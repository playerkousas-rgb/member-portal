'use client';
import { useEffect, useState } from 'react';

/**
 * 個人化通告通知設定。

 * 接入通告圖書館同一個 Supabase 訂閱資料庫 —
 * 成員只需喺呢邊訂閱，notify.py 推送時自然會推埋呢邊。
 */

interface CatalogBranch { id: string; label: string }
interface CatalogTopic { id: string; label: string; kind: string; branches: string[]; group?: string; section?: string; subgroup?: string }
interface Catalog { version: string; branches: CatalogBranch[]; topics: CatalogTopic[] }

interface PushStatus {
  supported: boolean;
  needsHomeScreen: boolean;
  permission: string;
  subscribed: boolean;
  enabledLocally: boolean;
  preferences: { branches: string[]; topics: string[] } | null;
}

const PICK_ALL_ID = 'all:new';

export default function PushSettings() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [pushStatus, setPushStatus] = useState<PushStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [statusMsg, setStatusMsg] = useState('');
  const [statusTone, setStatusTone] = useState<'good' | 'warn' | 'error' | ''>('');
  const [busy, setBusy] = useState(false);

  // Load catalog + status on mount
  useEffect(() => {
    fetch('/subscription_catalog.json', { cache: 'no-store' })
      .then((r) => r.json())
      .then((c: Catalog) => {
        setCatalog(c);
        // Load saved preferences
        try {
          const raw = localStorage.getItem('scl_push_preferences_v1');
          if (raw) {
            const prefs = JSON.parse(raw);
            setSelectedBranches(prefs.branches || []);
            setSelectedTopics(prefs.topics || []);
          }
        } catch { /* ignore */ }
      })
      .catch(() => {});

    // Load push status
    const script = document.createElement('script');
    script.src = '/push-client.js';
    script.onload = () => {
      if ((window as any).MemberPushClient) {
        (window as any).MemberPushClient.status().then((s: PushStatus) => {
          setPushStatus(s);
          if (s.preferences) {
            setSelectedBranches(s.preferences.branches || []);
            setSelectedTopics(s.preferences.topics || []);
          }
        });
      }
    };
    document.head.appendChild(script);
  }, []);

  const isActive = pushStatus?.enabledLocally && pushStatus?.subscribed && pushStatus?.permission === 'granted';
  const isAllNew = selectedTopics.includes(PICK_ALL_ID);

  function toggleBranch(id: string) {
    if (isAllNew) return;
    setSelectedBranches((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id],
    );
  }

  function toggleTopic(id: string) {
    if (id === PICK_ALL_ID) {
      setSelectedTopics((prev) => prev.includes(PICK_ALL_ID) ? [] : [PICK_ALL_ID]);
      return;
    }
    if (isAllNew) return;
    setSelectedTopics((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  }

  function topicCount() {
    if (isAllNew) return 999;
    return selectedTopics.length;
  }

  async function handleSave() {
    const client = (window as any).MemberPushClient;
    if (!client) { setStatusMsg('通知程式未能載入。'); setStatusTone('error'); return; }
    setBusy(true);
    try {
      const prefs = { branches: selectedBranches, topics: selectedTopics };
      const result = await client.savePreferences(prefs);
      setStatusMsg('已儲存在這個瀏覽器。');
      setStatusTone('good');
      const s = await client.status();
      setPushStatus(s);
    } catch (err: any) {
      setStatusMsg(err?.message || '儲存失敗。');
      setStatusTone('error');
    } finally { setBusy(false); }
  }

  async function handleEnable() {
    const client = (window as any).MemberPushClient;
    if (!client) { setStatusMsg('通知程式未能載入。'); setStatusTone('error'); return; }
    setBusy(true);
    try {
      const prefs = { branches: selectedBranches, topics: selectedTopics };
      const result = await client.enable(prefs);
      setStatusMsg('已啟用通知！');
      setStatusTone('good');
      const s = await client.status();
      setPushStatus(s);
    } catch (err: any) {
      setStatusMsg(err?.message || '啟用失敗。');
      setStatusTone(err?.message?.includes('權限') ? 'warn' : 'error');
    } finally { setBusy(false); }
  }

  async function handleDisable() {
    if (!confirm('停止這部裝置的通告通知？')) return;
    const client = (window as any).MemberPushClient;
    if (!client) return;
    setBusy(true);
    try {
      await client.disable();
      setStatusMsg('已停止通知。');
      setStatusTone('good');
      const s = await client.status();
      setPushStatus(s);
    } catch (err: any) {
      setStatusMsg(err?.message || '停止失敗。');
      setStatusTone('warn');
    } finally { setBusy(false); }
  }

  // Badge: show topic count or active state
  const badgeText = isActive ? `🔔 通知 (${topicCount() > 100 ? '全部' : topicCount()})` : '🔔 通知';

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '8px 14px', borderRadius: 999, border: `1.5px solid ${isActive ? '#22c55e' : 'var(--line)'}`,
          background: isActive ? 'rgba(34,197,94,.15)' : 'var(--bg)',
          color: isActive ? '#16a34a' : 'var(--muted)', cursor: 'pointer', fontSize: 13, fontWeight: 600,
        }}
      >
        {badgeText}
      </button>

      {/* Settings panel */}
      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div style={{
            width: 'min(600px, 100%)', maxHeight: 'calc(100vh - 32px)', overflow: 'auto',
            borderRadius: 16, padding: 20, background: 'var(--bg)', border: '1px solid var(--line)',
            boxShadow: '0 18px 40px rgba(0,0,0,.28)',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17 }}>🔔 通告推送通知</h3>
                <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 12, lineHeight: 1.5 }}>
                  訂閱後，通告圖書館有新通告時會自動推送到這部裝置。<br />
                  匿名訂閱 — 不收集任何個人資料。
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 18, color: 'var(--muted)' }}
                aria-label="關閉"
              >×</button>
            </div>

            {/* iOS home screen hint */}
            {pushStatus?.needsHomeScreen && (
              <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.3)', color: '#f59e0b', fontSize: 13, marginBottom: 12 }}>
                📱 請先用 Safari 將本站「加入主畫面」，再從圖示開啟，才可啟用通知（iOS 16.4+）。
              </div>
            )}

            {/* Testing notice */}
            <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.25)', color: '#93c5fd', fontSize: 12, marginBottom: 14 }}>
              <strong>通知系統測試中：</strong>推送可能延遲或遺漏，建議每天到圖書館瀏覽有沒有通告更新。
            </div>

            {/* All new toggle */}
            <div style={{ marginBottom: 14 }}>
              <label style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                padding: '6px 12px', borderRadius: 999, fontSize: 13,
                border: `1px solid ${isAllNew ? '#f59e0b' : 'var(--line)'}`,
                background: isAllNew ? 'rgba(245,158,11,.15)' : 'transparent',
                color: isAllNew ? '#f59e0b' : 'var(--muted)',
              }}>
                <input
                  type="checkbox"
                  checked={isAllNew}
                  onChange={() => toggleTopic(PICK_ALL_ID)}
                  style={{ display: 'none' }}
                />
                <span style={{
                  width: 18, height: 18, borderRadius: 4, border: '1px solid currentColor',
                  display: 'inline-grid', placeItems: 'center', fontSize: 11,
                  background: isAllNew ? 'currentColor' : 'transparent', color: isAllNew ? '#1a1205' : 'transparent',
                }}>✓</span>
                全選：所有新通告
              </label>
            </div>

            {/* Branches */}
            {!isAllNew && catalog && (
              <>
                <div style={{ marginBottom: 10, fontSize: 13, fontWeight: 700, color: '#d9e8ff' }}>
                  我的支部 <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 11 }}>可多選</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                  {catalog.branches.map((b) => {
                    const checked = selectedBranches.includes(b.id);
                    return (
                      <label
                        key={b.id}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                          padding: '5px 10px', borderRadius: 999, fontSize: 12,
                          border: `1px solid ${checked ? '#22c55e' : 'var(--line)'}`,
                          background: checked ? 'rgba(34,197,94,.15)' : 'transparent',
                          color: checked ? '#22c55e' : 'var(--muted)',
                          fontWeight: checked ? 700 : 400,
                        }}
                      >
                        <input type="checkbox" checked={checked} onChange={() => toggleBranch(b.id)} style={{ display: 'none' }} />
                        <span style={{
                          width: 15, height: 15, borderRadius: 4, border: '1px solid currentColor',
                          display: 'inline-grid', placeItems: 'center', fontSize: 10,
                          background: checked ? 'currentColor' : 'transparent', color: checked ? '#15803d' : 'transparent',
                        }}>✓</span>
                        {b.label}
                      </label>
                    );
                  })}
                </div>

                {/* Topics (branch-specific) */}
                {selectedBranches.length > 0 && (
                  <>
                    <div style={{ marginBottom: 10, fontSize: 13, fontWeight: 700, color: '#d9e8ff' }}>
                      關注項目 <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 11 }}>已選支部的可用項目</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                      {catalog.topics
                        .filter((t) => t.branches.includes('*') || t.branches.some((b) => selectedBranches.includes(b)))
                        .filter((t) => t.kind === 'branch-topic' || t.kind === 'training')
                        .map((t) => {
                          const checked = selectedTopics.includes(t.id);
                          return (
                            <label
                              key={t.id}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                                padding: '5px 10px', borderRadius: 999, fontSize: 12,
                                border: `1px solid ${checked ? '#3b82f6' : 'var(--line)'}`,
                                background: checked ? 'rgba(59,130,246,.15)' : 'transparent',
                                color: checked ? '#3b82f6' : 'var(--muted)',
                                fontWeight: checked ? 700 : 400,
                              }}
                            >
                              <input type="checkbox" checked={checked} onChange={() => toggleTopic(t.id)} style={{ display: 'none' }} />
                              <span style={{
                                width: 15, height: 15, borderRadius: 4, border: '1px solid currentColor',
                                display: 'inline-grid', placeItems: 'center', fontSize: 10,
                                background: checked ? 'currentColor' : 'transparent', color: checked ? '#1d4ed8' : 'transparent',
                              }}>✓</span>
                              {t.label}
                            </label>
                          );
                        })}
                    </div>
                  </>
                )}
              </>
            )}

            {/* How to receive */}
            <div style={{ marginBottom: 14, fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
              <div style={{ fontWeight: 700, color: '#d9e8ff', marginBottom: 4 }}>如何收到通知</div>
              <ul style={{ paddingLeft: 18, margin: 0 }}>
                <li><strong>手機：</strong>先加入主畫面，再從圖示開啟按「啟用通知」。
                  <ul style={{ paddingLeft: 16, marginTop: 2 }}>
                    <li>iPhone：Safari → 分享 →「加入主畫面」（iOS 16.4+）</li>
                    <li>Android：Chrome ⋮ →「加到主畫面」</li>
                  </ul>
                </li>
                <li><strong>電腦：</strong>按「啟用通知」選「允許」。</li>
              </ul>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <span style={{ flex: 1, fontSize: 12, color: 'var(--muted)' }}>
                {isAllNew ? '全選：有新通告就通知' : `已選 ${selectedBranches.length} 個支部・${selectedTopics.length} 個項目`}
              </span>
              <button
                onClick={handleSave}
                disabled={busy || (!isAllNew && (!selectedBranches.length || !selectedTopics.length))}
                style={{
                  padding: '8px 14px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13,
                  border: '1px solid var(--line)', background: '#12213a', color: '#d9e8ff',
                  opacity: busy ? 0.5 : 1,
                }}
              >只儲存選項</button>
              <button
                onClick={handleEnable}
                disabled={busy || pushStatus?.needsHomeScreen || (!isAllNew && (!selectedBranches.length || !selectedTopics.length))}
                style={{
                  padding: '8px 14px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13,
                  border: '1px solid #60a5fa', background: 'linear-gradient(135deg,#1d4ed8,#3b82f6)', color: '#fff',
                  opacity: busy ? 0.5 : 1,
                }}
              >{isActive ? '更新通知設定' : '啟用通知'}</button>
              {pushStatus?.subscribed && (
                <button
                  onClick={handleDisable}
                  disabled={busy}
                  style={{
                    padding: '8px 14px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13,
                    border: '1px solid rgba(248,113,113,.55)', background: 'rgba(127,29,29,.26)', color: '#fecaca',
                    opacity: busy ? 0.5 : 1,
                  }}
                >停止通知</button>
              )}
            </div>

            {/* Status message */}
            {statusMsg && (
              <div style={{
                marginTop: 10, fontSize: 12, lineHeight: 1.5,
                color: statusTone === 'good' ? '#86efac' : statusTone === 'warn' ? '#fcd34d' : '#fca5a5',
              }}>
                {statusMsg}
              </div>
            )}

            {/* Privacy note */}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(59,130,246,.2)', color: 'var(--muted)', fontSize: 11, lineHeight: 1.5 }}>
              私隱：設定先留在本機 LocalStorage，訂閱只存加密端點，不收集任何個人資料。與通告圖書館共用同一個推送系統。
            </div>
          </div>
        </div>
      )}
    </>
  );
}
