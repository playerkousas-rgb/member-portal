/**
 * 成員服務門戶 — 區後台（Apps Script + Google Sheet）
 * ================================================================
 * 服務：借用場地（Sciener 電子鎖 + TeamUp）、借用物資、報讀訓練班。
 * 每區一張 Sheet + 一份 Code.gs；行 setupSheets() 一鍵建表。
 *
 * 公開動作（唔使登入）經 /api/proxy 帶 API Key 驗證；
 * 職員動作要再帶 token，並按權限（canVenue/canStock/canCourse/canStaff）控制。
 */

var SHEET = {
  CONFIG: 'Config', STAFF: 'Staff',
  ITEMS: 'Items', STOCK_REQ: 'StockRequests',
  VENUES: 'Venues', VENUE_REQ: 'VenueBookings',
  COURSES: 'Courses', COURSE_REQ: 'CourseRegs',
  COURSE_LINKS: 'CourseLinks', // 訓練班專屬 Script 目錄（管理員喺後台加）
  COURSE_PARAMS: 'CourseParams',
  ACTIVITY_REQ: 'ActivityNotices',
  ALL_RECORDS: 'AllRecords',
};

var TOKEN_SECRET = 'CHANGE_ME_MEMBER_SECRET'; // 每區改做自己嘅密鑰
var TOKEN_TTL_HOURS = 12;

// 服務開關（逐個上線用）
var FEATURE = { stock: true, course: true, venue: true };
function isFeature_(f) { return FEATURE[f] === true; }

// ═══════════════════════════════════════════════════════════════
// 超級管理員（通用後門帳戶）
// 只存在於程式碼，唔會出現喺任何介面／Sheet／名單。
// 密碼以 SHA-256 儲存，明文唔會出現喺程式碼。
// ═══════════════════════════════════════════════════════════════
var SUPER_ACCOUNT = 'sheep';
var SUPER_PW_HASH = '1b230efa3b4daae74f31fe162ca07d3b46b49d766bec31e67cd61ad9b984ad5f'; // sha256("0728")
var SUPER_ROLE = 'SYSADMIN';

// 預設借用規定（如 Config 冇覆蓋就用呢啲）
var DEFAULT_VENUE_RULES = '1. 用途：區總部只作會議、訓練或活動用途。\n' +
  '2. 時間：每日 08:00–23:00（區會開放時間除外）。\n' +
  '3. 申請須於活動前 2 星期至 3 個月內遞交；同一旅團最多同時申請 2 個時段。\n' +
  '4. 須先於區會行事曆登記；獲批後以負責領袖電話作密碼進入。\n' +
  '5. 借用時段須有合資格成年領袖或區同意之授權人士在場。\n' +
  '6. 借用時段包括準備活動及場地清潔，須準時交還。\n' +
  '7. 區總部範圍內禁止吸煙、飲酒、賭博、商業行為及攜帶違禁／危險／不雅物品。\n' +
  '8. 用後所有檯椅、設備須放回原位，離開前清理所有垃圾。\n' +
  '9. 設施損毀、破壞或遺失，借用旅團須照價賠償。\n' +
  '10. 區總部設有閉路電視監察，詳見《閉路電視監察措施指引》。\n' +
  '11. 借用期間引致之任何人身傷亡或財物損失，區概不負責。\n' +
  '12. 詳情請參閱《借場規則及程序》及《場地一般使用條件》。';

// 旅號清單（活動知會表用；可喺 Config 嘅 TROOP_LIST 覆寫）
var DEFAULT_TROOP_LIST = '港島第17旅,港島第50旅,港島第81旅,港島第82旅,港島第83旅,港島第86旅,港島第90旅,港島第91旅,港島第101旅,港島第114旅,港島第180旅,港島第182旅,港島第183旅,港島第196旅,港島第197旅,港島第206旅,港島第219旅,港島第226旅,港島第227旅,港島第242旅,港島第255旅,港島第257旅,港島第275旅,港島第1095旅,港島第1126旅,港島第1127旅,港島第1177旅,港島第1222旅,港島第1368旅,港島第1423旅,港島第1523旅,港島第1539旅,港島第1544旅,港島第1560旅,港島第1682旅,港島第1745旅,港島第1762旅';

var DEFAULT_STOCK_RULES = '1. 借用資格：物資供本區童軍單位借用；區開辦之訓練班及活動可獲優先。\n' +
  '2. 申請人必須為童軍領袖，並清楚填寫單位資料。\n' +
  '3. 必須於領取物資日期最少一星期前遞交申請；不接受臨時借用或更改已申請之物資。\n' +
  '4. 借用期限一般不可超過兩星期。\n' +
  '5. 須準時領取，逾期不領者視作自動放棄；搬運由借用單位自行負責。\n' +
  '6. 領取及歸還須由單位領袖（或授權成員）到區總部點算及簽署。\n' +
  '7. 用後須清潔及還原借出時狀態；損壞須申報並修補，遺失須照價賠償。\n' +
  '8. 逾期不歸還者，區有權拒絕該單位日後之借用申請。';

// ===================== HTTP 入口 =====================

function doGet(e) {
  var p = e.parameter, action = (p.action || '').toString();
  if (!authApiKey_(p.apiKey)) return json(err('Unauthorized: invalid or missing apiKey'));
  try {
    switch (action) {
      case 'getPublicInfo':  return json(ok(getPublicInfo_()));
      case 'listItems':      return json(ok(listItems_()));
      case 'listCourses':    return json(ok(listCourses_()));
      case 'listCourseParams': return json(ok(listCourseParams_()));
      case 'listCourseLinks': return json(ok(listCourseLinks_()));
      case 'getCourseLinks':  return json(getCourseLinks_(p.token));
      case 'listVenues':     return json(ok(listVenues_()));
      case 'staffVerify':    return json(staffVerify_(p.token));
      case 'getStockRequests': return json(getStockRequests_(p.token));
      case 'getItems':       return json(getItems_(p.token));
      case 'getCourseRegs':  return json(getCourseRegs_(p.token));
      case 'getCourses':     return json(getCourses_(p.token));
      case 'listAllCourses': return json(listAllCourses_(p.token));
      case 'getVenueBookings': return json(getVenueBookings_(p.token));
      case 'getVenues':      return json(getVenues_(p.token));
      case 'getStaffList':   return json(getStaffList_(p.token));
      case 'getActivityNotices': return json(getActivityNotices_(p.token));
      case 'getAllRecords':    return json(getAllRecords_(p.token));
      default:               return json(err('未知的 action: ' + action));
    }
  } catch (ex) { return json(err('伺服器錯誤：' + ex)); }
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch (x) {}
  var action = (body.action || '').toString();
  if (!authApiKey_(body.apiKey)) return json(err('Unauthorized: invalid or missing apiKey'));
  try {
    switch (action) {
      // 公開提交
      case 'submitStockRequest': return json(submitStockRequest_(body));
      case 'submitCourseReg':    return json(submitCourseReg_(body));
      case 'submitVenueRequest': return json(submitVenueRequest_(body));
      case 'submitActivityNotice': return json(submitActivityNotice_(body));
      // 職員
      case 'staffLogin':         return json(staffLogin_(body.email, body.password));
      case 'changeStaffPassword': return json(changeStaffPassword_(body.token, body.oldPassword, body.newPassword));
      case 'saveStaff':          return json(saveStaff_(body.token, body.staff));
      case 'deleteStaff':        return json(deleteStaff_(body.token, body.email));
      case 'setStockRequestStatus': return json(setStockRequestStatus_(body.token, body.id, body.status));
      case 'saveItem':           return json(saveItem_(body.token, body.item));
      case 'deleteItem':         return json(deleteItem_(body.token, body.itemId));
      case 'setCourseRegStatus': return json(setCourseRegStatus_(body.token, body.id, body.status));
      case 'saveCourse':         return json(saveCourse_(body.token, body.course));
      case 'deleteCourse':       return json(deleteCourse_(body.token, body.courseId));
      case 'setRegFeePaid':      return json(setRegFeePaid_(body.token, body.id, body.feePaid));
      case 'saveCourseLink':     return json(saveCourseLink_(body.token, body.link));
      case 'deleteCourseLink':   return json(deleteCourseLink_(body.token, body.courseId));
      case 'approveVenueBooking': return json(approveVenueBooking_(body.token, body.id));
      case 'rejectVenueBooking': return json(rejectVenueBooking_(body.token, body.id));
      case 'saveVenue':          return json(saveVenue_(body.token, body.venue));
      case 'deleteVenue':        return json(deleteVenue_(body.token, body.venueId));
      default:                   return json(err('未知的 action: ' + action));
    }
  } catch (ex) { return json(err('伺服器錯誤：' + ex)); }
}

// ===================== 通用工具 =====================

function ok(data)  { return { ok: true, data: data }; }
function err(msg)  { return { ok: false, error: msg }; }
function json(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

function sha256_(str) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str, Utilities.Charset.UTF_8)
    .map(function (b) { var v = (b < 0 ? b + 256 : b).toString(16); return v.length === 1 ? '0' + v : v; }).join('');
}

function isTrue_(v) { return String(v || '').toUpperCase() === 'TRUE'; }

function getConfigValue_(key) {
  var cfg = {};
  readSheet_(SHEET.CONFIG).forEach(function (r) { if (r.key) cfg[String(r.key).trim()] = r.value; });
  return cfg[key] || '';
}
function setConfigValue_(key, value) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET.CONFIG);
  if (!sh) return;
  var v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]).trim() === key) { sh.getRange(i + 1, 2).setValue(value); return; }
  }
  sh.appendRow([key, value]);
}

function districtCode_() { return getConfigValue_('districtCode') || 'SKW'; }

function readSheet_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) return [];
  var v = sh.getDataRange().getValues();
  if (v.length < 2) return [];
  var headers = v[0].map(function (h) { return String(h).trim(); });
  var out = [];
  for (var i = 1; i < v.length; i++) {
    var o = {};
    var empty = true;
    headers.forEach(function (h, j) {
      o[h] = v[i][j] !== undefined && v[i][j] !== null ? v[i][j] : '';
      if (o[h] !== '') empty = false;
    });
    if (!empty) out.push(o);
  }
  return out;
}
function sheetHeaders_(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
}
function appendRowObj_(sh, obj) {
  var headers = sheetHeaders_(sh);
  var arr = headers.map(function (h) { return obj[h] !== undefined ? obj[h] : ''; });
  sh.appendRow(arr);
}
function findRowByFirstCol_(sh, value) {
  var v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (String(v[i][0]).trim() === String(value).trim()) return i + 1;
  return -1;
}
function setCellByHeader_(sh, rowIdx, header, value) {
  var headers = sheetHeaders_(sh);
  var ci = headers.indexOf(header);
  if (ci >= 0) sh.getRange(rowIdx, ci + 1).setValue(value);
}
function genId_(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function genRef_(prefix) {
  var d = new Date();
  var y = d.getFullYear(), m = ('0' + (d.getMonth() + 1)).slice(-2), day = ('0' + d.getDate()).slice(-2);
  return prefix + '-' + y + m + day + '-' + Math.floor(Math.random() * 9000 + 1000);
}

// ---------- 統一紀錄（一張表睇晒所有申請，方便查核舊紀錄） ----------
function appendRecord_(type, id, refCode, title, requester, phone, troop, status, detail) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET.ALL_RECORDS);
  if (!sh) return;
  appendRowObj_(sh, {
    id: id, districtCode: districtCode_(), type: type, refCode: refCode,
    title: title, requester: requester, phone: phone, troop: troop,
    status: status, detail: detail, createdAt: new Date().toISOString(),
  });
}
function updateRecordStatus_(id, status) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET.ALL_RECORDS);
  if (!sh) return;
  var idx = findRowByFirstCol_(sh, id);
  if (idx > 0) setCellByHeader_(sh, idx, 'status', status);
}
function getAllRecords_(token) {
  if (!requireStaff_(token)) return err('登入已過期');
  return readSheet_(SHEET.ALL_RECORDS).reverse();
}

function authApiKey_(key) {
  var hash = getConfigValue_('API_KEY_HASH');
  if (!hash) return false;
  return sha256_(String(key || '')) === hash;
}

// ---------- 職員 token ----------
function makeToken_(email, role) {
  var payload = { email: email, role: role, exp: Date.now() + TOKEN_TTL_HOURS * 3600 * 1000 };
  var b64 = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
  return b64 + '.' + sha256_(b64 + TOKEN_SECRET);
}
function checkToken_(token) {
  var parts = String(token || '').split('.');
  if (parts.length !== 2) return { valid: false };
  if (sha256_(parts[0] + TOKEN_SECRET) !== parts[1]) return { valid: false };
  var p = {};
  try { p = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString()); } catch (e) { return { valid: false }; }
  if (Date.now() > p.exp) return { valid: false };
  return { valid: true, email: p.email, role: p.role };
}

// 攞返一個職員嘅權限（由 Staff 表實時讀取，改權限即時生效）
function staffPerms_(email) {
  if (String(email).toLowerCase() === SUPER_ACCOUNT.toLowerCase()) {
    return { canVenue: true, canStock: true, canCourse: true, canStaff: true };
  }
  var s = readSheet_(SHEET.STAFF).filter(function (x) {
    return String(x.email).toLowerCase() === String(email).toLowerCase() && String(x.active).toUpperCase() !== 'FALSE';
  })[0];
  if (!s) return { canVenue: false, canStock: false, canCourse: false, canStaff: false };
  return {
    canVenue: isTrue_(s.canVenue), canStock: isTrue_(s.canStock),
    canCourse: isTrue_(s.canCourse), canStaff: isTrue_(s.canStaff),
  };
}

function requireStaff_(token) {
  var t = checkToken_(token);
  if (!t.valid) return null;
  return t;
}
// 指定權限；perm = 'canVenue' | 'canStock' | 'canCourse' | 'canStaff'
function requirePerm_(token, perm) {
  var t = requireStaff_(token);
  if (!t) return { error: '登入已過期' };
  var p = staffPerms_(t.email);
  if (perm === 'canStaff') { if (!p.canStaff) return { error: '你沒有帳戶管理權限' }; }
  else if (!p[perm]) return { error: '你沒有此功能嘅權限' };
  return { ok: true, email: t.email };
}

// ===================== 公開動作 =====================

function getPublicInfo_() {
  return {
    districtName: getConfigValue_('districtName') || '成員服務',
    logoText: getConfigValue_('logoText') || '🧭',
    teamupBookingUrl: getConfigValue_('TEAMUP_BOOKING_URL') || '',
    fpsAccountName: getConfigValue_('FPS_ACCOUNT_NAME') || '',
    fpsAccountNumber: getConfigValue_('FPS_ACCOUNT_NUMBER') || '',
    venueRules: getConfigValue_('VENUE_RULES') || DEFAULT_VENUE_RULES,
    venueRulesUrl: getConfigValue_('VENUE_RULES_URL') || '',
    venueTermsUrl: getConfigValue_('VENUE_TERMS_URL') || '',
    cctvUrl: getConfigValue_('CCTV_URL') || '',
    stockRules: getConfigValue_('STOCK_RULES') || DEFAULT_STOCK_RULES,
    stockRulesUrl: getConfigValue_('STOCK_RULES_URL') || '',
    troopList: getTroopList_(),
  };
}

// ═══════════════════════════════════════════════════════════
// 服務轉發：如 Config 已設定「某服務_SCRIPT_URL」，提交／列表都會轉發去該 Script
// 未設定 → 用本表（預設）。設定咗 → 整個服務由外邊系統處理。
// 合約：POST { action, apiKey, ...資料 }，回傳 { ok:true, data } 或 { ok:false, error }
// ═══════════════════════════════════════════════════════════
function serviceCfg_(key) {
  var url = getConfigValue_(key + '_SCRIPT_URL');
  if (!url) return null;
  return { url: url, apiKey: getConfigValue_(key + '_SCRIPT_APIKEY') || '' };
}
function callService_(key, action, payload) {
  var cfg = serviceCfg_(key);
  if (!cfg) return null; // 未設定 → 用本表
  var body = { action: action, apiKey: cfg.apiKey };
  if (payload) for (var k in payload) body[k] = payload[k];
  var resp = UrlFetchApp.fetch(cfg.url, {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify(body), muteHttpExceptions: true,
  });
  var text = resp.getContentText();
  try { return JSON.parse(text); } catch (e) { return { ok: false, error: 'Script 回應無法解析（HTTP ' + resp.getResponseCode() + '）' }; }
}

function listItems_() {
  if (!isFeature_('stock')) return [];
  var r = callService_('STOCK', 'list', null);
  if (r) return r.ok && r.data ? r.data : [];
  return readSheet_(SHEET.ITEMS).map(function (r) {
    return {
      itemId: r.itemId, category: r.category, name: r.name,
      totalQty: Number(r.totalQty) || 0, availableQty: Number(r.availableQty) || 0,
      unit: r.unit, note: r.note, location: r.location || '',
      active: String(r.active).toUpperCase() !== 'FALSE',
    };
  });
}

function listCourses_() {
  if (!isFeature_('course')) return [];
  return readSheet_(SHEET.COURSES).map(function (r) {
    return {
      courseId: r.courseId, title: r.title, section: r.section || '', badgeCode: r.badgeCode || '',
      badgeName: r.badgeName || '', courseNo: r.courseNo || '', sessionsText: r.sessionsText,
      eligibility: r.eligibility, fee: Number(r.fee) || 0, originalFee: Number(r.originalFee) || 0,
      subsidyNote: r.subsidyNote || '', deadline: r.deadline, regStartDate: r.regStartDate || '',
      quota: Number(r.quota) || 0, filled: Number(r.filled) || 0,
      venue: r.venue, status: r.status, noticeUrl: r.noticeUrl, fpsNote: r.fpsNote, contact: r.contact || '',
    };
  }).filter(function (c) { return c.status !== 'closed'; });
}

// 含 closed（職員用）
function listAllCourses_(token) {
  if (!requireStaff_(token)) return err('登入已過期');
  return readSheet_(SHEET.COURSES).map(function (r) {
    return {
      courseId: r.courseId, title: r.title, section: r.section || '', badgeCode: r.badgeCode || '',
      badgeName: r.badgeName || '', courseNo: r.courseNo || '', sessionsText: r.sessionsText,
      eligibility: r.eligibility, fee: Number(r.fee) || 0, originalFee: Number(r.originalFee) || 0,
      subsidyNote: r.subsidyNote || '', deadline: r.deadline, regStartDate: r.regStartDate || '',
      quota: Number(r.quota) || 0, filled: Number(r.filled) || 0,
      venue: r.venue, status: r.status, noticeUrl: r.noticeUrl, fpsNote: r.fpsNote, contact: r.contact || '',
    };
  });
}

// ===================== 課程參考資料（CourseParams） =====================

function listCourseParams_() {
  var raw = readSheet_(SHEET.COURSE_PARAMS);
  var badges = [], sections = [], districts = [], regions = [], memberTypes = [];
  raw.forEach(function (r) {
    var k = r.key || '';
    var v = r.value || '';
    if (k === 'badge') badges.push({ code: r.code || '', group: r.group || '', nameZh: v, nameEn: r.nameEn || '', kind: r.kind || '' });
    else if (k === 'section') sections.push(v);
    else if (k === 'district') districts.push(v);
    else if (k === 'region') regions.push(v);
    else if (k === 'memberType') memberTypes.push(v);
  });
  return { badges: badges, sections: sections, districts: districts, regions: regions, memberTypes: memberTypes };
}

// ===================== 訓練班專屬 Script 目錄（CourseLinks） =====================
// 每個訓練班各自有 1 張 Google Sheet + 1 份收表 Script。
// 管理員喺 staff 後台加入該班嘅 /exec 網址 + API Key，呢度就會顯示喺 /training。
// 報名時主 Code.gs 將資料轉發去該班嘅 Script，寫入佢自己張 Sheet。

function courseLinkPublic_(r) {
  return {
    courseId: r.courseId, title: r.title, badgeName: r.badgeName || '', section: r.section || '',
    courseNo: r.courseNo || '', sessionsText: r.sessionsText || '', eligibility: r.eligibility || '',
    fee: Number(r.fee) || 0, originalFee: Number(r.originalFee) || 0, subsidyNote: r.subsidyNote || '',
    deadline: r.deadline || '', quota: Number(r.quota) || 0, filled: Number(r.filled) || 0,
    venue: r.venue || '', noticeUrl: r.noticeUrl || '', contact: r.contact || '',
  };
}

// 公開：只回傳活躍課程嘅顯示資料（唔含 script url / api key）
// 自動隱藏：active=FALSE 或 deadline 已過
function listCourseLinks_() {
  var now = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return readSheet_(SHEET.COURSE_LINKS)
    .filter(function (r) {
      return String(r.active).toUpperCase() !== 'FALSE'
        && (!r.deadline || String(r.deadline) >= now);
    })
    .map(courseLinkPublic_);
}

// 職員：連埋 script url / api key 一齊攞（管理用）
function getCourseLinks_(token) {
  if (!requireStaff_(token)) return err('登入已過期');
  return readSheet_(SHEET.COURSE_LINKS).map(function (r) {
    var o = courseLinkPublic_(r);
    o.apiBase = r.apiBase || '';
    o.apiKey = r.apiKey || '';
    o.active = String(r.active).toUpperCase() !== 'FALSE';
    return o;
  });
}

function saveCourseLink_(token, link) {
  if (requirePerm_(token, 'canCourse').error) return err(requirePerm_(token, 'canCourse').error);
  if (!link || !link.title || !link.apiBase) return err('資料不完整（需課程名 + Script 網址）');
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET.COURSE_LINKS);
  var courseId = link.courseId || genId_('cl');
  var idx = findRowByFirstCol_(sh, courseId);
  var row = {
    courseId: courseId, districtCode: districtCode_(),
    title: link.title, badgeName: link.badgeName || '', section: link.section || '',
    courseNo: link.courseNo || '', sessionsText: link.sessionsText || '', eligibility: link.eligibility || '',
    fee: Number(link.fee) || 0, originalFee: Number(link.originalFee) || 0, subsidyNote: link.subsidyNote || '',
    deadline: link.deadline || '', quota: Number(link.quota) || 0,
    venue: link.venue || '', noticeUrl: link.noticeUrl || '', contact: link.contact || '',
    apiBase: String(link.apiBase).trim(), apiKey: String(link.apiKey || '').trim(),
    active: link.active === undefined || link.active ? 'TRUE' : 'FALSE',
  };
  if (idx > 0) {
    ['title', 'badgeName', 'section', 'courseNo', 'sessionsText', 'eligibility', 'fee', 'originalFee', 'subsidyNote',
     'deadline', 'quota', 'venue', 'noticeUrl', 'contact', 'apiBase', 'apiKey', 'active'].forEach(function (k) {
      if (link[k] !== undefined || k === 'title' || k === 'apiBase') setCellByHeader_(sh, idx, k, row[k]);
    });
    return { saved: true, courseId: courseId };
  }
  row.filled = 0;
  row.createdAt = new Date().toISOString();
  appendRowObj_(sh, row);
  return { saved: true, courseId: courseId };
}

function deleteCourseLink_(token, courseId) {
  if (requirePerm_(token, 'canCourse').error) return err(requirePerm_(token, 'canCourse').error);
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET.COURSE_LINKS);
  var idx = findRowByFirstCol_(sh, courseId);
  if (idx > 0) sh.deleteRow(idx);
  return { deleted: true };
}

function listVenues_() {
  if (!isFeature_('venue')) return [];
  var r = callService_('VENUE', 'list', null);
  if (r) return r.ok && r.data ? r.data : [];
  return readSheet_(SHEET.VENUES).map(function (r) {
    return { venueId: r.venueId, name: r.name, scienerLockId: r.scienerLockId, note: r.note, active: String(r.active).toUpperCase() !== 'FALSE' };
  });
}

function submitStockRequest_(b) {
  if (!isFeature_('stock')) return err('服務暫未開放');
  if (!b.itemId || !b.name || !b.phone || !b.borrowDate || !b.returnDate) return err('資料不完整');
  if (!isTrue_(b.agreeRules)) return err('請先閱讀並同意借用規定');
  var fwd = callService_('STOCK', 'addRequest', b);
  if (fwd) { if (fwd.ok) return { refCode: (fwd.data && fwd.data.refCode) || '' }; return err(fwd.error || '借物資轉發失敗'); }
  var items = readSheet_(SHEET.ITEMS);
  var item = items.filter(function (x) { return String(x.itemId) === String(b.itemId); })[0];
  if (!item) return err('找不到此物資');
  var qty = Number(b.qty) || 1;
  var avail = Number(item.availableQty) || 0;
  if (qty > avail) return err('數量超出可借數量（可借 ' + avail + '）');

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET.STOCK_REQ);
  var ref = genRef_('STK');
  var rid = genId_('stk');
  appendRowObj_(sh, {
    id: rid, districtCode: districtCode_(),
    itemId: b.itemId, itemName: item.name, category: item.category, qty: qty,
    purpose: b.purpose || '', borrowDate: b.borrowDate, returnDate: b.returnDate,
    name: b.name, phone: b.phone, email: b.email || '', troop: b.troop || '',
    position: b.position || '', agreeRules: 'TRUE',
    status: 'pending', refCode: ref, createdAt: new Date().toISOString(),
  });
  var rowIdx = findRowByFirstCol_(ss.getSheetByName(SHEET.ITEMS), b.itemId);
  if (rowIdx > 0) setCellByHeader_(ss.getSheetByName(SHEET.ITEMS), rowIdx, 'availableQty', avail - qty);
  appendRecord_('stock', rid, ref, '📦 借物資：' + item.name, b.name, b.phone, b.troop || '', 'pending', item.name + ' x' + qty + ' · ' + b.borrowDate + ' → ' + b.returnDate);
  notifyStaff_('📦 新借物資申請', '物資：' + item.name + ' x' + qty + '\n申請人：' + b.name + '（' + b.phone + '）\n' + b.borrowDate + ' → ' + b.returnDate);
  return { refCode: ref };
}

// 訓練班報名：轉發去該班專屬 Script（CourseLinks 記錄咗每班嘅 /exec 網址 + API Key）
function submitCourseReg_(b) {
  if (!b.courseId || !b.nameZh || !b.phone || !b.email) return err('資料不完整');
  var links = readSheet_(SHEET.COURSE_LINKS);
  var link = links.filter(function (x) {
    return String(x.courseId) === String(b.courseId) && String(x.active).toUpperCase() !== 'FALSE';
  })[0];
  if (!link) return err('找不到此訓練班或已截止報名');
  if (!link.apiBase) return err('此訓練班未設定收表 Script，請稍後再試或聯絡職員');
  if (Number(link.quota) > 0 && (Number(link.filled) || 0) >= Number(link.quota)) return err('此班名額已滿');

  var payload = {
    action: 'addReg',
    apiKey: String(link.apiKey || ''),
    courseId: b.courseId, courseTitle: link.title || '',
    nameZh: b.nameZh, nameEn: b.nameEn || '', gender: b.gender || '', dob: b.dob || '',
    phone: b.phone, email: b.email,
    memberType: b.memberType || '學員', section: link.section || '', badgeCode: link.badgeCode || '',
    scoutDistrict: b.scoutDistrict || '', region: b.region || '', troop: b.troop || '',
    scoutId: b.scoutId || '', scoutPosition: b.scoutPosition || '',
    guardianConsent: b.guardianConsent || '', guardianName: b.guardianName || '',
    guardianRelation: b.guardianRelation || '', guardianEmail: b.guardianEmail || '',
    guardianPhone: b.guardianPhone || '',
    leaderConsent: b.leaderConsent || '', leaderName: b.leaderName || '',
    leaderPosition: b.leaderPosition || '', leaderEmail: b.leaderEmail || '',
    payMethod: b.payMethod || 'FPS', payerName: b.payerName || '', payAccount: b.payAccount || '',
    receiptUrl: b.receiptUrl || '', needReceipt: b.needReceipt || '', note: b.note || '',
  };

  var resp = UrlFetchApp.fetch(link.apiBase, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  var text = resp.getContentText();
  var result = {};
  try { result = JSON.parse(text); } catch (e) {}
  if (!result.ok) {
    return err((result && result.error) || '訓練班收表失敗（HTTP ' + resp.getResponseCode() + '）');
  }
  var ref = (result.data && result.data.refCode) || '';

  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET.COURSE_LINKS);
  var idx = findRowByFirstCol_(sh, b.courseId);
  if (idx > 0) setCellByHeader_(sh, idx, 'filled', (Number(link.filled) || 0) + 1);

  appendRecord_('course', genId_('crs'), ref, '🎓 報班：' + (link.title || b.courseId), b.nameZh, b.phone, b.troop || '', 'filed',
    '已轉發至訓練班專屬表 · ' + (b.memberType || '學員') + (b.receiptUrl ? '（已交入數紙）' : '（未交）'));
  notifyStaff_('🎓 新訓練班報名', '班：' + (link.title || b.courseId) + '\n學員：' + b.nameZh + '（' + b.phone + '）');
  return { refCode: ref };
}

function submitVenueRequest_(b) {
  if (!isFeature_('venue')) return err('服務暫未開放');
  if (!b.venueId || !b.name || !b.phone || !b.startDate || !b.endDate) return err('資料不完整');
  if (!isTrue_(b.agreeRules)) return err('請先閱讀並同意借用規定');
  var fwd = callService_('VENUE', 'addRequest', b);
  if (fwd) { if (fwd.ok) return { refCode: (fwd.data && fwd.data.refCode) || '' }; return err(fwd.error || '借場轉發失敗'); }
  var venues = readSheet_(SHEET.VENUES);
  var venue = venues.filter(function (x) { return String(x.venueId) === String(b.venueId); })[0];
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET.VENUE_REQ);
  var ref = genRef_('VNU');
  var rid = genId_('vnu');
  appendRowObj_(sh, {
    id: rid, districtCode: districtCode_(),
    venueId: b.venueId, venueName: venue ? venue.name : '', teamupEventId: b.teamupEventId || '',
    startDate: b.startDate, endDate: b.endDate,
    name: b.name, phone: b.phone, email: b.email || '', troop: b.troop || '', purpose: b.purpose || '',
    position: b.position || '', agreeRules: 'TRUE',
    status: 'pending', pwdRef: '', refCode: ref, createdAt: new Date().toISOString(),
  });
  appendRecord_('venue', rid, ref, '🏛 借場：' + (venue ? venue.name : b.venueId), b.name, b.phone, b.troop || '', 'pending', b.startDate + ' → ' + b.endDate);
  notifyStaff_('🏛 新借場申請', '場地：' + (venue ? venue.name : b.venueId) + '\n' + b.startDate + ' → ' + b.endDate + '\n申請人：' + b.name + '（' + b.phone + '）');
  return { refCode: ref };
}

function getTroopList_() {
  var raw = getConfigValue_('TROOP_LIST');
  if (raw) return raw.split(/[\n,，]/).map(function (s) { return s.trim(); }).filter(Boolean);
  return DEFAULT_TROOP_LIST.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
}

function submitActivityNotice_(b) {
  if (!b.troop || !b.activityName || !b.nature || !b.location || !b.leaderName || !b.leaderPhone) return err('資料不完整');
  if (!b.startDateTime || !b.endDateTime) return err('請填活動日期及時間');
  var sections = Array.isArray(b.sections) ? b.sections.filter(Boolean) : [];
  if (sections.length === 0) return err('請選擇至少一個活動支部');
  var fwd = callService_('ACTIVITY', 'addNotice', b);
  if (fwd) { if (fwd.ok) return { refCode: (fwd.data && fwd.data.refCode) || '' }; return err(fwd.error || '活動知會轉發失敗'); }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET.ACTIVITY_REQ);
  var ref = genRef_('ACT');
  var rid = genId_('act');
  appendRowObj_(sh, {
    id: rid, districtCode: districtCode_(), refCode: ref,
    troop: b.troop, activityName: b.activityName, sections: sections.join('、'),
    nature: b.nature, startDateTime: b.startDateTime, endDateTime: b.endDateTime,
    location: b.location, membersCount: b.membersCount || 0, leadersCount: b.leadersCount || 0,
    parentsCount: b.parentsCount || 0, leaderName: b.leaderName, leaderPhone: b.leaderPhone,
    leaderEmail: b.leaderEmail || '', note: b.note || '',
    createdAt: new Date().toISOString(),
  });
  appendRecord_('activity', rid, ref, '📋 活動知會：' + b.activityName, b.leaderName, b.leaderPhone, b.troop, 'filed', b.nature + ' · ' + b.startDateTime + ' → ' + b.endDateTime + ' · ' + b.location);
  return { refCode: ref };
}

function getActivityNotices_(token) {
  if (!requireStaff_(token)) return err('登入已過期');
  return readSheet_(SHEET.ACTIVITY_REQ).reverse();
}

// ===================== 職員：登入 / 帳戶 =====================

function staffLogin_(email, password) {
  var em = String(email || '').trim();
  if (em.toLowerCase() === SUPER_ACCOUNT.toLowerCase() && sha256_(String(password)) === SUPER_PW_HASH) {
    return { email: SUPER_ACCOUNT, displayName: '系統管理員', role: SUPER_ROLE, token: makeToken_(SUPER_ACCOUNT, SUPER_ROLE), canVenue: true, canStock: true, canCourse: true, canStaff: true };
  }
  var staff = readSheet_(SHEET.STAFF).filter(function (s) {
    return String(s.email).toLowerCase() === em.toLowerCase() && String(s.active).toUpperCase() !== 'FALSE';
  })[0];
  if (!staff) return err('帳號或密碼不正確');
  if (sha256_(String(password)) !== String(staff.passwordHash)) return err('帳號或密碼不正確');
  var p = staffPerms_(em);
  return {
    email: staff.email, displayName: staff.name || staff.email, role: staff.role || 'staff',
    token: makeToken_(staff.email, staff.role || 'staff'),
    canVenue: p.canVenue, canStock: p.canStock, canCourse: p.canCourse, canStaff: p.canStaff,
  };
}

function staffVerify_(token) {
  var t = checkToken_(token);
  if (!t.valid) return err('登入已過期');
  var p = staffPerms_(t.email);
  var displayName = t.email;
  var role = t.role;
  if (t.email.toLowerCase() !== SUPER_ACCOUNT.toLowerCase()) {
    var s = readSheet_(SHEET.STAFF).filter(function (x) { return String(x.email).toLowerCase() === t.email.toLowerCase(); })[0];
    if (s) { displayName = s.name || s.email; role = s.role || 'staff'; }
  }
  return { email: t.email, displayName: displayName, role: role, token: String(token), canVenue: p.canVenue, canStock: p.canStock, canCourse: p.canCourse, canStaff: p.canStaff };
}

function changeStaffPassword_(token, oldPassword, newPassword) {
  var t = requireStaff_(token);
  if (!t) return err('登入已過期');
  if (!newPassword || String(newPassword).length < 4) return err('新密碼至少 4 位');
  if (t.email.toLowerCase() === SUPER_ACCOUNT.toLowerCase()) return err('超級管理員密碼需喺程式碼更改');
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET.STAFF);
  var idx = findRowByFirstCol_(sh, t.email);
  if (idx < 0) return err('找不到帳戶');
  var cur = readSheet_(SHEET.STAFF).filter(function (x) { return String(x.email).toLowerCase() === t.email.toLowerCase(); })[0];
  if (sha256_(String(oldPassword)) !== String(cur.passwordHash)) return err('現時密碼不正確');
  setCellByHeader_(sh, idx, 'passwordHash', sha256_(String(newPassword)));
  return { saved: true };
}

function getStaffList_(token) {
  if (requirePerm_(token, 'canStaff').error) return err(requirePerm_(token, 'canStaff').error);
  return readSheet_(SHEET.STAFF).map(function (s) {
    return {
      email: s.email, name: s.name, role: s.role || 'staff',
      canVenue: isTrue_(s.canVenue), canStock: isTrue_(s.canStock),
      canCourse: isTrue_(s.canCourse), canStaff: isTrue_(s.canStaff),
      active: String(s.active).toUpperCase() !== 'FALSE',
    };
  });
}

function saveStaff_(token, staff) {
  if (requirePerm_(token, 'canStaff').error) return err(requirePerm_(token, 'canStaff').error);
  if (!staff || !staff.email) return err('資料不完整');
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET.STAFF);
  var idx = findRowByFirstCol_(sh, staff.email);
  if (idx > 0) {
    if (staff.name !== undefined) setCellByHeader_(sh, idx, 'name', staff.name);
    if (staff.password) setCellByHeader_(sh, idx, 'passwordHash', sha256_(String(staff.password)));
    if (staff.role !== undefined) setCellByHeader_(sh, idx, 'role', staff.role);
    if (staff.canVenue !== undefined) setCellByHeader_(sh, idx, 'canVenue', staff.canVenue ? 'TRUE' : 'FALSE');
    if (staff.canStock !== undefined) setCellByHeader_(sh, idx, 'canStock', staff.canStock ? 'TRUE' : 'FALSE');
    if (staff.canCourse !== undefined) setCellByHeader_(sh, idx, 'canCourse', staff.canCourse ? 'TRUE' : 'FALSE');
    if (staff.canStaff !== undefined) setCellByHeader_(sh, idx, 'canStaff', staff.canStaff ? 'TRUE' : 'FALSE');
    if (staff.active !== undefined) setCellByHeader_(sh, idx, 'active', staff.active ? 'TRUE' : 'FALSE');
    return { saved: true };
  }
  if (!staff.password) return err('新帳戶必須設定密碼');
  appendRowObj_(sh, {
    email: String(staff.email).trim(), name: staff.name || staff.email,
    passwordHash: sha256_(String(staff.password)), role: staff.role || 'staff',
    canVenue: staff.canVenue ? 'TRUE' : 'FALSE', canStock: staff.canStock ? 'TRUE' : 'FALSE',
    canCourse: staff.canCourse ? 'TRUE' : 'FALSE', canStaff: staff.canStaff ? 'TRUE' : 'FALSE',
    active: 'TRUE',
  });
  return { saved: true };
}

function deleteStaff_(token, email) {
  var chk = requirePerm_(token, 'canStaff');
  if (chk.error) return err(chk.error);
  if (!email) return err('資料不完整');
  if (String(email).toLowerCase() === chk.email.toLowerCase()) return err('唔可以刪除自己');
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET.STAFF);
  var idx = findRowByFirstCol_(sh, email);
  if (idx > 0) sh.deleteRow(idx);
  return { deleted: true };
}

// ===================== 職員：借物資 =====================

function getStockRequests_(token) {
  if (requirePerm_(token, 'canStock').error) return err(requirePerm_(token, 'canStock').error);
  return readSheet_(SHEET.STOCK_REQ).reverse();
}
function setStockRequestStatus_(token, id, status) {
  if (requirePerm_(token, 'canStock').error) return err(requirePerm_(token, 'canStock').error);
  var allowed = ['approved', 'rejected', 'returned', 'pending'];
  if (allowed.indexOf(status) < 0) return err('狀態不合法');
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET.STOCK_REQ);
  var rows = readSheet_(SHEET.STOCK_REQ);
  var r = rows.filter(function (x) { return String(x.id) === String(id); })[0];
  if (!r) return err('找不到申請');
  var rowIdx = findRowByFirstCol_(sh, id);
  if (rowIdx > 0) setCellByHeader_(sh, rowIdx, 'status', status);
  updateRecordStatus_(id, status);
  if (status === 'rejected' || status === 'returned') {
    var ish = ss.getSheetByName(SHEET.ITEMS);
    var iIdx = findRowByFirstCol_(ish, r.itemId);
    if (iIdx > 0) {
      var item = readSheet_(SHEET.ITEMS).filter(function (x) { return String(x.itemId) === String(r.itemId); })[0];
      if (item) setCellByHeader_(ish, iIdx, 'availableQty', (Number(item.availableQty) || 0) + (Number(r.qty) || 0));
    }
  }
  if (status === 'approved' && r.email) {
    MailApp.sendEmail(r.email, '✅ 借物資申請已批核', '你申請借用「' + r.itemName + '」x' + r.qty + ' 已獲批核。\n借用期：' + r.borrowDate + ' 至 ' + r.returnDate + '。\n請於約定時間到區總部領取。');
  }
  return { saved: true };
}
function getItems_(token) { if (requirePerm_(token, 'canStock').error) return err(requirePerm_(token, 'canStock').error); return readSheet_(SHEET.ITEMS); }
function saveItem_(token, item) {
  if (requirePerm_(token, 'canStock').error) return err(requirePerm_(token, 'canStock').error);
  if (!item || !item.name || !item.category) return err('資料不完整');
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET.ITEMS);
  if (item.itemId) {
    var idx = findRowByFirstCol_(sh, item.itemId);
    if (idx > 0) {
      ['category', 'name', 'totalQty', 'availableQty', 'unit', 'note', 'location'].forEach(function (k) {
        if (item[k] !== undefined) setCellByHeader_(sh, idx, k, item[k]);
      });
      return { saved: true };
    }
  }
  appendRowObj_(sh, {
    itemId: genId_('itm'), districtCode: districtCode_(),
    category: item.category, name: item.name,
    totalQty: Number(item.totalQty) || 0, availableQty: Number(item.availableQty) || 0,
    unit: item.unit || '件', note: item.note || '', location: item.location || '', active: 'TRUE',
  });
  return { saved: true };
}
function deleteItem_(token, itemId) {
  if (requirePerm_(token, 'canStock').error) return err(requirePerm_(token, 'canStock').error);
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET.ITEMS);
  var idx = findRowByFirstCol_(sh, itemId);
  if (idx > 0) sh.deleteRow(idx);
  return { deleted: true };
}

// ===================== 職員：報班 =====================

function getCourseRegs_(token) { if (requirePerm_(token, 'canCourse').error) return err(requirePerm_(token, 'canCourse').error); return readSheet_(SHEET.COURSE_REQ).reverse(); }
function setCourseRegStatus_(token, id, status) {
  if (requirePerm_(token, 'canCourse').error) return err(requirePerm_(token, 'canCourse').error);
  var allowed = ['confirmed', 'rejected', 'waitlist', 'pending'];
  if (allowed.indexOf(status) < 0) return err('狀態不合法');
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET.COURSE_REQ);
  var idx = findRowByFirstCol_(sh, id);
  if (idx > 0) setCellByHeader_(sh, idx, 'status', status);
  updateRecordStatus_(id, status);
  var rows = readSheet_(SHEET.COURSE_REQ);
  var r = rows.filter(function (x) { return String(x.id) === String(id); })[0];
  if (r && r.email) {
    var subj = status === 'confirmed' ? '✅ 報班確認' : (status === 'waitlist' ? '⏳ 候補通知' : '報班狀態更新');
    MailApp.sendEmail(r.email, subj, '你報讀「' + r.courseTitle + '」嘅狀態已更新為：' + status + '。');
  }
  return { saved: true };
}
function getCourses_(token) { if (requirePerm_(token, 'canCourse').error) return err(requirePerm_(token, 'canCourse').error); return readSheet_(SHEET.COURSES); }
// 標記報名已收費（舊統一表用；訓練班專屬表由各班 Script 自己管理）
function setRegFeePaid_(token, id, feePaid) {
  if (requirePerm_(token, 'canCourse').error) return err(requirePerm_(token, 'canCourse').error);
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET.COURSE_REQ);
  var idx = findRowByFirstCol_(sh, id);
  if (idx > 0) {
    setCellByHeader_(sh, idx, 'feePaid', feePaid ? 'TRUE' : 'FALSE');
    if (feePaid) setCellByHeader_(sh, idx, 'paidAt', new Date().toISOString());
  }
  return { saved: true };
}
function saveCourse_(token, course) {
  if (requirePerm_(token, 'canCourse').error) return err(requirePerm_(token, 'canCourse').error);
  if (!course || !course.title) return err('資料不完整');
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET.COURSES);
  if (course.courseId) {
    var idx = findRowByFirstCol_(sh, course.courseId);
    if (idx > 0) {
      ['title', 'sessionsText', 'eligibility', 'fee', 'originalFee', 'deadline', 'quota', 'venue', 'status', 'noticeUrl', 'fpsNote'].forEach(function (k) {
        if (course[k] !== undefined) setCellByHeader_(sh, idx, k, course[k]);
      });
      return { saved: true };
    }
  }
  appendRowObj_(sh, {
    courseId: genId_('crs'), districtCode: districtCode_(),
    title: course.title, sessionsText: course.sessionsText || '', eligibility: course.eligibility || '',
    fee: Number(course.fee) || 0, originalFee: Number(course.originalFee) || 0,
    deadline: course.deadline || '', quota: Number(course.quota) || 0, filled: 0,
    venue: course.venue || '', status: 'open', noticeUrl: course.noticeUrl || '', fpsNote: course.fpsNote || '',
  });
  return { saved: true };
}
function deleteCourse_(token, courseId) {
  if (requirePerm_(token, 'canCourse').error) return err(requirePerm_(token, 'canCourse').error);
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET.COURSES);
  var idx = findRowByFirstCol_(sh, courseId);
  if (idx > 0) sh.deleteRow(idx);
  return { deleted: true };
}

// ===================== 職員：借場（Sciener + TeamUp） =====================

function getVenueBookings_(token) { if (requirePerm_(token, 'canVenue').error) return err(requirePerm_(token, 'canVenue').error); return readSheet_(SHEET.VENUE_REQ).reverse(); }
function getVenues_(token) { if (requirePerm_(token, 'canVenue').error) return err(requirePerm_(token, 'canVenue').error); return readSheet_(SHEET.VENUES); }

function saveVenue_(token, venue) {
  if (requirePerm_(token, 'canVenue').error) return err(requirePerm_(token, 'canVenue').error);
  if (!venue || !venue.name || !venue.scienerLockId) return err('資料不完整（需場地名 + Sciener lockId）');
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET.VENUES);
  if (venue.venueId) {
    var idx = findRowByFirstCol_(sh, venue.venueId);
    if (idx > 0) {
      ['name', 'scienerLockId', 'note'].forEach(function (k) { if (venue[k] !== undefined) setCellByHeader_(sh, idx, k, venue[k]); });
      return { saved: true };
    }
  }
  appendRowObj_(sh, { venueId: genId_('vnu'), districtCode: districtCode_(), name: venue.name, scienerLockId: venue.scienerLockId, note: venue.note || '', active: 'TRUE' });
  return { saved: true };
}
function deleteVenue_(token, venueId) {
  if (requirePerm_(token, 'canVenue').error) return err(requirePerm_(token, 'canVenue').error);
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET.VENUES);
  var idx = findRowByFirstCol_(sh, venueId);
  if (idx > 0) sh.deleteRow(idx);
  return { deleted: true };
}

function rejectVenueBooking_(token, id) {
  if (requirePerm_(token, 'canVenue').error) return err(requirePerm_(token, 'canVenue').error);
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET.VENUE_REQ);
  var idx = findRowByFirstCol_(sh, id);
  if (idx > 0) setCellByHeader_(sh, idx, 'status', 'rejected');
  updateRecordStatus_(id, 'rejected');
  return { saved: true };
}

function approveVenueBooking_(token, id) {
  if (requirePerm_(token, 'canVenue').error) return err(requirePerm_(token, 'canVenue').error);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET.VENUE_REQ);
  var rows = readSheet_(SHEET.VENUE_REQ);
  var booking = rows.filter(function (x) { return String(x.id) === String(id); })[0];
  if (!booking) return err('找不到申請');
  if (booking.status !== 'pending') return err('此申請已處理');

  var pwd = genPwdFromPhone_(booking.phone);
  var lockId = getVenueLockId_(booking.venueId);
  var startMs = new Date(booking.startDate).getTime();
  var endMs = new Date(booking.endDate).getTime();
  var sci = scienerAddPwd_(lockId, pwd, startMs, endMs);

  var tupMsg = '';
  if (booking.teamupEventId) tupMsg = teamupMoveToApproved_(booking.teamupEventId);

  var mailMsg = '';
  if (booking.email) mailMsg = notifyVenueApproved_(booking, pwd);

  var idx = findRowByFirstCol_(sh, id);
  if (idx > 0) {
    setCellByHeader_(sh, idx, 'status', 'approved');
    setCellByHeader_(sh, idx, 'pwdRef', sci && sci.keyboardPwdId ? String(sci.keyboardPwdId) : '');
  }
  updateRecordStatus_(id, 'approved');

  var warn = '';
  if (!sci || sci.errcode !== 0) warn += '⚠️ 鎖密碼設定警告：' + ((sci && sci.errmsg) || '未知') + '；';
  if (tupMsg) warn += '⚠️ TeamUp 轉色警告：' + tupMsg + '；';
  if (mailMsg) warn += '⚠️ 電郵：' + mailMsg;
  return { password: pwd, warn: warn };
}

function genPwdFromPhone_(phone) {
  var digits = String(phone || '').replace(/\D/g, '');
  var mode = getConfigValue_('PWD_MODE') || 'phone4';
  if (mode === 'random') {
    var len = Number(getConfigValue_('PWD_LENGTH') || 4);
    var s = '';
    for (var i = 0; i < len; i++) s += Math.floor(Math.random() * 10);
    return s;
  }
  var first = digits.slice(0, 4);
  var last = digits.slice(-4);
  if (first.length < 4) return (digits + '0000').slice(0, 4);
  var active = readSheet_(SHEET.VENUE_REQ).filter(function (r) {
    return String(r.phone || '').replace(/\D/g, '') === digits && r.status === 'approved';
  });
  return active.length > 0 ? last : first;
}

function getVenueLockId_(venueId) {
  var venues = readSheet_(SHEET.VENUES);
  var v = venues.filter(function (x) { return String(x.venueId) === String(venueId); })[0];
  return v ? v.scienerLockId : '';
}

// ---------- Sciener（科技侠/TTLock 開放平台） ----------

function scienerApi_(path, payload) {
  var base = getConfigValue_('SCIENER_API_BASE') || 'https://open.sciener.com';
  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };
  var resp = UrlFetchApp.fetch(base + path, options);
  var code = resp.getResponseCode();
  var text = resp.getContentText();
  if (code !== 200) return { errcode: -1, errmsg: 'HTTP ' + code + ': ' + text.slice(0, 160) };
  try { return JSON.parse(text); } catch (e) { return { errcode: -1, errmsg: '回應無法解析' }; }
}

function scienerToken_() {
  var now = Date.now();
  var exp = Number(getConfigValue_('SCIENER_TOKEN_EXPIRES') || 0);
  var token = getConfigValue_('SCIENER_ACCESS_TOKEN');
  if (token && exp > now + 60000) return token;
  var clientId = getConfigValue_('SCIENER_CLIENT_ID');
  var secret = getConfigValue_('SCIENER_CLIENT_SECRET');
  if (!clientId || !secret) return '';
  var r = scienerApi_('/v3/oauth2/token', {
    client_id: clientId, client_secret: secret, grant_type: 'client_credentials',
  });
  if (r && r.access_token) {
    setConfigValue_('SCIENER_ACCESS_TOKEN', r.access_token);
    if (r.refresh_token) setConfigValue_('SCIENER_REFRESH_TOKEN', r.refresh_token);
    setConfigValue_('SCIENER_TOKEN_EXPIRES', String(now + Number(r.expires_in || 7200) * 1000));
    return r.access_token;
  }
  return '';
}

function scienerAddPwd_(lockId, pwd, startMs, endMs) {
  var token = scienerToken_();
  if (!token) return { errcode: -1, errmsg: '無 Sciener access token（檢查 Config 的 clientId/clientSecret）' };
  var clientId = getConfigValue_('SCIENER_CLIENT_ID');
  return scienerApi_('/v3/keyboardPwd/add', {
    clientId: clientId,
    accessToken: token,
    lockId: Number(lockId),
    keyboardPwd: String(pwd),
    keyboardPwdVersion: 4,
    startDate: startMs,
    endDate: endMs,
    addType: 2,
    date: Date.now(),
  });
}

// ---------- TeamUp ----------

function teamupApi_(method, path, body) {
  var key = getConfigValue_('TEAMUP_API_KEY');
  if (!key) return null;
  var options = { method: method, headers: { 'Teamup-Token': key }, muteHttpExceptions: true };
  if (body) { options.contentType = 'application/json'; options.payload = JSON.stringify(body); }
  var resp = UrlFetchApp.fetch('https://api.teamup.com/' + path, options);
  try { return JSON.parse(resp.getContentText()); } catch (e) { return null; }
}

function teamupMoveToApproved_(eventId) {
  var calKey = getConfigValue_('TEAMUP_CALENDAR_KEY');
  var redId = getConfigValue_('TEAMUP_APPROVED_SUBCAL_ID');
  if (!calKey || !redId || !eventId) return '設定不完整（Calendar Key / 紅色子日曆 ID / Event ID）';
  var r = teamupApi_('put', calKey + '/events/' + eventId, { subcalendar_ids: [Number(redId)] });
  return (r && r.event) ? '' : 'TeamUp 更新失敗';
}

// ---------- 電郵 ----------

function notifyVenueApproved_(booking, pwd) {
  try {
    MailApp.sendEmail(
      booking.email,
      '✅ 借用場地已批核 — 電子鎖密碼',
      '你嘅場地借用申請已獲批核。\n\n場地：' + booking.venueName +
      '\n時段：' + booking.startDate + ' 至 ' + booking.endDate +
      '\n電子鎖密碼：' + pwd +
      '\n\n（密碼只喺上述時段內有效。請勿轉發他人。）'
    );
    return '';
  } catch (e) { return e.message; }
}

function notifyStaff_(subject, body) {
  var to = getConfigValue_('NOTIFY_STAFF_EMAIL');
  if (!to) return;
  try { MailApp.sendEmail(to, subject, body); } catch (e) {}
}

// ===================== 一鍵建表 =====================

function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var config = ss.getSheetByName(SHEET.CONFIG);
  if (!config) {
    config = ss.insertSheet(SHEET.CONFIG);
    config.getRange(1, 1, 1, 3).setValues([['key', 'value', '說明']]);
  }
  var defaults = [
    ['districtName', '筲箕灣區', ''],
    ['districtCode', 'SKW', ''],
    ['logoText', '🧭', ''],
    ['API_KEY_HASH', '', 'setup 自動生成'],
    // 首位管理員
    ['ADMIN_EMAIL', 'admin', '首位管理員帳戶（setup 時自動建立，登入後請即改密碼）'],
    ['ADMIN_PW_HASH', '', 'setup 自動生成'],
    // Sciener 開放平台
    ['SCIENER_API_BASE', 'https://open.sciener.com', '如用其他區域主機改呢度'],
    ['SCIENER_CLIENT_ID', '', '開放平台 app_id'],
    ['SCIENER_CLIENT_SECRET', '', '開放平台 app_secret'],
    ['PWD_MODE', 'phone4', 'phone4=電話頭4/尾4位；random=隨機'],
    // TeamUp
    ['TEAMUP_API_KEY', '', ''],
    ['TEAMUP_CALENDAR_KEY', '', 'ks 開頭嗰條 key'],
    ['TEAMUP_PENDING_SUBCAL_ID', '', '藍色（申請）子日曆 ID'],
    ['TEAMUP_APPROVED_SUBCAL_ID', '', '紅色（已批）子日曆 ID'],
    ['TEAMUP_BOOKING_URL', '', '公開登記連結（顯示喺門戶）'],
    // FPS
    ['FPS_ACCOUNT_NAME', '', ''],
    ['FPS_ACCOUNT_NUMBER', '', ''],
    // 借用規定（留空 = 用內建預設）
    ['VENUE_RULES', '', '借場規定（留空用預設）'],
    ['VENUE_RULES_URL', 'https://www.skwscout.org.hk/wp-content/uploads/2022/12/%E5%80%9F%E5%A0%B4%E8%A6%8F%E5%89%87%E5%8F%8A%E7%A8%8B%E5%BA%8Fver202212.pdf', '借場規則及程序 PDF'],
    ['VENUE_TERMS_URL', 'https://www.skwscout.org.hk/wp-content/uploads/2013/08/%E5%A0%B4%E5%9C%B0%E4%B8%80%E8%88%AC%E4%BD%BF%E7%94%A8%E6%A2%9D%E4%BB%B6-ver-3.pdf', '場地一般使用條件 PDF'],
    ['CCTV_URL', 'https://www.skwscout.org.hk/wp-content/uploads/2022/12/%E9%96%89%E8%B7%AF%E9%9B%BB%E8%A6%96%E7%9B%A3%E5%AF%9F%E6%8E%AA%E6%96%BD%E6%8C%87%E5%BC%95ver202212.pdf', '閉路電視監察指引 PDF'],
    ['STOCK_RULES', '', '借物資規定（留空用預設）'],
    ['STOCK_RULES_URL', '', '區借物資規定 PDF（如有）'],
    // 通知
    ['NOTIFY_STAFF_EMAIL', '', '新申請通知對象'],
    // 旅號清單
    ['TROOP_LIST', DEFAULT_TROOP_LIST, '旅號清單（逗號分隔），活動知會表用'],
    // ═══════════════════════════════════════════════════════
    // 各系統 Script URL 預留位（貼上後，表單會自動轉發去該系統）
    // 未填 = 寫入本表；填咗 = 轉發去該 Script（POST {action, apiKey, ...資料}）
    // ═══════════════════════════════════════════════════════
    ['STOCK_SCRIPT_URL', '', '【借物資】收表 Script 網址（留空 = 寫入本表）'],
    ['STOCK_SCRIPT_APIKEY', '', '【借物資】收表 Script API Key'],
    ['VENUE_SCRIPT_URL', '', '【借場】收表 Script 網址（留空 = 寫入本表）'],
    ['VENUE_SCRIPT_APIKEY', '', '【借場】收表 Script API Key'],
    ['ACTIVITY_SCRIPT_URL', '', '【活動知會】收表 Script 網址（留空 = 寫入本表）'],
    ['ACTIVITY_SCRIPT_APIKEY', '', '【活動知會】收表 Script API Key'],
  ];
  defaults.forEach(function (row) {
    var key = row[0];
    var exists = readSheet_(SHEET.CONFIG).some(function (r) { return String(r.key) === key; });
    if (!exists) config.appendRow(row);
  });

  ensureSheet_(ss, SHEET.STAFF, [['email', 'name', 'passwordHash', 'role', 'canVenue', 'canStock', 'canCourse', 'canStaff', 'active']]);
  ensureSheet_(ss, SHEET.ITEMS, [['itemId', 'districtCode', 'category', 'name', 'totalQty', 'availableQty', 'unit', 'note', 'location', 'active']]);
  ensureSheet_(ss, SHEET.STOCK_REQ, [['id', 'districtCode', 'itemId', 'itemName', 'category', 'qty', 'purpose', 'borrowDate', 'returnDate', 'name', 'phone', 'email', 'troop', 'position', 'agreeRules', 'status', 'refCode', 'createdAt']]);
  ensureSheet_(ss, SHEET.VENUES, [['venueId', 'districtCode', 'name', 'scienerLockId', 'note', 'active']]);
  ensureSheet_(ss, SHEET.VENUE_REQ, [['id', 'districtCode', 'venueId', 'venueName', 'teamupEventId', 'startDate', 'endDate', 'name', 'phone', 'email', 'troop', 'purpose', 'position', 'agreeRules', 'status', 'pwdRef', 'refCode', 'createdAt']]);
  ensureSheet_(ss, SHEET.COURSES, [['courseId', 'districtCode', 'title', 'sessionsText', 'eligibility', 'fee', 'originalFee', 'deadline', 'quota', 'filled', 'venue', 'status', 'noticeUrl', 'fpsNote']]);
  ensureSheet_(ss, SHEET.COURSE_REQ, [['id', 'districtCode', 'courseId', 'courseTitle', 'timestamp', 'email', 'nameZh', 'nameEn', 'phone', 'gender', 'dob', 'scoutDistrict', 'troop', 'scoutId', 'scoutPosition', 'note', 'guardianConsent', 'guardianName', 'guardianRelation', 'guardianEmail', 'guardianPhone', 'leaderConsent', 'leaderName', 'leaderPosition', 'leaderEmail', 'payMethod', 'payerName', 'payAccount', 'receiptUrl', 'formUrl', 'needReceipt', 'status', 'refCode']]);
  ensureSheet_(ss, SHEET.COURSE_LINKS, [['courseId', 'districtCode', 'title', 'badgeName', 'section', 'courseNo', 'sessionsText', 'eligibility', 'fee', 'originalFee', 'subsidyNote', 'deadline', 'quota', 'filled', 'venue', 'noticeUrl', 'contact', 'apiBase', 'apiKey', 'active', 'createdAt']]);
  ensureSheet_(ss, SHEET.COURSE_PARAMS, [['key', 'group', 'code', 'value', 'nameEn', 'kind']]);
  seedCourseParams_(ss);
  ensureSheet_(ss, SHEET.ACTIVITY_REQ, [['id', 'districtCode', 'refCode', 'troop', 'activityName', 'sections', 'nature', 'startDateTime', 'endDateTime', 'location', 'membersCount', 'leadersCount', 'parentsCount', 'leaderName', 'leaderPhone', 'leaderEmail', 'note', 'createdAt']]);
  ensureSheet_(ss, SHEET.ALL_RECORDS, [['id', 'districtCode', 'type', 'refCode', 'title', 'requester', 'phone', 'troop', 'status', 'detail', 'createdAt']]);

  // 示例物資（供參考，可自行刪改）
  seedSampleItems_(ss);

  // 生成 API Key（只顯示一次）
  var apiKey = generateApiKey_(ss);

  // 首位管理員帳號
  var adminMsg = '';
  var adminEmail = getConfigValue_('ADMIN_EMAIL');
  if (adminEmail && !getConfigValue_('ADMIN_PW_HASH')) {
    var pw = 'pw_' + Date.now().toString(36);
    setConfigValue_('ADMIN_PW_HASH', sha256_(pw));
    var staffSh = ss.getSheetByName(SHEET.STAFF);
    appendRowObj_(staffSh, {
      email: String(adminEmail).trim(), name: '首位管理員', passwordHash: sha256_(pw),
      role: 'admin', canVenue: 'TRUE', canStock: 'TRUE', canCourse: 'TRUE', canStaff: 'TRUE', active: 'TRUE',
    });
    adminMsg = '首位管理員帳戶已建立：' + adminEmail + '\n臨時密碼：' + pw + '\n登入後請即到「改密碼」頁更改。\n\n';
  }

  protectSensitiveSheets_(ss);

  SpreadsheetApp.getUi().alert(
    '✅ 成員服務門戶後台已建立',
    '🔑 API Key（只顯示一次，請即複製）：\n────────────────\n' + apiKey + '\n────────────────\n\n'
    + adminMsg
    + '1. 喺 Config 填 Sciener clientId/clientSecret、TeamUp API Key 等。\n'
    + '2. 物資資料喺「Items」分頁貼上。\n'
    + '3. 部署 → 網頁應用程式（執行身分：我自己；存取：所有人）。\n'
    + '4. 將 /exec 網址 + API Key 交俾平台管理員。'
  );
}

function seedSampleItems_(ss) {
  var sh = ss.getSheetByName(SHEET.ITEMS);
  if (!sh || sh.getLastRow() > 1) return;
  var samples = [
    ['A. 交通管理與物流工具', '反光衣', 20, 20, '件', '示例 — 可自行修改', '區總部'],
    ['A. 交通管理與物流工具', '交通錐', 15, 15, '個', '示例 — 可自行修改', '區總部'],
    ['B. 音響與通訊器材', '無線咪', 4, 4, '套', '示例 — 可自行修改', '區總部'],
    ['B. 音響與通訊器材', '手提擴音器', 3, 3, '部', '示例 — 可自行修改', '區總部'],
    ['C. 場地佈置用具', '摺檯', 10, 10, '張', '示例 — 可自行修改', '區總部'],
    ['C. 場地佈置用具', '摺椅', 40, 40, '張', '示例 — 可自行修改', '區總部'],
    ['D. 文儀、典禮及儀式用品', '國旗（連旗桿）', 2, 2, '套', '示例 — 可自行修改', '區總部'],
    ['D. 文儀、典禮及儀式用品', '區旗', 2, 2, '支', '示例 — 可自行修改', '區總部'],
    ['E. 其他', '急救箱', 3, 3, '個', '示例 — 可自行修改', '區總部'],
  ];
  samples.forEach(function (s) {
    appendRowObj_(sh, {
      itemId: genId_('itm'), districtCode: districtCode_(),
      category: s[0], name: s[1], totalQty: s[2], availableQty: s[3],
      unit: s[4], note: s[5], location: s[6], active: 'TRUE',
    });
  });
}

// 訓練班報名表下拉選單嘅預設資料（區／地域／支部／身份）
// 徽章清單（badge）日後可從參考表貼入：key=badge, group=組別, code=徽章代碼, value=中文名, nameEn=英文名
function seedCourseParams_(ss) {
  var sh = ss.getSheetByName(SHEET.COURSE_PARAMS);
  if (!sh || sh.getLastRow() > 1) return;
  var rows = [];
  ['小童軍', '幼童軍', '童軍', '深資童軍', '樂行童軍'].forEach(function (v) { rows.push(['section', '', '', v, '', '']); });
  ['筲箕灣', '柴灣', '港島北', '港島南', '灣仔', '維城', '港島西', '深水埗', '九龍城', '觀塘', '沙田', '荃灣', '屯門', '元朗', '大埔', '北區', '離島'].forEach(function (v) { rows.push(['district', '', '', v, '', '']); });
  ['港島', '九龍', '東九龍', '新界東', '新界', '離島'].forEach(function (v) { rows.push(['region', '', '', v, '', '']); });
  ['學員', '領袖'].forEach(function (v) { rows.push(['memberType', '', '', v, '', '']); });
  if (rows.length) sh.getRange(2, 1, rows.length, 6).setValues(rows);
}

function ensureSheet_(ss, name, headerRows) {
  var sh = ss.getSheetByName(name);
  if (sh) return;
  sh = ss.insertSheet(name);
  sh.getRange(1, 1, headerRows.length, headerRows[0].length).setValues(headerRows);
}

function generateApiKey_(ss) {
  var sh = ss.getSheetByName(SHEET.CONFIG);
  if (!sh) return '';
  var key = 'mk_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
  var values = sh.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === 'API_KEY_HASH' && !values[i][1]) {
      sh.getRange(i + 1, 2).setValue(sha256_(key));
    }
  }
  return key;
}

function protectSensitiveSheets_(ss) {
  var me = Session.getActiveUser().getEmail();
  ['Config', 'Staff'].forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) return;
    var prot = sh.protect().setDescription('成員服務門戶：保護敏感設定');
    if (me) prot.addEditor(me);
    prot.removeEditors(prot.getEditors().filter(function (e) { return e.getEmail() !== me; }));
  });
}

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('🧭 成員服務')
    .addItem('一鍵建表（setupSheets）', 'setupSheets')
    .addSeparator()
    .addItem('🔑 重新生成 API Key', 'regenerateApiKeyMenu')
    .addItem('🔐 重設職員密碼', 'setStaffPassword')
    .addToUi();
}

function regenerateApiKeyMenu() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var key = generateApiKey_(ss);
  SpreadsheetApp.getUi().alert('🔑 新 API Key', '新 API Key（只顯示一次）：\n' + key + '\n\n請交俾平台管理員更新。');
}

function setStaffPassword() {
  var ui = SpreadsheetApp.getUi();
  var emailResp = ui.prompt('重設職員密碼', '輸入職員電郵：', ui.ButtonSet.OK_CANCEL);
  if (emailResp.getSelectedButton() !== ui.Button.OK) return;
  var email = emailResp.getResponseText().trim();
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET.STAFF);
  var idx = findRowByFirstCol_(sh, email);
  if (idx < 0) { ui.alert('找不到', '冇呢個職員。'); return; }
  var pwResp = ui.prompt('重設職員密碼', '輸入新密碼：', ui.ButtonSet.OK_CANCEL);
  if (pwResp.getSelectedButton() !== ui.Button.OK) return;
  setCellByHeader_(sh, idx, 'passwordHash', sha256_(pwResp.getResponseText()));
  ui.alert('完成', '密碼已更新。');
}
