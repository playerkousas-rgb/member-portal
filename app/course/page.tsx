'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Course, PublicInfo } from '@/lib/types';

const empty = (s: string) => !s || s.trim() === '';

export default function CoursePage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [pub, setPub] = useState<PublicInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const [courseId, setCourseId] = useState('');
  const [nameZh, setNameZh] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('');
  const [dob, setDob] = useState('');
  const [scoutDistrict, setScoutDistrict] = useState('');
  const [troop, setTroop] = useState('');
  const [scoutId, setScoutId] = useState('');
  const [scoutPosition, setScoutPosition] = useState('');
  const [leaderName, setLeaderName] = useState('');
  const [leaderPosition, setLeaderPosition] = useState('');
  const [leaderEmail, setLeaderEmail] = useState('');
  const [payerName, setPayerName] = useState('');
  const [payAccount, setPayAccount] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [needReceipt, setNeedReceipt] = useState('是');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [doneRef, setDoneRef] = useState('');

  useEffect(() => {
    api.listCourses().then((r) => { if (r.ok && r.data) setCourses(r.data); setLoading(false); });
    api.getPublicInfo().then((r) => { if (r.ok && r.data) setPub(r.data); });
  }, []);

  const selected = courses.find((c) => c.courseId === courseId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (empty(courseId) || empty(nameZh) || empty(phone) || empty(email)) {
      setError('請填妥必填項目（班、中文姓名、電話、電郵）。');
      return;
    }
    setBusy(true);
    const r = await api.submitCourseReg({
      courseId, nameZh, nameEn, phone, email, gender, dob, scoutDistrict, troop,
      scoutId, scoutPosition, leaderName, leaderPosition, leaderEmail,
      payerName, payAccount, receiptUrl, needReceipt,
    });
    setBusy(false);
    if (r.ok && r.data) { setDoneRef(r.data.refCode); window.scrollTo(0, 0); }
    else setError(r.error || '提交失敗，請稍後再試。');
  }

  if (doneRef) {
    return (
      <div className="panel" style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 46 }}>✅</div>
        <h2>已收到報名</h2>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>
          報名編號：<b style={{ color: '#003366' }}>{doneRef}</b>
        </p>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 10 }}>
          {empty(receiptUrl)
            ? '請盡快以轉數快繳費，並再次確認已上傳入數紙。'
            : '已收到你嘅入數紙，職員核對後會以電郵確認。'}
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
      <h1 className="page-title">🎓 報讀訓練班</h1>
      <p className="page-sub">瀏覽開辦中嘅班，填表報名。繳費以轉數快（FPS）進行，繳費後上傳入數紙。</p>

      <div className="panel">
        <h2>開辦中嘅班</h2>
        {loading && <div className="empty">載入中…</div>}
        {!loading && courses.length === 0 && <div className="empty">暫時未有開辦中嘅班。</div>}
        {courses.map((c) => (
          <div className="item-row" key={c.courseId} style={{ alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div className="iname">{c.title}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, whiteSpace: 'pre-line' }}>{c.sessionsText}</div>
              {c.eligibility && <div style={{ fontSize: 12, color: '#64748b' }}>資格：{c.eligibility}</div>}
              <div style={{ fontSize: 12, color: '#64748b' }}>
                費用：HK${c.fee}{c.originalFee > c.fee ? `（原價 $${c.originalFee}）` : ''} · 截止：{c.deadline}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="pill pending">尚餘 {Math.max(0, c.quota - c.filled)} 位</span>
              <div style={{ marginTop: 8 }}>
                <button className="btn-sm" onClick={() => { setCourseId(c.courseId); window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); }}>
                  報名
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <form className="panel" onSubmit={submit}>
        <h2>報名表</h2>
        {error && <div className="err">{error}</div>}

        <div className="field">
          <label>報讀班別 <span className="req">*</span></label>
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">— 請選擇 —</option>
            {courses.map((c) => <option key={c.courseId} value={c.courseId}>{c.title}</option>)}
          </select>
        </div>

        <div className="frow">
          <div className="field"><label>中文姓名 <span className="req">*</span></label>
            <input value={nameZh} onChange={(e) => setNameZh(e.target.value)} /></div>
          <div className="field"><label>英文姓名</label>
            <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} /></div>
        </div>
        <div className="frow">
          <div className="field"><label>聯絡電話 <span className="req">*</span></label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div className="field"><label>電郵 <span className="req">*</span></label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        </div>
        <div className="frow3">
          <div className="field"><label>性別</label>
            <select value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">—</option><option>男</option><option>女</option>
            </select></div>
          <div className="field"><label>出生日期</label>
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} /></div>
          <div className="field"><label>童軍成員編號（ScoutID）</label>
            <input value={scoutId} onChange={(e) => setScoutId(e.target.value)} /></div>
        </div>
        <div className="frow">
          <div className="field"><label>所屬童軍區</label>
            <input value={scoutDistrict} onChange={(e) => setScoutDistrict(e.target.value)} /></div>
          <div className="field"><label>旅團</label>
            <input value={troop} onChange={(e) => setTroop(e.target.value)} placeholder="例：港島第82旅" /></div>
        </div>
        <div className="field"><label>童軍職位</label>
          <input value={scoutPosition} onChange={(e) => setScoutPosition(e.target.value)} /></div>

        <div className="frow3">
          <div className="field"><label>領袖姓名</label>
            <input value={leaderName} onChange={(e) => setLeaderName(e.target.value)} /></div>
          <div className="field"><label>領袖職位</label>
            <input value={leaderPosition} onChange={(e) => setLeaderPosition(e.target.value)} /></div>
          <div className="field"><label>領袖電郵</label>
            <input value={leaderEmail} onChange={(e) => setLeaderEmail(e.target.value)} /></div>
        </div>

        <div className="panel" style={{ background: '#f8fbff', border: '1px solid #dbeafe' }}>
          <h2>💳 繳費（轉數快）</h2>
          {pub && (
            <div style={{ fontSize: 12.5, color: '#334155', marginBottom: 12 }}>
              請轉數快至 <b>{pub.fpsAccountName}</b>（帳戶：{pub.fpsAccountNumber}），並上傳入數紙截圖。
            </div>
          )}
          <div className="frow">
            <div className="field"><label>付款人姓名</label>
              <input value={payerName} onChange={(e) => setPayerName(e.target.value)} /></div>
            <div className="field"><label>付款帳戶（FPS 識別）</label>
              <input value={payAccount} onChange={(e) => setPayAccount(e.target.value)} placeholder="電話 / FPS ID" /></div>
          </div>
          <div className="field"><label>入數紙截圖連結（Google Drive 分享連結）</label>
            <input value={receiptUrl} onChange={(e) => setReceiptUrl(e.target.value)} placeholder="https://drive.google.com/open?id=…" />
            <div className="helptext">如未繳費可稍後補交，或直接 WhatsApp 俾職員。</div>
          </div>
          <div className="field"><label>需要收據？</label>
            <select value={needReceipt} onChange={(e) => setNeedReceipt(e.target.value)}>
              <option>是</option><option>否</option>
            </select></div>
        </div>

        <button className="btn" disabled={busy}>{busy ? '提交中…' : '提交報名'}</button>
      </form>
    </>
  );
}
