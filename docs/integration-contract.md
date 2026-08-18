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

主要欄位：

```text
courseId, memberType,
nameZh, nameEn, gender, dob, phone, email,
scoutDistrict, region, troop, scoutId, scoutPosition, extra,
guardianConsent, guardianName, guardianRelation, guardianPhone, guardianEmail,
leaderConsent, leaderName, leaderPosition, leaderEmail,
payMethod, payerName, payAccount, needReceipt, note,
receiptFileName, receiptMimeType, receiptDataUrl
```

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
