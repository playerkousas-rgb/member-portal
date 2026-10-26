'use client';
import { useEffect, useRef } from 'react';
import { dialogFields } from '../lib/troops';
import type { DistrictTroop, DistrictUnit } from '../lib/types';

/**
 * 團（支部單位）詳情彈窗（手機寬度自動變底部抽屜）。
 * - 團有自己嘅集會時間／地點／社交帳戶 → 顯示團資料
 * - 完全空白 → 回落旅層級資料並標示，避免彈窗得個殼
 * - 外部連結一律新分頁＋rel="noopener noreferrer"
 * - ESC／點遮罩關閉、開啟時鎖定背景捲動、focus 落到關閉掣
 */
export default function TroopDialog({
  troop,
  unit,
  districtName,
  onClose,
}: {
  troop: DistrictTroop;
  unit: DistrictUnit;
  districtName?: string;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const { fields, fallback } = dialogFields(troop, unit);
  const title = unit.label || troop.label || troop.troop;

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
            <h2 id="troop-dialog-title">
              {title}
              {unit.unitCode ? <span className="unit-code-badge">{unit.unitCode}</span> : null}
            </h2>
            <p className="modal-sub">
              {troop.label}
              {troop.troop && troop.label !== troop.troop ? `（旅號 ${troop.troop}）` : ''}
            </p>
            {districtName ? <p className="modal-sub">{districtName}</p> : null}
          </div>
          <button ref={closeRef} type="button" className="modal-close" aria-label="關閉" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          {fallback && fields.length > 0 && (
            <p className="fallback-note">此團暫未提供獨立資料，以下顯示旅團層級資料。</p>
          )}
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
