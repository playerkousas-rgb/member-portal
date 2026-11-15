'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import AnnouncementBanner from '@/components/AnnouncementBanner';
import PushSettings from '@/components/PushSettings';
import SocialLinks from '@/components/SocialLinks';
import InstallPrompt from '@/components/InstallPrompt';
import ScoutSystemCredit from '@/components/ScoutSystemCredit';
import { useDistrict } from '@/lib/useDistrict';
import {
  applyCardOrder,
  clearCardOrder,
  isCustomCardOrder,
  loadCardOrder,
  moveCardInList,
  saveCardOrder,
} from '@/lib/cardOrder';

const ANNOUNCEMENT_URL = 'https://scout-circulars.vercel.app/';

interface ServiceCard {
  id: string;
  href: string;
  icon: string;
  title: string;
  borrowed?: boolean;
  tag: string;
  external: boolean;
}

const SERVICES: readonly ServiceCard[] = [
  {
    id: 'books',
    href: '/books', icon: '📚', title: '我的紀錄冊', borrowed: true,
    tag: '個人紀錄', external: false,
  },
  {
    id: 'venue',
    href: '/venue', icon: '🏛', title: '借用區總部',
    tag: '查看／提交', external: false,
  },
  {
    id: 'stock',
    href: '/stock', icon: '📦', title: '借用物資',
    tag: '公開提交', external: false,
  },
  {
    id: 'training',
    href: '/training', icon: '🎓', title: '訓練班報名',
    tag: '公開報名', external: false,
  },
  {
    id: 'badges',
    href: 'https://districtbadgesystem30.vercel.app/', icon: '🎖', title: '專科徽章系統',
    tag: '外連', external: true,
  },
  {
    id: 'activity',
    href: '/activity', icon: '📋', title: '旅團活動知會',
    tag: '公開提交', external: false,
  },
  {
    id: 'troops',
    href: '/troops', icon: '🧭', title: '區內旅團',
    tag: '公開名錄', external: false,
  },
  {
    id: 'contact-district',
    href: '/contact-district', icon: '📨', title: '聯絡區會',
    tag: '公開提交', external: false,
  },
  {
    id: 'feedback',
    href: '/feedback', icon: '💬', title: '你講我聽',
    tag: '匿名留言', external: false,
  },
  {
    id: 'gemini',
    href: 'https://gemini-woad-sigma.vercel.app/', icon: '✨', title: 'GEMINI 輔助系統', borrowed: true,
    tag: '外連', external: true,
  },
  {
    id: 'app-store',
    href: 'https://scoutappstore.vercel.app/', icon: '🧰', title: 'SCOUT APP STORE', borrowed: true,
    tag: '外連', external: true,
  },
];

export default function HomePage() {
  const { districtCode, district, withDistrict } = useDistrict();
  const storageDistrict = districtCode || district?.code || 'SKW';

  const [orderedServices, setOrderedServices] = useState<ServiceCard[]>(() => [...SERVICES]);
  const [reorderMode, setReorderMode] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const dragIndexRef = useRef<number | null>(null);
  const overIndexRef = useRef<number | null>(null);
  const touchMovedRef = useRef(false);
  const suppressClickUntilRef = useRef(0);

  useEffect(() => {
    const saved = loadCardOrder(storageDistrict);
    setOrderedServices(applyCardOrder(SERVICES, saved));
  }, [storageDistrict]);

  const customized = isCustomCardOrder(orderedServices, SERVICES);

  function commitMove(fromIndex: number, toIndex: number) {
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
    setOrderedServices((prev) => {
      const next = moveCardInList(prev, fromIndex, toIndex);
      saveCardOrder(storageDistrict, next.map((item) => item.id));
      return next;
    });
  }

  function resetOrder() {
    clearCardOrder(storageDistrict);
    setOrderedServices([...SERVICES]);
    setDraggingIndex(null);
    setOverIndex(null);
    setReorderMode(false);
  }

  function startTouchDrag(index: number) {
    dragIndexRef.current = index;
    overIndexRef.current = index;
    touchMovedRef.current = false;
    setDraggingIndex(index);
    setOverIndex(index);
  }

  function handleTouchMove(event: React.TouchEvent) {
    if (dragIndexRef.current === null || !event.touches.length) return;
    event.preventDefault();
    touchMovedRef.current = true;
    const touch = event.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    const slot = target?.closest<HTMLElement>('[data-card-index]');
    if (!slot) return;
    const idx = Number(slot.dataset.cardIndex);
    if (Number.isInteger(idx) && idx >= 0 && idx < orderedServices.length && overIndexRef.current !== idx) {
      overIndexRef.current = idx;
      setOverIndex(idx);
    }
  }

  function finishTouchDrag() {
    const from = dragIndexRef.current;
    const to = overIndexRef.current;
    if (from !== null && to !== null && from !== to) {
      commitMove(from, to);
    }
    if (touchMovedRef.current) {
      suppressClickUntilRef.current = Date.now() + 350;
    }
    dragIndexRef.current = null;
    overIndexRef.current = null;
    touchMovedRef.current = false;
    setDraggingIndex(null);
    setOverIndex(null);
  }

  function handleCardClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (reorderMode || Date.now() < suppressClickUntilRef.current) {
      event.preventDefault();
    }
  }

  function handleGripKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number, id: string) {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = index - 1;
    else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = index + 1;
    if (nextIndex === null || nextIndex < 0 || nextIndex >= orderedServices.length) return;
    event.preventDefault();
    event.stopPropagation();
    commitMove(index, nextIndex);
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(`[data-card-id="${id}"] .drag-grip`)?.focus();
      });
    }
  }

  return (
    <>
      <AnnouncementBanner />

      <div className="hero">
        <h1>{district?.name ? `${district.name} — 服務平台` : '服務平台'} 👋</h1>
        <p>呢度係區為旅團及成員提供嘅自助服務入口。填表即可提交，無需登入；區會收到後會跟進處理。</p>
        <SocialLinks
          links={district?.links}
          variant="hero"
          districtName={district?.name}
          showContact
          contactHref={withDistrict('/contact')}
        />
      </div>

      <InstallPrompt />

      <section
        className="panel"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 16, flexWrap: 'wrap', borderLeft: '6px solid var(--p2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 38 }}>📢</div>
          <div>
            <h2 style={{ margin: 0 }}>查看通告</h2>
            <ScoutSystemCredit variant="inline" />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <a
            className="btn"
            href={ANNOUNCEMENT_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ width: 'auto', padding: '11px 20px' }}
          >
            📢 瀏覽全港最新通告
          </a>
          <PushSettings />
        </div>
      </section>

      <div className="card-order-bar">
        <span className="card-order-hint">
          {reorderMode
            ? '👆 調整次序中：直接拖拉任何卡片重新排列（或按「✓ 完成調整」）'
            : '✋ 可拖拉卡片或右下角 ⠿ 圖示自由排列次序；自動儲存於此瀏覽器'}
        </span>
        <div className="card-order-actions">
          <button
            type="button"
            className={`order-btn${reorderMode ? ' active' : ''}`}
            aria-pressed={reorderMode}
            onClick={() => setReorderMode((prev) => !prev)}
          >
            {reorderMode ? '✓ 完成調整' : '⇄ 調整次序'}
          </button>
          {customized && (
            <button type="button" className="order-btn reset" onClick={resetOrder}>
              ↺ 還原預設次序
            </button>
          )}
        </div>
      </div>

      <div className={`grid${reorderMode ? ' reorder-mode' : ''}`}>
        {orderedServices.map((s, index) => {
          const isDragging = draggingIndex === index;
          const isDropTarget = draggingIndex !== null && overIndex === index && draggingIndex !== index;
          const itemClass = [
            'card-item',
            reorderMode ? 'reorder-active' : '',
            isDragging ? 'is-dragging' : '',
            isDropTarget ? 'is-drop-target' : '',
          ].filter(Boolean).join(' ');

          const cardInner = (
            <>
              <span className={`tag${s.external ? '' : ' pub'}`}>{s.tag}</span>
              <div className="ico">{s.icon}</div>
              <h3>{s.title}</h3>
              {'borrowed' in s && s.borrowed && <span className="src">Scout System</span>}
            </>
          );

          return (
            <div
              key={s.id}
              data-card-id={s.id}
              data-card-index={index}
              className={itemClass}
              draggable
              onDragStart={(e) => {
                dragIndexRef.current = index;
                overIndexRef.current = index;
                setDraggingIndex(index);
                setOverIndex(index);
                if (e.dataTransfer) {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', s.id);
                }
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                if (dragIndexRef.current !== null && overIndexRef.current !== index) {
                  overIndexRef.current = index;
                  setOverIndex(index);
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
                if (dragIndexRef.current !== null && overIndexRef.current !== index) {
                  overIndexRef.current = index;
                  setOverIndex(index);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const from = dragIndexRef.current;
                if (from !== null && from !== index) {
                  commitMove(from, index);
                }
                dragIndexRef.current = null;
                overIndexRef.current = null;
                setDraggingIndex(null);
                setOverIndex(null);
              }}
              onDragEnd={() => {
                dragIndexRef.current = null;
                overIndexRef.current = null;
                setDraggingIndex(null);
                setOverIndex(null);
              }}
              onTouchStart={reorderMode ? () => startTouchDrag(index) : undefined}
              onTouchMove={reorderMode ? handleTouchMove : undefined}
              onTouchEnd={reorderMode ? finishTouchDrag : undefined}
              onTouchCancel={reorderMode ? finishTouchDrag : undefined}
            >
              {s.external ? (
                <a
                  className="card"
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  draggable={false}
                  onClick={handleCardClick}
                >
                  {cardInner}
                </a>
              ) : (
                <Link
                  className="card"
                  href={withDistrict(s.href)}
                  draggable={false}
                  onClick={handleCardClick}
                >
                  {cardInner}
                </Link>
              )}
              <button
                type="button"
                className="drag-grip"
                aria-label={`拖拉排列「${s.title}」（支援方向鍵移動）`}
                title="拖拉或按方向鍵調整次序"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  startTouchDrag(index);
                }}
                onTouchMove={(e) => {
                  e.stopPropagation();
                  handleTouchMove(e);
                }}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  finishTouchDrag();
                }}
                onTouchCancel={(e) => {
                  e.stopPropagation();
                  finishTouchDrag();
                }}
                onKeyDown={(e) => handleGripKeyDown(e, index, s.id)}
              >
                ⠿
              </button>
            </div>
          );
        })}
      </div>

      <ScoutSystemCredit />

      <p className="hint" style={{ marginTop: 22 }}>
        有疑問？<Link href={withDistrict('/contact')} style={{ color: 'var(--p2)', fontWeight: 700 }}>查看聯絡及查詢資料</Link>。
        所有申請由區職員審批，你提交嘅資料只供本區使用。
      </p>
    </>
  );
}
