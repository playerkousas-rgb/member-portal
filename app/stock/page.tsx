'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Item, PublicInfo } from '@/lib/types';

export default function StockPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [pub, setPub] = useState<PublicInfo | null>(null);
  const [loading, setLoading] = useState(true);

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
    api.listItems().then((r) => {
      if (r.ok && r.data) setItems(r.data);
      setLoading(false);
    });
    api.getPublicInfo().then((r) => { if (r.ok && r.data) setPub(r.data); });
  }, []);

  const groups = useMemo(() => {
    const map: Record<string, Item[]> = {};
    items.filter((i) => i.active).forEach((i) => {
      (map[i.category] = map[i.category] || []).push(i);
    });
    return map;
  }, [items]);

  const selected = items.find((i) => i.itemId === itemId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!itemId || !name || !phone || !borrowDate || !returnDate) {
      setError('請填妥必填項目（物資、日期、姓名、電話）。');
      return;
    }
    if (!agree) { setError('請先閱讀並同意「借用規定」。'); return; }
    setBusy(true);
    const r = await api.submitStockRequest({
      itemId, qty: Number(qty), purpose, borrowDate, returnDate, name, phone, email, troop, position,
      agreeRules: agree,
    });
    setBusy(false);
    if (r.ok && r.data) {
      setDoneRef(r.data.refCode);
      window.scrollTo(0, 0);
    } else setError(r.error || '提交失敗，請稍後再試。');
  }

  if (doneRef) {
    return (
      <div className="panel" style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 46 }}>✅</div>
        <h2>已收到申請</h2>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>
          申請編號：<b style={{ color: '#003366' }}>{doneRef}</b>
        </p>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 10 }}>
          職員批核後會以電郵通知你。請記低申請編號以便查詢。
        </p>
        <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'center' }}>
          <Link href="/" className="btn-ghost">返回首頁</Link>
          <button className="btn-sm" onClick={() => { setDoneRef(''); setItemId(''); setQty('1'); setPurpose(''); }}>
            再借一件
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Link href="/" className="backlink">← 返回服務首頁</Link>
      <h1 className="page-title">📦 借用物資</h1>
      <p className="page-sub">揀你想借嘅物資，填好日期，交表後等職員批核。批核結果會以電郵通知。</p>

      <div className="panel" style={{ borderLeft: '4px solid #1565c0' }}>
        <h2>📋 借用規定</h2>
        <div style={{ fontSize: 13, whiteSpace: 'pre-line', lineHeight: 1.9 }}>
          {pub?.stockRules || ''}
        </div>
        {pub?.stockRulesUrl && (
          <div style={{ marginTop: 10 }}>
            <a href={pub.stockRulesUrl} target="_blank" rel="noopener" style={{ color: '#1565c0', fontSize: 13, fontWeight: 700 }}>📄 查看借用規定全文 ↗</a>
          </div>
        )}
      </div>

      <div className="panel">
        <h2>可借物資一覽</h2>
        {loading && <div className="empty">載入中…</div>}
        {!loading && Object.keys(groups).length === 0 && <div className="empty">暫未有物資開放借用。</div>}
        {Object.entries(groups).map(([cat, list]) => (
          <div key={cat}>
            <div className="cat-head">{cat}</div>
            {list.map((i) => (
              <div className="item-row" key={i.itemId}>
                <span className="iname">{i.name}</span>
                <span className="icat">{i.unit || '件'}</span>
                {i.location && <span style={{ fontSize: 11, color: '#64748b' }}>📍{i.location}</span>}
                {i.note && <span style={{ fontSize: 11, color: '#64748b' }}>{i.note}</span>}
                <span className="iqty">
                  可借：<span className={i.availableQty > 0 ? 'stock-ok' : 'stock-none'}>{i.availableQty}</span>
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <form className="panel" onSubmit={submit}>
        <h2>提交借用申請</h2>
        {error && <div className="err">{error}</div>}

        <div className="field">
          <label>物資 <span className="req">*</span></label>
          <select value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">— 請選擇 —</option>
            {Object.entries(groups).map(([cat, list]) => (
              <optgroup key={cat} label={cat}>
                {list.map((i) => (
                  <option key={i.itemId} value={i.itemId} disabled={i.availableQty <= 0}>
                    {i.name}（可借 {i.availableQty}）
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="frow">
          <div className="field">
            <label>數量 <span className="req">*</span></label>
            <input type="number" min={1} max={selected?.availableQty || 1} value={qty}
              onChange={(e) => setQty(e.target.value)} />
          </div>
          <div className="field">
            <label>用途</label>
            <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="例：旅集會、區活動…" />
          </div>
        </div>

        <div className="frow">
          <div className="field">
            <label>借出日期 <span className="req">*</span></label>
            <input type="date" value={borrowDate} onChange={(e) => setBorrowDate(e.target.value)} />
          </div>
          <div className="field">
            <label>歸還日期 <span className="req">*</span></label>
            <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
          </div>
        </div>

        <div className="frow">
          <div className="field">
            <label>聯絡人姓名 <span className="req">*</span></label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>聯絡電話 <span className="req">*</span></label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <div className="frow">
          <div className="field">
            <label>電郵（收批核通知用）</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label>旅團</label>
            <input value={troop} onChange={(e) => setTroop(e.target.value)} placeholder="例：港島第82旅" />
          </div>
        </div>
        <div className="field">
          <label>職位（申請人須為童軍領袖）</label>
          <input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="例：旅長、團長…" />
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
