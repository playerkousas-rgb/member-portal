'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AntiSpamField, getSubmissionMeta } from '@/components/AntiSpamField';
import { api } from '@/lib/api';
import { openSectionsForTroop } from '@/lib/troops';
import type { DistrictTroopsDirectory } from '@/lib/types';
import { useDistrict } from '@/lib/useDistrict';
import { confirmSubmit, useFormGuard } from '@/lib/useFormGuard';
import {
  isVisitReference, prepareVisitRequest, validateVisitRequestDirectory,
  VISIT_CONTACT_TYPES, VISIT_REQUEST_TYPES,
} from '@/lib/visitRequest';

interface FormValues {
  type: string;
  troop: string;
  section: string;
  activityName: string;
  preferredDate: string;
  preferredTime: string;
  location: string;
  purpose: string;
  attendeeCount: string;
  wantReply: boolean;
  contactName: string;
  contactType: string;
  contact: string;
}

function emptyForm(): FormValues {
  return {
    type: '', troop: '', section: '', activityName: '', preferredDate: '', preferredTime: '',
    location: '', purpose: '', attendeeCount: '', wantReply: false,
    contactName: '', contactType: '', contact: '',
  };
}

type TextField = Exclude<keyof FormValues, 'wantReply'>;
type CompletedRequest = { refCode: string; wantReply: boolean };

export default function ContactDistrictPage() {
  const { districtCode, withDistrict } = useDistrict();
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [directory, setDirectory] = useState<DistrictTroopsDirectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [directoryError, setDirectoryError] = useState('');
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState<CompletedRequest | null>(null);
  const startedAt = useRef(Date.now());
  const submitLock = useRef(false);
  const previousDistrict = useRef(districtCode);

  // 聯絡資料不保存至 localStorage 草稿；回復草稿時如需要回覆須重新填寫。
  const snapshot = useMemo(() => ({
    type: form.type, troop: form.troop, section: form.section, activityName: form.activityName,
    preferredDate: form.preferredDate, preferredTime: form.preferredTime, location: form.location,
    purpose: form.purpose, attendeeCount: form.attendeeCount, wantReply: form.wantReply,
  }), [form]);
  const guard = useFormGuard(`mp:draft:visit-request:${districtCode || 'none'}`, snapshot, (saved) => {
    const str = (value: unknown) => typeof value === 'string' ? value : '';
    setForm({
      type: str(saved.type), troop: str(saved.troop), section: str(saved.section),
      activityName: str(saved.activityName), preferredDate: str(saved.preferredDate),
      preferredTime: str(saved.preferredTime), location: str(saved.location), purpose: str(saved.purpose),
      attendeeCount: str(saved.attendeeCount), wantReply: saved.wantReply === true,
      contactName: '', contactType: '', contact: '',
    });
  }, { active: !completed });

  useEffect(() => {
    if (previousDistrict.current !== districtCode) {
      previousDistrict.current = districtCode;
      setForm(emptyForm());
      setCompleted(null);
      setError('');
    }
  }, [districtCode]);

  useEffect(() => {
    let cancelled = false;
    if (!districtCode) {
      setDirectory(null);
      setLoading(false);
      return () => { cancelled = true; };
    }
    setLoading(true);
    setDirectoryError('');
    setDirectory(null);
    api.listDistrictTroops().then((result) => {
      if (cancelled) return;
      if (result.ok && result.data) {
        const latest = result.data;
        setDirectory(latest);
        setForm((current) => {
          if (!current.troop) return current;
          const troop = latest.troops.find((item) => item.troop === current.troop);
          if (!troop) return { ...current, troop: '', section: '' };
          // 保留已失效的支部讓驗證擋下，避免靜默改成「全旅」。
          return current;
        });
      } else {
        setDirectoryError(result.error || '未能載入公開旅團名錄，請稍後再試。');
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [districtCode, reload]);

  const troops = useMemo(() => {
    const byNumber = new Map<string, NonNullable<DistrictTroopsDirectory['troops']>[number]>();
    for (const troop of directory?.troops || []) {
      if (troop.troop && !byNumber.has(troop.troop)) byNumber.set(troop.troop, troop);
    }
    return [...byNumber.values()];
  }, [directory]);
  const selectedTroop = troops.find((troop) => troop.troop === form.troop);
  const sections = selectedTroop ? openSectionsForTroop(selectedTroop) : [];

  function update(field: TextField, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current) return;
    setError('');
    if (!directory || loading || directoryError) {
      setError('未能核對公開旅團名錄，請先重新載入名錄。');
      return;
    }
    const prepared = prepareVisitRequest({ ...form });
    if (!prepared.ok) {
      setError(prepared.error);
      return;
    }
    const directoryValidation = validateVisitRequestDirectory(prepared.payload, directory);
    if (directoryValidation) {
      setError(directoryValidation);
      return;
    }
    if (!form.wantReply) {
      // 防止殘留的隱藏欄位留在 state；prepared.payload 亦不含任何聯絡欄位。
      setForm((current) => ({ ...current, contactName: '', contactType: '', contact: '' }));
    }
    const typeLabel = VISIT_REQUEST_TYPES.find((item) => item.value === prepared.payload.type)?.label || '';
    const sectionLabel = sections.find((item) => item.key === prepared.payload.section)?.label || '全旅';
    if (!confirmSubmit(
      `確認提交聯絡區會申請？\n\n${typeLabel}\n旅團：${selectedTroop?.label || prepared.payload.troop}\n支部：${sectionLabel}\n`
      + `需要回覆：${prepared.payload.wantReply ? '是' : '否'}\n\n申請交區會跟進，不會自動成為探訪紀錄。`,
    )) return;

    const meta = getSubmissionMeta(event.currentTarget, startedAt.current);
    submitLock.current = true;
    setBusy(true);
    try {
      const result = await api.submitVisitRequest(prepared.payload, meta);
      if (result.ok && isVisitReference(result.data?.refCode)) {
        guard.clearDraft();
        setCompleted({ refCode: result.data.refCode.trim(), wantReply: prepared.payload.wantReply });
        setForm(emptyForm());
        window.scrollTo(0, 0);
      } else if (result.ok) {
        setError('未收到有效申請編號，提交狀態未能確認；請先聯絡區會核對，切勿重複提交。');
      } else {
        setError(result.error === '連線失敗，請稍後再試。'
          ? '連線中斷，提交狀態未能確認；請先聯絡區會核對，切勿重複提交。'
          : result.error || '申請提交失敗，請稍後再試。');
      }
    } finally {
      submitLock.current = false;
      setBusy(false);
    }
  }

  if (completed) {
    return (
      <section className="panel" role="status" aria-live="polite" style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 46 }} aria-hidden="true">📨</div>
        <h2>申請提交成功</h2>
        <p>申請編號：<strong style={{ color: 'var(--p)' }}>{completed.refCode}</strong></p>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 10 }}>
          申請已交區會跟進。申請不會自動成為探訪紀錄；實際探訪後，區幹部會在管理系統另行登記。
        </p>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 8 }}>
          {completed.wantReply
            ? '區會可按你自願提供嘅聯絡方法，就今次申請回覆。'
            : '你沒有要求回覆，區會未必能主動聯絡你。請記低以上編號以便查詢。'}
        </p>
        <div style={{ marginTop: 20 }}><Link href={withDistrict('/')} className="btn-ghost">返回首頁</Link></div>
      </section>
    );
  }

  return (
    <>
      <Link href={withDistrict('/')} className="backlink">← 返回服務首頁</Link>
      <h1 className="page-title">📨 聯絡區會</h1>
      <p className="page-sub">申請區幹部探訪旅團，或邀請區幹部出席活動。</p>

      <section className="panel" style={{ borderLeft: '4px solid #1565c0' }}>
        <h2>📌 申請前請留意</h2>
        <ul style={{ fontSize: 13, lineHeight: 1.9, margin: 0, paddingLeft: 20 }}>
          <li>申請會交區會跟進；申請本身不會自動成為探訪紀錄，實際探訪後由區幹部另行登記。</li>
          <li>是否需要回覆由你決定；聯絡資料只供區會回覆今次申請。如不想提供，請勿在其他欄位填寫聯絡資料。</li>
          <li>如不要求回覆，區會未必能主動聯絡你，請記低提交後嘅申請編號。</li>
        </ul>
      </section>

      <form className="panel" onSubmit={submit} noValidate>
        <h2>填寫申請</h2>
        {guard.pending && (
          <div className="draft-banner" role="status">
            <span>♻️ 發現上次未提交嘅草稿（{new Date(guard.pending.t).toLocaleString('zh-HK')}）。聯絡資料不會儲存於草稿。</span>
            <span className="draft-actions">
              <button type="button" className="draft-restore" onClick={guard.restore}>回復草稿</button>
              <button type="button" className="draft-discard" onClick={guard.discard}>放棄</button>
            </span>
          </div>
        )}
        {loading && <p role="status" style={{ marginBottom: 12 }}>正在載入公開旅團名錄…</p>}
        {directoryError && (
          <div className="err" role="alert">
            未能載入公開旅團名錄：{directoryError}{' '}
            <button type="button" className="btn-sm" onClick={() => setReload((value) => value + 1)}>重試</button>
          </div>
        )}
        {!loading && !directoryError && directory && !troops.length && (
          <div className="err" role="alert">暫時沒有可選擇的公開旅團，請聯絡區會。</div>
        )}
        {error && <div className="err" role="alert">{error}</div>}

        <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <fieldset className="field" style={{ border: 0, padding: 0, minWidth: 0 }}>
            <legend style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>申請類別 <span className="req">*</span></legend>
            <div style={{ display: 'grid', gap: 8 }}>
              {VISIT_REQUEST_TYPES.map((item) => (
                <label key={item.value} style={{
                  display: 'flex', gap: 9, alignItems: 'flex-start', padding: '10px 12px',
                  border: `1px solid ${form.type === item.value ? '#1565c0' : 'var(--line)'}`,
                  borderRadius: 10, background: form.type === item.value ? '#eff6ff' : '#fff', cursor: 'pointer',
                }}>
                  <input type="radio" name="request-type" value={item.value} checked={form.type === item.value}
                    onChange={() => update('type', item.value)} style={{ width: 'auto', marginTop: 3 }} />
                  <span><strong>{item.label}</strong><small style={{ display: 'block', color: '#64748b', marginTop: 2 }}>{item.hint}</small></span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="frow">
            <div className="field">
              <label htmlFor="request-troop">旅團 <span className="req">*</span></label>
              <select id="request-troop" value={form.troop} required disabled={loading || !!directoryError || !troops.length}
                onChange={(event) => setForm((current) => ({ ...current, troop: event.target.value, section: '' }))}>
                <option value="">— 請選擇公開旅團 —</option>
                {troops.map((troop) => (
                  <option key={troop.troop} value={troop.troop}>
                    {troop.label ? `${troop.label}（旅號 ${troop.troop}）` : `旅號 ${troop.troop}`}
                  </option>
                ))}
              </select>
              {directory && !loading && (
                <p className="helptext">
                  <button type="button" className="draft-restore" onClick={() => setReload((value) => value + 1)}>重新載入名錄</button>
                </p>
              )}
            </div>
            <div className="field">
              <label htmlFor="request-section">支部（選填）</label>
              <select id="request-section" value={form.section} disabled={!selectedTroop || loading}
                onChange={(event) => update('section', event.target.value)}>
                <option value="">全旅（不指定支部）</option>
                {sections.map((section) => <option key={section.key} value={section.key}>{section.label}</option>)}
                {form.section && !sections.some((section) => section.key === form.section) && (
                  <option value={form.section} disabled>原選支部已不在名錄，請重新選擇</option>
                )}
              </select>
              <p className="helptext">只列出所選旅團已開設嘅支部；全旅申請毋須選擇。</p>
            </div>
          </div>

          <div className="field">
            <label htmlFor="request-activity">活動名稱 {form.type === 'invite' ? <span className="req">*</span> : '（選填）'}</label>
            <input id="request-activity" value={form.activityName} maxLength={200} required={form.type === 'invite'}
              onChange={(event) => update('activityName', event.target.value)} placeholder="邀請出席活動時必須填寫" />
            <p className="helptext">本表格最多 200 字；區方 v4.32.0 後台未修正前只接受 120 字，超出會被拒絕。</p>
          </div>

          <div className="frow">
            <div className="field">
              <label htmlFor="request-date">期望日期（選填）</label>
              <input id="request-date" type="date" value={form.preferredDate} max="9999-12-31"
                onChange={(event) => update('preferredDate', event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="request-time">期望時間（選填）</label>
              <input id="request-time" value={form.preferredTime} maxLength={40}
                onChange={(event) => update('preferredTime', event.target.value)} placeholder="例如：下午 2 時至 4 時" />
            </div>
          </div>

          <div className="frow">
            <div className="field">
              <label htmlFor="request-location">地點（選填）</label>
              <input id="request-location" value={form.location} maxLength={200} onChange={(event) => update('location', event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="request-attendees">預計參加人數（選填）</label>
              <input id="request-attendees" type="text" inputMode="numeric" value={form.attendeeCount}
                onChange={(event) => update('attendeeCount', event.target.value)} placeholder="正整數" />
              <p className="helptext">區方 v4.32.0 後台未修正前只接受 1 至 9999 人。</p>
            </div>
          </div>

          <div className="field">
            <label htmlFor="request-purpose">申請目的或需要區會提供的支援 <span className="req">*</span></label>
            <textarea id="request-purpose" value={form.purpose} maxLength={2000} required
              onChange={(event) => update('purpose', event.target.value)}
              placeholder="請簡單說明活動、探訪目的，或希望區會提供嘅支援（5 至 2000 字）。"
              style={{ minHeight: 130 }} />
            <p className="helptext" style={{ textAlign: 'right' }}>{form.purpose.length}／2000</p>
          </div>

          <div className="field">
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, fontWeight: 400 }}>
              <input type="checkbox" checked={form.wantReply} style={{ width: 'auto', marginTop: 3 }}
                onChange={(event) => {
                  const wantReply = event.target.checked;
                  setForm((current) => ({ ...current, wantReply, ...(!wantReply ? { contactName: '', contactType: '', contact: '' } : {}) }));
                }} />
              <span>我想收到區會回覆（自願提供聯絡資料）</span>
            </label>
          </div>

          {form.wantReply && (
            <div style={{ background: '#f8fafc', border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px', marginBottom: 13 }}>
              <div className="frow">
                <div className="field">
                  <label htmlFor="request-contact-name">稱呼（選填）</label>
                  <input id="request-contact-name" value={form.contactName} maxLength={80} autoComplete="off"
                    onChange={(event) => update('contactName', event.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="request-contact-type">聯絡方法類別 <span className="req">*</span></label>
                  <select id="request-contact-type" value={form.contactType} required onChange={(event) => update('contactType', event.target.value)}>
                    <option value="">— 請選擇 —</option>
                    {VISIT_CONTACT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="field">
                <label htmlFor="request-contact">聯絡資料 <span className="req">*</span></label>
                <input id="request-contact" value={form.contact} maxLength={160} required autoComplete="off"
                  onChange={(event) => update('contact', event.target.value)} placeholder="電話號碼／電郵／IG 或 FB 帳號" />
              </div>
              <p className="helptext" style={{ marginBottom: 0 }}>聯絡資料只供區會回覆今次申請，不會儲存於本機草稿。</p>
            </div>
          )}
          <AntiSpamField />
          <button className="btn" disabled={busy || loading || !!directoryError || !troops.length}>
            {busy ? '提交中…' : '提交申請'}
          </button>
        </fieldset>
      </form>
    </>
  );
}
