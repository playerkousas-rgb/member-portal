// 成員系統只保留公開 API 所需型別；管理／批核型別屬 scout-district-portal。

export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface DistrictConfig {
  districtName: string;
  theme?: string;
  logoText?: string;
}

export interface SystemState {
  locked: boolean;
  lockMessage: string;
}

export interface SubmissionMeta {
  _website: string;
  _startedAt: number;
}

export interface SubmissionResult {
  /** 批次申請編號；單項表單則為該項記錄編號。 */
  refCode: string;
  /** 多項物資申請寫入 Sheet 後，各項記錄的原始編號。 */
  refCodes?: string[];
  submittedCount?: number;
  requestedCount?: number;
  /** 極少數上游部分失敗時，提醒使用者不要整批重複遞交。 */
  partialError?: string;
}

export interface Venue {
  venueId: string;
  name: string;
  location: string;
  capacity: number;
  note: string;
}

export interface Item {
  itemId: string;
  name: string;
  category: string;
  totalQty: number;
  availableQty: number;
  unit: string;
  note: string;
}

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
  // 每班收費 FPS QR（由管理系統訓練班管理生成；空字串 = 未生成）
  fpsQrPayload?: string;   // HKICL Common QR 字串，直接畫 QR 即可掃
  fpsAmount?: string;      // 固定銀碼（= 學費）
  fpsReference?: string;   // 參考編號（付款 App 顯示）
  fpsAccountName?: string; // 收款戶口名
  fpsAccountNumber?: string; // FPS ID
  // 通告全文欄（管理系統 v4.16.0 由區網通告 PDF 讀入；未填 = 空字串）
  leader?: string;      // 班領導人
  uniform?: string;     // 服裝
  remarks?: string;     // 備註全文（可多行）
  signupText?: string;  // 報名辦法（通告原文）
  feeNote?: string;     // 費用全文（含轉數快戶口／付款說明）
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
  pinned: boolean;
  /** 'info' | 'warning' | 'important' — 控制顯示顏色 */
  level: 'info' | 'warning' | 'important';
}

/** 活動知會（公開欄位；領袖聯絡資料唔會經 member proxy 回傳） */
export interface ActivityNotice {
  id: string;
  refCode: string;
  year: string;
  section: string;
  nature: string;
  troop: string;
  activityName: string;
  startDateTime: string;
  endDateTime: string;
  location: string;
  membersCount: number;
  leadersCount: number;
  parentsCount: number;
  submittedAt: string;
}

/** 區內旅團名錄（listDistrictTroops；只含公開欄位，內部備註／支部團數唔會經 proxy 流出） */
export interface DistrictTroop {
  /** 旅號／旅團編號 */
  troop: string;
  /** 旅團名稱 */
  label: string;
  /** 主辦機構 */
  organizer: string;
  /** 集會時間 */
  meetingTime: string;
  instagramUrl: string;
  facebookUrl: string;
  websiteUrl: string;
}

export interface DistrictTroopsDirectory {
  districtCode: string;
  districtName: string;
  troops: DistrictTroop[];
}

/** 區系統公開設定（getPublicInfo；動態文字唯一來源） */
export interface PublicInfo {
  districtName: string;
  districtCode: string;
  venueRules: string;
  stockRules: string;
  troopList: string[];
  cctvUrl: string;
  teamupBookingUrl: string;
  /** Config TEAMUP_READONLY_URL：專為公開嵌入而設嘅 Teamup 唯讀分享連結（首選）。 */
  teamupReadOnlyUrl: string;
  fpsAccountName: string;
  fpsAccountNumber: string;
}
