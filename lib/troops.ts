/**
 * 「區內旅團」公開名錄嘅純函數工具（伺服器＋瀏覽器兩邊共用，方便 node 直接測試）。
 * 後台 listDistrictTroops 已過濾 active/publicVisible 並排除內部備註；
 * proxy 再做一次欄位白名單同網址驗證，縱深防禦。
 * v4.29.0：旅 → 團階層（sectionCounts＋units），向後相容舊版只回旅層級欄位嘅回應。
 */
import type { DistrictTroop, DistrictTroopsDirectory, DistrictUnit, TroopSectionKey } from './types';

type UnknownRecord = Record<string, unknown>;

function asText(value: unknown): string {
  return value == null ? '' : String(value);
}

/** 只接受 http(s) 公開網址；javascript:／data: 等一律清走，避免可注入連結。 */
export function safePublicUrl(value: unknown): string {
  const raw = asText(value).trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

/** 支部顯示資料（對照港島總會官網旅團表五欄） */
export const SECTION_META: { key: TroopSectionKey; label: string; emoji: string }[] = [
  { key: 'gh', label: '小童軍', emoji: '🐛' },
  { key: 'cub', label: '幼童軍', emoji: '🐺' },
  { key: 'scout', label: '童軍', emoji: '🧭' },
  { key: 'venture', label: '深資童軍', emoji: '⛵' },
  { key: 'rover', label: '樂行童軍', emoji: '🌟' },
];

const SECTION_KEYS = new Set<string>(SECTION_META.map((s) => s.key));

/** 單一團列白名單：公開端只得以下 8 個欄位。 */
export function sanitizeUnit(value: unknown): DistrictUnit {
  const row = value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {};
  const section = asText(row.section).trim();
  return {
    section: SECTION_KEYS.has(section) ? section : '',
    unitCode: asText(row.unitCode).trim().slice(0, 10),
    label: asText(row.label).trim().slice(0, 120),
    meetingTime: asText(row.meetingTime).trim().slice(0, 300),
    location: asText(row.location).trim().slice(0, 300),
    instagramUrl: safePublicUrl(row.instagramUrl).slice(0, 500),
    facebookUrl: safePublicUrl(row.facebookUrl).slice(0, 500),
    websiteUrl: safePublicUrl(row.websiteUrl).slice(0, 500),
  };
}

/** 單一旅團列白名單：旅層級 7 欄＋團數結構＋各團列表。 */
export function sanitizeTroop(value: unknown): DistrictTroop {
  const row = value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {};
  const rawCounts = row.sectionCounts && typeof row.sectionCounts === 'object' ? row.sectionCounts as UnknownRecord : {};
  const sectionCounts: DistrictTroop['sectionCounts'] = {};
  SECTION_META.forEach(({ key }) => {
    const count = asText(rawCounts[key]).trim().slice(0, 20);
    if (count) sectionCounts[key] = count;
  });
  const units = Array.isArray(row.units)
    ? row.units.map(sanitizeUnit).filter((u) => u.section && (u.label || u.unitCode !== undefined))
    : [];
  return {
    troop: asText(row.troop).trim().slice(0, 40),
    label: asText(row.label).trim().slice(0, 120),
    organizer: asText(row.organizer).trim().slice(0, 200),
    meetingTime: asText(row.meetingTime).trim().slice(0, 300),
    instagramUrl: safePublicUrl(row.instagramUrl).slice(0, 500),
    facebookUrl: safePublicUrl(row.facebookUrl).slice(0, 500),
    websiteUrl: safePublicUrl(row.websiteUrl).slice(0, 500),
    sectionCounts,
    units: units.filter((u) => u.section),
  };
}

/** listDistrictTroops 回應嘅伺服器端清洗：欄位白名單＋空列過濾。 */
export function sanitizeTroopsDirectory(input: unknown): DistrictTroopsDirectory {
  const row = input && typeof input === 'object' && !Array.isArray(input) ? input as UnknownRecord : {};
  const rawTroops = Array.isArray(row.troops) ? row.troops : [];
  const troops = rawTroops
    .map(sanitizeTroop)
    .filter((troop) => troop.troop || troop.label);
  return {
    districtCode: asText(row.districtCode).trim().slice(0, 12),
    districtName: asText(row.districtName).trim().slice(0, 60),
    troops,
  };
}

export interface DetailField {
  key: string;
  label: string;
  value: string;
  href?: string;
  external?: boolean;
}

function linkFields(prefix: string, source: { instagramUrl: string; facebookUrl: string; websiteUrl: string }): DetailField[] {
  const fields: DetailField[] = [];
  if (source.instagramUrl) {
    fields.push({ key: `${prefix}.instagramUrl`, label: 'Instagram', value: 'Instagram 專頁', href: source.instagramUrl, external: true });
  }
  if (source.facebookUrl) {
    fields.push({ key: `${prefix}.facebookUrl`, label: 'Facebook', value: 'Facebook 專頁', href: source.facebookUrl, external: true });
  }
  if (source.websiteUrl) {
    fields.push({ key: `${prefix}.websiteUrl`, label: '網頁', value: '旅團網頁', href: source.websiteUrl, external: true });
  }
  return fields;
}

/** 團（支部單位）自己嘅詳情欄位；空白欄位唔生成。 */
export function unitDetailFields(unit: DistrictUnit): DetailField[] {
  const fields: DetailField[] = [];
  if (unit.meetingTime) fields.push({ key: 'meetingTime', label: '集會時間', value: unit.meetingTime });
  if (unit.location) fields.push({ key: 'location', label: '集會地點', value: unit.location });
  fields.push(...linkFields('unit', unit));
  return fields;
}

/** 旅層級資料（團冇自己資料時回落顯示）。 */
export function troopFallbackFields(troop: DistrictTroop): DetailField[] {
  const fields: DetailField[] = [];
  if (troop.organizer) fields.push({ key: 'organizer', label: '主辦機構', value: troop.organizer });
  if (troop.meetingTime) fields.push({ key: 'meetingTime', label: '集會時間', value: troop.meetingTime });
  fields.push(...linkFields('troop', troop));
  return fields;
}

/** 團有冇自己填過任何詳情；完全空白時前端要回落旅層級資料。 */
export function unitHasDetail(unit: DistrictUnit): boolean {
  return Boolean(
    unit.meetingTime || unit.location || unit.instagramUrl || unit.facebookUrl || unit.websiteUrl,
  );
}

/**
 * 統一彈窗內容：團有獨立資料就顯示團欄位；否則回落旅層級欄位並標示。
 * organizer 喺兩種情況都顯示（屬旅層級但成員揀團時都想知）。
 */
export function dialogFields(troop: DistrictTroop, unit: DistrictUnit): { fields: DetailField[]; fallback: boolean } {
  if (unitHasDetail(unit)) {
    const fields: DetailField[] = [];
    if (troop.organizer) fields.push({ key: 'organizer', label: '主辦機構', value: troop.organizer });
    fields.push(...unitDetailFields(unit));
    return { fields, fallback: false };
  }
  return { fields: troopFallbackFields(troop), fallback: true };
}
