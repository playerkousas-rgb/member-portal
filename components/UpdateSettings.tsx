'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PWA_UPDATE_EVENT, applyPwaUpdate, checkForPwaUpdate, registerPwa } from '@/lib/pwa';
import type { PwaUpdateDetail } from '@/lib/pwa';

const CURRENT_VERSION = process.env.NEXT_PUBLIC_PORTAL_BUILD_VERSION;
type Status = 'idle' | 'checking' | 'current' | 'available' | 'error';

/**
 * 平台更新設定（每個版面都有）。
 * 兩條偵測線：/api/version 版本號（舊 worker／冇 SW 都用到）＋ PWA worker waiting。
 * 任何一條見到新版都只會提示，交由用戶按「立即更新」先重載，唔會中斷未提交表格。
 */
export default function UpdateSettings() {
  const [status, setStatus] = useState<Status>('idle');
  const [pendingVersion, setPendingVersion] = useState('');
  const [fromWorker, setFromWorker] = useState(false);
  const [applying, setApplying] = useState(false);
  const workerPending = useRef(false);

  const markAvailable = useCallback((version = '', fromWorkerUpdate = false) => {
    if (fromWorkerUpdate) {
      workerPending.current = true;
      setFromWorker(true);
    }
    setPendingVersion(version);
    setStatus('available');
  }, []);

  const check = useCallback(async (manual = false) => {
    if (manual) setStatus('checking');
    try {
      const response = await fetch('/api/version', { cache: 'no-store' });
      if (!response.ok) throw new Error('version request failed');
      const data: unknown = await response.json();
      const version = (data && typeof data === 'object' && 'version' in data) ? data.version : null;
      if (!CURRENT_VERSION || typeof version !== 'string' || !version) throw new Error('invalid version');
      if (version !== CURRENT_VERSION) {
        markAvailable(version);
      } else if (manual) {
        setStatus(workerPending.current ? 'available' : 'current');
      } else {
        setStatus((current) => (current === 'available' ? current : 'idle'));
      }
    } catch {
      if (manual) setStatus(workerPending.current ? 'available' : 'error');
    }
    // 順便叫 service worker 查一次（前景／手動都用），離線時會靜靜失敗。
    void checkForPwaUpdate();
  }, [markAvailable]);

  useEffect(() => {
    registerPwa();
    void check();
    const timer = window.setInterval(() => { void check(); }, 5 * 60 * 1000);
    const onFocus = () => { void check(); };
    const onVisible = () => { if (document.visibilityState === 'visible') void check(); };
    const onWorkerUpdate = (event: Event) => {
      const detail = (event as CustomEvent<PwaUpdateDetail>).detail;
      markAvailable(detail?.version || '', true);
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(PWA_UPDATE_EVENT, onWorkerUpdate);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(PWA_UPDATE_EVENT, onWorkerUpdate);
    };
  }, [check, markAvailable]);

  function update() {
    setApplying(true);
    void applyPwaUpdate();
  }

  return (
    <div className="update-settings">
      <button type="button" className="btn-ghost" disabled={status === 'checking' || applying} onClick={() => void check(true)}>
        {status === 'checking' ? '檢查中…' : '檢查平台更新'}
      </button>
      <div role="status" aria-live="polite">
        {status === 'current' && '目前已是最新版本。'}
        {status === 'error' && '未能檢查更新，請確認網絡連線後重試。'}
        {status === 'available' && (
          <span>
            服務平台有新版本。請先儲存未完成資料，再按更新。{' '}
            {fromWorker
              ? '新版已準備好；按一下即切換，唔使重新加入主畫面或重新安裝。'
              : '已加入主畫面嘅 APP 唔使重新安裝。'}{' '}
            <button type="button" className="btn-sm" disabled={applying} onClick={update}>
              {applying ? '正在更新…' : '立即更新'}
            </button>
          </span>
        )}
        {pendingVersion && status === 'available' ? (
          <span className="update-version-hint">　版本 {pendingVersion.slice(0, 12)}</span>
        ) : null}
      </div>
    </div>
  );
}
