'use client';
import {
  TROOP_CATEGORY_META, TROOP_FILTERS, TROOP_SORTS,
  type TroopCategoryCounts, type TroopFilter, type TroopSort,
} from '@/lib/troopCategory';

/**
 * 「區內旅團」嘅篩選 chips＋排序選單。
 * 獨立元件方便直接做 DOM 測試，唔需要 Next router／後台連線。
 */
export default function TroopDirectoryControls({
  counts, filter, sort, shownUnits, onFilterChange, onSortChange,
}: {
  counts: TroopCategoryCounts;
  filter: TroopFilter;
  sort: TroopSort;
  shownUnits: number;
  onFilterChange: (value: TroopFilter) => void;
  onSortChange: (value: TroopSort) => void;
}) {
  return (
    <section className="troop-controls" aria-label="旅團篩選及排序">
      <div className="troop-filter-chips" role="group" aria-label="按主辦機構篩選">
        {TROOP_FILTERS.filter((value) => value !== 'unknown' || counts.unknown > 0).map((value) => (
          <button
            key={value}
            type="button"
            className={`troop-filter-chip${filter === value ? ' active' : ''}`}
            aria-pressed={filter === value}
            onClick={() => onFilterChange(value)}
          >
            {value === 'all' ? '全部' : TROOP_CATEGORY_META[value].label} ({counts[value]})
          </button>
        ))}
      </div>

      <label className="troop-sort-control">
        <span>排序</span>
        <select
          aria-label="排序方式"
          value={sort}
          onChange={(event) => onSortChange(event.target.value as TroopSort)}
        >
          {TROOP_SORTS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>

      <p className="troop-controls-summary" role="status" aria-live="polite">
        顯示 {filter === 'all' ? counts.all : counts[filter]} / {counts.all} 個旅團 · {shownUnits} 個團
        {filter !== 'all' ? ` · ${TROOP_CATEGORY_META[filter].hint}` : ''}
      </p>
      <p className="hint troop-controls-hint">
        按名錄嘅主辦機構自動分為「公開旅／機構旅／學校旅」：公開旅同機構旅一般公開招生；
        學校旅多數只收校內學生，升團前宜先向旅團確認。分類只影響顯示，如有錯漏請通知區會更正主辦機構資料。
      </p>
    </section>
  );
}
