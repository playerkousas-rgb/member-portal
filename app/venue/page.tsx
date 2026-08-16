'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { PublicInfo, Venue } from '@/lib/types';

const empty = (s: string) => !s || s.trim() === '';

export default function VenuePage() {
  const [pub, setPub] = useState<PublicInfo | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [venueId, setVenueId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [troop, setTroop] = useState('');
  const [position, setPosition] = useState('');
  const [purpose, setPurpose] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [doneRef, setDoneRef] = useState('');

  useEffect(() => {
    api.getPublicInfo().then((r) => { if (r.ok && r.data) setPub(r.data); });
    api.listVenues().then((r) => { if (r.ok && r.data) setVenues(r.data); });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (empty(venueId) || empty(name) || empty(phone) || empty(startDate) || empty(endDate)) {
      setError('請填妥必填項目（場地、日期時間、姓名、電話）。');
      return;
    }
    if (!agree) { setError('請先閱讀並同意「借用規定」。'); return; }
    setBusy(true);
    const r = await api.submitVenueRequest({ venueId, startDate, endDate, name, phone, email, troop, position, purpose, agreeRules: agree });
    setBusy(false);
    if (r.ok && r.data) { setDoneRef(r.data.refCode); window.scrollTo(0, 0); }
    else setError(r.error || '提交失敗，請稍後再試。');
  }

  if (doneRef) {
    return (
      <div className="panel" style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 46 }}>✅</div>
        <h2>已收到借用場地申請</h2>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>
          申請編號：<b style={{ color: '#003366' }}>{doneRef}</b>
        </p>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 10 }}>
          職員批核後，電子鎖密碼會自動發送到你嘅電郵。請留意收件箱。
        </p>
        <div style={{ marginTop: 20 }}>
          <Link href="/" className="btn-ghost">返回首頁</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Link href="/" className="backlink">← 返回服務首頁</Link>
      <h1 className="page-title">🏛 借用場地</h1>
      <p className="page-sub">兩個步驟：① 先去 TeamUp 登記你想用嘅時段；② 返嚟填下表交俾職員批核。</p>

      <div className="panel" style={{ borderLeft: '4px solid #1565c0' }}>
        <h2>📋 借用規定</h2>
        <div style={{ fontSize: 13, whiteSpace: 'pre-line', lineHeight: 1.9 }}>
          {pub?.venueRules || ''}
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {pub?.venueRulesUrl && <a href={pub.venueRulesUrl} target="_blank" rel="noopener" style={{ color: '#1565c0', fontSize: 13, fontWeight: 700 }}>📄 借場規則及程序 ↗</a>}
          {pub?.venueTermsUrl && <a href={pub.venueTermsUrl} target="_blank" rel="noopener" style={{ color: '#1565c0', fontSize: 13, fontWeight: 700 }}>📄 場地一般使用條件 ↗</a>}
          {pub?.cctvUrl && <a href={pub.cctvUrl} target="_blank" rel="noopener" style={{ color: '#1565c0', fontSize: 13, fontWeight: 700 }}>📹 閉路電視監察指引 ↗</a>}
        </div>
      </div>

      <div className="panel">
        <h2>第 1 步：喺 TeamUp 登記時間</h2>
        {pub?.teamupBookingUrl ? (
          <a className="btn" href={pub.teamupBookingUrl} target="_blank" rel="noopener" style={{ display: 'inline-block', textAlign: 'center' }}>
            ↗ 前往 TeamUp 登記
          </a>
        ) : (
          <div className="empty">場地登記連結尚未設定，請直接聯絡職員。</div>
        )}
      </div>

      <form className="panel" onSubmit={submit}>
        <h2>第 2 步：提交借用申請</h2>
        {error && <div className="err">{error}</div>}

        <div className="field">
          <label>場地 <span className="req">*</span></label>
          <select value={venueId} onChange={(e) => setVenueId(e.target.value)}>
            <option value="">— 請選擇 —</option>
            {venues.filter((v) => v.active).map((v) => (
              <option key={v.venueId} value={v.venueId}>{v.name}</option>
            ))}
          </select>
        </div>

        <div className="frow">
          <div className="field"><label>開始時間 <span className="req">*</span></label>
            <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <div className="helptext">要同你喺 TeamUp 登記嘅時間一致。</div>
          </div>
          <div className="field"><label>結束時間 <span className="req">*</span></label>
            <input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
        </div>

        <div className="frow">
          <div className="field"><label>聯絡人姓名 <span className="req">*</span></label>
            <input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="field"><label>聯絡電話 <span className="req">*</span></label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
            <div className="helptext">電子鎖密碼會用你電話號碼生成。</div>
          </div>
        </div>
        <div className="frow">
          <div className="field"><label>電郵（收密碼用）</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="field"><label>旅團</label>
            <input value={troop} onChange={(e) => setTroop(e.target.value)} placeholder="例：港島第82旅" /></div>
        </div>
        <div className="frow">
          <div className="field"><label>職位</label>
            <input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="例：旅長、團長…" /></div>
          <div className="field"><label>用途</label>
            <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="例：旅集會" /></div>
        </div>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, margin: '8px 0 16px' }}>
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 3 }} />
          <span>我已閱讀並同意以上「借用規定」。 <span className="req">*</span></span>
        </label>

        <button className="btn" disabled={busy}>{busy ? '提交中…' : '提交申請'}</button>
      </form>
    </>
  );
}
