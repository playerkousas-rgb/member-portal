'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AntiSpamField, getSubmissionMeta } from '@/components/AntiSpamField';
import TeamupCalendar from '@/components/TeamupCalendar';
import { api } from '@/lib/api';
import { VENUE_RULES } from '@/lib/publicContent';
import type { Venue } from '@/lib/types';
import { useDistrict } from '@/lib/useDistrict';

const empty = (value: string) => !value.trim();

export default function VenuePage() {
  const { withDistrict } = useDistrict();
  const startedAt = useRef(Date.now());
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
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
    api.listVenues().then((result) => {
      if (result.ok && result.data) {
        setVenues(result.data);
        // 本區現時只有區總部一個可借場地，毋須申請人再揀一次。
        setVenueId(result.data[0]?.venueId || '');
      } else {
        setLoadError(result.error || '未能載入場地。');
      }
      setLoading(false);
    });
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (empty(venueId) || empty(name) || empty(phone) || empty(startDate) || empty(endDate)) {
      setError('請填妥必填項目（場地、日期時間、姓名、電話）。');
      return;
    }
    if (new Date(endDate).getTime() <= new Date(startDate).getTime()) {
      setError('結束時間必須遲過開始時間。');
      return;
    }
    if (!agree) {
      setError('請先閱讀並同意借用規定。');
      return;
    }

    const meta = getSubmissionMeta(event.currentTarget, startedAt.current);
    setBusy(true);
    const result = await api.submitVenueRequest(
      { venueId, startDate, endDate, name, phone, email, troop, position, purpose },
      meta,
    );
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
        <h2>已收到借用場地申請</h2>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>
          申請編號：<b style={{ color: '#003366' }}>{doneRef}</b>
        </p>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 10 }}>
          提交並不等於批核完成；區會會喺管理系統跟進。如需查詢，請提供以上編號。
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
      <h1 className="page-title">🏛 借用區總部</h1>
      <p className="page-sub">先用 Teamup 查看區總部使用情況，再於同一頁填寫借用申請。</p>

      <TeamupCalendar />

      <section className="panel" style={{ borderLeft: '4px solid #1565c0' }}>
        <h2>📋 借用規定</h2>
        <div style={{ fontSize: 13, whiteSpace: 'pre-line', lineHeight: 1.9 }}>{VENUE_RULES}</div>
        <div className="agree-rules">
          詳細守則（內建於本平台）：
          <Link href={withDistrict('/rules/venue')}>借場規則及程序</Link> ·
          <Link href={withDistrict('/rules/venue-terms')}>場地一般使用條件</Link> ·
          <Link href={withDistrict('/rules/cctv')}>閉路電視監察措施指引</Link>
        </div>
      </section>

      <form className="panel" onSubmit={submit}>
        <h2>提交借用申請</h2>
        {error && <div className="err" role="alert">{error}</div>}

        <div className="field">
          <label>借用地點</label>
          {loading ? (
            <div className="fixed-venue">載入區總部資料中…</div>
          ) : loadError ? (
            <div className="err" style={{ marginBottom: 0 }}>{loadError}</div>
          ) : (
            <div className="fixed-venue">
              <span className="fixed-venue-icon">🏛</span>
              <span>
                <strong>{venues[0]?.name || '筲箕灣區總部'}</strong>
                {venues[0]?.location && <small>📍 {venues[0].location}</small>}
              </span>
            </div>
          )}
          <p className="helptext">本區現時只有區總部可供借用，毋須另外選擇場地。</p>
        </div>

        <div className="frow">
          <div className="field">
            <label>開始時間 <span className="req">*</span></label>
            <input type="datetime-local" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </div>
          <div className="field">
            <label>結束時間 <span className="req">*</span></label>
            <input type="datetime-local" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </div>
        </div>

        <div className="frow">
          <div className="field">
            <label>聯絡人姓名 <span className="req">*</span></label>
            <input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="field">
            <label>聯絡電話 <span className="req">*</span></label>
            <input type="tel" value={phone} maxLength={30} onChange={(event) => setPhone(event.target.value)} />
          </div>
        </div>
        <div className="frow">
          <div className="field">
            <label>電郵</label>
            <input type="email" value={email} maxLength={254} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div className="field">
            <label>旅團</label>
            <input value={troop} maxLength={80} onChange={(event) => setTroop(event.target.value)} placeholder="例：港島第82旅" />
          </div>
        </div>
        <div className="frow">
          <div className="field">
            <label>職位</label>
            <input value={position} maxLength={80} onChange={(event) => setPosition(event.target.value)} placeholder="例：旅長、團長" />
          </div>
          <div className="field">
            <label>用途</label>
            <input value={purpose} maxLength={300} onChange={(event) => setPurpose(event.target.value)} placeholder="例：旅集會" />
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, margin: '8px 0 16px' }}>
          <input type="checkbox" checked={agree} onChange={(event) => setAgree(event.target.checked)} style={{ marginTop: 3 }} />
          <span>我已閱讀並同意以上借用規定。 <span className="req">*</span></span>
        </label>
        <AntiSpamField />
        <button className="btn" disabled={busy || loading || venues.length === 0}>
          {busy ? '提交中…' : '提交申請'}
        </button>
      </form>
    </>
  );
}
