/**
 * GET /api/push-config — expose only the public VAPID key.
 *
 * Uses the same VAPID key pair as scout-circulars so subscriptions
 * created here are addressable by the same notify.py dispatcher.
 */
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isValidVapidKey(value: string): boolean {
  return /^[A-Za-z0-9_-]{60,200}$/.test(value.trim());
}

export async function GET() {
  const vapidPublicKey = (process.env.VAPID_PUBLIC_KEY || '').trim();
  const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
  const supabaseKey = (process.env.SUPABASE_SERVICE_KEY || '').trim();

  const enabled = Boolean(supabaseUrl && supabaseKey && isValidVapidKey(vapidPublicKey));

  const body: Record<string, unknown> = { ok: true, enabled };
  if (enabled) {
    body.vapidPublicKey = vapidPublicKey;
  }

  return NextResponse.json(body, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
