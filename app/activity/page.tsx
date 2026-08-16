'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { PublicInfo } from '@/lib/types';

const empty = (s: string) => !s || s.trim() === '';

const SECTIONS = ['小童軍', '幼童軍', '童軍', '深資童軍', '樂行童軍'];
const NATURES = ['露營', '宿營', '日營', '遠足', '遠足營', '海上活動', '服務', '其他'];

export default function ActivityPage() {
  const [pub, setPub] = useState<PublicInfo | null>(null);

  const [troop, setTroop] = useState('');
  const [activityName, setActivityName] = useState('');
  const [sections, setSections] = useState<string[]>([]);
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

  useEffect(() => {
    api.getPublicInfo().then((r) => { if (r.ok && r.data) setPub(r.data); });
  }, []);

  function toggleSection(s: string) {
    setSections((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (empty(troop) || empty(activityName) || empty(nature) || empty(location) || empty(leaderName) || empty(leaderPhone)) {
      setError('請填妥必填項目（旅號、活動名稱、性質、地點、負責領袖）。');
      return;
    }
    if (sections.length === 0) { setError('請選擇至少一個活動支部。'); return; }
    if (empty(startDateTime) || empty(endDateTime)) { setError('請填活動日期及時間。'); return; }
    if (empty(membersCount) || empty(leadersCount)) { setError('請填參加人數（成員及領袖）。'); return; }
    setBusy(true);
    const r = await api.submitActivityNotice({
      troop, activityName, sections, nature, startDateTime, endDateTime,
      location, membersCount, leadersCount, parentsCount, leaderName, leaderPhone, leaderEmail, note,
    });
    setBusy(false);
    if (r.ok && r.data) { setDoneRef(r.data.refCode); window.scrollTo(0, 0); }
    else setError(r.error || '提交失敗，請稍後再試。');
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
          區會已收到你嘅活動知會並存檔。如需更改資料，請另行知會區會職員。
        </p>
        <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'center' }}>
          <Link href="/" className="btn-ghost">返回首頁</Link>
          <button className="btn-sm" onClick={() => { setDoneRef(''); setActivityName(''); setNote(''); }}>
            再知會一項活動
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Link href="/" className="backlink">← 返回服務首頁</Link>
      <h1 className="page-title">📋 旅團活動知會</h1>
      <p className="page-sub">
        根據總會規定，各旅團如進行戶外活動（如參觀、露營、遠足），必須以書面形式知會區會以作存檔。
        直接喺下面填表即可，提交後會寫入區會存檔。
      </p>

      <form className="panel" onSubmit={submit}>
        {error && <div className="err">{error}</div>}

        <div className="frow">
          <div className="field">
            <label>旅號 <span className="req">*</span></label>
            <select value={troop} onChange={(e) => setTroop(e.target.value)}>
              <option value="">— 請選擇 —</option>
              {(pub?.troopList || []).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>活動名稱 <span className="req">*</span></label>
            <input value={activityName} onChange={(e) => setActivityName(e.target.value)} placeholder="例：大潭遠足" />
          </div>
        </div>

        <div className="field">
          <label>活動支部（可多選） <span className="req">*</span></label>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {SECTIONS.map((s) => (
              <label key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5 }}>
                <input type="checkbox" checked={sections.includes(s)} onChange={() => toggleSection(s)} />
                {s}
              </label>
            ))}
          </div>
        </div>

        <div className="frow">
          <div className="field">
            <label>活動性質 <span className="req">*</span></label>
            <select value={nature} onChange={(e) => setNature(e.target.value)}>
              <option value="">— 請選擇 —</option>
              {NATURES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="field">
            <label>活動地點 <span className="req">*</span></label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="例：大潭童軍中心" />
          </div>
        </div>

        <div className="frow">
          <div className="field">
            <label>開始日期及時間 <span className="req">*</span></label>
            <input type="datetime-local" value={startDateTime} onChange={(e) => setStartDateTime(e.target.value)} />
          </div>
          <div className="field">
            <label>結束日期及時間 <span className="req">*</span></label>
            <input type="datetime-local" value={endDateTime} onChange={(e) => setEndDateTime(e.target.value)} />
          </div>
        </div>

        <div className="frow3">
          <div className="field">
            <label>參加人數（成員） <span className="req">*</span></label>
            <input type="number" min={0} value={membersCount} onChange={(e) => setMembersCount(e.target.value)} />
          </div>
          <div className="field">
            <label>參加人數（領袖） <span className="req">*</span></label>
            <input type="number" min={0} value={leadersCount} onChange={(e) => setLeadersCount(e.target.value)} />
          </div>
          <div className="field">
            <label>參加人數（家長）</label>
            <input type="number" min={0} value={parentsCount} onChange={(e) => setParentsCount(e.target.value)} />
          </div>
        </div>

        <div className="frow3">
          <div className="field">
            <label>負責領袖姓名 <span className="req">*</span></label>
            <input value={leaderName} onChange={(e) => setLeaderName(e.target.value)} />
          </div>
          <div className="field">
            <label>負責領袖聯絡電話 <span className="req">*</span></label>
            <input value={leaderPhone} onChange={(e) => setLeaderPhone(e.target.value)} />
          </div>
          <div className="field">
            <label>負責領袖聯絡電郵</label>
            <input type="email" value={leaderEmail} onChange={(e) => setLeaderEmail(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label>其他資料</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="例：其他活動性質之詳情、特別安排…" />
        </div>

        <button className="btn" disabled={busy}>{busy ? '提交中…' : '提交知會'}</button>
      </form>
    </>
  );
}
