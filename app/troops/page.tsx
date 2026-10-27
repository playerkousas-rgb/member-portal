'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import TroopDialog from '@/components/TroopDialog';
import TroopSectionChips from '@/components/TroopSectionChips';
import { SECTION_META, troopUnitsForDisplay } from '@/lib/troops';
import { api } from '@/lib/api';
import { useDistrict } from '@/lib/useDistrict';
import type { DistrictTroop, DistrictTroopsDirectory, DistrictUnit } from '@/lib/types';

interface Selection {
  troop: DistrictTroop;
  unit: DistrictUnit;
}

export default function TroopsPage() {
  const { withDistrict } = useDistrict();
  const [directory, setDirectory] = useState<DistrictTroopsDirectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<Selection | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const result = await api.listDistrictTroops();
    if (result.ok && result.data) {
      setDirectory(result.data);
    } else {
      setError(result.error || '未能載入區內旅團名錄。');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await api.listDistrictTroops();
      if (cancelled) return;
      if (result.ok && result.data) setDirectory(result.data);
      else setError(result.error || '未能載入區內旅團名錄。');
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const troops = directory?.troops ?? [];
  const totalUnits = useMemo(
    () => troops.reduce((sum, troop) => sum + troopUnitsForDisplay(troop).length, 0),
    [troops],
  );

  function toggle(troopKey: string) {
    setExpanded((current) => (current === troopKey ? null : troopKey));
  }

  return (
    <>
      <Link href={withDistrict('/')} className="backlink">← 返回主頁</Link>
      <h1 className="page-title">🧭 區內旅團</h1>
      <p className="page-sub">
        先按旅團查看旗下各支部嘅團，再點個別團查看集會時間、地點同社交帳戶；名錄由區管理系統維護，只顯示已公開資料。
      </p>

      {loading ? (
        <div className="center" role="status" aria-live="polite">
          <div className="spinner" />
          <p>正在載入旅團名錄…</p>
        </div>
      ) : error ? (
        <div className="panel troop-error-panel">
          <div className="err" role="alert">{error}</div>
          <button type="button" className="btn-sm" onClick={load}>重試</button>
        </div>
      ) : troops.length === 0 ? (
        <div className="empty">暫時未有公開旅團資料。</div>
      ) : (
        <>
          <p className="troop-count">共 {troops.length} 個旅團 · {totalUnits} 個團</p>
          <div className="troop-list">
            {troops.map((troop) => {
              const key = `${troop.troop}-${troop.label}`;
              const isOpen = expanded === key;
              const units = troopUnitsForDisplay(troop);
              return (
                <section className="troop-panel" key={key}>
                  <button
                    type="button"
                    className="troop-panel-head"
                    aria-expanded={isOpen}
                    aria-controls={`troop-body-${key}`}
                    onClick={() => toggle(key)}
                  >
                    <span className="troop-panel-id">
                      <strong>{troop.label || troop.troop}</strong>
                      {troop.troop && troop.label ? <small>旅號 {troop.troop}</small> : null}
                    </span>
                    <span className="troop-panel-org">{troop.organizer || '—'}</span>
                    <TroopSectionChips troop={troop} />
                    <span className={`troop-panel-arrow${isOpen ? ' open' : ''}`} aria-hidden="true">▾</span>
                  </button>

                  {isOpen && (
                    <div className="troop-panel-body" id={`troop-body-${key}`}>
                      {units.length === 0 ? (
                        <p className="empty">暫時未有已開設並公開嘅支部團資料。</p>
                      ) : (
                        <>
                          <p className="troop-body-hint">
                            {units.length} 個團 · 點選查看詳情（空白資料唔會顯示）
                          </p>
                          <div className="unit-grid">
                            {units.map((unit, index) => (
                              <button
                                type="button"
                                key={`${unit.section}-${unit.unitCode || index}`}
                                className="unit-card"
                                aria-haspopup="dialog"
                                onClick={() => setSelected({ troop, unit })}
                              >
                                <span className="unit-card-emoji" aria-hidden="true">
                                  {SECTION_META.find((m) => m.key === unit.section)?.emoji || '🧭'}
                                </span>
                                <span className="unit-card-text">
                                  <strong>
                                    {unit.label}
                                    {unit.unitCode ? <span className="unit-code-badge">{unit.unitCode}</span> : null}
                                  </strong>
                                  <small>{unit.meetingTime || unit.location || '查看旅團公開資料'}</small>
                                </span>
                                <span className="unit-card-arrow" aria-hidden="true">›</span>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
          <p className="hint">
            名錄資料由區管理系統（/visit）統一維護，本頁只作公開查閱；未啟用或未公開嘅旅團同團唔會顯示。
          </p>
        </>
      )}

      {selected ? (
        <TroopDialog
          troop={selected.troop}
          unit={selected.unit}
          districtName={directory?.districtName}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </>
  );
}
