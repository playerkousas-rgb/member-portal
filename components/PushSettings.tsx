'use client';
import { useEffect, useMemo, useState } from 'react';

/**
 * 個人化「通告」通知設定。
 *
 * 接入通告圖書館同一個 Supabase 訂閱資料庫 —
 * 成員只需喺呢邊訂閱，notify.py 推送時自然會推埋呢邊。
 *
 * 選單內容全部由 /subscription_catalog.json 提供（與圖書館共用同一份字典）：
 * 支部 → 活動／服務／比賽，訓練可以只揀自己有興趣嘅個別項目，
 * 唔需要一次過訂閱「所有支部訓練」。
 */

interface CatalogBranch { id: string; label: string }
interface CatalogTopic {
  id: string;
  label: string;
  kind: string;
  branches: string[];
  group?: string;
  section?: string;
  subgroup?: string;
}
interface Catalog { version: string; branches: CatalogBranch[]; topics: CatalogTopic[] }

interface PushStatus {
  supported: boolean;
  needsHomeScreen: boolean;
  permission: string;
  subscribed: boolean;
  enabledLocally: boolean;
  preferences: { branches: string[]; topics: string[] } | null;
}

/** 必須同 app/api/push-subscriptions/route.ts 嘅 MAX_TOPICS 保持一致 */
const MAX_TOPICS = 60;
const PICK_ALL_ID = 'all:new';

type Tone = 'green' | 'blue' | 'amber';

/** 淺色底下的高對比配色（字色一律用深色，避免字色貼近底色睇唔清楚） */
const TONES: Record<Tone, { fg: string; bg: string; bd: string }> = {
  green: { fg: '#15803d', bg: '#e7f7ed', bd: '#8ed0a6' },
  blue:  { fg: '#1d4ed8', bg: '#e8f0ff', bd: '#9dbdf6' },
  amber: { fg: '#a4530a', bg: '#fdf3e2', bd: '#eec47c' },
};

const CHIP_ROW: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 6 };
const MUTED_LINE: React.CSSProperties = { fontSize: 11.5, color: 'var(--muted)', margin: '10px 0 6px' };

/** 單一選項（活動／服務／比賽／訓練項目） */
function Chip({
  checked, onToggle, label, tone = 'blue', disabled,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  tone?: Tone;
  disabled?: boolean;
}) {
  const c = TONES[tone];
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={checked}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, cursor: disabled ? 'not-allowed' : 'pointer',
        padding: '5px 11px', borderRadius: 999, fontSize: 12.5, lineHeight: 1.4,
        fontFamily: 'inherit', whiteSpace: 'nowrap',
        border: `1px solid ${checked ? c.bd : 'var(--line)'}`,
        background: checked ? c.bg : '#fff',
        color: checked ? c.fg : '#475569',
        fontWeight: checked ? 700 : 400,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 15, height: 15, borderRadius: 4, flex: '0 0 auto',
          border: `1px solid ${checked ? c.fg : '#cbd5e1'}`,
          background: checked ? c.fg : '#fff',
          color: '#fff', display: 'inline-grid', placeItems: 'center',
          fontSize: 10, fontWeight: 900, lineHeight: 1,
        }}
      >{checked ? '✓' : ''}</span>
      {label}
    </button>
  );
}

export default function PushSettings() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogFailed, setCatalogFailed] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [statusMsg, setStatusMsg] = useState('');
  const [statusTone, setStatusTone] = useState<'good' | 'warn' | 'error' | ''>('');
  const [busy, setBusy] = useState(false);

  // Load catalog + status on mount
  useEffect(() => {
    fetch('/subscription_catalog.json', { cache: 'no-store' })
      .then((r) => r.json())
      .then((c: Catalog) => {
        setCatalog(c);
        setCatalogFailed(false);
        try {
          const raw = localStorage.getItem('scl_push_preferences_v1');
          if (raw) {
            const prefs = JSON.parse(raw);
            setSelectedBranches(prefs.branches || []);
            setSelectedTopics(prefs.topics || []);
          }
        } catch { /* ignore */ }
      })
      .catch(() => setCatalogFailed(true));

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

  // Esc 關閉設定面板
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const topicById = useMemo(() => {
    const map = new Map<string, CatalogTopic>();
    for (const t of catalog?.topics || []) map.set(t.id, t);
    return map;
  }, [catalog]);

  const isActive = pushStatus?.enabledLocally && pushStatus?.subscribed && pushStatus?.permission === 'granted';
  const isAllNew = selectedTopics.includes(PICK_ALL_ID);
  const atLimit = selectedTopics.length >= MAX_TOPICS;

  /** 某個支部可用嘅項目 */
  function topicsForBranch(topics: CatalogTopic[], branchId: string) {
    return topics.filter((t) => t.branches.includes('*') || t.branches.includes(branchId));
  }

  function toggleBranch(id: string) {
    if (isAllNew) return;
    const next = selectedBranches.includes(id)
      ? selectedBranches.filter((b) => b !== id)
      : [...selectedBranches, id];
    setSelectedBranches(next);
    // 取消支部時，清走只屬於該支部嘅項目
    if (!next.includes(id)) {
      setSelectedTopics((prev) => prev.filter((topicId) => {
        const topic = topicById.get(topicId);
        if (!topic || topic.branches.includes('*')) return true;
        return topic.branches.some((b) => next.includes(b));
      }));
    }
  }

  function toggleTopic(id: string) {
    setStatusMsg('');
    if (id === PICK_ALL_ID) {
      setSelectedTopics((prev) => (prev.includes(PICK_ALL_ID) ? [] : [PICK_ALL_ID]));
      return;
    }
    if (isAllNew) return;
    setSelectedTopics((prev) => {
      if (prev.includes(id)) return prev.filter((t) => t !== id);
      if (atLimit) return prev;
      return [...prev, id];
    });
    if (!selectedTopics.includes(id) && atLimit) {
      setStatusMsg(`最多只可選 ${MAX_TOPICS} 個項目；請先移除部分項目，或改用「所有訓練」一次過訂閱。`);
      setStatusTone('warn');
    }
  }

  /** 一次過選／取消整個訓練分組 */
  function toggleGroup(key: string) {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function selectGroup(items: CatalogTopic[]) {
    setStatusMsg('');
    const missing = items.filter((t) => !selectedTopics.includes(t.id));
    if (!missing.length) {
      setSelectedTopics((prev) => prev.filter((id) => !items.some((t) => t.id === id)));
      return;
    }
    const room = MAX_TOPICS - selectedTopics.length;
    if (room <= 0) {
      setStatusMsg(`最多只可選 ${MAX_TOPICS} 個項目；請先移除部分項目。`);
      setStatusTone('warn');
      return;
    }
    setSelectedTopics((prev) => [...prev, ...missing.slice(0, room).map((t) => t.id)]);
    if (missing.length > room) {
      setStatusMsg(`最多只可選 ${MAX_TOPICS} 個項目，只加入了其中 ${room} 個。`);
      setStatusTone('warn');
    }
  }

  async function handleSave() {
    const client = (window as any).MemberPushClient;
    if (!client) { setStatusMsg('通知程式未能載入。'); setStatusTone('error'); return; }
    setBusy(true);
    try {
      const prefs = { branches: selectedBranches, topics: selectedTopics };
      await client.savePreferences(prefs);
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
      await client.enable(prefs);
      setStatusMsg('已啟用通告通知！');
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
      setStatusMsg('已停止通告通知。');
      setStatusTone('good');
      const s = await client.status();
      setPushStatus(s);
    } catch (err: any) {
      setStatusMsg(err?.message || '停止失敗。');
      setStatusTone('warn');
    } finally { setBusy(false); }
  }

  const keyword = query.trim().toLowerCase();
  const countLabel = isAllNew ? '全部' : String(selectedTopics.length);

  return (
    <>
      {/* 觸發按鈕 — 放在「查看通告」區內，明確表示係通告通知 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="通告通知設定"
        title="設定想收到邊啲通告嘅推送通知"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer',
          padding: '10px 16px', borderRadius: 999, fontSize: 13.5, fontWeight: 700,
          fontFamily: 'inherit', whiteSpace: 'nowrap',
          border: `1.5px solid ${isActive ? TONES.green.bd : 'var(--line)'}`,
          background: isActive ? TONES.green.bg : '#fff',
          color: isActive ? TONES.green.fg : 'var(--p)',
        }}
      >
        <span aria-hidden>{isActive ? '🔔' : '🔕'}</span>
        通告通知{selectedTopics.length > 0 ? `（${countLabel}）` : ''}
      </button>

      {/* 設定面板 */}
      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(2,19,62,.55)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="通告通知設定"
            style={{
              width: 'min(640px, 100%)', maxHeight: 'calc(100vh - 32px)', overflow: 'auto',
              borderRadius: 16, padding: 20, background: '#fff', border: '1px solid var(--line)',
              boxShadow: '0 18px 40px rgba(0,0,0,.28)', color: 'var(--slate)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, color: 'var(--p)' }}>🔔 通告通知設定</h3>
                <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 12, lineHeight: 1.5 }}>
                  通告圖書館有新通告時，推送到這部裝置。<br />
                  可只選自己有興趣嘅項目 — 匿名訂閱，不收集任何個人資料。
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: '#fff', border: '1px solid var(--line)', borderRadius: 8,
                  width: 32, height: 32, cursor: 'pointer', fontSize: 18, color: 'var(--muted)', flex: '0 0 auto',
                }}
                aria-label="關閉"
              >×</button>
            </div>

            {/* iOS home screen hint */}
            {pushStatus?.needsHomeScreen && (
              <div style={{
                padding: '8px 12px', borderRadius: 10, marginBottom: 12, fontSize: 12.5,
                background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e',
              }}>
                📱 請先用 Safari 將本站「加入主畫面」，再從圖示開啟，才可啟用通知（iOS 16.4+）。
              </div>
            )}

            {/* Testing notice */}
            <div style={{
              padding: '8px 12px', borderRadius: 10, marginBottom: 14, fontSize: 12.5,
              background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af',
            }}>
              <strong>通知系統測試中：</strong>推送可能延遲或遺漏，建議每天到通告圖書館瀏覽有沒有通告更新。
            </div>

            {/* All new toggle */}
            <div style={{ marginBottom: 14 }}>
              <Chip
                checked={isAllNew}
                onToggle={() => toggleTopic(PICK_ALL_ID)}
                label="全選：所有新通告（不限支部）"
                tone="amber"
              />
            </div>

            {!isAllNew && !catalog && (
              <div style={{ fontSize: 12.5, color: catalogFailed ? '#b91c1c' : 'var(--muted)' }}>
                {catalogFailed ? '未能載入通告分類清單，請稍後再試。' : '正在載入通告分類清單…'}
              </div>
            )}

            {!isAllNew && catalog && (
              <>
                {/* Branches */}
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--p)' }}>
                  我的支部 <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 11 }}>可多選</span>
                </div>
                <div style={{ ...CHIP_ROW, marginBottom: 4 }}>
                  {catalog.branches.map((b) => (
                    <Chip
                      key={b.id}
                      checked={selectedBranches.includes(b.id)}
                      onToggle={() => toggleBranch(b.id)}
                      label={b.label}
                      tone="green"
                    />
                  ))}
                </div>

                {selectedBranches.length === 0 ? (
                  <div style={{
                    marginTop: 10, padding: '14px 16px', borderRadius: 12, fontSize: 12.5,
                    border: '1px dashed var(--line)', background: '#f8fafc', color: 'var(--muted)',
                  }}>
                    先選一個或以上支部，再揀想收到嘅活動、服務、比賽或訓練項目。
                  </div>
                ) : (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--p)' }}>
                        關注項目 <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 11 }}>
                          按已選支部列出；訓練可逐項揀
                        </span>
                      </div>
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="🔍 搜尋項目（例如：急救、露營）"
                        className="search-input"
                        style={{ width: 'min(260px, 100%)' }}
                        aria-label="搜尋訓練項目"
                      />
                    </div>

                    {selectedBranches.map((branchId) => {
                      const branchLabel = catalog.branches.find((b) => b.id === branchId)?.label || branchId;
                      const general = topicsForBranch(
                        catalog.topics.filter((t) => t.kind === 'branch-topic'), branchId,
                      );
                      const trainingAll = topicsForBranch(
                        catalog.topics.filter((t) => t.kind === 'training'), branchId,
                      );
                      const courses = topicsForBranch(
                        catalog.topics.filter((t) => t.kind === 'course'), branchId,
                      );

                      // 課程按 section › subgroup 分組（順序沿用字典）
                      const groups: { key: string; section: string; subgroup: string; items: CatalogTopic[] }[] = [];
                      for (const t of courses) {
                        const section = t.section || '訓練';
                        const subgroup = t.subgroup || '其他';
                        const key = `${branchId}|${section}|${subgroup}`;
                        let group = groups.find((g) => g.key === key);
                        if (!group) { group = { key, section, subgroup, items: [] }; groups.push(group); }
                        group.items.push(t);
                      }

                      const matched = keyword
                        ? courses.filter((t) => t.label.toLowerCase().includes(keyword))
                        : [];

                      return (
                        <div
                          key={branchId}
                          style={{
                            border: '1px solid var(--line)', borderRadius: 12,
                            padding: 12, marginBottom: 10, background: '#fbfdff',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <strong style={{ fontSize: 13.5, color: 'var(--p)' }}>{branchLabel}</strong>
                            <button
                              type="button"
                              onClick={() => toggleBranch(branchId)}
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                                fontSize: 11.5, color: 'var(--p2)', textDecoration: 'underline', padding: 0,
                              }}
                            >移除支部</button>
                          </div>

                          {/* 活動／服務／比賽 */}
                          <div style={MUTED_LINE}>活動・服務・比賽</div>
                          <div style={CHIP_ROW}>
                            {general.map((t) => (
                              <Chip
                                key={t.id}
                                checked={selectedTopics.includes(t.id)}
                                onToggle={() => toggleTopic(t.id)}
                                label={t.label}
                                tone="green"
                              />
                            ))}
                          </div>

                          {/* 訓練：一次過全部 */}
                          {trainingAll.length > 0 && (
                            <>
                              <div style={MUTED_LINE}>訓練 — 一次過訂閱全部</div>
                              <div style={CHIP_ROW}>
                                {trainingAll.map((t) => (
                                  <Chip
                                    key={t.id}
                                    checked={selectedTopics.includes(t.id)}
                                    onToggle={() => toggleTopic(t.id)}
                                    label={`${branchLabel}：${t.label}`}
                                    tone="amber"
                                  />
                                ))}
                              </div>
                            </>
                          )}

                          {/* 訓練：逐項揀 */}
                          {courses.length > 0 && (
                            <>
                              <div style={MUTED_LINE}>
                                訓練 — 只揀自己有興趣嘅項目（{courses.length} 項）
                              </div>

                              {keyword ? (
                                matched.length ? (
                                  <div style={CHIP_ROW}>
                                    {matched.map((t) => (
                                      <Chip
                                        key={t.id}
                                        checked={selectedTopics.includes(t.id)}
                                        onToggle={() => toggleTopic(t.id)}
                                        label={t.label}
                                        tone="blue"
                                      />
                                    ))}
                                  </div>
                                ) : (
                                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                                    呢個支部冇搵到「{query.trim()}」相關項目。
                                  </div>
                                )
                              ) : groups.map((g) => {
                                const isOpen = openGroups[g.key] ?? false;
                                const picked = g.items.filter((t) => selectedTopics.includes(t.id)).length;
                                return (
                                  <div
                                    key={g.key}
                                    style={{
                                      border: '1px solid var(--line)', borderRadius: 10,
                                      background: '#fff', marginBottom: 6, overflow: 'hidden',
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px' }}>
                                      <button
                                        type="button"
                                        onClick={() => toggleGroup(g.key)}
                                        aria-expanded={isOpen}
                                        style={{
                                          flex: 1, display: 'flex', alignItems: 'center', gap: 6, textAlign: 'left',
                                          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                                          fontFamily: 'inherit', fontSize: 12.5, color: 'var(--slate)',
                                        }}
                                      >
                                        <span aria-hidden style={{ color: 'var(--p2)' }}>{isOpen ? '▾' : '▸'}</span>
                                        <span style={{ fontWeight: 600 }}>
                                          {g.section === '訓練' ? g.subgroup : `${g.section} › ${g.subgroup}`}
                                        </span>
                                        <span style={{ color: 'var(--muted)', fontWeight: 400 }}>
                                          （{g.items.length}{picked > 0 ? ` · 已選 ${picked}` : ''}）
                                        </span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => selectGroup(g.items)}
                                        style={{
                                          background: '#fff', border: '1px solid var(--line)', borderRadius: 999,
                                          padding: '2px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                                          color: 'var(--p2)', flex: '0 0 auto',
                                        }}
                                      >{picked === g.items.length ? '清除' : '全選'}</button>
                                    </div>
                                    {isOpen && (
                                      <div style={{ ...CHIP_ROW, padding: '2px 10px 10px' }}>
                                        {g.items.map((t) => (
                                          <Chip
                                            key={t.id}
                                            checked={selectedTopics.includes(t.id)}
                                            onToggle={() => toggleTopic(t.id)}
                                            label={t.label}
                                            tone="blue"
                                          />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* 已選項目總覽 */}
            {!isAllNew && selectedTopics.length > 0 && (
              <details style={{ marginTop: 4, marginBottom: 12 }}>
                <summary style={{ cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: 'var(--p)' }}>
                  已選 {selectedTopics.length} 個項目（最多 {MAX_TOPICS} 個）— 查看／移除
                </summary>
                <div style={{ ...CHIP_ROW, marginTop: 8 }}>
                  {selectedTopics.map((id) => {
                    const topic = topicById.get(id);
                    const label = topic?.label || id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => toggleTopic(id)}
                        title={topic?.branches?.join('／') || ''}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                          padding: '4px 10px', borderRadius: 999, fontSize: 12, fontFamily: 'inherit',
                          background: '#eef2f7', border: '1px solid #d5dde7', color: '#334155',
                        }}
                      >{label} <span aria-hidden style={{ color: '#b91c1c', fontWeight: 900 }}>×</span></button>
                    );
                  })}
                </div>
              </details>
            )}

            {/* How to receive */}
            <div style={{ marginBottom: 14, fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
              <div style={{ fontWeight: 700, color: 'var(--p)', marginBottom: 4 }}>如何收到通知</div>
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
                {isAllNew
                  ? '全選：有新通告就通知'
                  : `已選 ${selectedBranches.length} 個支部・${selectedTopics.length} 個項目`}
              </span>
              <button
                onClick={handleSave}
                disabled={busy || (!isAllNew && (!selectedBranches.length || !selectedTopics.length))}
                style={{
                  padding: '8px 14px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13,
                  fontFamily: 'inherit', border: '1px solid var(--line)', background: '#fff', color: 'var(--p)',
                  opacity: busy ? 0.5 : 1,
                }}
              >只儲存選項</button>
              <button
                onClick={handleEnable}
                disabled={busy || pushStatus?.needsHomeScreen || (!isAllNew && (!selectedBranches.length || !selectedTopics.length))}
                style={{
                  padding: '8px 14px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13,
                  fontFamily: 'inherit', border: '1px solid var(--p2)',
                  background: 'linear-gradient(135deg,#0b4bb8,#1565c0)', color: '#fff',
                  opacity: busy ? 0.5 : 1,
                }}
              >{isActive ? '更新通告通知' : '啟用通告通知'}</button>
              {pushStatus?.subscribed && (
                <button
                  onClick={handleDisable}
                  disabled={busy}
                  style={{
                    padding: '8px 14px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13,
                    fontFamily: 'inherit', border: '1px solid #fca5a5', background: '#fef2f2', color: '#b91c1c',
                    opacity: busy ? 0.5 : 1,
                  }}
                >停止通知</button>
              )}
            </div>

            {/* Status message */}
            {statusMsg && (
              <div style={{
                marginTop: 10, fontSize: 12.5, lineHeight: 1.5, fontWeight: 600,
                color: statusTone === 'good' ? '#166534' : statusTone === 'warn' ? '#92400e' : '#b91c1c',
              }}>
                {statusMsg}
              </div>
            )}

            {/* Privacy note */}
            <div style={{
              marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)',
              color: 'var(--muted)', fontSize: 11, lineHeight: 1.5,
            }}>
              私隱：設定先留在本機 LocalStorage，訂閱只存加密端點，不收集任何個人資料。與通告圖書館共用同一個推送系統。
            </div>
          </div>
        </div>
      )}
    </>
  );
}
