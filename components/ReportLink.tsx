'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Scout Admin 統一回報系統（scout-admin widget）嘅入口掣。
 *
 * widget（https://scout-admin-blue.vercel.app/widget.js）會喺 <body> 掛：
 *   #scoutw-fab（浮動掣，本站已用 CSS 隱藏）＋ #scoutw-overlay（回報表格 modal）
 * 呢個組件就係代 #scoutw-fab 打開個 modal，等個入口可以放喺「查詢」隔離。
 * widget 未載入完就㩒，會等併載入完成先自動打開；
 * 等極都載入唔到（例如網絡問題）就跌去 scout-admin 嘅獨立回報頁。
 */

// 與 app/layout.tsx 載入 widget 時嘅 data-app 保持一致
const REPORT_SOURCE_APP = '成員系統';
const REPORT_STANDALONE_URL = `https://scout-admin-blue.vercel.app/report.html?app=${encodeURIComponent(REPORT_SOURCE_APP)}`;
const WIDGET_WAIT_MS = 150;
const WIDGET_MAX_TRIES = 34; // 約 5 秒

export function openScoutReport(): boolean {
  if (typeof document === 'undefined') return false;
  const overlay = document.getElementById('scoutw-overlay');
  if (overlay) {
    overlay.classList.add('open');
    return true;
  }
  const fab = document.getElementById('scoutw-fab');
  if (fab) {
    (fab as HTMLElement).click();
    return true;
  }
  return false;
}

export default function ReportLink({
  className,
  title = '問題回報 · 意見回饋',
  children,
}: {
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  const [pending, setPending] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  function handleClick() {
    if (openScoutReport()) return;
    if (timerRef.current) return; // 已經喺度等緊 widget
    setPending(true);
    let tries = 0;
    timerRef.current = setInterval(() => {
      tries += 1;
      if (openScoutReport()) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        setPending(false);
        return;
      }
      if (tries >= WIDGET_MAX_TRIES) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        setPending(false);
        window.open(REPORT_STANDALONE_URL, '_blank', 'noopener');
      }
    }, WIDGET_WAIT_MS);
  }

  return (
    <button type="button" className={className} title={title} aria-label={title} onClick={handleClick}>
      {children}
    </button>
  );
}
