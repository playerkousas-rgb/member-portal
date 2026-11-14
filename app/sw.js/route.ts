import { SERVICE_WORKER_SOURCE } from '@/lib/serviceWorkerSource';

/**
 * `/sw.js` 由 route 產生，而唔係 `public/` 靜態檔：
 * 每次 build 嘅 NEXT_PUBLIC_PORTAL_BUILD_VERSION 都會寫入 SW 本文，
 * 令已加入主畫面嘅 PWA 靠 reg.update() 偵測到新 worker，同時用版本號
 * 開一個新嘅靜態資源 cache。更新流程只參考 BOOK「加入主畫面後唔使重裝
 * 就更新」嘅生命週期；其他部署／iframe／離線設定唔套用。
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUILD_VERSION = process.env.NEXT_PUBLIC_PORTAL_BUILD_VERSION || 'dev';

export function GET() {
  const body = SERVICE_WORKER_SOURCE.replace(
    '__PORTAL_BUILD_VERSION__',
    JSON.stringify(BUILD_VERSION),
  );
  return new Response(body, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      // SW 本身唔好被快取；配合 register 嘅 updateViaCache:'none'，更新檢查一定攞到最新本文。
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
