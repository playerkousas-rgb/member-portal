// 與後台 Google Sheet 對應的型別

export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

// ---------- 課程參考資料（CourseParams 表） ----------
export interface CourseParamBadge {
  code: string;       // 徽章代碼（例：SBC = 原野烹飪）
  group: string;      // 組別（興趣/技能/服務/教導）
  nameZh: string;     // 中文徽章名
  nameEn: string;     // 英文徽章名
  kind: string;       // 專科徽章 / 其他徽章
}
export interface CourseParams {
  badges: CourseParamBadge[];
  sections: string[];      // 支部：小童軍/幼童軍/童軍/深資童軍/樂行童軍
  districts: string[];     // 區會（筲箕灣/柴灣/…）
  regions: string[];       // 地域（港島/九龍/…）
  memberTypes: string[];   // 支部（小童軍/幼童軍/童軍/深資童軍/樂行童軍）
}

export interface PublicInfo {
  districtName: string;
  logoText: string;
  teamupBookingUrl: string;
  fpsQr?: string;
  fpsAccountName: string;
  fpsAccountNumber: string;
  venueRules: string;
  venueRulesUrl: string;
  venueTermsUrl: string;
  cctvUrl: string;
  stockRules: string;
  stockRulesUrl: string;
  troopList: string[];
}

// ---------- 物資 ----------
export interface Item {
  itemId: string;
  category: string;
  name: string;
  totalQty: number;
  availableQty: number;
  unit: string;
  note: string;
  location: string;
  active: boolean;
}

export interface StockRequest {
  id: string;
  districtCode: string;
  itemId: string;
  itemName: string;
  category: string;
  qty: number;
  purpose: string;
  borrowDate: string;
  returnDate: string;
  name: string;
  phone: string;
  email: string;
  troop: string;
  position: string;
  agreeRules: string;
  status: 'pending' | 'approved' | 'rejected' | 'returned';
  refCode: string;
  createdAt: string;
}

// ---------- 訓練班 ----------
export interface Course {
  courseId: string;
  title: string;
  section: string;        // 支部
  badgeCode: string;      // 徽章代碼（如 SBC）
  badgeName: string;      // 徽章名
  courseNo: string;       // 訓練班編號（如 SAL）
  sessionsText: string;
  eligibility: string;
  fee: number;
  originalFee: number;
  subsidyNote: string;    // 資助說明
  deadline: string;
  regStartDate: string;
  quota: number;
  filled: number;
  venue: string;
  status: 'open' | 'full' | 'closed';
  noticeUrl: string;
  fpsNote: string;
  contact: string;        // 查詢聯絡
}

export interface CourseReg {
  id: string;
  courseId: string;
  courseTitle: string;
  email: string;
  nameZh: string;
  nameEn: string;
  phone: string;
  gender: string;
  dob: string;
  scoutDistrict: string;
  region: string;
  troop: string;
  scoutId: string;
  scoutPosition: string;
  memberType: string;     // 支部（小童軍/幼童軍/童軍/深資童軍/樂行童軍）
  section: string;        // 支部
  badgeCode: string;
  leaderName: string;
  leaderPosition: string;
  leaderEmail: string;
  payMethod: string;
  payerName: string;
  payAccount: string;
  receiptUrl: string;
  needReceipt: string;
  feePaid: string;        // TRUE / FALSE
  paidAt: string;
  confirmAt: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'waitlist';
  refCode: string;
}

// ---------- 訓練班專屬 Script 目錄（CourseLinks） ----------
export interface CourseLink {
  courseId: string;
  title: string;
  badgeName: string;
  section: string;
  courseNo: string;
  sessionsText: string;
  eligibility: string;
  fee: number;
  originalFee: number;
  subsidyNote: string;
  deadline: string;
  quota: number;
  filled: number;
  venue: string;
  noticeUrl: string;
  contact: string;
  active: boolean;
  apiBase?: string; // 職員先睇到
  apiKey?: string;  // 職員先睇到
}

// ---------- 借場 ----------
export interface Venue {
  venueId: string;
  name: string;
  scienerLockId: string;
  note: string;
  active: boolean;
}

export interface VenueBooking {
  id: string;
  venueId: string;
  venueName: string;
  teamupEventId: string;
  startDate: string;
  endDate: string;
  name: string;
  phone: string;
  email: string;
  troop: string;
  purpose: string;
  position: string;
  agreeRules: string;
  status: 'pending' | 'approved' | 'rejected' | 'done';
  pwdRef: string;
  refCode: string;
  createdAt: string;
}

// ---------- 活動知會 ----------
export interface ActivityNotice {
  id: string;
  refCode: string;
  troop: string;
  activityName: string;
  sections: string;
  nature: string;
  startDateTime: string;
  endDateTime: string;
  location: string;
  membersCount: string;
  leadersCount: string;
  parentsCount: string;
  leaderName: string;
  leaderPhone: string;
  leaderEmail: string;
  note: string;
  createdAt: string;
}

// ---------- 統一紀錄（AllRecords） ----------
export type RecordType = 'venue' | 'stock' | 'course' | 'activity';
export interface AllRecord {
  id: string;
  type: RecordType;
  refCode: string;
  title: string;
  requester: string;
  phone: string;
  troop: string;
  status: string;
  detail: string;
  createdAt: string;
}

// ---------- 職員 ----------
export interface StaffSession {
  email: string;
  displayName: string;
  role: string;
  token: string;
  canVenue: boolean;
  canStock: boolean;
  canCourse: boolean;
  canStaff: boolean;
}

export interface StaffInfo {
  email: string;
  name: string;
  role: string;
  canVenue: boolean;
  canStock: boolean;
  canCourse: boolean;
  canStaff: boolean;
  active: boolean;
}
