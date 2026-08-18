'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AntiSpamField, getSubmissionMeta } from '@/components/AntiSpamField';
import { api } from '@/lib/api';
import { STOCK_RULES, TROOP_LIST } from '@/lib/publicContent';
import type { Item, SubmissionResult } from '@/lib/types';
import { useDistrict } from '@/lib/useDistrict';

type Quantities = Record<string, string>;

export default function StockPage() {
  const { withDistrict } = useDistrict();
  const startedAt = useRef(Date.now());
  const [items, setItems] = useState<Item[]>([]);
  const [quantities, setQuantities] = useState<Quantities>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
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
  const [done, setDone] = useState<SubmissionResult | null>(null);

  function loadItems() {
    setLoading(true);
    setLoadError('');
    api.listItems().then((result) => {
      if (result.ok && result.data) setItems(result.data);
      else setLoadError(result.error || '未能載入物資。');
      setLoading(false);
    });
  }

  useEffect(loadItems, []);

  const groups = useMemo(() => {
    const grouped: Record<string, Item[]> = {};
    items.forEach((item) => {
      (grouped[item.category || '其他'] = grouped[item.category || '其他'] || []).push(item);
    });
    return grouped;
  }, [items]);

  const selectedItems = useMemo(() => items.flatMap((item) => {
    const qty = Number(quantities[item.itemId] || 0);
    return Number.isInteger(qty) && qty > 0 ? [{ itemId: item.itemId, qty }] : [];
  }), [items, quantities]);

  const totalQty = selectedItems.reduce((sum, item) => sum + item.qty, 0);

  function setItemQty(item: Item, rawValue: string) {
    const normalized = rawValue === '' ? '' : String(Math.max(0, Math.min(item.availableQty, Number(rawValue) || 0)));
    setQuantities((current) => ({ ...current, [item.itemId]: normalized }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!name.trim() || !phone.trim() || !borrowDate || !returnDate) {
      setError('請先填妥申請人姓名、聯絡電話及借還日期。');
      return;
    }
    if (!selectedItems.length) {
      setError('請在可借用物資旁填寫最少一項數量。');
      return;
    }
    const invalid = selectedItems.find((selection) => {
      const item = items.find((candidate) => candidate.itemId === selection.itemId);
      return !item || selection.qty < 1 || selection.qty > item.availableQty;
    });
    if (invalid) {
      setError('部分借用數量超出目前可借數量，請重新檢查。');
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
    const result = await api.submitStockBatchRequest({
      items: selectedItems,
      purpose,
      borrowDate,
      returnDate,
      name,
      phone,
      email,
      troop,
      position,
      agreeRules: true,
    }, meta);
    setBusy(false);

    if (result.ok && result.data) {
      setDone(result.data);
      window.scrollTo(0, 0);
    } else {
      setError(result.error || '提交失敗，請稍後再試。');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  if (done) {
    return (
      <div className="panel submission-done">
        <div className="done-icon">{done.partialError ? '⚠️' : '✅'}</div>
        <h2>{done.partialError ? '部分物資申請已提交' : '已收到借用物資申請'}</h2>
        <p>
          批次申請編號：<b>{done.refCode}</b>
        </p>
        <p>
          已將 {done.submittedCount ?? done.refCodes?.length ?? 1} 項物資記錄遞交到區會 Sheet。
          提交並不等於已預留庫存，區會會在管理系統跟進批核。
        </p>
        {done.partialError && <div className="err">{done.partialError}</div>}
        {!!done.refCodes?.length && (
          <details className="reference-list">
            <summary>查看各項 Sheet 記錄編號</summary>
            <div>{done.refCodes.join('、')}</div>
          </details>
        )}
        <div className="done-actions">
          <Link href={withDistrict('/')} className="btn-ghost">返回首頁</Link>
          <button className="btn-sm" onClick={() => {
            startedAt.current = Date.now();
            setDone(null);
            setQuantities({});
            setPurpose('');
            setAgree(false);
            loadItems();
          }}>
            再提交申請
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Link href={withDistrict('/')} className="backlink">← 返回服務首頁</Link>
      <h1 className="page-title">📦 借用物資</h1>
      <p className="page-sub">一次填寫申請人資料，再為所有需要借用的物資輸入數量，最後一併遞交。</p>

      <section className="panel rules-compact">
        <h2>📋 借用規定</h2>
        <div>{STOCK_RULES}</div>
        <div className="agree-rules">
          <Link href={withDistrict('/rules/stock')}>查看完整借物資規定</Link>
        </div>
      </section>

      <form onSubmit={submit}>
        {error && <div className="err form-error" role="alert">{error}</div>}

        <section className="panel form-step">
          <div className="step-heading">
            <span>1</span>
            <div><h2>借用申請人資料</h2><p>以下聯絡資料只供區會處理本次申請。</p></div>
          </div>

          <div className="frow">
            <div className="field">
              <label>申請人姓名 <span className="req">*</span></label>
              <input value={name} maxLength={120} autoComplete="name" onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="field">
              <label>聯絡電話 <span className="req">*</span></label>
              <input type="tel" value={phone} maxLength={30} autoComplete="tel" onChange={(event) => setPhone(event.target.value)} />
            </div>
          </div>
          <div className="frow">
            <div className="field">
              <label>電郵</label>
              <input type="email" value={email} maxLength={254} autoComplete="email" onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="field">
              <label>旅團</label>
              <input list="stock-troop-options" value={troop} maxLength={80} onChange={(event) => setTroop(event.target.value)} placeholder="請選擇或輸入旅團" />
              <datalist id="stock-troop-options">{TROOP_LIST.map((item) => <option key={item} value={item} />)}</datalist>
            </div>
          </div>
          <div className="frow">
            <div className="field">
              <label>職位</label>
              <input value={position} maxLength={80} onChange={(event) => setPosition(event.target.value)} placeholder="例：旅長、團長" />
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
              <input type="date" min={borrowDate || undefined} value={returnDate} onChange={(event) => setReturnDate(event.target.value)} />
            </div>
          </div>
        </section>

        <section className="panel form-step">
          <div className="step-heading inventory-heading">
            <span>2</span>
            <div><h2>選擇物資及填寫數量</h2><p>資料由區會物資 Sheet 即時讀取；不借用的項目留空即可。</p></div>
            <button type="button" className="btn-ghost refresh-btn" onClick={loadItems} disabled={loading}>↻ 更新數量</button>
          </div>

          {loading && <div className="empty">正在讀取最新物資資料…</div>}
          {loadError && <div className="err">{loadError}</div>}
          {!loading && !loadError && !items.length && <div className="empty">暫未有物資開放借用。</div>}

          {!loading && !loadError && Object.entries(groups).map(([category, list]) => (
            <div className="stock-category" key={category}>
              <div className="cat-head">{category}</div>
              <div className="stock-list">
                {list.map((item) => {
                  const unavailable = item.availableQty <= 0;
                  const selected = Number(quantities[item.itemId] || 0) > 0;
                  return (
                    <div className={`stock-picker-row${selected ? ' selected' : ''}${unavailable ? ' unavailable' : ''}`} key={item.itemId}>
                      <div className="stock-item-info">
                        <strong>{item.name}</strong>
                        <div>
                          {item.note && <span>{item.note} · </span>}
                          可借 <b>{item.availableQty}</b> {item.unit}
                        </div>
                      </div>
                      <label className="quantity-control">
                        <span>借用數量</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={item.availableQty}
                          step={1}
                          value={quantities[item.itemId] || ''}
                          onChange={(event) => setItemQty(item, event.target.value)}
                          placeholder="0"
                          disabled={unavailable}
                          aria-label={`${item.name}借用數量，最多${item.availableQty}${item.unit}`}
                        />
                        <em>{item.unit}</em>
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        <section className="panel submit-panel">
          <div className="selection-summary">
            <span className="summary-count">{selectedItems.length}</span>
            <span>已選物資種類<br /><small>合共 {totalQty} 件／套／項（按物資單位計）</small></span>
          </div>
          <label className="agree-check">
            <input type="checkbox" checked={agree} onChange={(event) => setAgree(event.target.checked)} />
            <span>我已閱讀並同意借用規定，並確認以上資料及數量正確。 <span className="req">*</span></span>
          </label>
          <AntiSpamField />
          <button className="btn" disabled={busy || loading || !items.length || !selectedItems.length}>
            {busy ? '正在遞交到 Sheet…' : `遞交 ${selectedItems.length || ''} 項物資申請`}
          </button>
          <p className="hint">按一次即可遞交所有已填數量的物資，毋須逐項重複填寫申請人資料。</p>
        </section>
      </form>
    </>
  );
}
