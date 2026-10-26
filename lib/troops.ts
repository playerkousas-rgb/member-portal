/**
 * 「區內旅團」公開名錄嘅純函數工具（伺服器＋瀏覽器兩邊共用，方便 node 直接測試）。
 * 後台 listDistrictTroops 已過濾 active/publicVisible 並排除支部團數同內部備註；
 * proxy 再做一次欄位白名單同網址驗證，縱深防禦。
 */
import type { DistrictTroop, DistrictTroopsDirectory } from './types';

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

/** 單一旅團列白名單：無論上游點改，公開端只得以下 7 個欄位。 */
export function sanitizeTroop(value: unknown): DistrictTroop {
  const row = value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {};
  return {
    troop: asText(row.troop).trim().slice(0, 40),
    label: asText(row.label).trim().slice(0, 120),
    organizer: asText(row.organizer).trim().slice(0, 200),
    meetingTime: asText(row.meetingTime).trim().slice(0, 300),
    instagramUrl: safePublicUrl(row.instagramUrl).slice(0, 500),
    facebookUrl: safePublicUrl(row.facebookUrl).slice(0, 500),
    websiteUrl: safePublicUrl(row.websiteUrl).slice(0, 500),
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

export interface TroopDetailField {
  key: keyof DistrictTroop;
  label: string;
  value: string;
  href?: string;
  external?: boolean;
}

/**
 * 彈窗詳情欄位：空白資料一律唔顯示；外部連結帶 href＋external，
 * 由組件統一加上 target="_blank" rel="noopener noreferrer"。
 */
export function troopDetailFields(troop: DistrictTroop): TroopDetailField[] {
  const fields: TroopDetailField[] = [];
  if (troop.organizer) {
    fields.push({ key: 'organizer', label: '主辦機構', value: troop.organizer });
  }
  if (troop.meetingTime) {
    fields.push({ key: 'meetingTime', label: '集會時間', value: troop.meetingTime });
  }
  if (troop.instagramUrl) {
    fields.push({ key: 'instagramUrl', label: 'Instagram', value: 'Instagram 專頁', href: troop.instagramUrl, external: true });
  }
  if (troop.facebookUrl) {
    fields.push({ key: 'facebookUrl', label: 'Facebook', value: 'Facebook 專頁', href: troop.facebookUrl, external: true });
  }
  if (troop.websiteUrl) {
    fields.push({ key: 'websiteUrl', label: '旅團網頁', value: '旅團網頁', href: troop.websiteUrl, external: true });
  }
  return fields;
}
