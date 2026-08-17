import { NextRequest, NextResponse } from 'next/server';
import { DISTRICTS } from '@/lib/district';
import type { DistrictInfo } from '@/lib/district';

/**
 * 公開成員系統唯一後端入口。
 *
 * 安全邊界：
 * - API Key 只由 server env 注入，永不回傳前端。
 * - 嚴格 action allowlist；登入、批核、改 status、管理資料等 action 一律不可轉發。
 * - 公開讀取資料再做欄位白名單，避免 CourseLinks key 或領袖聯絡資料外洩。
 * - 提交前檢查系統鎖定、honeypot、基本限流、body 大小及欄位白名單。
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GET_ACTIONS = new Set([
  'getConfig',
  'getSystem',
  'listCourseLinks',
  'listVenues',
  'listItems',
  'listActivityNotices',
]);

const POST_FIELDS: Record<string, string[]> = {
  submitVenueRequest: [
    'venueId', 'startDate', 'endDate', 'name', 'phone', 'email', 'troop', 'position', 'purpose',
  ],
  submitStockRequest: [
    'itemId', 'qty', 'purpose', 'borrowDate', 'returnDate', 'name', 'phone', 'email', 'troop', 'position',
  ],
  submitActivityNotice: [
    'year', 'section', 'nature', 'troop', 'activityName', 'startDateTime', 'endDateTime', 'location',
    'membersCount', 'leadersCount', 'parentsCount', 'leaderName', 'leaderPhone', 'leaderEmail', 'note',
  ],
  submitCourseReg: [
    'courseId', 'memberType', 'nameZh', 'nameEn', 'gender', 'dob', 'phone', 'email',
    'scoutDistrict', 'region', 'troop', 'scoutId', 'scoutPosition', 'extra',
    'guardianConsent', 'guardianName', 'guardianRelation', 'guardianPhone', 'guardianEmail',
    'leaderConsent', 'leaderName', 'leaderPosition', 'leaderEmail',
    'payMethod', 'payerName', 'payAccount', 'needReceipt', 'note',
    'receiptFileName', 'receiptMimeType', 'receiptDataUrl',
  ],
};

const REQUIRED_FIELDS: Record<string, string[]> = {
  submitVenueRequest: ['venueId', 'startDate', 'endDate', 'name', 'phone'],
  submitStockRequest: ['itemId', 'qty', 'borrowDate', 'returnDate', 'name', 'phone'],
  submitActivityNotice: ['section', 'nature', 'troop', 'activityName', 'startDateTime', 'endDateTime', 'location', 'leaderName', 'leaderPhone'],
  submitCourseReg: ['courseId', 'memberType', 'nameZh', 'phone', 'email', 'receiptDataUrl'],
};

const MAX_BODY_BYTES = 4_500_000;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 20;

type JsonRecord = Record<string, unknown>;
type RateEntry = { count: number; resetAt: number };

declare global {
  // Best-effort per-instance limiter. Production edge/CDN rate limiting can be added in front as a second layer.
  // eslint-disable-next-line no-var
  var __memberPortalRates: Map<string, RateEntry> | undefined;
}
const rateStore = globalThis.__memberPortalRates || new Map<string, RateEntry>();
globalThis.__memberPortalRates = rateStore;

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}
function text(value: unknown): string {
  return value == null ? '' : String(value);
}
function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function isActive(value: unknown): boolean {
  return !['FALSE', '0', 'NO', 'OFF'].includes(text(value).toUpperCase());
}
function publicUrl(value: unknown): string {
  const raw = text(value).trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

/** Apps Script 現有 public submit 會回 {ok:true,refCode}；GET 則多為 {ok:true,data}。 */
function normalizeUpstream(value: unknown): { ok: boolean; data?: unknown; error?: string } {
  const raw = asRecord(value);
  if (raw.ok === false || raw.error) {
    return { ok: false, error: text(raw.error) || '後台未能處理請求。' };
  }
  if (raw.ok === true && Object.prototype.hasOwnProperty.call(raw, 'data')) {
    return { ok: true, data: raw.data };
  }
  if (raw.ok === true) {
    const { ok: _ok, ...data } = raw;
    return { ok: true, data };
  }
  // 兼容舊版 public submit 直接回 {refCode}。
  if (Object.keys(raw).length) return { ok: true, data: raw };
  return { ok: false, error: '後台回應格式不正確。' };
}

function publicCourse(value: unknown) {
  const row = asRecord(value);
  return {
    courseId: text(row.courseId), title: text(row.title), badgeName: text(row.badgeName),
    section: text(row.section), courseNo: text(row.courseNo), sessionsText: text(row.sessionsText),
    eligibility: text(row.eligibility), fee: number(row.fee), originalFee: number(row.originalFee),
    subsidyNote: text(row.subsidyNote), deadline: text(row.deadline), quota: number(row.quota),
    filled: number(row.filled), venue: text(row.venue), noticeUrl: publicUrl(row.noticeUrl),
    contact: text(row.contact), active: isActive(row.active),
  };
}
function publicVenue(value: unknown) {
  const row = asRecord(value);
  return {
    venueId: text(row.venueId), name: text(row.name), location: text(row.location),
    capacity: number(row.capacity), note: text(row.note),
  };
}
function publicItem(value: unknown) {
  const row = asRecord(value);
  return {
    itemId: text(row.itemId), name: text(row.name), category: text(row.category),
    totalQty: number(row.totalQty), availableQty: number(row.availableQty),
    unit: text(row.unit), note: text(row.note),
  };
}
function publicNotice(value: unknown) {
  const row = asRecord(value);
  return {
    id: text(row.id), refCode: text(row.refCode), submittedAt: text(row.submittedAt),
    year: text(row.year), section: text(row.section), nature: text(row.nature),
    troop: text(row.troop), activityName: text(row.activityName),
    startDateTime: text(row.startDateTime), endDateTime: text(row.endDateTime),
    location: text(row.location), membersCount: number(row.membersCount),
    leadersCount: number(row.leadersCount), parentsCount: number(row.parentsCount),
    districtCode: text(row.districtCode),
    // 刻意不轉發 leaderName / leaderPhone / leaderEmail / note。
  };
}

function sanitizeGet(action: string, data: unknown): unknown {
  if (action === 'getConfig') {
    const row = asRecord(data);
    return { districtName: text(row.districtName), theme: text(row.theme), logoText: text(row.logoText) || '🧭' };
  }
  if (action === 'getSystem') {
    const row = asRecord(data);
    return {
      locked: row.locked === true || text(row.locked).toUpperCase() === 'TRUE',
      lockMessage: text(row.lockMessage) || '系統維護中，請稍後再試。',
    };
  }
  const rows = Array.isArray(data) ? data : [];
  if (action === 'listCourseLinks') {
    const today = new Date().toISOString().slice(0, 10);
    return rows.map(publicCourse).filter((course) =>
      course.courseId && course.title && course.active && (!course.deadline || course.deadline >= today));
  }
  if (action === 'listVenues') return rows.map(publicVenue).filter((venue) => venue.venueId && venue.name);
  if (action === 'listItems') return rows.map(publicItem).filter((item) => item.itemId && item.name);
  if (action === 'listActivityNotices') return rows.map(publicNotice).filter((notice) => notice.id && notice.activityName);
  return null;
}

function getDistrict(code: string): DistrictInfo | undefined {
  return (DISTRICTS as Record<string, DistrictInfo>)[code];
}
function getApiKey(code: string): string {
  return process.env[`MEMBER_${code}_APIKEY`] || '';
}

async function fetchGet(apiBase: string, apiKey: string, action: string, params: URLSearchParams = new URLSearchParams()) {
  const url = new URL(apiBase);
  url.searchParams.set('action', action);
  url.searchParams.set('apiKey', apiKey);
  params.forEach((value, key) => url.searchParams.set(key, value));
  const response = await fetch(url.toString(), {
    cache: 'no-store',
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
  });
  return parseUpstreamResponse(response);
}

async function fetchPost(apiBase: string, apiKey: string, action: string, payload: JsonRecord) {
  const response = await fetch(apiBase, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, apiKey, ...payload }),
    cache: 'no-store',
    redirect: 'follow',
    signal: AbortSignal.timeout(45_000),
  });
  return parseUpstreamResponse(response);
}

async function parseUpstreamResponse(response: Response) {
  const body = await response.text();
  if (/<!doctype html|<html/i.test(body)) {
    throw new Error('Apps Script 尚未設為公開 Web App。');
  }
  try {
    return normalizeUpstream(JSON.parse(body));
  } catch {
    throw new Error(`Apps Script 回應無法解析（HTTP ${response.status}）。`);
  }
}

function clientIp(request: NextRequest): string {
  return (request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown')
    .split(',')[0].trim().slice(0, 80);
}
function allowRate(ip: string): boolean {
  const now = Date.now();
  for (const [key, value] of rateStore) {
    if (value.resetAt <= now) rateStore.delete(key);
  }
  const current = rateStore.get(ip);
  if (!current || current.resetAt <= now) {
    rateStore.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (current.count >= RATE_MAX) return false;
  current.count += 1;
  return true;
}

function validateSubmission(action: string, body: JsonRecord): string {
  if (text(body._website).trim()) return '提交未能通過驗證。';
  const startedAt = number(body._startedAt);
  if (!startedAt || Date.now() - startedAt < 600 || startedAt > Date.now() + 60_000) {
    return '提交速度太快，請稍後再試。';
  }
  for (const field of REQUIRED_FIELDS[action] || []) {
    if (!text(body[field]).trim()) return '請填妥所有必填資料。';
  }
  for (const field of POST_FIELDS[action] || []) {
    if (field !== 'receiptDataUrl' && text(body[field]).length > 5_000) return '部分欄位內容過長。';
  }
  if (text(body.email).length > 254 || text(body.name).length > 120 || text(body.nameZh).length > 120) {
    return '部分欄位內容過長。';
  }
  if (action === 'submitStockRequest' && (number(body.qty) < 1 || number(body.qty) > 999)) {
    return '借用數量不正確。';
  }
  if (action === 'submitCourseReg') {
    const receipt = text(body.receiptDataUrl);
    if (!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(receipt)) return '入數紙格式不正確。';
    if (receipt.length > 3_800_000) return '入數紙檔案太大，請壓縮後再試。';
  }
  return '';
}

function pickPayload(action: string, body: JsonRecord): JsonRecord {
  const output: JsonRecord = {};
  for (const field of POST_FIELDS[action] || []) {
    if (body[field] !== undefined) output[field] = body[field];
  }
  return output;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const districtCode = text(searchParams.get('districtCode'));
  const action = text(searchParams.get('action'));

  if (!districtCode) return noStoreJson({ ok: false, error: 'Missing districtCode' }, 400);
  const district = getDistrict(districtCode);
  if (!district) return noStoreJson({ ok: false, error: 'Unknown district' }, 400);
  if (district.status === 'disabled') return noStoreJson({ ok: false, error: '此區服務現正暫停。' }, 503);
  if (!GET_ACTIONS.has(action)) return noStoreJson({ ok: false, error: '此公開系統不允許使用該 action。' }, 403);

  const apiKey = getApiKey(districtCode);
  if (!apiKey) return noStoreJson({ ok: false, error: '區會後台尚未完成連接。' }, 503);

  const allowedParams = new URLSearchParams();
  if (action === 'listActivityNotices') {
    ['year', 'section', 'nature'].forEach((key) => {
      const value = searchParams.get(key);
      if (value) allowedParams.set(key, value.slice(0, 80));
    });
  }

  try {
    const upstream = await fetchGet(district.apiBase, apiKey, action, allowedParams);
    if (!upstream.ok) return noStoreJson({ ok: false, error: upstream.error || '後台未能處理請求。' }, 502);
    return noStoreJson({ ok: true, data: sanitizeGet(action, upstream.data) });
  } catch (error) {
    return noStoreJson({ ok: false, error: error instanceof Error ? error.message : 'Proxy fetch failed' }, 502);
  }
}

export async function POST(request: NextRequest) {
  const declaredLength = number(request.headers.get('content-length'));
  if (declaredLength > MAX_BODY_BYTES) return noStoreJson({ ok: false, error: '提交內容太大。' }, 413);

  let rawBody = '';
  let body: JsonRecord = {};
  try {
    rawBody = await request.text();
    if (rawBody.length > MAX_BODY_BYTES) return noStoreJson({ ok: false, error: '提交內容太大。' }, 413);
    body = asRecord(JSON.parse(rawBody));
  } catch {
    return noStoreJson({ ok: false, error: '提交格式不正確。' }, 400);
  }

  const districtCode = text(body.districtCode);
  const action = text(body.action);
  const district = getDistrict(districtCode);
  if (!districtCode) return noStoreJson({ ok: false, error: 'Missing districtCode' }, 400);
  if (!district) return noStoreJson({ ok: false, error: 'Unknown district' }, 400);
  if (district.status === 'disabled') return noStoreJson({ ok: false, error: '此區服務現正暫停。' }, 503);
  if (!Object.prototype.hasOwnProperty.call(POST_FIELDS, action)) {
    return noStoreJson({ ok: false, error: '此公開系統不允許使用該 action。' }, 403);
  }

  const validationError = validateSubmission(action, body);
  if (validationError) return noStoreJson({ ok: false, error: validationError }, 400);
  if (!allowRate(clientIp(request))) return noStoreJson({ ok: false, error: '提交次數太多，請稍後再試。' }, 429);

  const apiKey = getApiKey(districtCode);
  if (!apiKey) return noStoreJson({ ok: false, error: '區會後台尚未完成連接。' }, 503);

  try {
    // UI 顯示鎖定之外，再於 server 強制檢查，避免直接呼叫 POST 繞過。
    const system = await fetchGet(district.apiBase, apiKey, 'getSystem');
    if (!system.ok) return noStoreJson({ ok: false, error: '未能確認系統狀態，請稍後再試。' }, 503);
    const state = asRecord(system.data);
    if (state.locked === true || text(state.locked).toUpperCase() === 'TRUE') {
      return noStoreJson({ ok: false, error: text(state.lockMessage) || '系統維護中，暫停提交。' }, 423);
    }

    const upstream = await fetchPost(district.apiBase, apiKey, action, pickPayload(action, body));
    if (!upstream.ok) return noStoreJson({ ok: false, error: upstream.error || '提交失敗。' }, 502);
    const result = asRecord(upstream.data);
    return noStoreJson({ ok: true, data: { refCode: text(result.refCode) } });
  } catch (error) {
    return noStoreJson({ ok: false, error: error instanceof Error ? error.message : 'Proxy fetch failed' }, 502);
  }
}
