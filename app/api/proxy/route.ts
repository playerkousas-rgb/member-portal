import { NextRequest, NextResponse } from 'next/server';
import { DISTRICTS } from '@/lib/district';

/**
 * 成員服務門戶 — API Proxy
 * 前端唔直接 call Apps Script；API Key 存 Vercel env（MEMBER_{區碼}_APIKEY）。
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const districtCode = searchParams.get('districtCode');
  const action = searchParams.get('action') || 'getPublicInfo';

  if (!districtCode) return NextResponse.json({ ok: false, error: 'Missing districtCode' }, { status: 400 });
  const district = DISTRICTS[districtCode as keyof typeof DISTRICTS];
  if (!district) return NextResponse.json({ ok: false, error: 'Unknown district' }, { status: 400 });

  const apiKey = process.env[`MEMBER_${districtCode}_APIKEY`] || '';
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: `District API Key not set (need env var MEMBER_${districtCode}_APIKEY)` }, { status: 500 });
  }

  const url = new URL(district.apiBase);
  url.searchParams.set('action', action);
  url.searchParams.set('apiKey', apiKey);
  searchParams.forEach((value, key) => {
    if (key !== 'districtCode' && key !== 'action') url.searchParams.set(key, value);
  });

  try {
    const res = await fetch(url.toString(), { cache: 'no-store' });
    const text = await res.text();
    if (/<!doctype html|<html/i.test(text)) {
      return NextResponse.json({ ok: false, error: 'Apps Script not public (Deploy → Anyone)' }, { status: 502 });
    }
    return NextResponse.json(JSON.parse(text));
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'Proxy fetch failed' }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { districtCode, action, ...rest } = body;

  if (!districtCode) return NextResponse.json({ ok: false, error: 'Missing districtCode' }, { status: 400 });
  const district = DISTRICTS[districtCode as keyof typeof DISTRICTS];
  if (!district) return NextResponse.json({ ok: false, error: 'Unknown district' }, { status: 400 });

  const apiKey = process.env[`MEMBER_${districtCode}_APIKEY`] || '';
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: `District API Key not set (need env var MEMBER_${districtCode}_APIKEY)` }, { status: 500 });
  }

  const postBody = { action, apiKey, ...rest };
  try {
    const res = await fetch(district.apiBase, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(postBody),
    });
    const text = await res.text();
    if (/<!doctype html|<html/i.test(text)) {
      return NextResponse.json({ ok: false, error: 'Apps Script not public (Deploy → Anyone)' }, { status: 502 });
    }
    return NextResponse.json(JSON.parse(text));
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'Proxy fetch failed' }, { status: 502 });
  }
}
