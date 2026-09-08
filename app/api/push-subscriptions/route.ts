/**
 * POST /api/push-subscriptions — anonymous browser Web Push lifecycle.
 *
 * Stores / updates / deletes PushSubscription in Supabase (same table as
 * scout-circulars).  No PII collected — only the browser's encrypted
 * endpoint + a random client token hash.
 *
 * Required env vars (same as scout-circulars):
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY, VAPID_PUBLIC_KEY
 */
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_REQUEST_BYTES = 24 * 1024;
const MAX_ENDPOINT_LENGTH = 2048;
const MAX_CLIENT_TOKEN_LENGTH = 128;
const MAX_TOPICS = 60;

const ALLOWED_PUSH_HOSTS = new Set([
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'push.services.mozilla.com',
  'web.push.apple.com',
]);
const ALLOWED_PUSH_SUFFIXES = ['.push.services.mozilla.com', '.push.apple.com', '.notify.windows.com'];

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function isAllowedPushEndpoint(host: string): boolean {
  host = host.toLowerCase().replace(/\.$/, '');
  if (ALLOWED_PUSH_HOSTS.has(host)) return true;
  return ALLOWED_PUSH_SUFFIXES.some((s) => host.endsWith(s));
}

function validateEndpoint(value: unknown): string {
  const endpoint = String(value || '').trim();
  if (!endpoint || endpoint.length > MAX_ENDPOINT_LENGTH) throw new Error('瀏覽器通知地址無效');
  let parsed: URL;
  try { parsed = new URL(endpoint); } catch { throw new Error('瀏覽器通知地址無效'); }
  if (
    parsed.protocol !== 'https:' ||
    !parsed.hostname ||
    parsed.username ||
    parsed.password ||
    !isAllowedPushEndpoint(parsed.hostname)
  ) {
    throw new Error('這個瀏覽器通知服務未受支援');
  }
  return endpoint;
}

function validateKey(value: unknown, field: string, min: number, max: number): string {
  const v = String(value || '').trim();
  if (!new RegExp(`^[A-Za-z0-9_+/=-]{${min},${max}}$`).test(v)) {
    throw new Error(`瀏覽器通知金鑰 ${field} 無效`);
  }
  return v;
}

function validateSubscription(value: unknown): { endpoint: string; p256dh: string; auth: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('缺少瀏覽器通知資料');
  const keys = (value as Record<string, unknown>).keys;
  if (!keys || typeof keys !== 'object' || Array.isArray(keys)) throw new Error('缺少瀏覽器通知金鑰');
  return {
    endpoint: validateEndpoint((value as Record<string, unknown>).endpoint),
    p256dh: validateKey((keys as Record<string, unknown>).p256dh, 'p256dh', 40, 300),
    auth: validateKey((keys as Record<string, unknown>).auth, 'auth', 8, 128),
  };
}

function validateClientToken(value: unknown): string {
  const v = String(value || '').trim();
  if (!new RegExp(`^[A-Za-z0-9_-]{32,${MAX_CLIENT_TOKEN_LENGTH}}$`).test(v)) {
    throw new Error('本機通知識別碼無效，請重新設定');
  }
  return v;
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

// ── Subscription catalog (shared with scout-circulars) ─────────────
interface CatalogBranch { id: string; label: string }
interface CatalogTopic { id: string; label: string; kind: string; branches: string[]; [k: string]: unknown }
interface Catalog { version: string; branches: CatalogBranch[]; topics: CatalogTopic[]; _branchIds: Set<string>; _topicIds: Set<string> }

let catalogCache: Catalog | null = null;

function loadCatalog(): Catalog {
  if (catalogCache) return catalogCache;
  const catalogPath = join(process.cwd(), 'public', 'subscription_catalog.json');
  const raw = JSON.parse(readFileSync(catalogPath, 'utf8'));
  const branches: CatalogBranch[] = Array.isArray(raw.branches) ? raw.branches : [];
  const topics: CatalogTopic[] = Array.isArray(raw.topics) ? raw.topics : [];
  catalogCache = {
    version: String(raw.version || ''),
    branches,
    topics,
    _branchIds: new Set(branches.map((b) => String(b.id))),
    _topicIds: new Set(topics.map((t) => String(t.id))),
  };
  return catalogCache;
}

function validatePreferences(body: Record<string, unknown>): { branches: string[]; topics: string[]; catalogVersion: string } {
  const catalog = loadCatalog();
  const rawBranches = Array.isArray(body.branches) ? body.branches : [];
  const rawTopics = Array.isArray(body.topics) ? body.topics : [];

  const branches = rawBranches.filter((v) => typeof v === 'string' && catalog._branchIds.has(v)) as string[];
  const topics = rawTopics.filter((v) => typeof v === 'string' && catalog._topicIds.has(v)) as string[];

  if (topics.includes('all:new')) {
    return { branches: catalog.branches.map((b) => b.id), topics: ['all:new'], catalogVersion: catalog.version };
  }
  if (!branches.length) throw new Error('請至少選擇一個支部');
  if (!topics.length) throw new Error('請至少選擇一個關注項目');
  if (topics.length > MAX_TOPICS) throw new Error(`關注項目過多（最多 ${MAX_TOPICS} 個）`);

  // Validate topic-branch compatibility
  const topicById = new Map(catalog.topics.map((t) => [t.id, t]));
  const branchSet = new Set(branches);
  for (const topicId of topics) {
    const topic = topicById.get(topicId);
    if (!topic) continue;
    const scope = new Set(topic.branches || []);
    if (!scope.has('*') && !branches.some((b) => scope.has(b))) {
      throw new Error('所選項目不適用於已選支部');
    }
  }

  return { branches, topics, catalogVersion: catalog.version };
}

// ── Supabase helper ────────────────────────────────────────────────
async function supabaseRequest(
  method: string,
  resource: string,
  opts: { query?: Record<string, string>; payload?: unknown; prefer?: string } = {},
) {
  const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';
  if (!supabaseUrl || !supabaseKey) throw new Error('push_unavailable');

  let url = `${supabaseUrl}/rest/v1/${resource}`;
  if (opts.query) {
    const qs = new URLSearchParams(opts.query);
    url += '?' + qs.toString();
  }
  const headers: Record<string, string> = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    Accept: 'application/json',
  };
  if (opts.prefer) headers.Prefer = opts.prefer;
  if (opts.payload !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(url, {
    method: method.toUpperCase(),
    headers,
    body: opts.payload !== undefined ? JSON.stringify(opts.payload) : undefined,
    signal: AbortSignal.timeout(12_000),
  });
  return { status: response.status, body: await response.text() };
}

// ── Route handler ──────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  // Same-origin check
  const origin = request.headers.get('origin') || '';
  const host = request.headers.get('host') || '';
  if (origin) {
    try {
      const o = new URL(origin);
      if (o.host !== host) return json({ ok: false, error: 'origin_not_allowed', message: '只接受本站的通知設定請求' }, 403);
    } catch {
      return json({ ok: false, error: 'origin_not_allowed', message: '只接受本站的通知設定請求' }, 403);
    }
  }

  // Check config
  const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
  const supabaseKey = (process.env.SUPABASE_SERVICE_KEY || '').trim();
  const vapidKey = (process.env.VAPID_PUBLIC_KEY || '').trim();
  if (!supabaseUrl || !supabaseKey || !vapidKey) {
    return json({ ok: false, error: 'push_unavailable', message: '通知服務尚未完成設定' }, 503);
  }

  // Read body
  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > MAX_REQUEST_BYTES) return json({ ok: false, error: 'invalid_request', message: '通知設定資料大小無效' }, 413);
    body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('bad');
  } catch {
    return json({ ok: false, error: 'invalid_request', message: '通知設定不是有效 JSON' }, 400);
  }

  try {
    const action = String(body.action || '');
    const token = validateClientToken(body.clientToken);
    const tokenDigest = sha256(token);

    if (action === 'upsert') {
      const sub = validateSubscription(body.subscription);
      const { branches, topics, catalogVersion } = validatePreferences(body);
      const now = new Date().toISOString();
      const record = {
        endpoint_hash: sha256(sub.endpoint),
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth,
        client_token_hash: tokenDigest,
        branch_ids: branches,
        topic_ids: topics,
        catalog_version: catalogVersion,
        enabled: true,
        last_seen_at: now,
      };
      await supabaseRequest('POST', 'push_subscriptions', {
        query: { on_conflict: 'endpoint_hash' },
        payload: record,
        prefer: 'resolution=merge-duplicates,return=minimal',
      });
      return json({ ok: true, status: 'saved' }, 201);
    }

    if (action === 'delete') {
      const rawSub = body.subscription;
      const endpoint = validateEndpoint(
        rawSub && typeof rawSub === 'object' ? (rawSub as Record<string, unknown>).endpoint : body.endpoint,
      );
      await supabaseRequest('DELETE', 'push_subscriptions', {
        query: {
          endpoint_hash: `eq.${sha256(endpoint)}`,
          client_token_hash: `eq.${tokenDigest}`,
        },
        prefer: 'return=minimal',
      });
      return json({ ok: true, status: 'deleted' });
    }

    return json({ ok: false, error: 'invalid_action', message: '不支援的通知設定操作' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : '通知設定暫時無法處理';
    return json({ ok: false, error: 'server_error', message }, 500);
  }
}
