'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Announcement } from '@/lib/types';

const LS_KEY = 'ann_last_seen_id';

/** 取得上次見過的最新公告 id */
function getLastSeenId(): string {
  if (typeof window === 'undefined') return '';
  try { return localStorage.getItem(LS_KEY) || ''; } catch { return ''; }
}
function setLastSeenId(id: string) {
  try { localStorage.setItem(LS_KEY, id); } catch { /* ignore */ }
}

/** 通知等級對應樣式 */
const LEVEL_STYLES: Record<Announcement['level'], { bg: string; border: string; icon: string }> = {
  important: { bg: '#fef2f2', border: '#dc2626', icon: '🔴' },
  warning:   { bg: '#fffbeb', border: '#d97706', icon: '🟡' },
  info:      { bg: '#eff6ff', border: '#3b82f6', icon: '🔵' },
};

/**
 * ① 置頂顯示 — pinned 公告顯示喺首頁最頂部
 * ② 開 app 通知 — 有新公告時用 Notification API 彈瀏覽器通知
 */
export default function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [hasNew, setHasNew] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    api.listAnnouncements().then((result) => {
      if (cancelled || !result.ok || !result.data) return;
      const all = result.data;
      // 只顯示 pinned 嘅
      const pinned = all.filter((a) => a.pinned);
      setAnnouncements(pinned);

      // 方案 ②：檢查有冇新公告（比較 id）
      const lastSeen = getLastSeenId();
      if (all.length > 0) {
        const newestId = all[0].id; // 已按 date 降序排
        if (lastSeen && newestId !== lastSeen) {
          setHasNew(true);
          // 彈瀏覽器通知
          fireNotification(all, lastSeen);
        }
        setLastSeenId(newestId);
      }
    });
    return () => { cancelled = true; };
  }, []);

  if (announcements.length === 0) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      {hasNew && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 14px', marginBottom: 10,
          background: '#fef9c3', borderRadius: 8, fontSize: 13, color: '#92400e',
        }}>
          <span>🔔 有新消息！瀏覽器通知已自動彈出。</span>
          <button
            onClick={() => setHasNew(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#92400e' }}
            aria-label="關閉提示"
          >✕</button>
        </div>
      )}

      {announcements.map((ann) => {
        const style = LEVEL_STYLES[ann.level];
        const isOpen = expanded[ann.id] ?? false;
        return (
          <div
            key={ann.id}
            style={{
              background: style.bg,
              border: `2px solid ${style.border}`,
              borderRadius: 10,
              padding: '12px 16px',
              marginBottom: 8,
            }}
          >
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: ann.content ? 'pointer' : 'default' }}
              onClick={() => {
                if (ann.content) setExpanded((prev) => ({ ...prev, [ann.id]: !prev[ann.id] }));
              }}
            >
              <span style={{ fontSize: 16 }}>{style.icon}</span>
              <strong style={{ flex: 1, fontSize: 15 }}>{ann.title}</strong>
              <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>{formatDate(ann.date)}</span>
              {ann.content ? (
                <span style={{ fontSize: 12, color: '#6b7280' }}>{isOpen ? '▲' : '▼'}</span>
              ) : null}
            </div>
            {isOpen && ann.content && (
              <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6, color: '#374151', whiteSpace: 'pre-wrap' }}>
                {ann.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** 計算自上次以來的新公告，彈 Notification API */
function fireNotification(all: Announcement[], lastSeenId: string) {
  if (typeof Notification === 'undefined') return;
  const idx = all.findIndex((a) => a.id === lastSeenId);
  const fresh = idx >= 0 ? all.slice(0, idx) : all.slice(0, 3); // 最多顯示 3 則
  if (!fresh.length) return;

  // 如果已授權或可以自動授權
  const show = () => {
    for (const ann of fresh) {
      new Notification(`📢 ${ann.title}`, {
        body: ann.content || `日期：${formatDate(ann.date)}`,
        icon: '/favicon.ico',
        tag: `ann-${ann.id}`, // 避免重複
      });
    }
  };

  if (Notification.permission === 'granted') {
    show();
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((perm) => {
      if (perm === 'granted') show();
    });
  }
}

function formatDate(d: string): string {
  if (!d) return '';
  // 支持 YYYY-MM-DD 或完整 ISO
  const match = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}/${match[2]}/${match[3]}`;
  return d;
}
