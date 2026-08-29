'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { AntiSpamField, getSubmissionMeta } from '@/components/AntiSpamField';
import { api } from '@/lib/api';
import { TROOP_LIST } from '@/lib/publicContent';
import { useDistrict } from '@/lib/useDistrict';

const SECTIONS = ['小童軍', '幼童軍', '童軍', '深資童軍', '樂行童軍'];
const NATURES = ['露營', '宿營', '日營', '遠足', '遠足營', '海上活動', '服務', '參觀', '其他'];

export default function ActivityPage() {
  const { withDistrict } = useDistrict();
  const startedAt = useRef(Date.now());

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
          呢個表單只係將活動知會區會存檔，已提交嘅記錄只會喺區管理系統列出，唔會喺度顯示。
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
      <p className="page-sub">將旅團戶外活動資料交區會存檔。已提交嘅知會只會喺區管理系統列出，唔會喺度公開顯示。</p>

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
