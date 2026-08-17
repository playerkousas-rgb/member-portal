'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AntiSpamField, getSubmissionMeta } from '@/components/AntiSpamField';
import { api } from '@/lib/api';
import { TROOP_LIST } from '@/lib/publicContent';
import type { ActivityNotice } from '@/lib/types';
import { useDistrict } from '@/lib/useDistrict';

const SECTIONS = ['小童軍', '幼童軍', '童軍', '深資童軍', '樂行童軍'];
const NATURES = ['露營', '宿營', '日營', '遠足', '遠足營', '海上活動', '服務', '參觀', '其他'];

export default function ActivityPage() {
  const { withDistrict } = useDistrict();
  const startedAt = useRef(Date.now());
  const [notices, setNotices] = useState<ActivityNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterNature, setFilterNature] = useState('');

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

  function loadNotices() {
    setLoading(true);
    setLoadError('');
    api.listActivityNotices().then((result) => {
      if (result.ok && result.data) setNotices(result.data);
      else setLoadError(result.error || '未能載入活動知會。');
      setLoading(false);
    });
  }
  useEffect(loadNotices, []);

  const years = useMemo(() =>
    Array.from(new Set(notices.map((notice) => notice.year).filter(Boolean))).sort().reverse(), [notices]);
  const filtered = useMemo(() => notices.filter((notice) =>
    (!filterYear || notice.year === filterYear) &&
    (!filterSection || notice.section === filterSection) &&
    (!filterNature || notice.nature === filterNature)
  ), [notices, filterYear, filterSection, filterNature]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

    const meta = getSubmissionMeta(event.currentTarget, startedAt.current);
    setBusy(true);
    const result = await api.submitActivityNotice({
      year: startDateTime.slice(0, 4), section, nature, troop, activityName,
      startDateTime, endDateTime, location,
      membersCount: Number(membersCount), leadersCount: Number(leadersCount), parentsCount: Number(parentsCount || 0),
      leaderName, leaderPhone, leaderEmail, note,
    }, meta);
    setBusy(false);
    if (result.ok && result.data) {
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
          知會已提交到區會主 Sheet。如需更改，請聯絡區會並提供以上編號。
        </p>
        <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'center' }}>
          <Link href={withDistrict('/')} className="btn-ghost">返回首頁</Link>
          <button className="btn-sm" onClick={() => {
            startedAt.current = Date.now();
            setDoneRef(''); setActivityName(''); setNote(''); loadNotices();
          }}>
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
      <p className="page-sub">公開查看已提交知會，或將活動資料交區會存檔。公開清單不會顯示負責領袖聯絡資料。</p>

      <section className="panel">
        <h2>活動知會一覽</h2>
        <div className="frow3" style={{ marginBottom: 12 }}>
          <select className="search-input" value={filterYear} onChange={(event) => setFilterYear(event.target.value)} aria-label="按年份篩選">
            <option value="">全部年份</option>
            {years.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
          <select className="search-input" value={filterSection} onChange={(event) => setFilterSection(event.target.value)} aria-label="按支部篩選">
            <option value="">全部支部</option>
            {SECTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select className="search-input" value={filterNature} onChange={(event) => setFilterNature(event.target.value)} aria-label="按性質篩選">
            <option value="">全部性質</option>
            {NATURES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        {loading && <div className="empty">載入中…</div>}
        {loadError && <div className="err">{loadError}</div>}
        {!loading && !loadError && filtered.length === 0 && <div className="empty">暫時未有符合條件嘅活動知會。</div>}
        {filtered.map((notice) => (
          <article className="item-row" key={notice.id} style={{ alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div className="iname">{notice.activityName}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                {notice.troop} · {notice.section} · {notice.nature}
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                {notice.startDateTime}{notice.endDateTime ? ` → ${notice.endDateTime}` : ''}{notice.location ? ` · ${notice.location}` : ''}
              </div>
            </div>
            {notice.refCode && <span className="icat">{notice.refCode}</span>}
          </article>
        ))}
      </section>

      <form className="panel" onSubmit={submit}>
        <h2>提交新知會</h2>
        {error && <div className="err" role="alert">{error}</div>}

        <div className="frow">
          <div className="field">
            <label>旅團 <span className="req">*</span></label>
            <input list="troop-options" value={troop} maxLength={80} onChange={(event) => setTroop(event.target.value)} placeholder="請選擇或輸入旅團" />
            <datalist id="troop-options">{TROOP_LIST.map((item) => <option key={item} value={item} />)}</datalist>
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
    </>
  );
}
