/** 「聯絡區會」表單及 proxy 共用嘅欄位驗證。唔包含任何私人名錄資料。 */
import { openSectionsForTroop, SECTION_META } from './troops';
import type { DistrictTroopsDirectory, TroopSectionKey } from './types';

export const VISIT_REQUEST_TYPES = [
  { value: 'visit', label: '申請區幹部探訪', hint: '邀請區幹部到旅團集會交流或提供支援' },
  { value: 'invite', label: '邀請區幹部出席活動', hint: '邀請區幹部出席旅團活動或典禮' },
] as const;

export const VISIT_CONTACT_TYPES = [
  { value: 'phone', label: '電話' },
  { value: 'email', label: '電郵' },
  { value: 'ig', label: 'Instagram' },
  { value: 'fb', label: 'Facebook' },
] as const;

type RequestType = typeof VISIT_REQUEST_TYPES[number]['value'];
type ContactType = typeof VISIT_CONTACT_TYPES[number]['value'];

export interface VisitRequestPayload {
  type: RequestType;
  troop: string;
  section: TroopSectionKey | '';
  activityName: string;
  preferredDate: string;
  preferredTime: string;
  location: string;
  purpose: string;
  attendeeCount?: number;
  wantReply: boolean;
  contactName?: string;
  contactType?: ContactType;
  contact?: string;
}

type Preparation =
  | { ok: true; payload: VisitRequestPayload }
  | { ok: false; error: string };

/** 不將物件、陣列或布林值轉成文字，避免繞過必填及長度驗證。 */
function optionalText(value: unknown): string | null {
  if (value === undefined || value === null) return '';
  return typeof value === 'string' ? value.trim() : null;
}

function validDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= days[month - 1];
}

/**
 * 驗證並建立唯一允許轉發嘅 payload。唔要求回覆時即使輸入帶聯絡資料，
 * 回傳 payload 亦不含任何 contact 欄位；proxy 同瀏覽器均執行此步。
 */
export function prepareVisitRequest(input: Record<string, unknown>): Preparation {
  const type = optionalText(input.type);
  if (!VISIT_REQUEST_TYPES.some((item) => item.value === type)) {
    return { ok: false, error: '請選擇有效嘅申請類別。' };
  }
  const troop = optionalText(input.troop);
  if (!troop) return { ok: false, error: '請從公開名錄選擇旅團。' };

  const section = optionalText(input.section);
  if (section === null || (section && !SECTION_META.some((item) => item.key === section))) {
    return { ok: false, error: '請選擇有效嘅支部，或選擇全旅。' };
  }

  const activityName = optionalText(input.activityName);
  if (activityName === null) return { ok: false, error: '活動名稱格式不正確。' };
  if (type === 'invite' && !activityName) return { ok: false, error: '邀請區幹部出席活動時，請填寫活動名稱。' };
  if (activityName.length > 200) return { ok: false, error: '活動名稱不可超過 200 字。' };

  const preferredDate = optionalText(input.preferredDate);
  if (preferredDate === null || (preferredDate && !validDate(preferredDate))) {
    return { ok: false, error: '日期不正確，請使用 yyyy-MM-dd 格式及有效日期。' };
  }
  const preferredTime = optionalText(input.preferredTime);
  if (preferredTime === null || preferredTime.length > 40) return { ok: false, error: '期望時間不可超過 40 字。' };
  const location = optionalText(input.location);
  if (location === null || location.length > 200) return { ok: false, error: '地點不可超過 200 字。' };
  const purpose = optionalText(input.purpose);
  if (purpose === null || purpose.length < 5 || purpose.length > 2000) {
    return { ok: false, error: '請說明申請目的或所需支援（5 至 2000 字）。' };
  }

  let attendeeCount: number | undefined;
  const rawCount = input.attendeeCount;
  if (rawCount !== undefined && rawCount !== null && !(typeof rawCount === 'string' && !rawCount.trim())) {
    const countText = typeof rawCount === 'string' ? rawCount.trim() : typeof rawCount === 'number' ? String(rawCount) : '';
    const count = Number(countText);
    if (!/^\d+$/.test(countText) || !Number.isSafeInteger(count) || count < 1) {
      return { ok: false, error: '預計參加人數必須係正整數。' };
    }
    attendeeCount = count;
  }

  if (input.wantReply !== undefined && input.wantReply !== null && typeof input.wantReply !== 'boolean') {
    return { ok: false, error: '是否需要回覆嘅選項不正確。' };
  }
  const wantReply = input.wantReply === true;
  const payload: VisitRequestPayload = {
    type: type as RequestType, troop, section: section as TroopSectionKey | '',
    activityName, preferredDate, preferredTime, location, purpose,
    ...(attendeeCount === undefined ? {} : { attendeeCount }),
    wantReply,
  };

  if (wantReply) {
    const contactName = optionalText(input.contactName);
    const contactType = optionalText(input.contactType);
    const contact = optionalText(input.contact);
    if (contactName === null || contactName.length > 80) return { ok: false, error: '聯絡人稱呼不可超過 80 字。' };
    if (!VISIT_CONTACT_TYPES.some((item) => item.value === contactType)) {
      return { ok: false, error: '需要回覆時，請選擇聯絡方法類別。' };
    }
    if (contact === null || !contact) return { ok: false, error: '需要回覆時，請填寫聯絡資料。' };
    if (contact.length > 160) return { ok: false, error: '聯絡資料不可超過 160 字。' };
    if (contactName) payload.contactName = contactName;
    payload.contactType = contactType as ContactType;
    payload.contact = contact;
  }
  return { ok: true, payload };
}

/** 必須同最新公開名錄核對旅號及該旅已開設嘅支部，唔接受任意輸入。 */
export function validateVisitRequestDirectory(payload: VisitRequestPayload, directory: DistrictTroopsDirectory): string {
  const troop = directory.troops.find((item) => item.troop === payload.troop);
  if (!troop || !troop.troop) return '所選旅團不在公開名錄中，請重新載入名錄並選擇旅團。';
  if (payload.section && !openSectionsForTroop(troop).some((section) => section.key === payload.section)) {
    return '所選支部並非該旅已開設嘅支部，請重新選擇。';
  }
  return '';
}

export function isVisitReference(value: unknown): value is string {
  return typeof value === 'string' && /^TR-\d{8}-\d+$/.test(value.trim());
}
