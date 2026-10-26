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
| `Units` | 只經 `listDistrictTroops` 讀公開旅團欄位；內部備註、支部團數、啟用狀態唔流出 |
| `VenueBookings` | 只可經 `submitVenueRequest` 新增；不可讀／改 status |
| `StockRequests` | 只可經 `submitStockRequest` 新增；不可讀／改 status |
| `Roles / Cards / Perms / Users` | 不可讀；`Users` 含敏感資料 |

## 公開 GET actions

```text
getConfig
getSystem
getPublicInfo
listCourseLinks
listVenues
listItems
listActivityNotices?year=&section=&nature=
listDistrictTroops
```

`getPublicInfo` 經 member proxy 後只回傳白名單欄位（`districtName`／`venueRules`／`stockRules`／`troopList`／`cctvUrl`／`teamupBookingUrl`／`teamupReadOnlyUrl`／`fpsAccountName`／`fpsAccountNumber`）；借用規則、旅團清單同 Teamup 網址以區系統 Config 為唯一來源，成員端 hardcoded 內容只作後備。

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

### `listDistrictTroops`（區內旅團公開名錄，v1.2 起）

公開 GET（唔使登入），經 `/api/proxy` allowlist 轉發；API Key 只留喺 Vercel server env，瀏覽器唔會直接呼叫 Apps Script。

```json
{
  "districtCode": "SKW",
  "districtName": "筲箕灣區",
  "troops": [
    {
      "troop": "17",
      "label": "筲箕灣第十七旅",
      "organizer": "主辦機構名稱",
      "meetingTime": "逢星期六 14:00–16:00",
      "instagramUrl": "https://...",
      "facebookUrl": "https://...",
      "websiteUrl": "https://..."
    }
  ]
}
```

- 後台只回 `active=TRUE` 且 `publicVisible=TRUE` 嘅旅團；**唔會回傳**支部團數（`gh/cub/scout/venture/rover`）、內部 `note`、`active`、`publicVisible`、`sections`。
- proxy 再做欄位白名單（淨係 7 個欄位）同網址驗證：只接受 `http(s)`，`javascript:`／`data:` 等偽連結清空；空字串欄位由前端隱藏，唔顯示空行。
- 外部連結一律 `target="_blank"` 加 `rel="noopener noreferrer"`。
- 管理資料由區管理系統 `/visit`（Units 表）維護，成員端只讀，唔提供編輯功能。
- 異常處理：載入中顯示 spinner、失敗顯示錯誤＋重試、空名單顯示提示；手機版詳情以底部抽屜呈現。

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
  "activityName": "...",
  "attendeeCount": 30,
  "purpose": "...",
  "agreeRules": true
}
```

`agreeRules` 為必填（proxy 會強制檢查）；後台會記入 `VenueBookings`，供審計之用。`venueId` 必須是 `listVenues` 回傳嘅有效場地（後台會核對 `Venues` 表，唔存在會回「場地不存在」）；`Venues` 表未有 active 行時成員端會顯示「尚未開放」而唔可以提交。

`activityName`（活動名稱，字串，必填，≤120 字）同 `attendeeCount`（參加人數，必填正整數 1–9999）由成員端 v1.1 起提交，proxy 白名單及伺服器端驗證已對齊。**成員端只負責提交，瀏覽器唔會直接寫 Teamup**；後台 `Code.gs` 需配合：

1. 將 `activityName`／`attendeeCount` 連同現有欄位一併記入 `VenueBookings`；
2. 建立 Teamup「申請中」事件時，將姓名／職位同 `attendeeCount` 寫入 Teamup 自訂欄位（custom fields）——需先喺 Teamup 設定取得該兩個自訂欄位嘅識別碼／欄位 key，存入主 Sheet Config（例如 `TEAMUP_FIELD_LEADER_KEY`／`TEAMUP_FIELD_ATTENDEE_KEY`），**唔需要、亦唔可以將 Teamup API Token 交予成員端**；
3. 舊版後台未識別新欄位時會忽略佢，唔影響現有收表（向後兼容），但新欄位要等後台更新先會入 Sheet／Teamup。

### 借場一條龍（成員端只負責提交；其餘全部喺後台 `gs/Code.gs`）

```text
成員提交 submitVenueRequest
  → VenueBookings（pending）
  → Teamup「申請中」子日曆建事件（失敗唔擋收表，warn 回傳）
  → 職員電郵（Config NOTIFY_STAFF_EMAIL）

職員一鍵批准 approveVenueBooking
  → 通通鎖（Sciener）限時密碼（借用時段提前／延後 15 分鐘；PWD_MODE=phone4＝電話頭 4 位；撞碼自動重試）
  → Teamup 事件搬去「確認借用」子日曆，notes 補密碼
  → 申請人電郵收「已獲批准＋入場密碼」（申請人冇填電郵則跳過）

拒絕／取消 rejectVenueBooking / setVenueBookingStatus
  → Teamup 拒絕事件（選填子日曆）＋ 申請人電郵
```

#### 成員端 Teamup 月曆：唯讀嵌入＋單一申請入口（方案 1）

- 成員端上方月曆**只嵌入「唯讀（Read-only）」分享連結**：優先取 Config `TEAMUP_READONLY_URL`
  （`getPublicInfo` → `teamupReadOnlyUrl`），未設定時向後兼容 `TEAMUP_BOOKING_URL`
  （同樣必須係 Read-only 連結），兩者皆空時先用成員端內建後備連結。
- Teamup 連結權限係**唯一寫入邊界**：Read-only 連結只能檢視，點擊日期唔會開啟可填寫嘅
  Teamup Form；URL 參數只控制外觀（隱藏 menu／search／sidepanel 等），**冇任何參數可以將
  Add-only／Modify 連結降格做唯讀**。可編輯連結唔可以再喺成員端使用。
- 前端**唔存、亦唔暴露** `TEAMUP_API_KEY`／`TEAMUP_CALENDAR_KEY` 等任何 Teamup 憑證；
  瀏覽器對 Teamup 只有 iframe 唯讀讀取，冇任何直接寫入呼叫。
- 唯一申請入口係下方成員表格 → member proxy（嚴格 action allowlist）→ `submitVenueRequest`
  → `VenueBookings`（pending）→ GS 用 server 端 key 建**藍色「申請中」**事件；職員批核後
  同一事件轉去「確認借用」子日曆（**轉紅**）。唔存在、亦唔可以新增第二條獨立 Teamup 申請流程。
- 區系統操作（一次性）：Teamup → Settings → Sharing → Create Link → 權限選 **Read-only**
  （或 Read-only, no details）→ 將連結貼入主 Sheet Config `TEAMUP_READONLY_URL`；
  舊嘅可編輯連結應降權或停用。Config 係 runtime 讀，改完唔使重新部署 Web App。

降級設計：通通鎖未設定／建碼失敗 → 自動改用隨機密碼，批核照完成（warn 回傳管理端）；Teamup 未設定 → 照收表。聯調期間可喺 Config 設 `ttlockDisabled=TRUE` 跳過通通鎖。

後台 Config（管理系統 Config 表）所需 key 及來源：

| key | 用途 | 去邊度搵 |
|---|---|---|
| `TEAMUP_API_KEY`／`TEAMUP_CALENDAR_KEY`／`TEAMUP_PENDING_SUBCAL_ID`／`TEAMUP_APPROVED_SUBCAL_ID` | Teamup 行事曆 | **已填好**（`getHealthCheck` 已核實 teamupReady／pendingSet／approvedSet 全 true），唔使再理 |
| `SCIENER_CLIENT_ID`／`SCIENER_CLIENT_SECRET` | 通通鎖開發者應用 | TTLock 開放平台 **open.sciener.com** → 用 TTLock App 同一帳號登入 → 應用管理 → 建立應用（網頁 Web App）→ 攞 Client ID＋Secret。**最快捷徑：舊 `skw-booking` Vercel 專案 → Settings → Environment Variables 有齊 `TTLOCK_*` 五條，直接抄** |
| `SCIENER_USERNAME`／`SCIENER_PASSWORD` | 管鎖帳號 | TTLock App（即 lock2.sciener.com）嘅登入 email＋密碼——當初設定區總部大門鎖嗰個帳戶（邊個同事管開把鎖就問邊個） |
| `SCIENER_API_BASE` | API 區域 | 固定填 `https://api.sciener.com`（填咗 `open.sciener.com` Code.gs 會自動改正） |
| `SCIENER_LOCK_ID` | 大門鎖 ID | 填好頭 4 條之後，管理系統借場審批頁（`/venue-regs`）有**「讀取鎖列表」掣**，一撳列出所有鎖＋Lock ID＋有冇網關；或跑 `node services/skw-booking/get-lock-id.js`。**必須揀「已連接網關：是」嗰把** |
| `NOTIFY_STAFF_EMAIL` | 新申請職員電郵通知 | 區會電郵地址（可逗號分隔多個） |

驗證方法（唔使將任何 key 貼出嚟）：

1. 借場審批頁撳「讀取鎖列表」→ 列到鎖＝SCIENER_CLIENT_ID／SECRET／USERNAME／PASSWORD 四條正確；
2. 終極測試：成員系統交一張真申請 → 一鍵批准 → `warn` 欄冇「TTLock 建碼失敗」＋申請人收到密碼電郵＝全線通。

電郵由部署 Apps Script 嘅 Google 帳戶經 `MailApp` 寄出（Apps Script 免費額度：消費帳戶每日 100 封），唔使額外 SMTP 設定。

### 由舊 skw-booking（Vercel）搬 key 過來嘅對照

主 Sheet **Config 分頁**係「一列 key＝一個設定」（key 欄＋value 欄），直接喺 Google Sheet 填；Config 係 runtime 讀，**改完唔使重新部署 Web App**。舊名 `ttlock*` 同新名 `SCIENER_*` 都認得（`cfgFirst_` 自動 fallback）：

| 舊 Vercel 環境變數（skw-booking） | Config 表 key（任揀一個） | 備註 |
|---|---|---|
| `TTLOCK_CLIENT_ID` | `SCIENER_CLIENT_ID` 或 `ttlockClientId` | |
| `TTLOCK_CLIENT_SECRET` | `SCIENER_CLIENT_SECRET` 或 `ttlockClientSecret` | |
| `TTLOCK_USERNAME` | `SCIENER_USERNAME` 或 `ttlockUsername` | TTLock App 登入 email |
| `TTLOCK_PASSWORD` | `SCIENER_PASSWORD` 或 `ttlockPassword` | |
| `TTLOCK_LOCK_ID` | `SCIENER_LOCK_ID` 或 `ttlockLockId` | 亦可填喺場地列 `scienerLockId` |
| `TTLOCK_API_BASE` | `SCIENER_API_BASE` 或 `ttlockApiBase` | 唔填預設 `https://api.sciener.com`（同 `api.ttlock.com` 同一後端；帳號喺 eu／cn 區先要改） |
| （新） | `PWD_MODE` | 預設 `phone4`＝電話頭 4 位（**4 位碼係得嘅**——區方幫領袖開碼一直都用 4 位；舊 skw-booking 筆記「4 位會被拒」實為撞碼被拒嘅誤診，TTLock 拒嘅係同鎖上 active 重複密碼，唔係長度）。維持 `phone4` 唔使改 |

### 電話密碼雙位制（後台需套用 `docs/backend-venue-passcode.patch`）

區方實戰方案（補丁已寫好，並用模擬 Sciener 鎖做過完整 E2E 驗證）：

- 第一段借用＝**電話頭 4 位**；第二段＝**電話尾 4 位**——領袖記自己電話就記到密碼，唔使睇電郵；
- 建碼候選次序：頭4 → 尾4 → 頭4+1…（撞碼後備）；邊個先批核，邊個攞頭4；
- **同一電話同時最多兩段借用**（pending 或 approved 而時段未完結）——因為一個人只有兩個密碼位；時段完結＋15 分鐘（密碼過期）之後個位自動釋放；
- 第三段提交會被拒：「這個電話號碼同時最多兩段借用時間（密碼位：電話頭4位＋尾4位）；請等現有借用時段完結或取消後再申請。」

實測結果（mock 後台＋模擬鎖 `docs/backend-mock-ttlock-sim.patch`）：陳大文 91234567 第一段→密碼 **9123**、第二段→**4567**；黃小芬 91239999（同陳大文撞頭4位）→**9999**（自己尾4位）；同一電話第三段→正確拒收；三個申請人電郵各收到正確密碼。

套用方法（scout-district-portal 一側）：`git apply docs/backend-venue-passcode.patch`（或照 patch 內容手動改 `gs/Code.gs` 三處：`createTtlockPasscode_` 改候選制、新增四個 helper、`submitVenueRequest_` 加兩段上限檢查）→ 開 Apps Script 編輯器貼上新 `Code.gs` → **部署 → 管理部署 → 編輯 → 新版本**。⚠️ 改 code 必須重新部署 Web App 先生效（改 Config 則唔使）。

### 界線：成員系統唔會、亦唔使連通通鎖

通通鎖（Sciener）純粹係**區系統（Apps Script）↔ 鎖**之間嘅事：所有 `SCIENER_*`／`ttlock*` key 只存喺主 Sheet Config 分頁，成員系統（member-portal）由頭到尾唔掂鎖、唔存任何鎖 key。成員唯一接觸到密碼嘅途徑係批核後嘅電郵。所以開通可以分兩步走：

- **Phase 1（唔使任何 key，即刻開通）**：merge member-portal PR → `Venues` 表加場地 → 成員即刻可以網上交表（收表上線）。審批暫時用「**✅ 確認（唔設鎖）**」（`confirmVenueBooking`：只改狀態＋Teamup，**唔會寄密碼電郵**），門鎖密碼照舊由職員人手處理——同多年做法一樣。
- **Phase 2（執齊 key 先做）**：Config 貼 `SCIENER_*` 五條＋套用雙位制補丁＋Apps Script 出新版本 →「一鍵批准」先會自動建碼＋寄密碼電郵。

⚠️ **Phase 1 期間千祈唔好撳「一鍵批准」**：SCIENER 未設定時，佢會 fallback 隨機密碼並**照樣寄電郵俾申請人——嗰個密碼係冇寫入鎖嘅，開唔到門**。（一鍵批准需 DDC 或以上；「確認（唔設鎖）」一般有 venue 權限就撳得到。）

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

### `submitDistrictFeedback`（「你講我聽」區務意見箱）

成員端 `/feedback`：預設匿名留言，聯絡方法選填；可選 DC 保密直達。

```json
{
  "category": "opinion",
  "message": "...（10–2000 字）",
  "wantReply": false,
  "contactName": "",
  "contactType": "phone | email | ig | fb",
  "contact": "",
  "dcOnly": false
}
```

- `category` 必填，僅接受 `opinion`（想同區講）／`support`（想區支援）；proxy 白名單及伺服器端驗證已強制。
- `wantReply !== true` 一律視為匿名：proxy 會喺 server 強制清空 `contactName／contactType／contact`，匿名提交保證唔帶個人聯絡資料。
- `wantReply === true` 時 `contact` 必填，`contactType` 僅接受 `phone／email／ig／fb`；`contactName`（稱呼）選填。
- `dcOnly === true`：後台必須寫入**獨立保密分頁 `DCConfidential`**，而該分頁嘅 Google Sheet 分享權限只限 DC 帳號——唔可以淨係喺管理系統 UI 隱藏，否則「只有 DC 睇到」嘅承諾無效。一般留言寫入 `DistrictFeedback` 分頁。
- 建議記錄欄位：`refCode`（例如 `FB-YYYYMMDD-xxxx`）、`createdAt`、以上 payload 全欄、提交來源（成員系統）；**唔需要、亦唔可以要求 Teamup 或其他第三方 Token**。
- 區管理系統（scout-district-portal）需配合：留言列表頁＋角色把關（`DCConfidential` 僅 DC 角色可讀）；GS 未部署新 action 前成員端表單唔會對外開放（上游會回未知 action）。
- 復用現成防濫用：honeypot、提交時間檢查、proxy per-IP 限流（10 分鐘 20 次）；匿名留言唔記 IP。

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

## Scout Admin 統一回報（成員端 ↔ scout-admin，唔經主 Code.gs）

`app/layout.tsx` 載入 `https://scout-admin-blue.vercel.app/widget.js`（`data-app="成員系統"`），
成員可以隨時遞交「問題回報／意見回饋」。入口放喺「查詢」隔離（`components/ReportLink.tsx`
打開 widget modal；widget 自帶嘅右下角浮動掣已用 CSS 隱藏）：首頁社交列、頁尾連結、
聯絡及查詢頁嘅查詢卡隔離各有一個掣：

- **唔關主 Code.gs 事**：payload 直接送 Scout Admin 自己嘅 Apps Script 接收端（統一回報格式 v1），
  入區會既有嘅問題回報／意見回饋工作表，`來源APP` 欄會存「成員系統」；
- 免 API key、免登入、可匿名；本站 `/api/proxy` 完全唔參與；
- 「成員系統」係未登記來源——後台照收照顯示（🔹 原樣名稱）；想變正式膠囊，
  喺 scout-admin `SOURCE_ALIASES`／`SOURCE_APPS` 加一行即可（可選，唔影響運作）。

## 成員端防呆（本站行為，唔需要後台配合）

借場／借物資／活動知會／訓練班報名四張表（`lib/useFormGuard.ts`）：草稿自動保存（localStorage
`mp:draft:*`，大圖自動剔除防配額爆）、離開頁面提示、草稿一鍵回復、提交前確認清單、
`submitLock` 防雙擊、成功自動清草稿。全部係瀏覽器端行為，後台零改動。
