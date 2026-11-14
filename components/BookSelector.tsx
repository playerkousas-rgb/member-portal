'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const BOOKS = [
  { id: 'cub', name: '幼童軍紀錄冊', short: '幼童軍', url: 'https://cubsbook.vercel.app/', color: '#a46b00' },
  { id: 'scout', name: '童軍紀錄冊', short: '童軍', url: 'https://scoutbook-five.vercel.app/', color: '#21623c' },
  { id: 'venture', name: '深資童軍紀錄冊', short: '深資童軍', url: 'https://vsbook-sand.vercel.app/', color: '#862c42' },
  { id: 'rover', name: '樂行童軍紀錄冊', short: '樂行童軍', url: 'https://roverbook.vercel.app/', color: '#245582' },
] as const;
const STORAGE_KEY = 'member-portal:book-choice';
type Book = (typeof BOOKS)[number];

export default function BookSelector({ homeHref }: { homeHref: string }) {
  const [selected, setSelected] = useState<Book | null>(null);
  const [ready, setReady] = useState(false);
  const [choosing, setChoosing] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    try {
      const saved = BOOKS.find(book => book.id === localStorage.getItem(STORAGE_KEY));
      if (saved) { setSelected(saved); setChoosing(false); setExpanded(true); }
    } catch { setStorageError(true); }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [expanded]);

  function choose(book: Book) {
    try { localStorage.setItem(STORAGE_KEY, book.id); setStorageError(false); }
    catch { setStorageError(true); }
    setSelected(book);
    setChoosing(false);
    setExpanded(true);
  }

  if (!ready) return <p className="page-sub">載入紀錄冊選擇中…</p>;
  return (
    <>
      <Link href={homeHref} className="backlink">← 返回服務首頁</Link>
      <h1 className="page-title">📚 我的紀錄冊</h1>
      <p className="page-sub">選擇自己所屬支部；下次開啟會直接進入你揀選嘅紀錄冊。</p>
      {storageError && <p className="warning-banner" role="status">此瀏覽器無法儲存選擇，下次可能需要重新選擇。</p>}
      {choosing ? (
        <div className="books-grid" aria-label="選擇紀錄冊">
          {BOOKS.map(book => (
            <button key={book.id} type="button" className={`book-choice${selected?.id === book.id ? ' selected' : ''}`}
              style={{ borderTopColor: book.color }} onClick={() => choose(book)} aria-pressed={selected?.id === book.id}>
              <span aria-hidden="true">📖</span><strong>{book.short}</strong><small>{book.name}</small>
            </button>
          ))}
        </div>
      ) : selected && (
        <div className="panel book-selected">
          <div><strong>已選擇：{selected.name}</strong><p>此選擇只保存在這部裝置。</p></div>
          <div className="book-selected-actions">
            <button type="button" className="btn-sm" onClick={() => setExpanded(true)}>開啟紀錄冊</button>
            <button type="button" className="btn-ghost" onClick={() => setChoosing(true)}>更改選擇</button>
          </div>
        </div>
      )}
      <div className="book-note">
        紀錄冊資料由各 BOOK 儲存在此裝置。瀏覽器可能將內嵌及原網站嘅資料分開，或限制內嵌儲存；原有資料未必會自動出現。請先喺原網站備份，並在需要時使用紀錄冊嘅備份／還原功能。清除瀏覽器資料亦可能刪除紀錄，請定期備份。
      </div>
      {selected && (
        <section className="book-viewer book-viewer-expanded" aria-label={selected.name} hidden={!expanded}>
          <div className="book-viewer-head">
            <div className="book-viewer-title">
              <button type="button" className="btn-ghost" onClick={() => setExpanded(false)}>← 返回平台</button>
              <h2>{selected.name}</h2>
            </div>
            <a href={selected.url} target="_blank" rel="noopener noreferrer">開啟原網站 ↗</a>
          </div>
          <iframe key={selected.id} src={selected.url} title={selected.name} allow="camera; fullscreen" allowFullScreen className="book-frame" />
        </section>
      )}
    </>
  );
}
