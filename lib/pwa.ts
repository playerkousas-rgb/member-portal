/**
 * PWA 註冊、前景查更新同「一按更新」協定。
 *
 * 【只參考 BOOK 嘅呢一部分】：已加入主畫面嘅 APP 點樣唔使刪除重裝就換新版
 * （版本化 SW → waiting → SKIP_WAITING → reload）。其他部署／iframe／離線
 * 設定唔跟；本站嘅靜態資源快取係按載入速度需求自己實作。
 *
 * 全流程唔使刪除 APP、唔使重新加入主畫面、唔使重新下載安裝包：
 *   1. 每次 build 嘅 /sw.js 內容唔同（見 app/sw.js/route.ts）；
 *   2. 開頁／回前景／重新連線／每 30 分鐘 reg.update()，新 worker 裝好會停喺 waiting；
 *   3. 派 `member-portal:pwa-update`，UI 彈「有新版本 → 立即更新」；
 *   4. 用戶按一下先 postMessage SKIP_WAITING → activate → controllerchange → reload。
 *
 * 本站有大量未提交表格，所以【唔會】靜靜自動重載：只喺用戶明確按更新後先重載。
 */
export const PWA_UPDATE_EVENT = 'member-portal:pwa-update';
const CHECK_INTERVAL_MS = 30 * 60 * 1000;
const FALLBACK_RELOAD_MS = 3000;

export interface PwaUpdateDetail { version?: string }

let registration: ServiceWorkerRegistration | null = null;
let checkTimer: number | null = null;
let started = false;
let refreshing = false;
let updateRequested = false;

function supported(): boolean {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}

/** 搵伺服器上目前嘅 build 版本，純粹用嚟顯示／除錯，唔影響更新判斷。 */
async function peekRemoteVersion(): Promise<string> {
  try {
    const response = await fetch('/api/version', { cache: 'no-store' });
    if (!response.ok) return '';
    const data = await response.json();
    return data && typeof data.version === 'string' ? data.version : '';
  } catch {
    return '';
  }
}

function announce(version = ''): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<PwaUpdateDetail>(PWA_UPDATE_EVENT, { detail: { version } }));
}

async function checkWaiting(reg: ServiceWorkerRegistration | null | undefined): Promise<void> {
  if (reg?.waiting && navigator.serviceWorker.controller) announce(await peekRemoteVersion());
}

/** 主動查更新（前景／連線／計時器／手動檢查都用同一個入口）。 */
export async function checkForPwaUpdate(): Promise<void> {
  if (!supported()) return;
  try {
    const reg = registration || await navigator.serviceWorker.getRegistration('/');
    if (!reg) return;
    await reg.update();
    await checkWaiting(reg);
  } catch {
    /* 離線或唔支援 SW：核心功能照常，只是暫時冇更新提示 */
  }
}

function watch(reg: ServiceWorkerRegistration): void {
  registration = reg;
  void checkWaiting(reg);
  reg.addEventListener('updatefound', () => {
    const installing = reg.installing;
    if (!installing) return;
    installing.addEventListener('statechange', () => {
      // 已有 controller 先算「版本交替」；首次安裝唔應該彈更新提示。
      if (installing.state === 'installed' && navigator.serviceWorker.controller) {
        void peekRemoteVersion().then(announce);
      }
    });
  });
}

export function registerPwa(): void {
  if (!supported() || started) return;
  started = true;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // 只有用戶撳過「立即更新」先自動重載，避免無故中斷未提交表格。
    if (!updateRequested || refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  const start = async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
      watch(reg);
      await checkForPwaUpdate();
    } catch {
      /* 非安全 origin／私密視窗：照常當普通網站用 */
    }
  };
  if (document.readyState === 'complete') void start();
  else window.addEventListener('load', () => { void start(); }, { once: true });

  const onVisible = () => {
    if (document.visibilityState === 'visible') void checkForPwaUpdate();
  };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onVisible);
  window.addEventListener('online', onVisible);
  if (checkTimer !== null) window.clearInterval(checkTimer);
  checkTimer = window.setInterval(onVisible, CHECK_INTERVAL_MS);
}

/** 用戶按「立即更新」：叫 waiting worker 接手；冇 waiting 就普通重載攞新版 HTML。 */
export async function applyPwaUpdate(): Promise<void> {
  updateRequested = true;
  const fallbackReload = () => {
    window.setTimeout(() => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    }, FALLBACK_RELOAD_MS);
  };
  try {
    if (supported()) {
      const reg = registration || await navigator.serviceWorker.getRegistration('/');
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        fallbackReload();
        return;
      }
      if (reg) {
        await reg.update();
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          fallbackReload();
          return;
        }
      }
    }
  } catch {
    /* 落到下面直接重載 */
  }
  if (!refreshing) {
    refreshing = true;
    window.location.reload();
  }
}
