/**
 * 「區內旅團」按主辦機構分類、篩選同排序（純函數，瀏覽器／node 測試共用）。
 *
 * 點解要分：「公開旅」同「機構旅」（會所、居民協會、管理中心、委員會等主辦）
 * 一般都公開招生，對升團／轉旅最有參考價值；「學校旅」多數只收校內學生，
 * 校外成員通常唔適用。後台公開名錄 v1.3 只有 `organizer`（主辦機構）一個
 * 公開文字欄，冇獨立嘅旅類欄位，所以依用戶要求喺前端按主辦機構判斷，
 * 唔改後台合約、唔放行任何管理／私隱欄位。
 *
 * 判斷只影響顯示同排序，唔會增刪旅團；名錄本身已經由後台過濾
 * active / publicVisible，未公開嘅旅團仍然唔會出現。
 */
import type { DistrictTroop } from './types';

export type TroopCategory = 'open' | 'organization' | 'school' | 'unknown';
export type TroopFilter = 'all' | TroopCategory;
export type TroopSort = 'troop' | 'openFirst' | 'organizationFirst' | 'schoolFirst';

export interface TroopCategoryMeta {
  label: string;
  short: string;
  hint: string;
  /** 一般會唔會公開招生；未分類用 null（未知） */
  recruit: boolean | null;
  className: string;
}

export const TROOP_CATEGORY_META: Record<TroopCategory, TroopCategoryMeta> = {
  open: {
    label: '公開旅', short: '公開', recruit: true, className: 'troop-cat-open',
    hint: '主辦機構標明「公開旅」，一般而言公開招生。',
  },
  organization: {
    label: '機構旅', short: '機構', recruit: true, className: 'troop-cat-organization',
    hint: '由青少年／社區機構、會所、居民組織、管理公司或委員會主辦，一般而言公開招生。',
  },
  school: {
    label: '學校旅', short: '學校', recruit: false, className: 'troop-cat-school',
    hint: '由中學、小學、幼稚園或書院主辦，多數只收校內學生。',
  },
  unknown: {
    label: '未分類', short: '未分類', recruit: null, className: 'troop-cat-unknown',
    hint: '名錄未填主辦機構，未能判斷類別；可請區會補充資料。',
  },
};

export const TROOP_FILTERS: TroopFilter[] = ['all', 'open', 'organization', 'school', 'unknown'];

export const TROOP_SORTS: { value: TroopSort; label: string }[] = [
  { value: 'troop', label: '按旅號' },
  { value: 'openFirst', label: '公開旅優先' },
  { value: 'organizationFirst', label: '機構旅優先' },
  { value: 'schoolFirst', label: '學校旅優先' },
];

/** 主辦機構入面有呢啲字，就當係學校／幼稚園主辦（對照港島地域官網旅團表）。 */
const SCHOOL_WORDS = [
  '中學', '小學', '幼稚園', '幼兒園', '學校', '書院', '學院', '大學',
  '官立', '國際學校', '特殊學校', '夜校',
];

/** 可選：日後後台若提供明確分類，优先用後台值；目前 v1.3 合約冇呢個欄。 */
type ExplicitType = { troopType?: unknown; category?: unknown } | null | undefined;

function explicitCategory(value: unknown): TroopCategory | null {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return null;
  if (['open', 'public', '公開旅', '公開'].includes(raw)) return 'open';
  if (['organization', 'org', '機構旅', '機構'].includes(raw)) return 'organization';
  if (['school', 'private', '非公開旅', '學校旅', '學校'].includes(raw)) return 'school';
  if (['unknown', '未分類'].includes(raw)) return 'unknown';
  return null;
}

/** 單一旅團嘅分類：公開旅 → 學校旅 → 機構旅 → 未分類。 */
export function troopCategory(
  troop: Pick<DistrictTroop, 'organizer' | 'label'> | string,
  explicit?: ExplicitType,
): TroopCategory {
  const declared = explicitCategory(explicit?.troopType) || explicitCategory(explicit?.category);
  if (declared) return declared;

  const raw = typeof troop === 'string' ? troop : (troop?.organizer || '');
  const org = String(raw).replace(/\s+/g, '');
  // 「（公開旅）」係官網／區會名錄既有嘅明確標記，優先於任何學校關鍵字。
  if (/公開旅/.test(org) && !/非公開旅/.test(org)) return 'open';
  if (/非公開旅/.test(org)) return 'school';
  if (!org) return 'unknown';
  if (SCHOOL_WORDS.some((word) => org.includes(word))) return 'school';
  return 'organization';
}

export function troopCategoryMeta(troop: Parameters<typeof troopCategory>[0], explicit?: ExplicitType): TroopCategoryMeta {
  return TROOP_CATEGORY_META[troopCategory(troop, explicit)];
}

/** 旅號數字排序，非純數字（例如舊旅號）放最後並用名稱排。 */
export function troopNumber(troop: Pick<DistrictTroop, 'troop'>): number {
  const digits = String(troop?.troop || '').replace(/[^0-9]/g, '');
  const value = Number.parseInt(digits, 10);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function compareByTroop(a: DistrictTroop, b: DistrictTroop): number {
  const byNumber = troopNumber(a) - troopNumber(b);
  if (byNumber) return byNumber;
  return String(a.label || a.troop || '').localeCompare(String(b.label || b.troop || ''), 'zh-Hant');
}

const SORT_ORDER: Record<Exclude<TroopSort, 'troop'>, TroopCategory[]> = {
  openFirst: ['open', 'organization', 'school', 'unknown'],
  organizationFirst: ['organization', 'open', 'school', 'unknown'],
  schoolFirst: ['school', 'organization', 'open', 'unknown'],
};

/** 篩選＋排序；唔改動傳入陣列。 */
export function filterAndSortTroops(
  troops: DistrictTroop[],
  filter: TroopFilter = 'all',
  sort: TroopSort = 'troop',
  explicit?: (troop: DistrictTroop) => ExplicitType,
): DistrictTroop[] {
  const classify = (troop: DistrictTroop) => troopCategory(troop, explicit?.(troop));
  const rows = filter === 'all' ? troops.slice() : troops.filter((troop) => classify(troop) === filter);
  if (sort === 'troop') return rows.sort(compareByTroop);
  const order = SORT_ORDER[sort];
  return rows.sort((a, b) => {
    const byCategory = order.indexOf(classify(a)) - order.indexOf(classify(b));
    return byCategory || compareByTroop(a, b);
  });
}

export type TroopCategoryCounts = Record<TroopFilter, number>;

export function countTroopCategories(
  troops: DistrictTroop[],
  explicit?: (troop: DistrictTroop) => ExplicitType,
): TroopCategoryCounts {
  const counts: TroopCategoryCounts = { all: troops.length, open: 0, organization: 0, school: 0, unknown: 0 };
  for (const troop of troops) counts[troopCategory(troop, explicit?.(troop))] += 1;
  return counts;
}

export function isTroopFilter(value: unknown): value is TroopFilter {
  return TROOP_FILTERS.includes(value as TroopFilter);
}
export function isTroopSort(value: unknown): value is TroopSort {
  return TROOP_SORTS.some((option) => option.value === value);
}
