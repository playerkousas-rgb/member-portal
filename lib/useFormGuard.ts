'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 表單防呆機制（移植自區系統 v4.15.0「寫入防呆」同一套精神）：
 *
 * ① 草稿自動保存——填緊嘅嘢 800ms 後自動存入 localStorage，refresh／意外關頁都唔會甩
 * ② 離開提示——有未提交內容就離開頁面／重新整理，瀏覽器會彈提示（同區系統探訪頁同一寫法）
 * ③ 草稿回復——返到頁面發現有未提交草稿，可以一鍵回復或者放棄
 * ④ 提交成功自動清草稿；提交失敗表格原封不動，改完可以直接再試
 * ⑤ 防雙擊——submitLock 在 setBusy 生效前同步上鎖，連點唔會重複提交
 * ⑥ 確認清單——撳提交前彈一次重點摘要（場地／時段／數量），確認先真正遞交
 */

type Leaf = string | number | boolean;
export type FormSnapshot = Record<string, Leaf | Record<string, Leaf>>;

interface DraftEnvelope {
  t: number;
  v: FormSnapshot;
}

function nonEmpty(value: Leaf | Record<string, Leaf>): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value.trim() !== '';
  if (value && typeof value === 'object') {
    return Object.values(value).some((x) => nonEmpty(x as Leaf));
  }
  return false;
}

/** 表單係咪有嘢填咗（用嚟決定離開提示／草稿保存） */
export function isDirty(snapshot: FormSnapshot): boolean {
  return Object.values(snapshot).some(nonEmpty);
}

/**
 * localStorage 一般上限 5MB。收據／截圖 dataUrl 隨時幾 MB——
 * 寫唔入（配額爆）就自動剔走大欄位（>100KB 嘅字串）再試一次，
 * 文字草稿照樣保住，唔會因為一張相成個草稿報廢。
 */
function persist(key: string, envelope: DraftEnvelope): void {
  const full = JSON.stringify(envelope);
  if (full.length <= 3_500_000) {
    try { localStorage.setItem(key, full); return; } catch { /* 跌落剔除大欄位 */ }
  }
  const slim: FormSnapshot = {};
  for (const [field, value] of Object.entries(envelope.v)) {
    if (typeof value === 'string' && value.length > 100_000) continue;
    slim[field] = value;
  }
  try { localStorage.setItem(key, JSON.stringify({ t: envelope.t, v: slim })); } catch { /* 真係冇位就算 */ }
}

export function useFormGuard(
  key: string,
  snapshot: FormSnapshot,
  apply: (saved: FormSnapshot) => void,
  opts: { active?: boolean } = {},
) {
  const active = opts.active ?? true;
  const [pending, setPending] = useState<DraftEnvelope | null>(null);
  const applyRef = useRef(apply);
  applyRef.current = apply;
  const hydratedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ① 開頁：讀返上次未提交嘅草稿（只讀一次）
  useEffect(() => {
    if (!active) { hydratedRef.current = true; return; }
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const envelope = JSON.parse(raw) as DraftEnvelope;
        if (envelope && typeof envelope.t === 'number' && envelope.v && isDirty(envelope.v)) {
          setPending(envelope);
        }
      }
    } catch { /* 壞草稿當冇 */ }
    hydratedRef.current = true;
  }, [key, active]);

  // ② 草稿自動保存（有未決定嘅舊草稿期間唔覆寫，避免即刻沖走佢）
  useEffect(() => {
    if (!active || pending || !hydratedRef.current) return;
    if (!isDirty(snapshot)) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      persist(key, { t: Date.now(), v: snapshot });
    }, 800);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [key, active, pending, snapshot]);

  // ③ 離開／重新整理提示（有未提交內容先會裝）
  useEffect(() => {
    if (!active || pending) return;
    if (!isDirty(snapshot)) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [active, pending, snapshot]);

  /** 回復草稿（內容套返落表格） */
  const restore = useCallback(() => {
    if (pending) applyRef.current(pending.v);
    setPending(null);
  }, [pending]);

  /** 放棄草稿（連 localStorage 一齊清走） */
  const discard = useCallback(() => {
    setPending(null);
    try { localStorage.removeItem(key); } catch { /* 忽略 */ }
  }, [key]);

  /** 提交成功後清草稿 */
  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(key); } catch { /* 忽略 */ }
  }, [key]);

  return { pending, restore, discard, clearDraft };
}

/** 撳提交前嘅確認清單（彈重點摘要，撳取消就唔會遞交） */
export function confirmSubmit(summary: string): boolean {
  if (typeof window === 'undefined') return true;
  return window.confirm(summary);
}
