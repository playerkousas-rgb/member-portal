'use client';
import { useEffect, useRef } from 'react';
import { troopDetailFields } from '../lib/troops';
import type { DistrictTroop } from '../lib/types';

/**
 * 旅團詳情彈窗（手機寬度自動變底部抽屜）。
 * - 空白欄位由 troopDetailFields 過濾，唔會顯示空行
 * - 外部連結一律新分頁＋rel="noopener noreferrer"
 * - ESC／點遮罩關閉、開啟時鎖定背景捲動、focus 落到關閉掣
 */
export default function TroopDialog({
  troop,
  districtName,
  onClose,
}: {
  troop: DistrictTroop;
  districtName?: string;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const fields = troopDetailFields(troop);
  const title = troop.label || troop.troop;

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="troop-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h2 id="troop-dialog-title">{title}</h2>
            {troop.troop && troop.label ? <p className="modal-sub">旅團編號：{troop.troop}</p> : null}
            {districtName ? <p className="modal-sub">{districtName}</p> : null}
          </div>
          <button ref={closeRef} type="button" className="modal-close" aria-label="關閉" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          {fields.length === 0 ? (
            <p className="empty">暫時未有更詳細資料。</p>
          ) : (
            <dl className="troop-detail">
              {fields.map((field) => (
                <div className="troop-detail-row" key={field.key}>
                  <dt>{field.label}</dt>
                  <dd>
                    {field.href ? (
                      <a href={field.href} target="_blank" rel="noopener noreferrer">
                        {field.value} ↗
                      </a>
                    ) : (
                      field.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}
