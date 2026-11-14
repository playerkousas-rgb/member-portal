'use client';

import { useCallback, useEffect, useState } from 'react';

const CURRENT_VERSION = process.env.NEXT_PUBLIC_PORTAL_BUILD_VERSION;
type Status = 'idle' | 'checking' | 'current' | 'available' | 'error';

export default function UpdateSettings() {
  const [status, setStatus] = useState<Status>('idle');

  const check = useCallback(async (manual = false) => {
    if (manual) setStatus('checking');
    try {
      const response = await fetch('/api/version', { cache: 'no-store' });
      if (!response.ok) throw new Error('version request failed');
      const data: unknown = await response.json();
      const version = (data && typeof data === 'object' && 'version' in data) ? data.version : null;
      if (!CURRENT_VERSION || typeof version !== 'string' || !version) throw new Error('invalid version');
      setStatus(version !== CURRENT_VERSION ? 'available' : manual ? 'current' : 'idle');
      // 本站 worker 負責推送，不快取頁面；檢查其更新，但不重設訂閱或其他資料。
      if ('serviceWorker' in navigator) {
        void navigator.serviceWorker.getRegistration('/').then(registration => registration?.update()).catch(() => {});
      }
    } catch { if (manual) setStatus('error'); }
  }, []);

  useEffect(() => {
    void check();
    const timer = window.setInterval(() => { void check(); }, 5 * 60 * 1000);
    const onFocus = () => { void check(); };
    window.addEventListener('focus', onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [check]);

  return (
    <div className="update-settings">
      <button type="button" className="btn-ghost" disabled={status === 'checking'} onClick={() => void check(true)}>
        {status === 'checking' ? '檢查中…' : '檢查平台更新'}
      </button>
      <div role="status" aria-live="polite">
        {status === 'current' && '目前已是最新版本。'}
        {status === 'error' && '未能檢查更新，請確認網絡連線後重試。'}
        {status === 'available' && (
          <span>服務平台有新版本。請先儲存未完成資料，再按更新。{' '}
            <button type="button" className="btn-sm" onClick={() => window.location.reload()}>立即更新</button>
          </span>
        )}
      </div>
    </div>
  );
}
