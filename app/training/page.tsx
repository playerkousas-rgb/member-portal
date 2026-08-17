'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getStoredDistrictCode, setStoredDistrictCode } from '@/lib/district';
import type { CourseLink, CourseParams, PublicInfo } from '@/lib/types';

const empty = (s: string) => !s || s.trim() === '';

export default function TrainingPage() {
  const [links, setLinks] = useState<CourseLink[]>([]);
  const [params, setParams] = useState<CourseParams | null>(null);
  const [pub, setPub] = useState<PublicInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // 報名表
  const [courseId, setCourseId] = useState('');
  const [memberType, setMemberType] = useState('學員');
  const [nameZh, setNameZh] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [gender, setGender] = useState('');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [scoutDistrict, setScoutDistrict] = useState('');
  const [region, setRegion] = useState('');
  const [troop, setTroop] = useState('');
  const [scoutId, setScoutId] = useState('');
  const [scoutPosition, setScoutPosition] = useState('');
  const [guardianConsent, setGuardianConsent] = useState(false);
  const [guardianName, setGuardianName] = useState('');
  const [guardianRelation, setGuardianRelation] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [leaderConsent, setLeaderConsent] = useState(false);
  const [leaderName, setLeaderName] = useState('');
  const [leaderPosition, setLeaderPosition] = useState('');
  const [leaderEmail, setLeaderEmail] = useState('');
  const [payerName, setPayerName] = useState('');
  const [payAccount, setPayAccount] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [needReceipt, setNeedReceipt] = useState('是');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [doneRef, setDoneRef] = useState('');
  const [doneTitle, setDoneTitle] = useState('');

  useEffect(() => {
    if (!getStoredDistrictCode()) setStoredDistrictCode('SKW');
    api.listCourseLinks().then((r) => { if (r.ok && r.data) setLinks(r.data); setLoading(false); });
    api.listCourseParams().then((r) => { if (r.ok && r.data) setParams(r.data); });
    api.getPublicInfo().then((r) => { if (r.ok && r.data) setPub(r.data); });
  }, []);

  const selected = useMemo(() => links.find((c) => c.courseId === courseId), [links, courseId]);
  const sections = params?.sections || [];
  const districts = params?.districts || [];
  const regions = params?.regions || [];
  const memberTypes = params?.memberTypes?.length ? params.memberTypes : ['學員', '領袖'];

  function pickCourse(id: string) {
    setCourseId(id);
    window.scrollTo({ top: document.getElementById('reg-form')?.offsetTop ?? 0, behavior: 'smooth' });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (empty(courseId) || empty(nameZh) || empty(phone) || empty(email)) {
      setError('請填妥必填項目（課程、中文姓名、電話、電郵）。');
      return;
    }
    setBusy(true);
    const r = await api.submitCourseReg({
      courseId, memberType, nameZh, nameEn, gender, dob, phone, email,
      scoutDistrict, region, troop, scoutId, scoutPosition,
      guardianConsent: guardianConsent ? 'TRUE' : '',
      guardianName, guardianRelation, guardianPhone, guardianEmail,
      leaderConsent: leaderConsent ? 'TRUE' : '',
      leaderName, leaderPosition, leaderEmail,
      payerName, payAccount, receiptUrl, needReceipt, note,
    });
    setBusy(false);
    if (r.ok && r.data) { setDoneRef(r.data.refCode); setDoneTitle(selected?.title || ''); window.scrollTo(0, 0); }
    else setError(r.error || '提交失敗，請稍後再試。');
  }

  if (doneRef) {
    return (
      <div className="panel" style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 46 }}>✅</div>
        <h2>已收到報名</h2>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>
          {doneTitle && <><b style={{ color: '#003366' }}>{doneTitle}</b><br /></>}
          報名編號：<b style={{ color: '#003366' }}>{doneRef}</b>
        </p>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 10 }}>
          {empty(receiptUrl)
            ? '請盡快以轉數快繳費，並補交入數紙（可透過區會職員）。'
            : '已收到你嘅入數紙，職員核對後會以電郵確認。'}
        </p>
        <div style={{ marginTop: 20 }}>
          <Link href="/" className="btn-ghost">返回首頁</Link>{' '}
          <button className="btn-sm" onClick={() => { setDoneRef(''); setCourseId(''); setReceiptUrl(''); }}>再報名</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Link href="/" className="backlink">← 返回服務首頁</Link>
      <h1 className="page-title">🎓 訓練班報名</h1>
      <p className="page-sub">揀你想報嘅訓練班，填表報名。繳費以轉數快（FPS）進行，繳費後上傳入數紙。</p>

      <div className="panel">
        <h2>開辦中嘅訓練班</h2>
        {loading && <div className="empty">載入中…</div>}
        {!loading && links.length === 0 && <div className="empty">暫時未有開放報名嘅訓練班。</div>}
        {links.map((c) => {
          const full = c.quota > 0 && c.filled >= c.quota;
          return (
            <div className="item-row" key={c.courseId} style={{ alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div className="iname">{c.title}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, whiteSpace: 'pre-line' }}>{c.sessionsText}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  {c.badgeName && <span className="icat">🏅 {c.badgeName}</span>}{' '}
                  {c.section && <span className="icat">{c.section}</span>}
                </div>
                {c.eligibility && <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>資格：{c.eligibility}</div>}
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  費用：HK${c.fee}{c.originalFee > c.fee ? `（原價 $${c.originalFee}）` : ''}{c.subsidyNote ? ` · ${c.subsidyNote}` : ''} · 截止：{c.deadline}
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
                  {c.noticeUrl && <a href={c.noticeUrl} target="_blank" rel="noopener" style={{ color: '#1565c0', fontSize: 12, fontWeight: 700 }}>📄 詳情及通告 ↗</a>}
                  {c.contact && <span style={{ fontSize: 11, color: '#64748b' }}>📞 查詢：{c.contact}</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className={`pill ${full ? 'rejected' : 'pending'}`}>{full ? '名額已滿' : `尚餘 ${Math.max(0, c.quota - c.filled)} 位`}</span>
                <div style={{ marginTop: 8 }}>
                  <button className="btn-sm" disabled={full} onClick={() => pickCourse(c.courseId)}>報名</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <form id="reg-form" className="panel" onSubmit={submit}>
        <h2>報名表</h2>
        {error && <div className="err">{error}</div>}

        <div className="frow">
          <div className="field">
            <label>報讀訓練班 <span className="req">*</span></label>
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">— 請選擇 —</option>
              {links.map((c) => <option key={c.courseId} value={c.courseId}>{c.title}</option>)}
            </select>
          </div>
          <div className="field">
            <label>身份 <span className="req">*</span></label>
            <select value={memberType} onChange={(e) => setMemberType(e.target.value)}>
              {memberTypes.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        {selected && (
          <div style={{ background: '#f8fbff', border: '1px solid #dbeafe', borderRadius: 12, padding: 12, marginBottom: 14, fontSize: 12.5, color: '#334155' }}>
            <b>{selected.title}</b>
            {selected.section && <> · {selected.section}</>}
            {selected.badgeName && <> · 🏅 {selected.badgeName}</>}
            <div style={{ whiteSpace: 'pre-line' }}>{selected.sessionsText}</div>
            <div>費用：HK${selected.fee}{selected.originalFee > selected.fee ? `（原價 $${selected.originalFee}）` : ''} · 截止：{selected.deadline}</div>
          </div>
        )}

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
            <select value={scoutDistrict} onChange={(e) => setScoutDistrict(e.target.value)}>
              <option value="">—</option>
              {districts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select></div>
          <div className="field"><label>地域</label>
            <select value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="">—</option>
              {regions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select></div>
        </div>
        <div className="frow">
          <div className="field"><label>旅團</label>
            <input value={troop} onChange={(e) => setTroop(e.target.value)} placeholder="例：港島第82旅" /></div>
          <div className="field"><label>童軍職位</label>
            <input value={scoutPosition} onChange={(e) => setScoutPosition(e.target.value)} /></div>
        </div>

        <div className="panel" style={{ background: '#fefce8', border: '1px solid #fde68a', marginBottom: 14 }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={guardianConsent} onChange={(e) => setGuardianConsent(e.target.checked)} style={{ marginTop: 3 }} />
            <span>如申請人未滿 18 歲，請徵得家長／監護人同意，並填寫以下資料。</span>
          </label>
          {guardianConsent && (
            <>
              <div className="frow" style={{ marginTop: 12 }}>
                <div className="field"><label>監護人姓名</label>
                  <input value={guardianName} onChange={(e) => setGuardianName(e.target.value)} /></div>
                <div className="field"><label>與申請人關係</label>
                  <input value={guardianRelation} onChange={(e) => setGuardianRelation(e.target.value)} placeholder="父／母／監護人" /></div>
              </div>
              <div className="frow">
                <div className="field"><label>監護人電話</label>
                  <input value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} /></div>
                <div className="field"><label>監護人電郵</label>
                  <input type="email" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} /></div>
              </div>
            </>
          )}
        </div>

        <div className="panel" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', marginBottom: 14 }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={leaderConsent} onChange={(e) => setLeaderConsent(e.target.checked)} style={{ marginTop: 3 }} />
            <span>已獲所屬旅團領袖同意推薦報讀（如需要）。</span>
          </label>
          {leaderConsent && (
            <div className="frow3" style={{ marginTop: 12 }}>
              <div className="field"><label>領袖姓名</label>
                <input value={leaderName} onChange={(e) => setLeaderName(e.target.value)} /></div>
              <div className="field"><label>領袖職位</label>
                <input value={leaderPosition} onChange={(e) => setLeaderPosition(e.target.value)} /></div>
              <div className="field"><label>領袖電郵</label>
                <input type="email" value={leaderEmail} onChange={(e) => setLeaderEmail(e.target.value)} /></div>
            </div>
          )}
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

        <div className="field"><label>其他資料</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="其他需要通知嘅資料…" /></div>

        <button className="btn" disabled={busy}>{busy ? '提交中…' : '提交報名'}</button>
      </form>
    </>
  );
}