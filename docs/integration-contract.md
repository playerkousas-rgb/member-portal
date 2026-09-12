# member-portal × scout-district-portal 對接合約

## 定位

- `scout-district-portal`：需要登入；負責管理、開班、批核、角色、權限、設定。
- `member-portal`：完全公開；只讀公開選項及提交 intake，絕不管理或改 status。
- 兩者共用每區同一張主 Google Sheet、同一份主 `Code.gs`、同一個 `/exec` 及 API Key。
- 每個訓練班另有一張專屬 Sheet 及一份 `Code.gs.course.js`。

## 主 Sheet 公開範圍

| Sheet | 成員系統權限 |
|---|---|
| `Config` | 只經 `getConfig` 讀公開區設定 |
| `System` | 只經 `getSystem` 讀鎖定狀態 |
| `CourseLinks` | 只經 `listCourseLinks` 讀已清理公開欄位 |
| `Venues` | 經 `listVenues` 讀選項 |
| `Items` | 經 `listItems` 讀選項及可借數量 |
| `ActivityNotices` | 經 `listActivityNotices` 讀已清理公開欄位 |
| `VenueBookings` | 只可經 `submitVenueRequest` 新增；不可讀／改 status |
| `StockRequests` | 只可經 `submitStockRequest` 新增；不可讀／改 status |
| `Roles / Cards / Perms / Users` | 不可讀；`Users` 含敏感資料 |

## 公開 GET actions

```text
getConfig
getSystem
listCourseLinks
listVenues
listItems
listActivityNotices?year=&section=&nature=
```

`listCourseLinks` 不可回傳：

```text
scriptExecUrl
scriptApiKey
driveFolderId
```

`listActivityNotices` 經 member proxy 後不可回傳：

```text
leaderName
leaderPhone
leaderEmail
note
```

## 公開 POST actions

### `submitVenueRequest`

```json
{
  "venueId": "...",
  "startDate": "YYYY-MM-DDTHH:mm",
  "endDate": "YYYY-MM-DDTHH:mm",
  "name": "...",
  "phone": "...",
  "email": "...",
  "troop": "...",
  "position": "...",
  "purpose": "..."
}
```

### `submitStockRequest`（舊版單項相容）

```json
{
  "itemId": "...",
  "qty": 1,
  "borrowDate": "YYYY-MM-DD",
  "returnDate": "YYYY-MM-DD",
  "purpose": "...",
  "name": "...",
  "phone": "...",
  "email": "...",
  "troop": "...",
  "position": "..."
}
```

### `submitStockBatchRequest`（建議後台原生支援）

```json
{
  "batchRef": "SB-20260818-A1B2C3",
  "items": [
    { "itemId": "item-1", "qty": 2 },
    { "itemId": "item-2", "qty": 1 }
  ],
  "borrowDate": "YYYY-MM-DD",
  "returnDate": "YYYY-MM-DD",
  "purpose": "...",
  "name": "...",
  "phone": "...",
  "email": "...",
  "troop": "...",
  "position": "...",
  "agreeRules": true
}
```

成員端永遠只提交一次。member proxy 會先以 `listItems` 核對最新庫存，再優先呼叫原生 batch action；後台未升級時，會相容地拆成多個 `submitStockRequest`，並在各行用途欄加入同一批次編號。原生 action 應將 `items` 存成同一申請，以便管理系統一次批核整批。

### `submitActivityNotice`

```json
{
  "year": "2026",
  "section": "童軍",
  "nature": "遠足",
  "troop": "港島第82旅",
  "activityName": "...",
  "startDateTime": "YYYY-MM-DDTHH:mm",
  "endDateTime": "YYYY-MM-DDTHH:mm",
  "location": "...",
  "membersCount": 20,
  "leadersCount": 3,
  "parentsCount": 0,
  "leaderName": "...",
  "leaderPhone": "...",
  "leaderEmail": "...",
  "note": "..."
}
```

### `submitCourseReg`

主要欄位（v6.2.1 起送 **canonical 名**；區後台 v4.18.0 會自動補舊制別名一併轉發新舊制收表）：

```text
courseId, memberType,
nameZh, nameEn, gender, dob, phone, email,
scoutDistrict, region, troop, scoutId, scoutPosition, reason,
consentParent, gName, gRelation, gEmail, gPhone,
consentLeader, leaderName, leaderTitle, leaderEmail,
payMethod, payer, payAccount, needReceipt, remark,
receiptFileName, receiptMimeType, receiptDataUrl, formDataUrl
```

canonical 名 → 區後台自動補嘅舊制別名（成員端唔使送）：

```text
scoutPosition → scoutRank；reason → extra；
consentParent → guardianConsent；gName/gRelation/gEmail/gPhone → guardianName/guardianRelation/guardianEmail/guardianPhone；
consentLeader → leaderConsent；leaderTitle → leaderPosition；
payer → payerName；remark → comment/note；
formDataUrl → formShotDataUrl/formScreenshot/formUrl
```

課程對應：`courseId` 照舊。新制 hub 班嘅 `courseId` 即係公開課程ID（`publicCourseId`，`crs_xxx`）；
區後台 `submitCourseReg_` 會自動改走 hub 公開 `addReg`（write-only、唔送 apiKey／fileId），成員端報名表唔使分別新舊制。

主 `Code.gs` 必須：

1. 由 `CourseLinks` 找同 `courseId`、`active=TRUE`、未過 deadline 嘅班；
2. 檢查 quota；
3. 只喺 server 讀 `scriptExecUrl / scriptApiKey`；
4. POST 到每班 Script，action 改為 `addReg`；
5. 將每班 Script 嘅 `refCode` 回傳公開端。

## 回應格式

建議統一：

```json
{ "ok": true, "data": { "refCode": "VR-20260817-1234" } }
```

現有 Apps Script public submit 使用以下格式亦可，member proxy 會正規化：

```json
{ "ok": true, "refCode": "VR-20260817-1234" }
```

錯誤：

```json
{ "ok": false, "error": "可安全顯示俾用戶嘅訊息" }
```

## 後台實作狀態（v4.0.1 已核對）

主 `scout-district-portal/gs/Code.gs`（統一後台 v4.0.1）已實作：

1. ✅ 公開 `listCourseLinks`（`listCourseLinks_` + `courseLinkPublic_` 清洗，不含 script URL / key / driveFolderId）；
2. ✅ 公開 `submitCourseReg`（`submitCourseReg_`：驗證課程、quota、**deadline（v4.0.1）**、server 讀 key → 轉發每班 `addReg` → 回傳 `refCode`）；
3. ✅ 每班 `gs/Code.gs.course.js` 嘅 `addReg`（防重複、入數紙存 Drive、回傳 `refCode`）。

欄位差距已修正（v4.0.1，commit fb82bba）：

- `submitCourseReg_` 轉發 payload 已加入 `extra: b.extra || ''`；member 表單日後加入「附加資料」輸入框即可直通每班 Script，無需再改 proxy（`POST_FIELDS` 已有 `extra` 白名單）。

成員系統唔應為此保留另一份 `Code.gs`；任何後台修正必須落喺管理系統唯一來源。


## 訓練班收費 FPS QR（GS v4.3.0）

`listCourseLinks` 每個 course 多咗 5 個公開欄位（管理系統「訓練班管理」按班生成；未生成 = 空字串）：

| 欄位 | 用途 |
|---|---|
| `fpsQrPayload` | HKICL Common QR 字串（已計 CRC），前端直接 `<QRCodeCanvas value=…/>` |
| `fpsAmount` | 固定銀碼（= 學費） |
| `fpsReference` | 付款參考（預設課程編號） |
| `fpsAccountName` / `fpsAccountNumber` | 收款戶口名 / FPS ID |

proxy `publicCourse()` 已加入白名單；`components/CourseFpsQr.tsx` 喺 `/training` 繳費區同報名成功頁顯示。
依賴：`qrcode.react`。

## 通告全文欄（GS v4.16.0）

`listCourseLinks` 每個 course 再多 5 個公開欄位（管理系統「📥 由通告網址讀取」由區網通告 PDF／帖文頁讀入；
未填 = 空字串，舊班完全不受影響）：

| 欄位 | 用途 |
|---|---|
| `leader` | 班領導人（通告「班領導人」段） |
| `uniform` | 服裝（通告「服裝」段，如「整齊童軍制服」） |
| `remarks` | 備註全文（通告「備註」段，可多行） |
| `signupText` | 報名辦法（通告原文；成員照舊用本頁內置報名表） |
| `feeNote` | 費用全文（含原價／資助／轉數快戶口等付款說明） |

proxy `publicCourse()` 已加入白名單；`/training` 列表行顯示 班領導人／服裝，
「📋 付款須知及備註（通告全文）」可展開 付款說明／備註／報名辦法；報名表所選班面板同時顯示。
多班同掛照舊：每班各自指向自己嘅收表 Script（`submitCourseReg` 按 `courseId` 對號轉發）。

## 報名欄位對齊（區後台 v4.18.0 × CourseHub 6.2.1）

v4.18.0 起區後台 `submitCourseReg` 將報名表**全部欄位**轉發去訓練班後端，並自動補舊制別名
（canonical 名同舊名兩套都送），新舊制收表都收得齊，唔再靜默丟失。成員端已對齊 canonical 名：

- 報名表 `submit` 送晒：`scoutId`、`scoutPosition`、`reason`（附加資料）、
  `consentParent`＋`gName/gRelation/gEmail/gPhone`、`consentLeader`＋`leaderName/leaderTitle/leaderEmail`、
  `payMethod/payer/payAccount`、`receiptDataUrl`（入數紙，必填）、`formDataUrl`（已填妥表格截圖，選填）、
  `needReceipt`、`remark`（備註）。
- `consentParent`／`consentLeader`／`needReceipt` 嘅 truthy→`✔` 轉換、兩類截圖 `data:URL` 存 Drive，
  全部由**訓練班後端**做；成員端唔自己上載 Drive。
- `formDataUrl` 選填（紙本表格正本於上課時交回）；入數紙＋表格截圖兩張圖加埋限 4MB（body 限 4.5MB）。
- 公開報名照舊只憑 `courseId`（hub 班＝公開課程ID `crs_xxx`），區後台自動改走 hub 公開 `addReg`
  （write-only、唔送 apiKey／fileId），成員端唔使分別新舊制。
- 對接合約詳見 CourseHub `docs/API.md`「addReg 報名欄位」及區後台 `docs/member-gs-handshake.md`。
