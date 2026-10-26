'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import TroopDialog from '@/components/TroopDialog';
import { api } from '@/lib/api';
import { useDistrict } from '@/lib/useDistrict';
import type { DistrictTroop, DistrictTroopsDirectory } from '@/lib/types';

export default function TroopsPage() {
  const { withDistrict } = useDistrict();
  const [directory, setDirectory] = useState<DistrictTroopsDirectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<DistrictTroop | null>(null);

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

  return (
    <>
      <Link href={withDistrict('/')} className="backlink">← 返回主頁</Link>
      <h1 className="page-title">🧭 區內旅團</h1>
      <p className="page-sub">
        公開名錄由區管理系統維護；撳旅團名稱可查看主辦機構、集會時間及社交媒體連結。
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
          <p className="troop-count">共 {troops.length} 個旅團</p>
          <div className="troop-grid">
            {troops.map((troop) => (
              <button
                type="button"
                key={`${troop.troop}-${troop.label}`}
                className="troop-card"
                onClick={() => setSelected(troop)}
                aria-haspopup="dialog"
              >
                <span className="troop-card-ico" aria-hidden="true">🧭</span>
                <span className="troop-card-body">
                  <strong>{troop.label || troop.troop}</strong>
                  {troop.troop && troop.label ? <small>旅團編號 {troop.troop}</small> : null}
                </span>
                <span className="troop-card-chevron" aria-hidden="true">›</span>
              </button>
            ))}
          </div>
          <p className="hint">
            名錄資料由區管理系統（/visit）統一維護，本頁只作公開查閱；未啟用或未公開嘅旅團唔會顯示。
          </p>
        </>
      )}

      {selected ? (
        <TroopDialog
          troop={selected}
          districtName={directory?.districtName}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </>
  );
}
