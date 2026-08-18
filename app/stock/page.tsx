'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AntiSpamField, getSubmissionMeta } from '@/components/AntiSpamField';
import { api } from '@/lib/api';
import { STOCK_RULES } from '@/lib/publicContent';
import type { Item } from '@/lib/types';
import { useDistrict } from '@/lib/useDistrict';

export default function StockPage() {
  const { withDistrict } = useDistrict();
  const startedAt = useRef(Date.now());
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState('1');
  const [purpose, setPurpose] = useState('');
  const [borrowDate, setBorrowDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [troop, setTroop] = useState('');
  const [position, setPosition] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [doneRef, setDoneRef] = useState('');

  useEffect(() => {
    api.listItems().then((result) => {
      if (result.ok && result.data) setItems(result.data);
      else setLoadError(result.error || '未能載入物資。');
      setLoading(false);
    });
  }, []);

  const groups = useMemo(() => {
    const grouped: Record<string, Item[]> = {};
    items.forEach((item) => {
      (grouped[item.category || '其他'] = grouped[item.category || '其他'] || []).push(item);
    });
    return grouped;
  }, [items]);
  const selected = items.find((item) => item.itemId === itemId);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const amount = Number(qty);
    if (!itemId || !name.trim() || !phone.trim() || !borrowDate || !returnDate) {
      setError('請填妥必填項目（物資、數量、日期、姓名、電話）。');
      return;
    }
    if (!Number.isInteger(amount) || amount < 1 || !selected || amount > selected.availableQty) {
      setError('借用數量超出目前可借數量。');
      return;
    }
    if (returnDate < borrowDate) {
      setError('歸還日期不可早過借出日期。');
      return;
    }
    if (!agree) {
      setError('請先閱讀並同意借用規定。');
      return;
    }

    const meta = getSubmissionMeta(event.currentTarget, startedAt.current);
    setBusy(true);
    const result = await api.submitStockRequest({
      itemId, qty: amount, purpose, borrowDate, returnDate, name, phone, email, troop, position,
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
        <h2>已收到借用物資申請</h2>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>
          申請編號：<b style={{ color: '#003366' }}>{doneRef}</b>
        </p>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 10 }}>
          提交並不等於已預留庫存；區會會喺管理系統批核。如需查詢，請提供以上編號。
        </p>
        <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'center' }}>
          <Link href={withDistrict('/')} className="btn-ghost">返回首頁</Link>
          <button className="btn-sm" onClick={() => {
            startedAt.current = Date.now();
            setDoneRef(''); setItemId(''); setQty('1'); setPurpose('');
          }}>
            再提交一項
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Link href={withDistrict('/')} className="backlink">← 返回服務首頁</Link>
      <h1 className="page-title">📦 借用物資</h1>
      <p className="page-sub">物資及可借數量由共用主 Sheet 讀取；批核及庫存扣還只由區管理系統處理。</p>

      <section className="panel" style={{ borderLeft: '4px solid #1565c0' }}>
        <h2>📋 借用規定</h2>
        <div style={{ fontSize: 13, whiteSpace: 'pre-line', lineHeight: 1.9 }}>{STOCK_RULES}</div>
        <div className="agree-rules">
          詳細守則（內建於本平台）：
          <Link href={withDistrict('/rules/stock')}>借物資規定</Link>
        </div>
      </section>

      <section className="panel">
        <h2>可借物資一覽</h2>
        {loading && <div className="empty">載入中…</div>}
        {loadError && <div className="err">{loadError}</div>}
        {!loading && !loadError && Object.keys(groups).length === 0 && <div className="empty">暫未有物資開放借用。</div>}
        {Object.entries(groups).map(([category, list]) => (
          <div key={category}>
            <div className="cat-head">{category}</div>
            {list.map((item) => (
              <div className="item-row" key={item.itemId}>
                <span className="iname">{item.name}</span>
                <span className="icat">{item.unit}</span>
                {item.note && <span style={{ fontSize: 11, color: '#64748b' }}>{item.note}</span>}
                <span className="iqty">
                  可借：<span className={item.availableQty > 0 ? 'stock-ok' : 'stock-none'}>{item.availableQty}</span>
                </span>
              </div>
            ))}
          </div>
        ))}
      </section>

      <form className="panel" onSubmit={submit}>
        <h2>提交借用申請</h2>
        {error && <div className="err" role="alert">{error}</div>}

        <div className="field">
          <label>物資 <span className="req">*</span></label>
          <select value={itemId} onChange={(event) => { setItemId(event.target.value); setQty('1'); }} disabled={loading || items.length === 0}>
            <option value="">— 請選擇 —</option>
            {Object.entries(groups).map(([category, list]) => (
              <optgroup key={category} label={category}>
                {list.map((item) => (
                  <option key={item.itemId} value={item.itemId} disabled={item.availableQty <= 0}>
                    {item.name}（可借 {item.availableQty} {item.unit}）
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="frow">
          <div className="field">
            <label>數量 <span className="req">*</span></label>
            <input type="number" min={1} max={selected?.availableQty || 1} value={qty} onChange={(event) => setQty(event.target.value)} />
          </div>
          <div className="field">
            <label>用途</label>
            <input value={purpose} maxLength={300} onChange={(event) => setPurpose(event.target.value)} placeholder="例：旅集會、區活動" />
          </div>
        </div>

        <div className="frow">
          <div className="field">
            <label>借出日期 <span className="req">*</span></label>
            <input type="date" value={borrowDate} onChange={(event) => setBorrowDate(event.target.value)} />
          </div>
          <div className="field">
            <label>歸還日期 <span className="req">*</span></label>
            <input type="date" value={returnDate} onChange={(event) => setReturnDate(event.target.value)} />
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
        <div className="field">
          <label>職位</label>
          <input value={position} maxLength={80} onChange={(event) => setPosition(event.target.value)} placeholder="例：旅長、團長" />
        </div>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, margin: '8px 0 16px' }}>
          <input type="checkbox" checked={agree} onChange={(event) => setAgree(event.target.checked)} style={{ marginTop: 3 }} />
          <span>我已閱讀並同意以上借用規定。 <span className="req">*</span></span>
        </label>
        <AntiSpamField />
        <button className="btn" disabled={busy || loading || items.length === 0}>
          {busy ? '提交中…' : '提交申請'}
        </button>
      </form>
    </>
  );
}
