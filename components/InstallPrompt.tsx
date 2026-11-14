'use client';

import { useEffect, useState } from 'react';

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
    };
    const onInstalled = () => { setInstalled(true); setInstallEvent(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function install() {
    if (!installEvent) { setShowHelp(true); return; }
    try {
      await installEvent.prompt();
      await installEvent.userChoice;
    } catch {
      setShowHelp(true);
    } finally {
      setInstallEvent(null);
    }
  }

  if (installed) return null;
  return (
    <section className="panel install-panel" aria-labelledby="install-title">
      <div>
        <h2 id="install-title">📱 加入主畫面</h2>
      </div>
      <button type="button" className="btn-sm" onClick={install}>
        {installEvent ? '安裝服務平台' : '查看安裝方法'}
      </button>
      {showHelp && (
        <div className="install-help">
          <p><strong>iPhone／iPad：</strong>用 Safari 開啟本站，按「分享」→「加入主畫面」。</p>
          <p><strong>Android：</strong>用 Chrome 開啟本站，按選單 →「安裝應用程式」或「加到主畫面」。</p>
          <p><strong>電腦：</strong>在支援安裝嘅瀏覽器，使用網址列或選單內嘅安裝選項。</p>
          <p>選項名稱可能因瀏覽器而異；部分服務仍需網絡連線。</p>
        </div>
      )}
    </section>
  );
}
