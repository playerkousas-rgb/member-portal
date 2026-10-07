'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AntiSpamField, getSubmissionMeta } from '@/components/AntiSpamField';
import { api } from '@/lib/api';
import { usePublicInfo } from '@/lib/usePublicInfo';
import { confirmSubmit, useFormGuard } from '@/lib/useFormGuard';
import type { ActivityNotice } from '@/lib/types';
import { useDistrict } from '@/lib/useDistrict';

const SECTIONS = ['小童軍', '幼童軍', '童軍', '深資童軍', '樂行童軍'];
const NATURES = ['露營', '宿營', '日營', '遠足', '遠足營', '海上活動', '服務', '參觀', '其他'];

export default function ActivityPage() {
  const { withDistrict } = useDistrict();
  const { troopList } = usePublicInfo();
  const startedAt = useRef(Date.now());
  const submitLock = useRef(false);

  const [troop, setTroop] = useState('');
  const [activityName, setActivityName] = useState('');
  const [section, setSection] = useState('');
  const [nature, setNature] = useState('');
  const [startDateTime, setStartDateTime] = useState('');
  const [endDateTime, setEndDateTime] = useState('');
  const [location, setLocation] = useState('');
  const [membersCount, setMembersCount] = useState('');
  const [leadersCount, setLeadersCount] = useState('');
  const [parentsCount, setParentsCount] = useState('');
  const [leaderName, setLeaderName] = useState('');
  const [leaderPhone, setLeaderPhone] = useState('');
  const [leaderEmail, setLeaderEmail] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [doneRef, setDoneRef] = useState('');

  // 已遞交嘅知會（公開欄位）；提交成功（doneRef 改變）後自動重新載入
  const [notices, setNotices] = useState<ActivityNotice[]>([]);
  const [noticesLoading, setNoticesLoading] = useState(true);
  const [noticesError, setNoticesError] = useState('');
  const [yearFilter, setYearFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    setNoticesLoading(true);
    api.listActivityNotices().then((result) => {
      if (cancelled) return;
      if (result.ok && result.data) {
        setNotices(result.data);
        setNoticesError('');
      } else {
        setNoticesError(result.error || '未能載入已遞交嘅知會。');
      }
      setNoticesLoading(false);
    });
    return () => { cancelled = true; };
  }, [doneRef]);

  // 防呆：草稿自動保存＋離開提示（詳見 lib/useFormGuard.ts）
  const snapshot = useMemo(
    () => ({
      troop, activityName, section, nature, startDateTime, endDateTime, location,
      membersCount, leadersCount, parentsCount, leaderName, leaderPhone, leaderEmail, note,
    }),
    [troop, activityName, section, nature, startDateTime, endDateTime, location,
      membersCount, leadersCount, parentsCount, leaderName, leaderPhone, leaderEmail, note],
  );
  const guard = useFormGuard('mp:draft:activity', snapshot, (saved) => {
    if (typeof saved.troop === 'string') setTroop(saved.troop);
    if (typeof saved.activityName === 'string') setActivityName(saved.activityName);
    if (typeof saved.section === 'string') setSection(saved.section);
    if (typeof saved.nature === 'string') setNature(saved.nature);
    if (typeof saved.startDateTime === 'string') setStartDateTime(saved.startDateTime);
    if (typeof saved.endDateTime === 'string') setEndDateTime(saved.endDateTime);
    if (typeof saved.location === 'string') setLocation(saved.location);
    if (typeof saved.membersCount === 'string') setMembersCount(saved.membersCount);
    if (typeof saved.leadersCount === 'string') setLeadersCount(saved.leadersCount);
    if (typeof saved.parentsCount === 'string') setParentsCount(saved.parentsCount);
    if (typeof saved.leaderName === 'string') setLeaderName(saved.leaderName);
    if (typeof saved.leaderPhone === 'string') setLeaderPhone(saved.leaderPhone);
    if (typeof saved.leaderEmail === 'string') setLeaderEmail(saved.leaderEmail);
    if (typeof saved.note === 'string') setNote(saved.note);
  }, { active: !doneRef });

  function resetForm() {
    startedAt.current = Date.now();
    setDoneRef('');
    setTroop('');
    setActivityName('');
    setSection('');
    setNature('');
    setStartDateTime('');
    setEndDateTime('');
    setLocation('');
    setMembersCount('');
    setLeadersCount('');
    setParentsCount('');
    setLeaderName('');
    setLeaderPhone('');
    setLeaderEmail('');
    setNote('');
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current) return;
    setError('');
    if (!troop.trim() || !activityName.trim() || !section || !nature || !location.trim() || !leaderName.trim() || !leaderPhone.trim()) {
      setError('請填妥必填項目（旅團、活動、支部、性質、地點及負責領袖）。');
      return;
    }
    if (!startDateTime || !endDateTime) {
      setError('請填活動開始及結束日期時間。');
      return;
    }
    if (new Date(endDateTime).getTime() <= new Date(startDateTime).getTime()) {
      setError('結束時間必須遲過開始時間。');
      return;
    }
    if (membersCount === '' || leadersCount === '') {
      setError('請填參加成員及領袖人數。');
      return;
    }
    if (!confirmSubmit(
      `確認提交活動知會？\n\n${troop}．${activityName}\n${startDateTime.replace('T', ' ')} → ${endDateTime.replace('T', ' ')}\n📍 ${location}\n成員 ${membersCount}・領袖 ${leadersCount}${parentsCount ? `・家長 ${parentsCount}` : ''}\n\n提交後會喺下方公開列表顯示（只顯示公開欄位，領袖聯絡資料唔會公開）。`,
    )) return;

    const meta = getSubmissionMeta(event.currentTarget, startedAt.current);
    submitLock.current = true;
    setBusy(true);
    const result = await api.submitActivityNotice({
      year: startDateTime.slice(0, 4), section, nature, troop, activityName,
      startDateTime, endDateTime, location,
      membersCount: Number(membersCount), leadersCount: Number(leadersCount), parentsCount: Number(parentsCount || 0),
      leaderName, leaderPhone, leaderEmail, note,
    }, meta);
    submitLock.current = false;
    setBusy(false);
    if (result.ok && result.data) {
      guard.clearDraft();
      setDoneRef(result.data.refCode || '已提交');
      window.scrollTo(0, 0);
    } else {
      setError(result.error || '提交失敗，請稍後再試。');
    }
  }

  if (doneRef) {
    return (
      <div className="panel" style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 46 }}>✅</div>
        <h2>已收到活動知會</h2>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>
          知會編號：<b style={{ color: '#003366' }}>{doneRef}</b>
        </p>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 10 }}>
          呢個表單會將活動知會交區會存檔；已遞交嘅記錄會喺本頁下方列出（只顯示公開欄位）。
        </p>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
          如需更改，請聯絡區會並提供以上編號。
        </p>
        <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'center' }}>
          <Link href={withDistrict('/')} className="btn-ghost">返回首頁</Link>
          <button className="btn-sm" onClick={resetForm}>
            再知會一項活動
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Link href={withDistrict('/')} className="backlink">← 返回服務首頁</Link>
      <h1 className="page-title">📋 旅團活動知會</h1>
      <p className="page-sub">將旅團戶外活動資料交區會存檔；已遞交嘅知會會喺本頁下方列出（只顯示公開欄位）。</p>

      <form className="panel" onSubmit={submit}>
        <h2>提交新知會</h2>
        {guard.pending && (
          <div className="draft-banner" role="status">
            <span>♻️ 發現上次未提交嘅草稿（{new Date(guard.pending.t).toLocaleString('zh-HK')}）。</span>
            <span className="draft-actions">
              <button type="button" className="draft-restore" onClick={guard.restore}>回復草稿</button>
              <button type="button" className="draft-discard" onClick={guard.discard}>放棄</button>
            </span>
          </div>
        )}
        {error && <div className="err" role="alert">{error}</div>}

        <div className="frow">
          <div className="field">
            <label>旅團 <span className="req">*</span></label>
            <input list="troop-options" value={troop} maxLength={80} onChange={(event) => setTroop(event.target.value)} placeholder="請選擇或輸入旅團" />
            <datalist id="troop-options">{troopList.map((item) => <option key={item} value={item} />)}</datalist>
          </div>
          <div className="field">
            <label>活動名稱 <span className="req">*</span></label>
            <input value={activityName} maxLength={160} onChange={(event) => setActivityName(event.target.value)} placeholder="例：大潭遠足" />
          </div>
        </div>

        <div className="frow">
          <div className="field">
            <label>活動支部 <span className="req">*</span></label>
            <select value={section} onChange={(event) => setSection(event.target.value)}>
              <option value="">— 請選擇 —</option>
              {SECTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div className="field">
            <label>活動性質 <span className="req">*</span></label>
            <select value={nature} onChange={(event) => setNature(event.target.value)}>
              <option value="">— 請選擇 —</option>
              {NATURES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        </div>

        <div className="frow">
          <div className="field">
            <label>開始日期及時間 <span className="req">*</span></label>
            <input type="datetime-local" value={startDateTime} onChange={(event) => setStartDateTime(event.target.value)} />
          </div>
          <div className="field">
            <label>結束日期及時間 <span className="req">*</span></label>
            <input type="datetime-local" value={endDateTime} onChange={(event) => setEndDateTime(event.target.value)} />
          </div>
        </div>

        <div className="field">
          <label>活動地點 <span className="req">*</span></label>
          <input value={location} maxLength={200} onChange={(event) => setLocation(event.target.value)} placeholder="例：大潭童軍中心" />
        </div>

        <div className="frow3">
          <div className="field">
            <label>成員人數 <span className="req">*</span></label>
            <input type="number" min={0} max={9999} value={membersCount} onChange={(event) => setMembersCount(event.target.value)} />
          </div>
          <div className="field">
            <label>領袖人數 <span className="req">*</span></label>
            <input type="number" min={0} max={9999} value={leadersCount} onChange={(event) => setLeadersCount(event.target.value)} />
          </div>
          <div className="field">
            <label>家長人數</label>
            <input type="number" min={0} max={9999} value={parentsCount} onChange={(event) => setParentsCount(event.target.value)} />
          </div>
        </div>

        <div className="frow3">
          <div className="field">
            <label>負責領袖姓名 <span className="req">*</span></label>
            <input value={leaderName} maxLength={120} onChange={(event) => setLeaderName(event.target.value)} />
          </div>
          <div className="field">
            <label>負責領袖電話 <span className="req">*</span></label>
            <input type="tel" value={leaderPhone} maxLength={30} onChange={(event) => setLeaderPhone(event.target.value)} />
          </div>
          <div className="field">
            <label>負責領袖電郵</label>
            <input type="email" value={leaderEmail} maxLength={254} onChange={(event) => setLeaderEmail(event.target.value)} />
          </div>
        </div>

        <div className="field">
          <label>其他資料</label>
          <textarea value={note} maxLength={2000} onChange={(event) => setNote(event.target.value)} placeholder="特別安排或補充資料" />
        </div>
        <AntiSpamField />
        <button className="btn" disabled={busy}>{busy ? '提交中…' : '提交知會'}</button>
      </form>

      <section className="panel">
        <h2>已遞交嘅活動知會</h2>
        <p className="helptext" style={{ marginBottom: 10 }}>
          只顯示公開欄位（旅團、活動、時段、地點及人數）；負責領袖姓名、電話、電郵及備註唔會公開。
        </p>
        {(() => {
          const years = [...new Set(notices.map((n) => n.year).filter(Boolean))].sort().reverse();
          const filtered = yearFilter ? notices.filter((n) => n.year === yearFilter) : notices;
          if (noticesLoading) return <div className="empty">正在載入已遞交嘅知會…</div>;
          if (noticesError) return <div className="err" style={{ marginBottom: 0 }}>{noticesError}</div>;
          if (!notices.length) return <div className="empty">未有已遞交嘅活動知會。</div>;
          return (
            <>
              {years.length > 1 && (
                <div className="field" style={{ maxWidth: 200 }}>
                  <label>年份</label>
                  <select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
                    <option value="">全部年份</option>
                    {years.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              )}
              {filtered.length === 0
                ? <div className="empty">這個年份未有知會記錄。</div>
                : filtered.map((n) => (
                  <div key={n.id} style={{ padding: '10px 2px', borderBottom: '1px dashed var(--line)' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'baseline' }}>
                      <strong style={{ color: 'var(--p)' }}>{n.troop}．{n.activityName}</strong>
                      <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                        {n.year}・{n.section}{n.nature ? `・${n.nature}` : ''}
                      </span>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--slate)', marginTop: 4, lineHeight: 1.7 }}>
                      {n.startDateTime.replace('T', ' ')} → {n.endDateTime.replace('T', ' ')}｜📍 {n.location}
                      <br />
                      成員 {n.membersCount}・領袖 {n.leadersCount}・家長 {n.parentsCount}
                      {n.refCode ? `｜編號 ${n.refCode}` : ''}
                    </div>
                  </div>
                ))}
            </>
          );
        })()}
      </section>
    </>
  );
}
