'use client';
import { useEffect, useMemo, useState } from 'react';

/**
 * 個人化「通告」通知設定（成員系統版）。
 *
 * 選單、用語及分組邏輯同通告圖書館（scout-circulars）睇齊：
 * 兩邊共用同一份 /subscription_catalog.json（v3.3.0）、同一個 Supabase 訂閱表、
 * 同一對 VAPID key 及同一份 push-client.js（全域名稱同樣係 ScoutPushClient），
 * notify.py 推送時自然會推埋呢邊。
 *
 * 全選剔項（2026-10-01 起，同圖書館一致）：
 *   all:notices → 小工具以外嘅所有新通告（含公布／未分類），不限支部
 *   all:tools   → 所有支部嘅小工具，不限支部
 *   兩個都剔 == 舊版 all:new；all:new 保留相容，舊設定自動顯示成兩個都剔。
 *
 * 字典 kind：
 *   branch-topic 支部＋活動／服務／比賽／公布／小工具（group 對應分節，match_topic 對應舊共用分類）
 *   training     某個支部嘅「所有訓練」（領袖再分木章／非木章 section）
 *   course       該支部訓練綱要內嘅徽章／訓練班（subgroup = 綱要分組）
 *
 * 圖書館係深色主題；成員系統係白底，所以配色換成淺底深字版本（字色一律深色，
 * 避免字色貼近底色睇唔清楚），其餘結構、步驟、提示文字保持一致。
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
  match_topic?: string;
}
interface Catalog { version: string; branches: CatalogBranch[]; topics: CatalogTopic[] }

interface PushStatus {
  supported: boolean;
  standalone: boolean;
  needsHomeScreen: boolean;
  permission: string;
  subscribed: boolean;
  enabledLocally: boolean;
  preferences: { branches: string[]; topics: string[] } | null;
}

/** 必須同 app/api/push-subscriptions/route.ts 嘅 MAX_TOPICS 及圖書館 api/push_common.py 保持一致 */
const PUSH_MAX_TOPICS = 60;
const PUSH_TOOLS_GROUP = '小工具';
const PUSH_GENERAL_ORDER = ['服務', '活動', '比賽', '小工具', '公布'];
const PUSH_LEADER_SECTION_ORDER = ['木章訓練班', '非木章訓練班'];

/** 兩個獨立全選剔項（同圖書館 PUSH_MASTER_TOPICS 一致）；all:new 為舊版相容 ID */
const PUSH_MASTER_TOPICS = [
  { id: 'all:notices', label: '全選：所有通告', title: '小工具以外嘅所有新通告（包括公布及未分類），唔分支部' },
  { id: 'all:tools', label: '全選：所有小工具', title: '所有支部嘅小工具；小工具只按支部細分，冇其他子分類' },
] as const;
const PUSH_LEGACY_ALL_ID = 'all:new';
const PUSH_MASTER_IDS = new Set<string>([PUSH_LEGACY_ALL_ID, ...PUSH_MASTER_TOPICS.map((t) => t.id)]);

type Tone = 'branch' | 'topic' | 'all';

/** 淺色底下的高對比配色：實色底＋白字，剔號用底色反白 */
const TONES: Record<Tone, { on: string; soft: string; softBorder: string }> = {
  branch: { on: '#15803d', soft: '#e7f7ed', softBorder: '#8ed0a6' },
  topic:  { on: '#1d4ed8', soft: '#e8f0ff', softBorder: '#9dbdf6' },
  all:    { on: '#a4530a', soft: '#fdf3e2', softBorder: '#eec47c' },
};

const CHIP_ROW: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 6 };
const SECTION_TITLE: React.CSSProperties = {
  marginTop: 10, paddingTop: 8, borderTop: '1px dashed #c7d8ef',
  color: 'var(--p)', fontSize: 12.5, fontWeight: 700, marginBottom: 6,
};
const HELP: React.CSSProperties = { display: 'block', marginTop: 8, color: 'var(--muted)', fontSize: 11.5, lineHeight: 1.5 };

/** 一下即剔嘅選項（同圖書館 pick-chip 一樣：整個掣都係可撳範圍） */
function Chip({
  checked, onToggle, label, tone = 'topic', dashed, title,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  tone?: Tone;
  dashed?: boolean;
  title?: string;
}) {
  const c = TONES[tone];
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={checked}
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer',
        padding: '6px 11px 6px 8px', borderRadius: 999, fontSize: 12.5, lineHeight: 1.3,
        fontFamily: 'inherit', userSelect: 'none', whiteSpace: 'nowrap',
        border: `${dashed && !checked ? '1px dashed ' : '1px solid '}${checked ? c.on : '#cbd5e1'}`,
        background: checked ? c.on : '#fff',
        color: checked ? '#fff' : '#334155',
        fontWeight: checked ? 700 : 400,
      }}
    >
      <span
        aria-hidden
        style={{
          flex: '0 0 auto', width: 15, height: 15, borderRadius: 4,
          border: `1px solid ${checked ? '#fff' : '#94a3b8'}`,
          background: checked ? '#fff' : '#f8fafc',
          color: checked ? c.on : 'transparent',
          display: 'inline-grid', placeItems: 'center', fontSize: 10, lineHeight: 1, fontWeight: 900,
        }}
      >✓</span>
      {label}
    </button>
  );
}

function isTopicForBranches(topic: CatalogTopic, branches: string[]) {
  if (!Array.isArray(topic.branches)) return false;
  return topic.branches.includes('*') || topic.branches.some((b) => branches.includes(b));
}

/** 舊共用分類（category:training ／ match_topic）展開成已選支部嘅獨立項目 */
function migrateTopics(topics: string[], branches: string[], allTopics: CatalogTopic[]) {
  const wanted = new Set(topics);
  for (const topic of allTopics) {
    if (topic.kind === 'branch-topic' && topic.match_topic && wanted.has(topic.match_topic)
      && isTopicForBranches(topic, branches)) wanted.add(topic.id);
    if (topic.kind === 'training' && wanted.has('category:training')
      && isTopicForBranches(topic, branches)) wanted.add(topic.id);
  }
  return [...wanted];
}

/** 舊版單一「全選」（all:new）→ 顯示成兩個新全選都剔；下次儲存就會寫返新嘅一對 ID */
function migrateLegacyAll(topics: string[]) {
  if (!topics.includes(PUSH_LEGACY_ALL_ID)) return topics;
  return [...new Set([...topics.filter((id) => id !== PUSH_LEGACY_ALL_ID), ...PUSH_MASTER_TOPICS.map((t) => t.id)])];
}

function subgroupsFor(topics: CatalogTopic[]) {
  const groups = new Map<string, CatalogTopic[]>();
  for (const topic of topics) {
    const name = topic.subgroup || '其他';
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name)!.push(topic);
  }
  return groups;
}

export default function PushSettings() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogFailed, setCatalogFailed] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [statusTone, setStatusTone] = useState<'good' | 'warn' | 'error' | ''>('');
  const [busy, setBusy] = useState(false);

  // Load catalog（同圖書館共用同一份字典）
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
            const branches: string[] = prefs.branches || [];
            setSelectedBranches(branches);
            setSelectedTopics(migrateLegacyAll(migrateTopics(prefs.topics || [], branches, c.topics || [])));
          }
        } catch { /* ignore */ }
      })
      .catch(() => setCatalogFailed(true));
  }, []);

  // Load push status（/push-client.js 提供匿名 Web Push 生命週期；全域名稱同圖書館一樣係 ScoutPushClient）
  useEffect(() => {
    const script = document.createElement('script');
    script.src = '/push-client.js';
    script.onload = () => {
      if ((window as any).ScoutPushClient) {
        (window as any).ScoutPushClient.status().then((s: PushStatus) => {
          setPushStatus(s);
          if (s.preferences) {
            const branches = s.preferences.branches || [];
            setSelectedBranches(branches);
            setSelectedTopics(migrateLegacyAll(migrateTopics(s.preferences.topics || [], branches, catalog?.topics || [])));
          }
        });
      }
    };
    document.head.appendChild(script);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 瀏覽器通知地址改變（subscriptionchange）時自動重新同步
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      if ((event.data as any)?.type !== 'scout-push-subscription-change') return;
      const client = (window as any).ScoutPushClient;
      try {
        const raw = localStorage.getItem('scl_push_preferences_v1');
        const prefs = raw ? JSON.parse(raw) : null;
        if (!client || !prefs?.topics?.length) return;
        client.sync(prefs, { resubscribe: true }).then((s: any) => setPushStatus(s)).catch(() => {});
      } catch { /* ignore */ }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
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

  /** 揀咗邊啲全選掣（all:notices／all:tools） */
  const masters = useMemo(
    () => selectedTopics.filter((id) => PUSH_MASTER_IDS.has(id)),
    [selectedTopics],
  );
  const bothMasters = masters.length >= PUSH_MASTER_TOPICS.length;
  const isActive = Boolean(pushStatus?.enabledLocally && pushStatus?.subscribed && pushStatus?.permission === 'granted');

  /** 已被全選包住嘅組別：剔「所有通告」就包住小工具以外嘅組別（含訓練）；剔「所有小工具」就包住小工具組 */
  function groupCovered(group: string) {
    if (group === PUSH_TOOLS_GROUP) return masters.includes('all:tools');
    return masters.includes('all:notices');
  }
  const trainingCovered = masters.includes('all:notices');

  /** 實際會儲存／上傳嘅項目：全選＋未被全選包住嘅逐項選擇（同圖書館 pushSelectionState 一致） */
  const effectiveTopics = useMemo(
    () => selectedTopics.filter((id) => {
      if (PUSH_MASTER_IDS.has(id)) return true;
      const topic = topicById.get(id);
      return topic ? !groupCovered(topic.group || '') : true;
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedTopics, topicById, masters],
  );
  const extraCount = effectiveTopics.filter((id) => !PUSH_MASTER_IDS.has(id)).length;
  const overLimit = effectiveTopics.length > PUSH_MAX_TOPICS;
  /** 全選唔靠支部配對；淨係剔全選時補返全部支部（資料表要求 1..8 個支部） */
  const effectiveBranches = masters.length && !selectedBranches.length
    ? (catalog?.branches || []).map((b) => b.id)
    : selectedBranches;
  const invalid = overLimit || (!masters.length && (!selectedBranches.length || !extraCount));

  function toggleBranch(id: string) {
    setOpenGroups({});
    setSelectedBranches((prev) => {
      const next = prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id];
      // 取消支部時只保留仍然適用嘅項目（同圖書館一樣：保住配對，唔做交叉相乘）
      if (!next.includes(id)) {
        setSelectedTopics((prevTopics) => prevTopics.filter((topicId) => {
          const topic = topicById.get(topicId);
          if (!topic || topic.branches.includes('*')) return true;
          return topic.branches.some((b) => next.includes(b));
        }));
      }
      return next;
    });
  }

  function toggleTopic(id: string) {
    setSelectedTopics((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  function toggleMaster(id: string) {
    setSelectedTopics((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  /** 「重新設定」— 只清空面板，未儲存前唔會改動已儲存設定或訂閱 */
  function resetDraft() {
    if (!confirm('清空面板內全部支部及項目，重新選擇？這不會停止通知，也不會刪除已儲存設定；按儲存／更新後才會套用新選項。')) return;
    setSelectedBranches([]);
    setSelectedTopics([]);
    setOpenGroups({});
    setQuery('');
    setStatusMsg('已清空面板，請重新選擇支部及項目，再按儲存／更新。正在使用的通知設定尚未改動。');
    setStatusTone('warn');
  }

  function currentPreferences() {
    return {
      branches: effectiveBranches,
      topics: effectiveTopics,
      catalogVersion: String(catalog?.version || ''),
    };
  }

  async function handleSave() {
    const client = (window as any).ScoutPushClient;
    if (!client) { setStatusMsg('通知程式未能載入；選項仍不會上傳。'); setStatusTone('error'); return; }
    setBusy(true);
    try {
      const saved = client.savePreferences(currentPreferences());
      const info = await client.status();
      if (info.subscribed && info.permission === 'granted') {
        try {
          await client.sync(saved, { resubscribe: false });
          setStatusMsg('已儲存在這個瀏覽器，並已同步更新匿名通知設定。');
          setStatusTone('good');
        } catch (err: any) {
          setStatusMsg(`已只儲存在這個瀏覽器；伺服器同步未完成：${err?.message || '請稍後再試。'}`);
          setStatusTone('warn');
        }
      } else {
        setStatusMsg('已只儲存在這個瀏覽器。尚未要求或取得通知權限。');
        setStatusTone('good');
      }
      setPushStatus(await client.status());
    } catch (err: any) {
      setStatusMsg(err?.message || '未能儲存選項。');
      setStatusTone('error');
    } finally { setBusy(false); }
  }

  async function handleEnable() {
    const client = (window as any).ScoutPushClient;
    if (!client) { setStatusMsg('通知程式未能載入。'); setStatusTone('error'); return; }
    setBusy(true);
    try {
      setStatusMsg('正在要求瀏覽器通知權限並儲存匿名訂閱…');
      setStatusTone('');
      const result = await client.enable(currentPreferences());
      const savedMasters = result.preferences.topics.filter((id: string) => PUSH_MASTER_IDS.has(id));
      const hasNotices = savedMasters.includes('all:notices') || savedMasters.includes(PUSH_LEGACY_ALL_ID);
      const hasTools = savedMasters.includes('all:tools') || savedMasters.includes(PUSH_LEGACY_ALL_ID);
      setStatusMsg(hasNotices && hasTools
        ? '已啟用全選：所有通告＋所有小工具（即係所有新消息，包括未分類）。'
        : hasNotices
          ? '已啟用全選：小工具以外嘅所有新通告都會通知（包括公布及未分類）。'
          : hasTools
            ? '已啟用全選：所有支部嘅小工具有新消息就會通知。'
            : '已啟用：符合任何一組支部及項目的新通告就會通知。');
      setStatusTone('good');
      setPushStatus(await client.status());
    } catch (err: any) {
      setStatusMsg(err?.message || '未能啟用通知。');
      setStatusTone('error');
    } finally { setBusy(false); }
  }

  async function handleDisable() {
    if (!confirm('停止這部裝置的通告通知？本機選項會保留，日後可重新啟用。')) return;
    const client = (window as any).ScoutPushClient;
    if (!client) return;
    setBusy(true);
    try {
      setStatusMsg('正在停止這部裝置的通知…');
      setStatusTone('');
      await client.disable();
      setStatusMsg('這部裝置已停止接收通知。本機支部和關注選項仍然保留。');
      setStatusTone('good');
      setPushStatus(await client.status());
    } catch (err: any) {
      setStatusMsg(err?.message || '停止通知時出現問題。');
      setStatusTone('warn');
    } finally { setBusy(false); }
  }

  const keyword = query.trim().toLowerCase();
  const enableLabel = isActive ? '更新通知設定'
    : pushStatus?.permission === 'denied' ? '重新嘗試啟用通知' : '啟用通知';

  /** 面板底部嘅已選摘要（同圖書館 updatePushCount 嘅用語一致） */
  const summaryText = (() => {
    const names = PUSH_MASTER_TOPICS.filter((t) => masters.includes(t.id)).map((t) => t.label.replace('全選：', ''));
    if (names.length >= PUSH_MASTER_TOPICS.length) return '全選：所有通告 ＋ 所有小工具（即係所有新消息）';
    if (names.length) return `全選：${names.join('＋')}${extraCount ? `・另加 ${effectiveBranches.length} 個支部・${extraCount} 個項目` : ''}`;
    return `已選 ${selectedBranches.length} 個支部・${extraCount} 個項目${overLimit ? `（最多 ${PUSH_MAX_TOPICS} 個）` : ''}`;
  })();

  /** 一個支部嘅關注項目（活動／服務／比賽／公布／小工具 ＋ 訓練分組） */
  function renderBranchBlock(branchId: string) {
    const topics = catalog?.topics || [];
    const branchLabel = catalog?.branches.find((b) => b.id === branchId)?.label || branchId;

    // 一般項目（活動／服務／比賽／公布／小工具）：按 group 分節，同圖書館一致；
    // 已被全選包住嘅組別收埋（但保留剔選，取消全選時原樣復原）。
    const generalSections = PUSH_GENERAL_ORDER
      .map((group) => ({
        group,
        covered: groupCovered(group),
        list: topics.filter((t) => t.kind === 'branch-topic' && t.group === group && t.branches.includes(branchId)),
      }))
      .filter((section) => section.list.length > 0);

    // 只屬呢個支部（或首個已選支部）嘅項目，避免共用徽章喺幾個支部重複出現
    const owned = (t: CatalogTopic) => Array.isArray(t.branches) && !t.branches.includes('*')
      && t.branches.includes(branchId)
      && t.branches.filter((b) => selectedBranches.includes(b))[0] === branchId;
    const trainingAll = topics.filter((t) => t.kind === 'training' && owned(t));
    const courses = topics.filter((t) => t.kind === 'course' && owned(t));

    const sectionNames = [...new Set([...trainingAll, ...courses].map((t) => t.section || ''))]
      .sort((a, b) => {
        const ia = PUSH_LEADER_SECTION_ORDER.indexOf(a);
        const ib = PUSH_LEADER_SECTION_ORDER.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });

    const visibleCourses = keyword
      ? courses.filter((t) => t.label.toLowerCase().includes(keyword))
      : courses;

    // 成個支部區塊嘅可見內容都俾全選包住時，收埋成區（同圖書館 appendPushBranchBlock 一致）
    const hasVisibleGeneral = generalSections.some((s) => !s.covered);
    const hasVisibleTraining = branchId !== '家長' && !trainingCovered && (trainingAll.length > 0 || courses.length > 0);
    const blockHidden = bothMasters || !(hasVisibleGeneral || hasVisibleTraining);

    return (
      <div
        key={branchId}
        hidden={blockHidden}
        style={{
          marginTop: 10, padding: '10px 12px', borderRadius: 12,
          border: '1px solid var(--line)', background: '#fbfdff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
          <strong style={{ color: 'var(--p)', fontSize: 14 }}>{branchLabel}</strong>
          <button
            type="button"
            onClick={() => toggleBranch(branchId)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 11.5, color: 'var(--p2)', textDecoration: 'underline', padding: 0,
            }}
          >移除支部</button>
        </div>

        {generalSections.map((section) => (
          <div key={section.group} hidden={section.covered}>
            <div style={SECTION_TITLE}>{section.group}</div>
            <div style={CHIP_ROW}>
              {section.list.map((t) => (
                <Chip
                  key={t.id}
                  checked={selectedTopics.includes(t.id)}
                  onToggle={() => toggleTopic(t.id)}
                  label={t.label}
                  tone="topic"
                />
              ))}
            </div>
          </div>
        ))}

        {/* 家長只有活動及比賽，冇訓練項目；訓練被「所有通告」全選包住時亦收埋 */}
        {branchId === '家長' || trainingCovered ? null : (
          <>
            <div style={SECTION_TITLE}>訓練</div>
            {!trainingAll.length && !courses.length ? (
              <span style={HELP}>這個支部暫時沒有受控訓練項目；可選上方活動、服務或比賽。</span>
            ) : (
              sectionNames.map((sectionName) => {
                const allTopic = trainingAll.find((t) => (t.section || '') === sectionName) || null;
                const list = courses.filter((t) => (t.section || '') === sectionName);
                const showAll = !keyword && allTopic;
                return (
                  <div key={sectionName || 'default'}>
                    {sectionName ? (
                      <div style={{ ...SECTION_TITLE, borderTop: 'none', marginTop: 6, paddingTop: 0 }}>{sectionName}</div>
                    ) : null}
                    {showAll && (
                      <>
                        <div style={CHIP_ROW}>
                          <Chip
                            checked={selectedTopics.includes(allTopic!.id)}
                            onToggle={() => toggleTopic(allTopic!.id)}
                            label={allTopic!.label}
                            tone="all"
                            dashed
                          />
                        </div>
                        {selectedTopics.includes(allTopic!.id) && (
                          <span style={{ ...HELP, marginTop: 6 }}>
                            已選「所有訓練」：這個支部／類別的每張新訓練通告都會通知，下面細項可留空。
                          </span>
                        )}
                      </>
                    )}
                    {keyword ? (
                      visibleCourses.length ? (
                        <div style={{ ...CHIP_ROW, marginTop: 6 }}>
                          {visibleCourses.map((t) => (
                            <Chip
                              key={t.id}
                              checked={selectedTopics.includes(t.id)}
                              onToggle={() => toggleTopic(t.id)}
                              label={t.label}
                              tone="topic"
                            />
                          ))}
                        </div>
                      ) : (
                        <span style={HELP}>呢個支部冇搵到「{query.trim()}」相關項目。</span>
                      )
                    ) : (
                      [...subgroupsFor(list)].map(([name, items]) => {
                        const key = `${branchId}|${sectionName}|${name}`;
                        const picked = items.filter((t) => selectedTopics.includes(t.id)).length;
                        const isOpen = openGroups[key] ?? picked > 0;
                        return (
                          <details
                            key={key}
                            open={isOpen}
                            onToggle={(e) => {
                              const el = e.currentTarget as HTMLDetailsElement;
                              setOpenGroups((prev) => (prev[key] === el.open ? prev : { ...prev, [key]: el.open }));
                            }}
                            style={{ marginTop: 8 }}
                          >
                            <summary
                              style={{
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                                color: 'var(--slate)', fontSize: 12.5, fontWeight: 600, padding: '4px 0',
                                listStyle: 'none',
                              }}
                            >
                              <span aria-hidden style={{ color: 'var(--p2)', fontSize: 11 }}>▸</span>
                              <span>{name}（{items.length}）</span>
                              <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 11 }}>
                                {picked ? `已選 ${picked}` : ''}
                              </span>
                            </summary>
                            <div style={{ ...CHIP_ROW, padding: '4px 0 2px 14px' }}>
                              {items.map((t) => (
                                <Chip
                                  key={t.id}
                                  checked={selectedTopics.includes(t.id)}
                                  onToggle={() => toggleTopic(t.id)}
                                  label={t.label}
                                  tone="topic"
                                />
                              ))}
                            </div>
                          </details>
                        );
                      })
                    )}
                  </div>
                );
              })
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <>
      {/* 觸發按鈕 — 放喺「查看通告」區內，明確表示係通告通知 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="通告通知設定"
        title="設定個人化通告通知：全選，或先揀支部再點選關注項目"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer',
          padding: '10px 16px', borderRadius: 999, fontSize: 13.5, fontWeight: 700,
          fontFamily: 'inherit', whiteSpace: 'nowrap',
          border: `1.5px solid ${effectiveTopics.length ? TONES.branch.softBorder : 'var(--line)'}`,
          background: effectiveTopics.length ? TONES.branch.soft : '#fff',
          color: effectiveTopics.length ? TONES.branch.on : 'var(--p)',
        }}
      >
        <span aria-hidden>{isActive ? '🔔' : '🔕'}</span>
        通告通知
        {effectiveTopics.length > 0 && (
          <span
            style={{
              display: 'inline-block', minWidth: 18, padding: '0 5px', borderRadius: 999,
              background: isActive ? TONES.branch.on : 'rgba(0,51,102,.12)',
              color: isActive ? '#fff' : 'var(--p)', fontSize: 11, fontWeight: 700,
            }}
          >{bothMasters ? '全部' : effectiveTopics.length}</span>
        )}
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
            aria-labelledby="member-push-title"
            style={{
              width: 'min(640px, 100%)', maxHeight: 'calc(100vh - 32px)', overflow: 'auto',
              borderRadius: 16, padding: 20, background: '#fff', border: '1px solid var(--line)',
              boxShadow: '0 18px 40px rgba(0,0,0,.28)', color: 'var(--slate)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <h3 id="member-push-title" style={{ margin: 0, fontSize: 17, color: 'var(--p)' }}>🔔 個人化通告通知</h3>
                <p style={{ margin: '5px 0 0', color: 'var(--muted)', fontSize: 12, lineHeight: 1.55 }}>
                  通告圖書館有新通告時，推送到這部裝置 — 全選，或先揀支部再點選關注項目。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  flex: '0 0 auto', background: '#fff', border: '1px solid var(--line)', borderRadius: 10,
                  width: 34, height: 34, cursor: 'pointer', fontSize: 18, lineHeight: 1, color: 'var(--muted)',
                }}
                aria-label="關閉通告通知設定"
              >×</button>
            </div>

            {/* Testing notice */}
            <div style={{
              marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)',
              fontSize: 12, lineHeight: 1.55, color: '#92400e',
            }}>
              <strong>通知系統仍在測試中：</strong>推送可能延遲或遺漏，建議每天到通告圖書館瀏覽有沒有通告更新，不要只依賴通知。
            </div>

            {/* 全選：通告／小工具各一個獨立剔項 */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
              <div style={CHIP_ROW} role="group" aria-label="全選：通告／小工具">
                {PUSH_MASTER_TOPICS.map((master) => (
                  <Chip
                    key={master.id}
                    checked={masters.includes(master.id)}
                    onToggle={() => toggleMaster(master.id)}
                    label={master.label}
                    tone="all"
                    dashed
                    title={master.title}
                  />
                ))}
              </div>
              <small style={HELP}>兩個都剔＝所有新消息。全選唔分支部；小工具只按支部細分。</small>
            </div>

            {!bothMasters && (
              <>
                {/* 1 我的支部 */}
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, color: 'var(--p)', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
                    <span style={{
                      display: 'inline-grid', placeItems: 'center', width: 20, height: 20,
                      borderRadius: '50%', background: '#1d4ed8', color: '#fff', fontSize: 11,
                    }}>1</span>
                    我的支部 <small style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 11.5 }}>可多選，點一下即選取</small>
                  </div>
                  {catalog ? (
                    <div style={CHIP_ROW} role="group" aria-label="我的支部">
                      {catalog.branches.map((b) => (
                        <Chip
                          key={b.id}
                          checked={selectedBranches.includes(b.id)}
                          onToggle={() => toggleBranch(b.id)}
                          label={b.label}
                          tone="branch"
                        />
                      ))}
                    </div>
                  ) : (
                    <span style={HELP}>
                      {catalogFailed ? '未能載入通告分類清單，請稍後再試。' : '正在載入通告分類清單…'}
                    </span>
                  )}
                  <small style={HELP}>命中任何一組就通知；同一通告只計一次。淨係剔全選可以唔揀支部。</small>
                </div>

                {/* 2 各支部關注項目 */}
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, color: 'var(--p)', fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                    <span style={{
                      display: 'inline-grid', placeItems: 'center', width: 20, height: 20,
                      borderRadius: '50%', background: '#1d4ed8', color: '#fff', fontSize: 11,
                    }}>2</span>
                    各支部關注項目
                  </div>
                  {selectedBranches.length > 0 && (
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="🔍 搜尋訓練項目（例如：急救、露營）"
                      className="search-input"
                      style={{ width: 'min(280px, 100%)', marginBottom: 6 }}
                      aria-label="搜尋訓練項目"
                    />
                  )}
                  <div role="group" aria-label="各支部關注項目">
                    {selectedBranches.length === 0
                      ? <span style={HELP}>先選一個或以上支部，下面就會列出該支部嘅活動、服務、比賽及訓練項目。</span>
                      : (catalog?.branches || [])
                        .map((b) => b.id)
                        .filter((id) => selectedBranches.includes(id))
                        .map((id) => renderBranchBlock(id))}
                  </div>
                </div>
              </>
            )}

            {/* 已選項目總覽（成員系統加設：方便逐項覆核及移除） */}
            {effectiveTopics.length > 0 && (
              <details style={{ marginTop: 12 }}>
                <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--p)' }}>
                  已選 {effectiveTopics.length} 個項目 — 查看／移除
                </summary>
                <div style={{ ...CHIP_ROW, marginTop: 8 }}>
                  {effectiveTopics.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleTopic(id)}
                      title={topicById.get(id)?.branches?.join('／') || ''}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                        padding: '4px 10px', borderRadius: 999, fontSize: 12, fontFamily: 'inherit',
                        background: PUSH_MASTER_IDS.has(id) ? TONES.all.soft : '#eef2f7',
                        border: `1px solid ${PUSH_MASTER_IDS.has(id) ? TONES.all.softBorder : '#d5dde7'}`,
                        color: '#334155',
                      }}
                    >{topicById.get(id)?.label || id} <span aria-hidden style={{ color: '#b91c1c', fontWeight: 900 }}>×</span></button>
                  ))}
                </div>
              </details>
            )}

            {/* 如何收到通知 */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
              <div style={{ color: 'var(--p)', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>如何收到通知</div>
              {pushStatus?.needsHomeScreen && (
                <p style={{ ...HELP, marginTop: 0, color: '#92400e' }} role="status">
                  此 iPhone／iPad 尚未從主畫面開啟。請先用 Safari 將本站「加入主畫面」，再從圖示開啟，才可啟用通知。
                </p>
              )}
              {pushStatus?.standalone && !pushStatus?.needsHomeScreen && (
                <p style={{ ...HELP, marginTop: 0 }} role="status">已從主畫面 App 開啟，可在下方啟用通知。</p>
              )}
              <ul style={{ paddingLeft: 18, margin: 0, color: 'var(--muted)', fontSize: 11.5, lineHeight: 1.5 }}>
                <li><strong>手機：</strong>先加入主畫面，再從圖示開啟按「啟用通知」。
                  <ul style={{ paddingLeft: 16, margin: '2px 0 0' }}>
                    <li>iPhone／iPad：Safari → 分享 →「加入主畫面」（iOS 16.4+）</li>
                    <li>Android：Chrome ⋮ →「加到主畫面」</li>
                  </ul>
                </li>
                <li><strong>電腦：</strong>按「啟用通知」選「允許」，並在系統設定容許瀏覽器通知；毋須一直開着本站。</li>
                <li><strong>離線最多保留 3 日（72 小時）</strong>，逾期通知不補發，訂閱不會因此取消。</li>
              </ul>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14, alignItems: 'center' }}>
              <span
                aria-live="polite"
                style={{
                  flex: '1 1 auto', fontSize: 12, color: overLimit ? '#b91c1c' : 'var(--muted)',
                  fontWeight: overLimit ? 700 : 400,
                }}
              >
                {summaryText}
              </span>
              <button
                type="button"
                onClick={resetDraft}
                disabled={busy || (!selectedBranches.length && !selectedTopics.length)}
                style={{
                  borderRadius: 10, padding: '9px 12px', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                  fontFamily: 'inherit', border: '1px solid var(--line)', background: '#fff', color: 'var(--p)',
                  opacity: busy ? 0.55 : 1,
                }}
              >重新設定</button>
              <button
                type="button"
                onClick={handleSave}
                disabled={busy || invalid}
                style={{
                  borderRadius: 10, padding: '9px 12px', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                  fontFamily: 'inherit', border: '1px solid var(--line)', background: '#fff', color: 'var(--p)',
                  opacity: busy || invalid ? 0.55 : 1,
                }}
              >只儲存選項</button>
              <button
                type="button"
                onClick={handleEnable}
                disabled={busy || invalid || (pushStatus ? !pushStatus.supported : false)}
                style={{
                  borderRadius: 10, padding: '9px 12px', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                  fontFamily: 'inherit', border: '1px solid #60a5fa', color: '#fff',
                  background: 'linear-gradient(135deg,#1d4ed8,#3b82f6)',
                  opacity: busy || invalid || (pushStatus ? !pushStatus.supported : false) ? 0.55 : 1,
                }}
              >{enableLabel}</button>
              {pushStatus?.subscribed && (
                <button
                  type="button"
                  onClick={handleDisable}
                  disabled={busy}
                  style={{
                    borderRadius: 10, padding: '9px 12px', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                    fontFamily: 'inherit', border: '1px solid #fca5a5', background: '#fef2f2', color: '#b91c1c',
                    opacity: busy ? 0.55 : 1,
                  }}
                >停止這部裝置通知</button>
              )}
            </div>
            <small style={HELP}>更改後儲存即可；「重新設定」只清空面板，儲存前不會改動訂閱。</small>

            {/* Status */}
            <div
              role="status"
              aria-live="polite"
              style={{
                marginTop: 10, fontSize: 12, lineHeight: 1.55,
                color: statusTone === 'good' ? '#166534' : statusTone === 'warn' ? '#92400e' : statusTone === 'error' ? '#b91c1c' : 'var(--muted)',
              }}
            >
              {statusMsg || (
                !pushStatus ? '正在載入通知選項…'
                  : !pushStatus.supported
                    ? (pushStatus.needsHomeScreen
                      ? '請先加入主畫面並從圖示開啟，才可啟用通知；目前仍可只儲存篩選設定。'
                      : '這個瀏覽器或目前的連線不支援網頁通知；請參考上方說明，你仍可只儲存篩選設定。')
                    : pushStatus.subscribed && pushStatus.permission === 'granted'
                      ? '這部裝置已啟用匿名通知；更改選項後會同步更新。'
                      : pushStatus.permission === 'denied'
                        ? '瀏覽器已封鎖通知。請在網址列的網站設定中改為「允許」後再試。'
                        : '尚未啟用通知。'
              )}
            </div>

            {/* Privacy */}
            <ul style={{
              margin: '10px 0 0', paddingTop: 10, paddingLeft: 18, borderTop: '1px solid var(--line)',
              color: 'var(--muted)', fontSize: 11, lineHeight: 1.55,
            }}>
              <li>私隱：設定先留在本機 LocalStorage。</li>
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
