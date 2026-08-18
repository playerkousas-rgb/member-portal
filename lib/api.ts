/**
 * 成員系統公開 API。
 * 所有請求經同源 /api/proxy；主 Apps Script API Key 只存在 server env。
 */
import { resolveDistrictCode } from './district';
import type {
  ActivityNotice, ApiResult, CourseLink, DistrictConfig, Item,
  SubmissionMeta, SubmissionResult, SystemState, Venue,
} from './types';

type UnknownRecord = Record<string, unknown>;

function districtCode(): string {
  if (typeof window === 'undefined') return '';
  return resolveDistrictCode() || '';
}

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {};
}
function asString(value: unknown): string {
  return value == null ? '' : String(value);
}
function asNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
function asBoolean(value: unknown, defaultValue = false): boolean {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;
  return !['FALSE', '0', 'NO', 'OFF'].includes(String(value).toUpperCase());
}

async function readResult<T>(response: Response): Promise<ApiResult<T>> {
  try {
    const result = await response.json() as ApiResult<T>;
    if (!response.ok && result.ok !== false) {
      return { ok: false, error: '服務暫時未能處理請求，請稍後再試。' };
    }
    return result;
  } catch {
    return { ok: false, error: '後台回應格式不正確，請聯絡區會。' };
  }
}

async function callGet<T>(action: string, params: Record<string, string> = {}): Promise<ApiResult<T>> {
  const url = new URL('/api/proxy', window.location.origin);
  url.searchParams.set('districtCode', districtCode());
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });

  try {
    const response = await fetch(url.toString(), { cache: 'no-store' });
    return await readResult<T>(response);
  } catch {
    return { ok: false, error: '連線失敗，請稍後再試。' };
  }
}

async function callPost<T>(action: string, body: UnknownRecord): Promise<ApiResult<T>> {
  try {
    const response = await fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ districtCode: districtCode(), action, ...body }),
    });
    return await readResult<T>(response);
  } catch {
    return { ok: false, error: '連線失敗，請稍後再試。' };
  }
}

function mapVenue(value: unknown): Venue {
  const row = asRecord(value);
  return {
    venueId: asString(row.venueId),
    name: asString(row.name),
    location: asString(row.location),
    capacity: asNumber(row.capacity),
    note: asString(row.note),
  };
}

function mapItem(value: unknown): Item {
  const row = asRecord(value);
  return {
    itemId: asString(row.itemId),
    name: asString(row.name),
    category: asString(row.category) || '其他',
    totalQty: asNumber(row.totalQty),
    availableQty: asNumber(row.availableQty),
    unit: asString(row.unit) || '件',
    note: asString(row.note),
  };
}

function mapCourse(value: unknown): CourseLink {
  const row = asRecord(value);
  return {
    courseId: asString(row.courseId),
    title: asString(row.title),
    badgeName: asString(row.badgeName),
    section: asString(row.section),
    courseNo: asString(row.courseNo),
    sessionsText: asString(row.sessionsText),
    eligibility: asString(row.eligibility),
    fee: asNumber(row.fee),
    originalFee: asNumber(row.originalFee),
    subsidyNote: asString(row.subsidyNote),
    deadline: asString(row.deadline),
    quota: asNumber(row.quota),
    filled: asNumber(row.filled),
    venue: asString(row.venue),
    noticeUrl: asString(row.noticeUrl),
    contact: asString(row.contact),
    active: asBoolean(row.active, true),
  };
}

function mapNotice(value: unknown): ActivityNotice {
  const row = asRecord(value);
  return {
    id: asString(row.id),
    refCode: asString(row.refCode),
    submittedAt: asString(row.submittedAt),
    year: asString(row.year),
    section: asString(row.section),
    nature: asString(row.nature),
    troop: asString(row.troop),
    activityName: asString(row.activityName),
    startDateTime: asString(row.startDateTime),
    endDateTime: asString(row.endDateTime),
    location: asString(row.location),
    membersCount: asNumber(row.membersCount),
    leadersCount: asNumber(row.leadersCount),
    parentsCount: asNumber(row.parentsCount),
    districtCode: asString(row.districtCode),
  };
}

async function mapList<T>(
  result: Promise<ApiResult<unknown[]>>,
  mapper: (value: unknown) => T,
): Promise<ApiResult<T[]>> {
  const response = await result;
  if (!response.ok) return { ok: false, error: response.error };
  return { ok: true, data: Array.isArray(response.data) ? response.data.map(mapper) : [] };
}

export const api = {
  getConfig: (): Promise<ApiResult<DistrictConfig>> => callGet('getConfig'),
  getSystem: (): Promise<ApiResult<SystemState>> => callGet('getSystem'),

  listCourseLinks: (): Promise<ApiResult<CourseLink[]>> =>
    mapList(callGet<unknown[]>('listCourseLinks'), mapCourse),

  listVenues: (): Promise<ApiResult<Venue[]>> =>
    mapList(callGet<unknown[]>('listVenues'), mapVenue),

  listItems: (): Promise<ApiResult<Item[]>> =>
    mapList(callGet<unknown[]>('listItems'), mapItem),

  listActivityNotices: (params: { year?: string; section?: string; nature?: string } = {}): Promise<ApiResult<ActivityNotice[]>> =>
    mapList(callGet<unknown[]>('listActivityNotices', params as Record<string, string>), mapNotice),

  submitVenueRequest: (payload: UnknownRecord, meta: SubmissionMeta): Promise<ApiResult<SubmissionResult>> =>
    callPost('submitVenueRequest', { ...payload, ...meta }),

  submitStockRequest: (payload: UnknownRecord, meta: SubmissionMeta): Promise<ApiResult<SubmissionResult>> =>
    callPost('submitStockRequest', { ...payload, ...meta }),

  submitStockBatchRequest: (payload: UnknownRecord, meta: SubmissionMeta): Promise<ApiResult<SubmissionResult>> =>
    callPost('submitStockBatchRequest', { ...payload, ...meta }),

  submitActivityNotice: (payload: UnknownRecord, meta: SubmissionMeta): Promise<ApiResult<SubmissionResult>> =>
    callPost('submitActivityNotice', { ...payload, ...meta }),

  submitCourseReg: (payload: UnknownRecord, meta: SubmissionMeta): Promise<ApiResult<SubmissionResult>> =>
    callPost('submitCourseReg', { ...payload, ...meta }),
};
