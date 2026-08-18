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
}

/** 公開知會資料刻意不包含負責領袖姓名、電話及電郵。 */
export interface ActivityNotice {
  id: string;
  refCode: string;
  submittedAt: string;
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
  districtCode: string;
}
