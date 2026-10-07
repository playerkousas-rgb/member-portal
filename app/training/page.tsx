'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AntiSpamField, getSubmissionMeta } from '@/components/AntiSpamField';
import CourseFpsQr from '@/components/CourseFpsQr';
import { api } from '@/lib/api';
import { SCOUT_DISTRICTS, SCOUT_REGIONS, SCOUT_SECTIONS } from '@/lib/scout';
import { confirmSubmit, useFormGuard } from '@/lib/useFormGuard';
import type { CourseLink } from '@/lib/types';
import { useDistrict } from '@/lib/useDistrict';

const empty = (s: string) => !s || s.trim() === '';

// 讀入數紙截圖 → 縮細至可上傳大小（base64 dataURL）
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('讀取檔案失敗'));
    reader.readAsDataURL(file);
  });
}

async function processReceiptFile(file: File, maxDim = 1600, quality = 0.72): Promise<{ dataUrl: string; mimeType: string }> {
  const raw = await fileToDataUrl(file);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('無法解析圖片'));
    img.src = raw;
  });
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('不支援圖片處理');
  ctx.drawImage(img, 0, 0, w, h);
  return { dataUrl: canvas.toDataURL('image/jpeg', quality), mimeType: 'image/jpeg' };
}

export default function TrainingPage() {
  const { withDistrict } = useDistrict();
  const startedAt = useRef(Date.now());
  const [links, setLinks] = useState<CourseLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // 報名表
  const [courseId, setCourseId] = useState('');
  const [memberType, setMemberType] = useState('');
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
  // 附加資料（有助訓練班取錄之原因）— CourseHub v6.2.1 canonical 欄位
  const [reason, setReason] = useState('');
  const [consentParent, setConsentParent] = useState(false);
  const [gName, setGName] = useState('');
  const [gRelation, setGRelation] = useState('');
  const [gPhone, setGPhone] = useState('');
  const [gEmail, setGEmail] = useState('');
  const [consentLeader, setConsentLeader] = useState(false);
  const [leaderName, setLeaderName] = useState('');
  const [leaderTitle, setLeaderTitle] = useState('');
  const [leaderEmail, setLeaderEmail] = useState('');
  const [payer, setPayer] = useState('');
  const [payAccount, setPayAccount] = useState('');
  const [receiptFile, setReceiptFile] = useState<{ name: string; dataUrl: string; mimeType: string } | null>(null);
  const submitLock = useRef(false);
  const [receiptBusy, setReceiptBusy] = useState(false);
  // 已填妥表格截圖（選填；正本上課時交回）
  const [formShotFile, setFormShotFile] = useState<{ name: string; dataUrl: string } | null>(null);
  const [formShotBusy, setFormShotBusy] = useState(false);
  const [needReceipt, setNeedReceipt] = useState('否');
  const [remark, setRemark] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [doneRef, setDoneRef] = useState('');
  const [doneTitle, setDoneTitle] = useState('');
  const [doneCourse, setDoneCourse] = useState<CourseLink | null>(null);

  useEffect(() => {
    api.listCourseLinks().then((result) => {
      if (result.ok && result.data) {
        const activeLinks = result.data.filter((course) => course.active);
        setLinks(activeLinks);
        // 直接報名連結（通告印嘅成員系統入口）：?courseId=crs_xxx 自動選好課程。
        // 新制 hub 班嘅 courseId 即係公開課程ID（publicCourseId）。
        const qid = (new URLSearchParams(window.location.search).get('courseId') || '').trim();
        if (qid && activeLinks.some((course) => course.courseId === qid)) {
          setCourseId(qid);
          requestAnimationFrame(() => {
            window.scrollTo({ top: document.getElementById('reg-form')?.offsetTop ?? 0, behavior: 'smooth' });
          });
        }
      } else {
        setLoadError(result.error || '未能載入訓練班。');
      }
      setLoading(false);
    });
  }, []);

  const selected = useMemo(() => links.find((c) => c.courseId === courseId), [links, courseId]);
  const sections = SCOUT_SECTIONS;
  const districts = SCOUT_DISTRICTS;
  const regions = SCOUT_REGIONS;

  // 防呆：草稿自動保存＋離開提示（連入數紙一齊存；配額唔夠會自動剔走圖片、文字照保住）
  const snapshot = useMemo(
    () => ({
      courseId, memberType, nameZh, nameEn, gender, dob, phone, email,
      scoutDistrict, region, troop, scoutId, scoutPosition, reason,
      consentParent, gName, gRelation, gPhone, gEmail,
      consentLeader, leaderName, leaderTitle, leaderEmail,
      payer, payAccount, needReceipt, remark,
      receiptName: receiptFile?.name || '', receiptDataUrl: receiptFile?.dataUrl || '',
      receiptMimeType: receiptFile?.mimeType || '', formShotName: formShotFile?.name || '',
      formShotDataUrl: formShotFile?.dataUrl || '',
    }),
    [courseId, memberType, nameZh, nameEn, gender, dob, phone, email,
      scoutDistrict, region, troop, scoutId, scoutPosition, reason,
      consentParent, gName, gRelation, gPhone, gEmail,
      consentLeader, leaderName, leaderTitle, leaderEmail,
      payer, payAccount, needReceipt, remark, receiptFile, formShotFile],
  );
  const guard = useFormGuard('mp:draft:training', snapshot, (saved) => {
    const text = (v: unknown, set: (s: string) => void) => { if (typeof v === 'string') set(v); };
    text(saved.courseId, setCourseId);
    text(saved.memberType, setMemberType);
    text(saved.nameZh, setNameZh);
    text(saved.nameEn, setNameEn);
    text(saved.gender, setGender);
    text(saved.dob, setDob);
    text(saved.phone, setPhone);
    text(saved.email, setEmail);
    text(saved.scoutDistrict, setScoutDistrict);
    text(saved.region, setRegion);
    text(saved.troop, setTroop);
    text(saved.scoutId, setScoutId);
    text(saved.scoutPosition, setScoutPosition);
    text(saved.reason, setReason);
    text(saved.gName, setGName);
    text(saved.gRelation, setGRelation);
    text(saved.gPhone, setGPhone);
    text(saved.gEmail, setGEmail);
    text(saved.leaderName, setLeaderName);
    text(saved.leaderTitle, setLeaderTitle);
    text(saved.leaderEmail, setLeaderEmail);
    text(saved.payer, setPayer);
    text(saved.payAccount, setPayAccount);
    text(saved.needReceipt, setNeedReceipt);
    text(saved.remark, setRemark);
    setConsentParent(saved.consentParent === true);
    setConsentLeader(saved.consentLeader === true);
    if (typeof saved.receiptDataUrl === 'string' && saved.receiptDataUrl && typeof saved.receiptName === 'string') {
      setReceiptFile({
        name: saved.receiptName,
        dataUrl: saved.receiptDataUrl,
        mimeType: typeof saved.receiptMimeType === 'string' ? saved.receiptMimeType : 'image/jpeg',
      });
    }
    if (typeof saved.formShotDataUrl === 'string' && saved.formShotDataUrl && typeof saved.formShotName === 'string') {
      setFormShotFile({ name: saved.formShotName, dataUrl: saved.formShotDataUrl });
    }
  }, { active: !doneRef });

  function pickCourse(id: string) {
    setCourseId(id);
    window.scrollTo({ top: document.getElementById('reg-form')?.offsetTop ?? 0, behavior: 'smooth' });
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitLock.current) return;
    setError('');
    if (empty(courseId) || empty(nameZh) || empty(phone) || empty(email) || empty(memberType)) {
      setError('請填妥必填項目（課程、支部、中文姓名、電話、電郵）。');
      return;
    }
    if (!receiptFile) {
      setError('請上傳入數紙截圖。未繳費將不獲處理申請。');
      return;
    }
    if (!confirmSubmit(
      `確認提交報名？\n\n課程：${selected?.title || courseId}\n姓名：${nameZh}${memberType ? `（${memberType}）` : ''}\n電話：${phone}｜電郵：${email}\n入數紙：${receiptFile.name}\n\n提交後職員核對入數紙，會以電郵確認。`,
    )) return;

    const meta = getSubmissionMeta(e.currentTarget, startedAt.current);
    submitLock.current = true;
    setBusy(true);
    // 送 CourseHub v6.2.1 canonical 欄位；區後台 v4.18.0 會自動對應舊制別名（scoutRank／extra／
    // guardian*／leaderPosition／payerName／note 等）一併轉發，新舊制收表都收得齊。
    const r = await api.submitCourseReg({
      courseId, memberType, nameZh, nameEn, gender, dob, phone, email,
      scoutDistrict, region, troop, scoutId, scoutPosition, reason,
      consentParent: consentParent ? 'TRUE' : '',
      gName, gRelation, gPhone, gEmail,
      consentLeader: consentLeader ? 'TRUE' : '',
      leaderName, leaderTitle, leaderEmail,
      payMethod: 'FPS', payer, payAccount, needReceipt, remark,
      receiptFileName: receiptFile.name,
      receiptMimeType: receiptFile.mimeType,
      receiptDataUrl: receiptFile.dataUrl,
      ...(formShotFile ? { formDataUrl: formShotFile.dataUrl } : {}),
    }, meta);
    submitLock.current = false;
    setBusy(false);
    if (r.ok && r.data) {
      guard.clearDraft();
      setDoneRef(r.data.refCode || '已提交'); setDoneTitle(selected?.title || ''); setDoneCourse(selected || null); window.scrollTo(0, 0);
    }
    else setError(r.error || '提交失敗，請稍後再試。');
  }

  async function onReceiptChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files && e.target.files[0];
    setError('');
    if (!file) return;
    if (!/^image\//.test(file.type)) { setError('請上傳圖片檔案（JPG／PNG）。'); return; }
    if (file.size > 15_000_000) { setError('原始圖片太大，請先壓縮至 15MB 以下。'); return; }
    setReceiptBusy(true);
    try {
      const { dataUrl, mimeType } = await processReceiptFile(file);
      if (dataUrl.length > 3_800_000) throw new Error('COMPRESSED_FILE_TOO_LARGE');
      setReceiptFile({ name: file.name, dataUrl, mimeType });
    } catch {
      setError('圖片處理失敗，請再試。');
    } finally {
      setReceiptBusy(false);
    }
  }

  // 已填妥表格截圖（選填）：同入數紙一樣壓縮，但限額收細，確保兩張圖加埋 body 唔超過 Vercel 4.5MB 上限。
  async function onFormShotChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files && e.target.files[0];
    setError('');
    if (!file) return;
    if (!/^image\//.test(file.type)) { setError('請上傳圖片檔案（JPG／PNG）。'); return; }
    if (file.size > 15_000_000) { setError('原始圖片太大，請先壓縮至 15MB 以下。'); return; }
    setFormShotBusy(true);
    try {
      const { dataUrl } = await processReceiptFile(file, 1400, 0.68);
      if (dataUrl.length > 1_200_000) throw new Error('FORM_SHOT_TOO_LARGE');
      setFormShotFile({ name: file.name, dataUrl });
    } catch {
      setError('表格截圖處理失敗，請改傳細一點嘅圖片再試。');
    } finally {
      setFormShotBusy(false);
    }
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
          已收到你嘅入數紙，職員核對後會以電郵確認。
        </p>
        {doneCourse?.fpsQrPayload && (
          <div style={{ textAlign: 'left', marginTop: 16 }}>
            <div style={{ fontSize: 12.5, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>
              仲未交費？可以即刻用以下 QR 補交，再把入數紙電郵／WhatsApp 俾課程負責人。
            </div>
            <CourseFpsQr course={doneCourse} />
          </div>
        )}
        <div style={{ marginTop: 20 }}>
          <Link href={withDistrict('/')} className="btn-ghost">返回首頁</Link>{' '}
          <button className="btn-sm" onClick={() => { startedAt.current = Date.now(); setDoneRef(''); setCourseId(''); setReceiptFile(null); setFormShotFile(null); setReason(''); setRemark(''); }}>再報名</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Link href={withDistrict('/')} className="backlink">← 返回服務首頁</Link>
      <h1 className="page-title">🎓 訓練班報名</h1>
      <p className="page-sub">揀你想報嘅訓練班，填表報名。繳費以轉數快（FPS）進行，報名時必須上傳入數紙，未繳費將不獲處理。</p>

      <div className="panel">
        <h2>開辦中嘅訓練班</h2>
        {loading && <div className="empty">載入中…</div>}
        {loadError && <div className="err">{loadError}</div>}
        {!loading && !loadError && links.length === 0 && <div className="empty">暫時未有開放報名嘅訓練班。</div>}
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
                {c.leader && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>👔 班領導人：{c.leader}</div>}
                {c.uniform && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>👕 服裝：{c.uniform}</div>}
                {(c.feeNote || c.remarks || c.signupText) && (
                  <details style={{ marginTop: 4, fontSize: 12, color: '#64748b' }}>
                    <summary style={{ cursor: 'pointer', color: '#1565c0', fontWeight: 700 }}>📋 付款須知及備註（通告全文）</summary>
                    {c.feeNote && <div style={{ whiteSpace: 'pre-line', marginTop: 4 }}>💰 {c.feeNote}</div>}
                    {c.remarks && <div style={{ whiteSpace: 'pre-line', marginTop: 4 }}>📝 {c.remarks}</div>}
                    {c.signupText && <div style={{ whiteSpace: 'pre-line', marginTop: 4 }}>🖊 {c.signupText}</div>}
                  </details>
                )}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
                  {c.noticeUrl && <a href={c.noticeUrl} target="_blank" rel="noopener" style={{ color: '#1565c0', fontSize: 12, fontWeight: 700 }}>📄 詳情及通告 ↗</a>}
                  {c.contact && <span style={{ fontSize: 11, color: '#64748b' }}>📞 查詢：{c.contact}</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className={`pill ${full ? 'rejected' : 'pending'}`}>
                  {full ? '名額已滿' : c.quota > 0 ? `尚餘 ${Math.max(0, c.quota - c.filled)} 位` : '接受報名'}
                </span>
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
        {guard.pending && (
          <div className="draft-banner" role="status">
            <span>♻️ 發現上次未提交嘅草稿（{new Date(guard.pending.t).toLocaleString('zh-HK')}）。收據／截圖有機會因儲存空間限制冇備份到，回復後請檢查。</span>
            <span className="draft-actions">
              <button type="button" className="draft-restore" onClick={guard.restore}>回復草稿</button>
              <button type="button" className="draft-discard" onClick={guard.discard}>放棄</button>
            </span>
          </div>
        )}
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
            <label>支部 <span className="req">*</span></label>
            <select value={memberType} onChange={(e) => setMemberType(e.target.value)}>
              <option value="">— 請選擇 —</option>
              {sections.map((m) => <option key={m} value={m}>{m}</option>)}
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
            {selected.leader && <div style={{ marginTop: 2 }}>👔 班領導人：{selected.leader}</div>}
            {selected.uniform && <div style={{ marginTop: 2 }}>👕 服裝：{selected.uniform}</div>}
            {selected.feeNote && <div style={{ whiteSpace: 'pre-line', marginTop: 2 }}>💰 {selected.feeNote}</div>}
            {selected.remarks && <div style={{ whiteSpace: 'pre-line', marginTop: 2 }}>📝 {selected.remarks}</div>}
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
          <div className="field"><label>所屬童軍地域</label>
            <select value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="">—</option>
              {regions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select></div>
          <div className="field"><label>所屬童軍區</label>
            <select value={scoutDistrict} onChange={(e) => setScoutDistrict(e.target.value)}>
              <option value="">—</option>
              {districts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select></div>
        </div>
        <div className="frow">
          <div className="field"><label>旅團</label>
            <input value={troop} onChange={(e) => setTroop(e.target.value)} placeholder="例：港島第82旅" /></div>
          <div className="field"><label>童軍職位</label>
            <input value={scoutPosition} onChange={(e) => setScoutPosition(e.target.value)} /></div>
        </div>
        <div className="field" style={{ marginBottom: 14 }}>
          <label>附加資料</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="有助訓練班取錄之原因（選填）" />
        </div>

        <div className="panel" style={{ background: '#fefce8', border: '1px solid #fde68a', marginBottom: 14 }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={consentParent} onChange={(e) => setConsentParent(e.target.checked)} style={{ marginTop: 3 }} />
            <span>如申請人未滿 18 歲，請徵得家長／監護人同意，並填寫以下資料。</span>
          </label>
          {consentParent && (
            <>
              <div className="frow" style={{ marginTop: 12 }}>
                <div className="field"><label>監護人姓名</label>
                  <input value={gName} onChange={(e) => setGName(e.target.value)} /></div>
                <div className="field"><label>與申請人關係</label>
                  <input value={gRelation} onChange={(e) => setGRelation(e.target.value)} placeholder="父／母／監護人" /></div>
              </div>
              <div className="frow">
                <div className="field"><label>監護人電話</label>
                  <input value={gPhone} onChange={(e) => setGPhone(e.target.value)} /></div>
                <div className="field"><label>監護人電郵</label>
                  <input type="email" value={gEmail} onChange={(e) => setGEmail(e.target.value)} /></div>
              </div>
            </>
          )}
        </div>

        <div className="panel" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', marginBottom: 14 }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={consentLeader} onChange={(e) => setConsentLeader(e.target.checked)} style={{ marginTop: 3 }} />
            <span>已獲所屬旅團領袖同意推薦報讀（如需要）。</span>
          </label>
          {consentLeader && (
            <div className="frow3" style={{ marginTop: 12 }}>
              <div className="field"><label>領袖姓名</label>
                <input value={leaderName} onChange={(e) => setLeaderName(e.target.value)} /></div>
              <div className="field"><label>領袖職位</label>
                <input value={leaderTitle} onChange={(e) => setLeaderTitle(e.target.value)} /></div>
              <div className="field"><label>領袖電郵</label>
                <input type="email" value={leaderEmail} onChange={(e) => setLeaderEmail(e.target.value)} /></div>
            </div>
          )}
        </div>

        <div className="panel" style={{ background: '#f8fbff', border: '1px solid #dbeafe' }}>
          <h2>💳 繳費（轉數快）</h2>
          {selected?.fpsQrPayload ? (
            <CourseFpsQr course={selected} />
          ) : (
            <div style={{ fontSize: 12.5, color: '#334155', marginBottom: 12 }}>
              請按課程通告提供嘅付款資料完成繳費，並上傳入數紙截圖。
            </div>
          )}
          <div className="frow">
            <div className="field"><label>付款人姓名</label>
              <input value={payer} onChange={(e) => setPayer(e.target.value)} /></div>
            <div className="field"><label>付款帳戶（FPS 識別）</label>
              <input value={payAccount} onChange={(e) => setPayAccount(e.target.value)} placeholder="電話 / FPS ID" /></div>
          </div>
          <div className="field"><label>入數紙截圖 <span className="req">*</span></label>
            <input type="file" accept="image/*" onChange={onReceiptChange} />
            <div className="helptext">上傳後會存入訓練班嘅雲端資料夾。必須報名時上傳，未繳費將不獲處理申請。</div>
            {receiptBusy && <div className="helptext">處理中…</div>}
            {receiptFile && (
              <div className="helptext" style={{ color: '#166534', fontWeight: 700 }}>
                ✅ 已上傳：{receiptFile.name}
              </div>
            )}
          </div>
          <div className="field"><label>已填妥表格截圖</label>
            <input type="file" accept="image/*" onChange={onFormShotChange} />
            <div className="helptext">如已填妥訓練班紙本表格，請上傳填妥表格嘅照片；正本於上課時交回（選填）。</div>
            {formShotBusy && <div className="helptext">處理中…</div>}
            {formShotFile && (
              <div className="helptext" style={{ color: '#166534', fontWeight: 700 }}>
                ✅ 已上傳：{formShotFile.name}
              </div>
            )}
          </div>
          <div className="field"><label>需要收據？</label>
            <select value={needReceipt} onChange={(e) => setNeedReceipt(e.target.value)}>
              <option>否</option><option>是</option>
            </select></div>
        </div>

        <div className="field"><label>備註</label>
          <textarea value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="其他需要通知嘅資料…" /></div>

        <AntiSpamField />
        <button className="btn" disabled={busy || loading || links.length === 0}>{busy ? '提交中…' : '提交報名'}</button>
      </form>
    </>
  );
}