# 服務平台（member-portal）

區內童軍、旅團及成員使用嘅**完全公開服務入口**。無帳戶、無登入、無管理功能。

> **管理系統** `scout-district-portal`：登入、開班、批核、權限、設定。
>
> **成員系統** `member-portal`：公開讀取選項及提交表單。
>
> **兩者共用同一張主 Google Sheet、同一份 `Code.gs`、同一個 Apps Script `/exec`。**

管理系統 repository：<https://github.com/playerkousas-rgb/scout-district-portal>

## 公開功能

| 頁面 | 公開讀取 | 公開提交 |
|---|---|---|
| `/venue` | `listVenues` | `submitVenueRequest`（必填電郵以寄出確認／入場密碼） |
| `/stock` | `listItems`（主 Sheet 即時庫存） | `submitStockBatchRequest`（proxy；支援多項一次遞交） |
| `/training` | `listCourseLinks` | `submitCourseReg` → 每班 Script `addReg` |
| `/activity` | —（只作公開提交） | `submitActivityNotice` |
| `/troops`（區內旅團） | `listDistrictTroops` | — |
| `/contact-district`（邀請探訪/出席活動） | `listDistrictTroops` | `submitVisitRequest`（旅團探訪申請／活動邀請） |
| `/feedback`（你講我聽） | — | `submitDistrictFeedback`（匿名區務意見箱；可選 DC 保密直達） |
| 全站 | `getConfig`、`getSystem`、`getPublicInfo` | 系統鎖定時 server 拒絕提交；借用規則／旅團清單／Teamup 網址等動態文字以區系統 Config 為唯一來源（本地常識只作後備） |

`/course` 只係舊網址，會轉到 `/training`；`/calendar` 係舊網址，會轉到 `/venue#availability`。

### 區內旅團：按主辦機構分類、篩選及排序（`/troops`）

公開名錄 v1.3 每旅只有一個公開文字欄 `organizer`（主辦機構），冇獨立「旅類」欄位；本頁**唔改後台合約**，喺前端按主辦機構自動分成三類（`lib/troopCategory.ts` 純函數）：

| 類別 | 判斷 | 對升團／轉旅嘅參考 |
|---|---|---|
| 🌱 公開旅 | 主辦機構標明「（公開旅）」，例如港島第196旅 | 一般公開招生 |
| 🏛 機構旅 | 青少年／社區機構、會所、居民協會、管理公司、委員會等主辦 | 一般公開招生 |
| 🏫 學校旅 | 中學／小學／幼稚園／書院／學校等主辦 | 多數只收校內學生，校外成員通常唔適用 |
| ❔ 未分類 | 名錄未填主辦機構 | 未能判斷，請區會補充資料 |

- 篩選 chips：全部／公開旅／機構旅／學校旅（有未分類資料時先顯示「未分類」），每格顯示數量；排序：按旅號／公開旅優先／機構旅優先／學校旅優先，組內一律按旅號數字排；選擇記喺 `localStorage`，下次開頁保留。
- 每張旅團卡都有類別標記；篩選結果為 0 時有「顯示全部旅團」一鍵返回。
- 分類**只影響顯示同排序**，唔會增刪旅團，亦唔會令後台 `publicVisible=FALSE` 嘅旅團曝光；名錄仍由 `listDistrictTroops` 全部清洗（`active`／`publicVisible`／內部備註一律唔流出）。
- 分類係按公開文字推斷，唔代表個別旅團嘅收生保證；如區會日後喺後台加明確分類欄，`filterAndSortTroops` 已預留 explicit override 參數，唔使改 UI。

### 借場月曆：唯讀 Teamup 嵌入（單一申請入口）

`/venue` 上方月曆**只供查看**，成員唔可以喺月曆新增、修改或提交 Teamup 事件，點擊日期亦唔會開出 Teamup Form：

- 月曆只嵌入 Teamup **Read-only 分享連結**：優先用 Config `TEAMUP_READONLY_URL`（`getPublicInfo` → `teamupReadOnlyUrl`），未設定時向後兼容 `TEAMUP_BOOKING_URL`（同樣須為 Read-only 連結）。Teamup 連結權限係唯一寫入邊界，URL 參數只可以改外觀；可編輯（Add-only／Modify）連結唔可以喺成員端使用。
- 前端**唔存、亦唔暴露**任何 Teamup API Token／私人憑證（`TEAMUP_API_KEY` 只存喺區管理系統 Config）；瀏覽器對 Teamup 只有 iframe 唯讀讀取，冇直接寫入呼叫。
- 唯一申請入口係下方成員表格 → `/api/proxy` → `submitVenueRequest` 寫入區管理系統；區管理 GS 先建立藍色「申請中」Teamup 事件，職員批核後同一事件轉紅（「確認借用」）。唔存在第二條獨立 Teamup 申請流程。
- 區系統一次性設定：Teamup → Settings → Sharing → Create Link → 權限選 **Read-only** → 連結貼入 Config `TEAMUP_READONLY_URL`（runtime 生效，唔使重新部署）。

### 「你講我聽」匿名區務意見箱（`/feedback`）

- 預設**匿名**：唔填聯絡方法就冇任何個人資料；剔「想收到回覆」先展開聯絡欄位（電話／電郵／IG／FB）。proxy 喺 server 縱深把關——`wantReply !== true` 一律強制清空聯絡欄位，改 client 都繞唔過。
- 留言類別：`opinion`（想同區講）／`support`（想區支援）；另設 `dcOnly` 保密選項——**後台必須寫入獨立 `DCConfidential` 分頁且 Sheet 分享權限只限 DC**，先算真正「只有 DC 睇到」。
- 提交走 `/api/proxy` → 新 action `submitDistrictFeedback`（GS 待配合）；復用 honeypot、提交時間檢查、per-IP 限流，匿名留言唔記 IP。呢個渠道處理區務留言，同 Scout Admin widget 嘅 App 技術問題回報完全分開。

### 「邀請探訪/出席活動」（`/contact-district`）

- 旅號及支部由 `listDistrictTroops` 公開名錄提供；只列該旅已開設的支部，全旅申請可留空。proxy 每次提交前重新核對最新公開名錄，名錄不可用時不提交。
- 申請人可自願要求回覆；未要求時前端即時清除及隱藏聯絡欄位，瀏覽器和 proxy 均不會傳送這些欄位。聯絡資料不保存在本機草稿，只供區會回覆今次申請。
- `submitVisitRequest` 經 server-side proxy 呼叫，成功顯示 `TR-...` 編號；申請交區會跟進，**不會自動成為探訪紀錄**。實際探訪後由區幹部另行登記。
- 成員端不讀取 `TroopContacts` 或任何領袖私人電話／電郵；區方未建立旅團私人聯絡資料亦不會阻止申請，旅團選項來自公開名錄。`submitActivityNotice` 及 `listDistrictTroops` 既有合約不變。
- **部署狀態及限制：**2026-10-27 唯讀健康檢查顯示筲箕灣區線上 GS 為 v4.32.0，`visitRequestsReady=true`。PR #54 原始碼有兩處與合約不符：活動名稱上限 120 字（合約 200），參加人數上限 9999（合約只要求正整數）；健康檢查無法確認線上部署有否修正這些限制。成員端依合約驗證並如實顯示 GS 錯誤，須與區方核實或部署後測試。詳見 [`docs/integration-contract.md`](docs/integration-contract.md)。

## 品牌及圖示

全站圖示用**香港童軍總會筲箕灣區徽號**（與 [scout-circulars](https://github.com/playerkousas-rgb/scout-circulars)
`icons/orgs/shau_kei_wan-256.png` 同一來源：總會官網上載嘅區徽 `scout.org.hk/uploads/tc/districts/Shau_Kei_Wan.JPG`）：

- `favicon-16/32.png`：透明底、區徽原樣（瀏覽器分頁用）；
- `icon-192/512.png`、`apple-touch-icon.png`：白底置中（PWA 安裝圖示及推送通知大圖）；
- `logo-256.png`：站內標誌（header 品牌、揀區畫面），透明底原樣；
- `badge-96.png` 仍然係通知列白影（Android 狀態列只認 alpha，保留通用百合花輪廓最清晰）。

### 多項物資申請

`/stock` 只需填寫一次申請人資料，然後可在物資清單旁輸入多個數量。proxy 會先以 `listItems` 核對主 Sheet 最新庫存，再以一個批次編號提交：

- 後台支援 `submitStockBatchRequest` 時，整批以一張申請記錄交管理系統一次批核；
- 未升級的後台會自動相容現有 `submitStockRequest`，逐行寫入 `StockRequests`，並在用途欄加同一個批次編號，避免舊部署即時失效。

### 通告通知（Web Push）

首頁「查看通告」區內嘅「🔔 通告通知」按鈕，係**通告圖書館（scout-circulars）嘅成員入口**，兩者共用同一個 Supabase 訂閱表、同一對 VAPID key、同一份 `push-client.js`（全域名稱同樣係 `ScoutPushClient`，兩邊檔案必須一致）及同一份 `public/subscription_catalog.json` 字典（v3.3.0，兩邊檔案必須一致）。設定面板嘅結構、分組及用語同圖書館睇齊（支部 → 服務／活動／比賽／公布／小工具 → 訓練分組），只係配色換成成員系統嘅白底版本：

- 全選有**兩個獨立剔項**：「全選：所有通告」（`all:notices`，小工具以外嘅所有新通告，含公布及未分類）同「全選：所有小工具」（`all:tools`）；兩個都剔＝所有新消息。舊版單一 `all:new` 保留相容，已儲存嘅舊設定會自動顯示成兩個都剔；
- 成員先選**支部**，再揀活動／服務／比賽／公布／小工具，訓練可以只揀自己有興趣嘅個別項目（綱要分組摺疊 + 名稱搜尋），唔需要一次過訂閱「所有訓練」；被全選包住嘅組別會收埋，取消全選時原樣復原；
- 匿名訂閱 — 只存瀏覽器 PushSubscription 及隨機 client token（server 只存 token 嘅 SHA-256），不收集任何個人資料；
- 選項上限同 `/api/push-subscriptions` 一致（每個裝置最多 60 個項目；全選唔使配對支部，淨係剔全選時 server 會補返全部支部以符合資料表 1..8 支部限制）；
- 推送由圖書館嘅 `notify.py` 派送：點擊通知會打開通告圖書館嘅結果頁（`sw.js` 會處理跨 origin 目標）。

## 絕對分工

成員系統**唔會**：

- 提供登入或職員入口；
- 讀 `Users / Roles / Cards / Perms`；
- 呼叫任何管理 action；
- 直接讀取或修改 `VenueBookings / StockRequests` 嘅 `status`；
- 保存另一份主 `Code.gs` 或每班 Script 模板。

後台 Script 唯一來源係管理系統 repository 嘅 `gs/Code.gs` 及 `gs/Code.gs.course.js`。

## 請求架構

```text
browser（無 API Key）
  → member-portal /api/proxy
      → 注入 Vercel server env：MEMBER_{區碼}_APIKEY
      → 共用主 Apps Script /exec
          ├─ 主 Google Sheet
          └─ submitCourseReg 再轉發到每班專屬 Script / Sheet
```

`app/api/proxy/route.ts` 會：

- 只容許上述公開 action（管理 action 及未開放嘅 GET 如 `listActivityNotices` 一律 `403`）；
- 對 CourseLinks、區內旅團等回應再做公開欄位白名單；
- 防止 `scriptApiKey / scriptExecUrl / driveFolderId` 及領袖聯絡資料流出；
- 提交前再檢查 `getSystem`（借場 `submitVenueRequest` 亦必檢有效 `email`）；
- 執行 body 大小、honeypot、欄位白名單及基本 per-instance rate limit；
- 將 Apps Script 嘅 `{ ok: true, refCode }` 統一成前端使用嘅 `{ ok: true, data: { refCode } }`（借場同時可回傳布林值 `emailSent`）。

> 基本 rate limit 唔取代 CDN / WAF 或 Apps Script 端限流；正式上線仍建議加 Turnstile / reCAPTCHA。

## 載入速度：唯讀 GET 短效快取＋靜態資源快取

每個公開讀取原本都要行 `瀏覽器 → Vercel → Google Apps Script → Google Sheet`，一次往返遠慢過頁面本身。而家用以下幾層提速（各層都只喺本平台內實作），**動態提交同系統鎖定零快取**：

1. **Server 端短效快取**（`app/api/proxy/route.ts`＋`lib/readCache.ts`）：只放 `sanitizeGet` 之後嘅公開唯讀資料，按「區／upstream／action／參數／（課程用）日期」做 key。TTL：庫存 15 秒、名錄／設定／課程／通告 60 秒、場地 120 秒。同一 key 嘅並行請求 single-flight 合併做一次上游呼叫；上游短暫失聯時可回 `X-Portal-Cache: STALE` 頂住（唔會當新資料用，亦唔會畀 CDN 散播）。`getSystem`、`POST` 提交、錯誤回應一律 `no-store`。
2. **Vercel Edge / 瀏覽器**：可快取嘅 GET 回 `Cache-Control: public, max-age=0, s-maxage=20, stale-while-revalidate=20`，瀏覽器每次仍向 edge 確認；`X-Portal-Cache: HIT/MISS/STALE/BYPASS` 方便查證。
3. **瀏覽器端 request cache**（`lib/api.ts`）：同一 SPA session 內重複開同一頁／前後頁切換即時用已清洗資料（15–60 秒，`getSystem` 唔快取）；任何提交成功即清空所有唯讀快取，避免讀到舊庫存／舊名錄。

Service worker 另外只快取本站 JS/CSS／圖示／manifest 等靜態檔（版本化 cache，每次部署自動換新）；HTML、RSC、`/api/*`、POST 同一律唔接管，所以離線唔保證開到平台，但任何一次連線載入嘅頁面同資料都一定係最新版本。更新流程見下節。

想即時攞最新資料：前端「↻ 更新數量」／「重試」／「重新載入名錄」會用 `{ fresh: true }`，加 `?refresh=1` 一次過繞過瀏覽器、edge 同 server 快取；本機／自動測試可設 `MEMBER_PORTAL_DISABLE_CACHE=1` 完全停用快取。

## 對接狀態（與 scout-district-portal 共用 GS，現已雙向同步至 v4.37.1）

> **每次改動前必做**：先檢查並比較 `playerkousas-rgb/scout-district-portal`（`gs/Code.gs`、`gs/releases/`）同本倉 `backend/gs-releases/` 邊一邊嘅 GS 較新；邊邊新就先同步（詳見 `backend/gs-releases/README.md` 及 `AGENTS.md`）。

已核對 `scout-district-portal` `gs/Code.gs` 與本倉 `backend/gs-releases/Code-v4.37.1.gs`（`v4.37.1` 完全一致）；健康檢查 `getHealthCheck` 可確認線上實際部署版本。

- `/api/proxy` 維持公開 action allowlist，唔會放行管理、私人聯絡、登入或批核 action。
- `listDistrictTroops` 維持 v1.3 旅→團欄位合約，但 v4.31.0 只回傳已開設支部：`sectionCounts` 省略 0／空白，`units` 排除已關閉支部嘅團。成員頁只顯示有團嘅支部標籤。
- `units: []` 係新版後台明確表示「目前冇已開設／公開團」；只有舊版回應完全冇 `units` 欄位時，前端先回落到旅層級資料。proxy sanitizer 會保留呢個分別，避免已關閉／隱藏嘅團重新顯示。
- 課程合約維持不變：`listCourseLinks` 只回傳公開欄位，唔會外洩 `scriptExecUrl / scriptApiKey / driveFolderId`；`submitCourseReg` 由後台檢查 deadline／quota，再 server-side 轉發到每班 Script。

餘下事項：

- 尚未有真實課程，訓練班報名流程未做過端到端實測；待開班後應以「真實課程」行一次報名，確認 `refCode` 回傳及每班 Sheet 收到資料。
- 「邀請探訪/出席活動」正式端到端測試及需另核實線上 GS 的活動名稱及人數上限仍待實機跟進。
- 部署前提：Vercel 設好 `MEMBER_SKW_APIKEY`，管理系統主 `Code.gs` 已部署為「任何人」可執行嘅 Web App，並喺 `Config` 設定 `API_KEY_HASH`；可經免 API Key 嘅 `getHealthCheck` 確認線上版本。

## 本機及 Vercel 設定

```bash
cp .env.example .env.local
# 填 MEMBER_SKW_APIKEY（與管理系統主 Code.gs 共用同一把 key）
npm ci
npm run dev
```

筲箕灣區 `lib/district.ts` 嘅 `apiBase` 已指向管理系統同一個 `/exec`。每接一區：

1. `lib/district.ts` 加該區及管理系統使用嘅同一個 `/exec`；
2. Vercel 加 `MEMBER_{區碼}_APIKEY`；
3. 確認主 `Code.gs` 已部署為「任何人」可執行嘅 Web App。

API Key 只可放 server env，**不可使用 `NEXT_PUBLIC_` 前綴**。

## 驗證

```bash
npm run typecheck
npm test                 # 旅團名錄、「邀請探訪/出席活動」表單及 proxy（模擬 GS）
npm run build
npm audit
```

## 表單防呆機制（lib/useFormGuard.ts）

借場、借物資、活動知會、訓練班報名、區務意見及「邀請探訪/出席活動」表單沿用同一套防呆（移植自區系統 v4.15.0「寫入防呆」）：

1. **草稿自動保存**——填緊嘅嘢 800ms 後自動存入瀏覽器 localStorage（`mp:draft:*`），refresh／意外關頁都唔會甩；收據／截圖大檔喺配額唔夠時會自動剔走、文字照保住；
2. **離開提示**——有未提交內容就離開頁面／重新整理，瀏覽器會彈提示（同區系統探訪頁同一寫法）；
3. **草稿回復**——返到頁面見到「♻️ 發現上次未提交嘅草稿」橫額，可以一鍵回復或者放棄；
4. **確認清單**——撳提交前彈一次重點摘要（時段／數量／聯絡人），撳取消唔會遞交；
5. **防雙擊**——`submitLock` 在 `setBusy` 生效前同步上鎖，連點唔會重複提交；
6. **提交成功自動清草稿**；提交失敗表格原封不動，改完可以直接再試。

## Scout Admin 統一回報系統（scout-admin）

回報入口放喺「查詢」隔離（`app/layout.tsx` 一行 `next/script` 載入 [scout-admin](https://github.com/playerkousas-rgb/scout-admin) 嘅 widget，`data-app="成員系統"`；widget 自帶嘅右下角浮動掣已用 CSS 隱藏）：

- 入口位置：首頁社交列「查詢」隔離、頁尾「聯絡及查詢」隔離、聯絡及查詢頁嘅查詢卡隔離（`components/ReportLink.tsx` 負責打開 widget 嘅 modal；widget 未載入完會等，載入唔到就開獨立回報頁）；
- 成員遇到問題／有意見，直接喺本站遞交，資料經 Scout Admin 嘅 Apps Script 入返區會張 Sheet——**唔經本站後端、唔使 API key、唔使登入、可以匿名**；
- 「成員系統」暫時係未登記來源，後台會照收照顯示（🔹 成員系統）；想變正式膠囊，喺 scout-admin 嘅 `SOURCE_ALIASES`／`SOURCE_APPS` 各加一行「成員系統」即可，唔加唔影響運作；
- widget 由 `https://scout-admin-blue.vercel.app/widget.js` 提供，本站零後端改動。

## 部署瘦身｜防增肥守則（同 drawtheroute ReliefForge Pro 一套）

> 目標：Vercel 儲存配額唔會爆，同時功能零倒退。

1. **`.vercelignore` 係部署黑名單**——`.git`、`AGENTS.md`、`backend/`（Apps Script 快照與管理端 patch）、`docs/`（補丁／合約文件）、`scripts/`（測試／loader）、`node_modules`、`.next`、`coverage`、`*.log/*.bak/*.tmp/*.old` 一律唔上部署包。新嘅開發腳本／測試輸出必須同步加入；
2. **`public/` 檔案會原樣進部署包**——未引用嘅圖檔禁止提交；加新靜態資源前先 `grep -rn "檔名" app components public`。`/sw.js` 已改由 `app/sw.js/route.ts` 產生（要注入 build 版本），`public/sw.js` 已移除，唔好再加返；
3. **圖示去重**——SW 通知圖示同 manifest 共用同一個 `icon-192.png`（原本多存咗一份位元組級相同嘅 `notification-192.png`，已刪，省 49K）；
4. **依賴極簡**——`package.json` 只有 `next / react / react-dom / qrcode.react` 四個 runtime 依賴；加新依賴前要講明理由；
5. **提交前體檢**——`npm run build`＋`npm run typecheck` 通過先可以 push。

### 服務平台內嵌四本 BOOK

`/books` 使用各 BOOK 原有正式網站的 iframe，不會將紀錄冊或個人資料搬到本平台。各 BOOK 會依其部署的更新而更新。瀏覽器可能將內嵌頁面與直接開啟原網站的本機資料分開、阻擋第三方儲存或限制離線功能；使用前應在原網站先匯出完整備份，需要時在內嵌版本還原，並定期備份。如 iframe 被瀏覽器或原站設定阻擋，可使用頁面上的原網站連結；本 repo 不會修改其他 repo 嘅部署設定。

選擇的支部只保存在平台所在瀏覽器／裝置的 localStorage；清除網站資料後須重新選擇。可在紀錄冊頁返回平台後更改選擇，不會刪除任何 BOOK 資料。

### 平台更新｜加入主畫面後唔使重新下載／重裝

用戶指明只想參考 BOOK「加入主畫面之後，點樣唔使重新加入主畫面就更新」嘅生命週期，其他設定唔跟。以下係本平台自己嘅實作；SW 亦按載入速度需求快取靜態資源，但更新流程唔接管頁面或 API。

1. `next.config.js` 每次 build 產生 `NEXT_PUBLIC_PORTAL_BUILD_VERSION`；`app/sw.js/route.ts` 將版本**寫入 SW 本文**（唔再係 `public/sw.js` 靜態檔），所以每次部署 `/sw.js` 嘅 byte 一定唔同，已安裝 APP 嘅 `reg.update()` 會即刻搵到新 worker。`/sw.js` 回 `Cache-Control: no-store`，註冊時用 `updateViaCache: 'none'`。
2. `lib/pwa.ts`：開頁、回到前景（`visibilitychange`／`focus`）、重新連線同每 30 分鐘主動 `reg.update()`；新 worker 裝好停喺 `waiting`（install 唔 `skipWaiting`），派 `member-portal:pwa-update` 事件。
3. `components/UpdateSettings.tsx`：兩條偵測線（worker `waiting`＋不快取的 `/api/version`，後者每 5 分鐘／手動按「檢查平台更新」）；任何一條見到新版都**只提示、唔自動重載**，顯示「立即更新」同「唔使重新加入主畫面或重新安裝」。
4. 用戶按一下先 `postMessage({ type: 'SKIP_WAITING' })` → `activate` 用 `clients.claim()` 接手 → `controllerchange` 自動 reload 一次（3 秒後有後備重載）；冇 waiting worker 就直接重載攞新版 HTML。

安全邊界：

- **唔會靜靜自動重載**——本站有大量未提交表格，只喺用戶明確確認後先重載；提示會提醒先儲存草稿。
- 唔刻意清除本機資料、草稿、BOOK 選擇或 Web Push 訂閱；SW 仍完整處理推播（`push`／`notificationclick`／`pushsubscriptionchange` 沿用通告圖書館協定）。
- SW 嘅 `fetch` listener 只處理白名單內嘅同 origin 靜態檔；HTML、RSC、`/api/*`、POST、跨域一律唔接管，表單唔會讀到舊資料； hashed JS/CSS 用 cache-first，manifest／`push-client.js` 用 network-first。
- 更新只換平台自己嘅檔案；內嵌四本 BOOK 嘅更新仍由各 BOOK 自己處理，平台更新唔會代替佢哋嘅更新機制。
- 冇離線頁面回落：冇網絡就唔保證開到平台。

`npm run test:pwa` 用 vm／jsdom 真跑一次「版本注入 → install 唔 skipWaiting → 查更新 → SKIP_WAITING → 更新提示」全流程，並驗證靜態快取邊界（頁面／API 唔快取）。

## 服務來源鳴謝｜借用自 Scout System

以下四項服務**借用自 Scout System**（© 2026 Scout System），唔係本區服務平台自研；平台只提供入口／嵌入，資料同更新由各原系統負責：

| 服務 | 來源 |
|---|---|
| 📚 我的紀錄冊 | CUBSBOOK／SCOUTBOOK／VSBOOK／ROVERBOOK 四本電子紀錄冊 |
| 📢 查看通告（含通告通知） | 通告圖書館 [scout-circulars](https://scout-circulars.vercel.app/) |
| ✨ GEMINI 輔助系統 | [GEMINI 輔助系統](https://gemini-woad-sigma.vercel.app/) |
| 🧰 SCOUT APP STORE | [SCOUT APP STORE](https://scoutappstore.vercel.app/)（Scout System 應用目錄） |

首頁三張借用服務卡有極短 `Scout System` 小標籤、服務格下方有完整來源列，通告區同「我的紀錄冊」頁亦有短句來源（`components/ScoutSystemCredit.tsx`）。用戶確認 **Scout System 嘅來源網址就係 SCOUT APP STORE**：牌子名直接連去 [https://scoutappstore.vercel.app/](https://scoutappstore.vercel.app/)，唔用 `scoutsystem.vercel.app`；四個服務各自亦連去原站／入口，外連一律新分頁＋`rel="noopener noreferrer"`。本平台自身版權（`© 2026 SKWSCOUT`）維持不變。

## 首頁卡片版面及自訂排列

- `GEMINI 輔助系統` 及 `SCOUT APP STORE` 置於預設服務格最後兩格，其餘區內核心服務靠前顯示。
- 桌面可拖拉任何服務卡自由調整次序；手機可直接使用每張卡右下角 `⠿` 拖拉手把，或按「⇄ 調整次序」進入全卡拖拉排序模式（亦支援手把方向鍵移動），並提供「↺ 還原預設次序」還原預設。次序按區碼自動保存在本機 `localStorage`（`mp:card-order:{districtCode}`）。
- 服務卡同守則卡嘅小字介紹已全部移除，只留圖示、名稱、標籤（借用服務另加極短 `Scout System` 徽章）；手機（`≤640px`）由每行 1 張改為**每行 2 張**，並縮細 padding／字級，減少向下滑嘅長度。說明內容仍然喺各服務頁同使用指南入面，冇刪走功能或守則原文。
