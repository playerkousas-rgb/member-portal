'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AntiSpamField, getSubmissionMeta } from '@/components/AntiSpamField';
import { api } from '@/lib/api';
import { confirmSubmit, useFormGuard } from '@/lib/useFormGuard';
import { useDistrict } from '@/lib/useDistrict';

const MESSAGE_MAX = 2000;
const CONTACT_TYPES = [
  { value: 'phone', label: '電話' },
  { value: 'email', label: '電郵' },
  { value: 'ig', label: 'Instagram' },
  { value: 'fb', label: 'Facebook' },
] as const;
const CATEGORIES = [
  { value: 'opinion', label: '想同區講', hint: '意見、建議、觀察，或者任何想區知嘅事' },
  { value: 'support', label: '想區支援', hint: '遇到困難，希望區會提供協助或資源' },
] as const;

const empty = (value: string) => !value.trim();

export default function FeedbackPage() {
  const { withDistrict } = useDistrict();
  const startedAt = useRef(Date.now());
  const submitLock = useRef(false);
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');
  const [wantReply, setWantReply] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactType, setContactType] = useState<string>('phone');
  const [contact, setContact] = useState('');
  const [dcOnly, setDcOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [doneRef, setDoneRef] = useState('');

  const snapshot = useMemo(
    () => ({ category, message, wantReply, contactName, contactType, contact, dcOnly }),
    [category, message, wantReply, contactName, contactType, contact, dcOnly],
  );
  const guard = useFormGuard('mp:draft:feedback', snapshot, (saved) => {
    if (typeof saved.category === 'string') setCategory(saved.category);
    if (typeof saved.message === 'string') setMessage(saved.message);
    setWantReply(saved.wantReply === true);
    if (typeof saved.contactName === 'string') setContactName(saved.contactName);
    if (typeof saved.contactType === 'string') setContactType(saved.contactType);
    if (typeof saved.contact === 'string') setContact(saved.contact);
    setDcOnly(saved.dcOnly === true);
  }, { active: !doneRef });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current) return;
    setError('');
    if (empty(category)) {
      setError('請選擇留言類別。');
      return;
    }
    if (empty(message)) {
      setError('請填寫留言內容。');
      return;
    }
    if (message.length > MESSAGE_MAX) {
      setError(`留言內容不可超過 ${MESSAGE_MAX} 字。`);
      return;
    }
    if (wantReply && empty(contact)) {
      setError('你選擇咗想收到回覆，請填寫至少一個聯絡方法。');
      return;
    }
    const categoryLabel = CATEGORIES.find((c) => c.value === category)?.label || '';
    const contactLabel = wantReply
      ? `${CONTACT_TYPES.find((t) => t.value === contactType)?.label || ''}${contact ? `：${contact}` : ''}${contactName ? `（${contactName}）` : ''}`
      : '匿名，毋須回覆';
    if (!confirmSubmit(
      `確認遞交留言？\n\n類別：${categoryLabel}\n內容：${message.slice(0, 80)}${message.length > 80 ? '…' : ''}\n`
      + `聯絡：${contactLabel}\n保密直達區總監（DC）：${dcOnly ? '是' : '否'}\n\n`
      + '匿名留言遞交後無法自行追查或撤回，請記低確認頁嘅參考編號。',
    )) return;

    const meta = getSubmissionMeta(event.currentTarget, startedAt.current);
    submitLock.current = true;
    setBusy(true);
    const result = await api.submitDistrictFeedback(
      {
        category,
        message,
        wantReply,
        contactName: wantReply ? contactName : '',
        contactType: wantReply ? contactType : '',
        contact: wantReply ? contact : '',
        dcOnly,
      },
      meta,
    );
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
        <div style={{ fontSize: 46 }}>📨</div>
        <h2>已收到你嘅留言</h2>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>
          留言編號：<b style={{ color: '#003366' }}>{doneRef}</b>
        </p>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 10 }}>
          {dcOnly
            ? '留言已保密直達區總監（DC），只有 DC 睇到。'
            : '區會職員會喺區管理系統閱讀跟進。'}
          {wantReply ? '你已提供聯絡方法，區會會按內容適時回覆。' : '你以匿名方式提交，區會無法主聯絡你；如有後續，請提供此編號查詢。'}
        </p>
        <div style={{ marginTop: 20 }}>
          <Link href={withDistrict('/')} className="btn-ghost">返回首頁</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Link href={withDistrict('/')} className="backlink">← 返回服務首頁</Link>
      <h1 className="page-title">💬 你講我聽</h1>
      <p className="page-sub">
        區務意見箱｜可匿名留言、尋求支援；想收到區回覆先填聯絡方法。
      </p>

      <section className="panel" style={{ borderLeft: '4px solid #1565c0' }}>
        <h2>📌 點樣運作</h2>
        <ul style={{ fontSize: 13, lineHeight: 1.9, margin: 0, paddingLeft: 20 }}>
          <li>預設<strong>匿名</strong>：唔填聯絡方法就冇任何個人資料，區會只見到留言內容。</li>
          <li>想收到回覆先填聯絡方法（電話／電郵／IG／FB），資料只供區會就呢則留言聯絡你。</li>
          <li>剔選「<strong>保密直達區總監</strong>」後，留言只寫入 DC 專用保密分頁，其他區職員睇唔到。</li>
          <li>留言唔經 Teamup，亦唔係 App 技術問題回報；App 故障請用頁尾「問題回報」。</li>
        </ul>
      </section>

      <form className="panel" onSubmit={submit}>
        <h2>寫低你嘅說話</h2>
        {guard.pending && (
          <div className="draft-banner" role="status">
            <span>♻️ 發現上次未提交嘅草稿（{new Date(guard.pending.t).toLocaleString('zh-HK')}）。</span>
            <span>
              <button type="button" className="draft-restore" onClick={guard.restore}>回復草稿</button>
              <button type="button" className="draft-discard" onClick={guard.discard}>放棄</button>
            </span>
          </div>
        )}
        {error && <div className="err" role="alert">{error}</div>}

        <div className="field">
          <label>留言類別 <span className="req">*</span></label>
          <div role="radiogroup" aria-label="留言類別" style={{ display: 'grid', gap: 8 }}>
            {CATEGORIES.map((c) => (
              <label
                key={c.value}
                style={{
                  display: 'flex', gap: 9, alignItems: 'flex-start', padding: '10px 12px',
                  border: `1px solid ${category === c.value ? '#1565c0' : 'var(--line)'}`,
                  borderRadius: 10, background: category === c.value ? '#eff6ff' : '#fff',
                  cursor: 'pointer', fontSize: 13.5,
                }}
              >
                <input
                  type="radio"
                  name="feedback-category"
                  value={c.value}
                  checked={category === c.value}
                  onChange={() => setCategory(c.value)}
                  style={{ width: 'auto', marginTop: 3 }}
                />
                <span>
                  <strong>{c.label}</strong>
                  <small style={{ display: 'block', color: '#64748b', marginTop: 2 }}>{c.hint}</small>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <label>留言內容 <span className="req">*</span></label>
          <textarea
            value={message}
            maxLength={MESSAGE_MAX}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="寫低你想同區講嘅事、具體情況，或者需要咩支援…"
            style={{ minHeight: 150 }}
          />
          <p className="helptext" style={{ textAlign: 'right' }}>{message.length}／{MESSAGE_MAX}</p>
        </div>

        <div className="field">
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, fontWeight: 400 }}>
            <input
              type="checkbox"
              checked={wantReply}
              onChange={(event) => setWantReply(event.target.checked)}
              style={{ width: 'auto', marginTop: 3 }}
            />
            <span>我想收到區嘅回覆（展開聯絡方法；唔剔就以匿名方式提交）</span>
          </label>
        </div>

        {wantReply && (
          <div style={{ background: '#f8fafc', border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px', marginBottom: 13 }}>
            <div className="frow">
              <div className="field" style={{ marginBottom: 0 }}>
                <label>稱呼（選填）</label>
                <input value={contactName} maxLength={120} onChange={(event) => setContactName(event.target.value)} placeholder="例：陳先生／82 旅旅長" />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>聯絡方法 <span className="req">*</span></label>
                <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 8 }}>
                  <select value={contactType} onChange={(event) => setContactType(event.target.value)}>
                    {CONTACT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <input value={contact} maxLength={200} onChange={(event) => setContact(event.target.value)} placeholder="電話號碼／電郵／IG 或 FB 帳號" />
                </div>
              </div>
            </div>
            <p className="helptext" style={{ marginBottom: 0 }}>聯絡資料只供區會就呢則留言回覆，不會作其他用途。</p>
          </div>
        )}

        <div
          className="field"
          style={{
            background: dcOnly ? '#fff7ed' : '#f8fafc',
            border: `1px solid ${dcOnly ? '#fdba74' : 'var(--line)'}`,
            borderRadius: 12, padding: '12px 14px',
          }}
        >
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, fontWeight: 400, marginBottom: 0 }}>
            <input
              type="checkbox"
              checked={dcOnly}
              onChange={(event) => setDcOnly(event.target.checked)}
              style={{ width: 'auto', marginTop: 3 }}
            />
            <span>
              🔒 <strong>保密直達區總監（DC）</strong>
              <small style={{ display: 'block', color: '#64748b', marginTop: 3 }}>
                開啟後留言只寫入 DC 專用保密分頁，只有區總監睇到，其他區職員無法查看；適合敏感或不便公開嘅內容。
              </small>
            </span>
          </label>
        </div>

        <AntiSpamField />
        <button className="btn" disabled={busy}>
          {busy ? '提交中…' : '遞交留言'}
        </button>
      </form>
    </>
  );
}
