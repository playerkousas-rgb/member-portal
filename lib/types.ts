// 與後台 Google Sheet 對應的型別

export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
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
  sessionsText: string;
  eligibility: string;
  fee: number;
  originalFee: number;
  deadline: string;
  quota: number;
  filled: number;
  venue: string;
  status: 'open' | 'full' | 'closed';
  noticeUrl: string;
  fpsNote: string;
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
  troop: string;
  scoutId: string;
  scoutPosition: string;
  leaderName: string;
  leaderPosition: string;
  leaderEmail: string;
  payMethod: string;
  payerName: string;
  payAccount: string;
  receiptUrl: string;
  needReceipt: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'waitlist';
  refCode: string;
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
