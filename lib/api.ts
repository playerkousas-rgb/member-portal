/**
 * API 封裝：所有請求經 /api/proxy 轉發，API Key 唔經前端。
 * 公開表單（唔使登入）同職員動作都行同一條路。
 */
import { resolveDistrictCode } from './district';
import type {
  ApiResult, PublicInfo, Item, StockRequest, Course, CourseReg,
  Venue, VenueBooking, StaffSession, StaffInfo, ActivityNotice, AllRecord,
} from './types';

function districtCode(): string {
  if (typeof window === 'undefined') return '';
  return resolveDistrictCode() || '';
}

async function callGet<T = any>(action: string, params: Record<string, string> = {}): Promise<ApiResult<T>> {
  const url = new URL('/api/proxy', window.location.origin);
  url.searchParams.set('districtCode', districtCode());
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  try {
    const res = await fetch(url.toString(), { cache: 'no-store' });
    return await res.json();
  } catch {
    return { ok: false, error: '連線失敗，請稍後再試。' };
  }
}

async function callPost<T = any>(action: string, body: Record<string, unknown> = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ districtCode: districtCode(), action, ...body }),
    });
    return await res.json();
  } catch {
    return { ok: false, error: '連線失敗，請稍後再試。' };
  }
}

export const api = {
  // ---------- 公開（唔使登入） ----------
  getPublicInfo: (): Promise<ApiResult<PublicInfo>> => callGet('getPublicInfo'),

  listItems: (): Promise<ApiResult<Item[]>> => callGet('listItems'),
  submitStockRequest: (payload: Record<string, unknown>): Promise<ApiResult<{ refCode: string }>> =>
    callPost('submitStockRequest', payload),

  listCourses: (): Promise<ApiResult<Course[]>> => callGet('listCourses'),
  submitCourseReg: (payload: Record<string, unknown>): Promise<ApiResult<{ refCode: string }>> =>
    callPost('submitCourseReg', payload),

  listVenues: (): Promise<ApiResult<Venue[]>> => callGet('listVenues'),
  submitVenueRequest: (payload: Record<string, unknown>): Promise<ApiResult<{ refCode: string }>> =>
    callPost('submitVenueRequest', payload),

  submitActivityNotice: (payload: Record<string, unknown>): Promise<ApiResult<{ refCode: string }>> =>
    callPost('submitActivityNotice', payload),
  getActivityNotices: (token: string): Promise<ApiResult<ActivityNotice[]>> => callGet('getActivityNotices', { token }),

  // 統一紀錄
  getAllRecords: (token: string): Promise<ApiResult<AllRecord[]>> => callGet('getAllRecords', { token }),

  // ---------- 職員 ----------
  staffLogin: (email: string, password: string): Promise<ApiResult<StaffSession>> =>
    callPost('staffLogin', { email, password }),
  staffVerify: (token: string): Promise<ApiResult<StaffSession>> => callGet('staffVerify', { token }),
  changeStaffPassword: (token: string, oldPassword: string, newPassword: string): Promise<ApiResult<{ saved: boolean }>> =>
    callPost('changeStaffPassword', { token, oldPassword, newPassword }),

  // 帳戶管理
  getStaffList: (token: string): Promise<ApiResult<StaffInfo[]>> => callGet('getStaffList', { token }),
  saveStaff: (token: string, staff: Partial<StaffInfo> & { password?: string }): Promise<ApiResult<{ saved: boolean }>> =>
    callPost('saveStaff', { token, staff }),
  deleteStaff: (token: string, email: string): Promise<ApiResult<{ deleted: boolean }>> =>
    callPost('deleteStaff', { token, email }),

  // 借物資
  getStockRequests: (token: string): Promise<ApiResult<StockRequest[]>> => callGet('getStockRequests', { token }),
  setStockRequestStatus: (token: string, id: string, status: string): Promise<ApiResult<{ saved: boolean }>> =>
    callPost('setStockRequestStatus', { token, id, status }),
  getItems: (token: string): Promise<ApiResult<Item[]>> => callGet('getItems', { token }),
  saveItem: (token: string, item: Partial<Item>): Promise<ApiResult<{ saved: boolean }>> =>
    callPost('saveItem', { token, item }),
  deleteItem: (token: string, itemId: string): Promise<ApiResult<{ deleted: boolean }>> =>
    callPost('deleteItem', { token, itemId }),

  // 報班
  getCourseRegs: (token: string): Promise<ApiResult<CourseReg[]>> => callGet('getCourseRegs', { token }),
  setCourseRegStatus: (token: string, id: string, status: string): Promise<ApiResult<{ saved: boolean }>> =>
    callPost('setCourseRegStatus', { token, id, status }),
  getCourses: (token: string): Promise<ApiResult<Course[]>> => callGet('getCourses', { token }),
  saveCourse: (token: string, course: Partial<Course>): Promise<ApiResult<{ saved: boolean }>> =>
    callPost('saveCourse', { token, course }),
  deleteCourse: (token: string, courseId: string): Promise<ApiResult<{ deleted: boolean }>> =>
    callPost('deleteCourse', { token, courseId }),

  // 借場
  getVenueBookings: (token: string): Promise<ApiResult<VenueBooking[]>> => callGet('getVenueBookings', { token }),
  approveVenueBooking: (token: string, id: string): Promise<ApiResult<{ password: string; warn?: string }>> =>
    callPost('approveVenueBooking', { token, id }),
  rejectVenueBooking: (token: string, id: string): Promise<ApiResult<{ saved: boolean }>> =>
    callPost('rejectVenueBooking', { token, id }),
  getVenues: (token: string): Promise<ApiResult<Venue[]>> => callGet('getVenues', { token }),
  saveVenue: (token: string, venue: Partial<Venue>): Promise<ApiResult<{ saved: boolean }>> =>
    callPost('saveVenue', { token, venue }),
  deleteVenue: (token: string, venueId: string): Promise<ApiResult<{ deleted: boolean }>> =>
    callPost('deleteVenue', { token, venueId }),
};
