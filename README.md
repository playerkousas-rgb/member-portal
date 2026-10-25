# 成員服務門戶（member-portal）

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
| `/venue` | `listVenues` | `submitVenueRequest` |
| `/stock` | `listItems`（主 Sheet 即時庫存） | `submitStockBatchRequest`（proxy；支援多項一次遞交） |
| `/training` | `listCourseLinks` | `submitCourseReg` → 每班 Script `addReg` |
| `/activity` | `listActivityNotices` | `submitActivityNotice` |
| 全站 | `getConfig`、`getSystem`、`getPublicInfo` | 系統鎖定時 server 拒絕提交；借用規則／旅團清單／Teamup 網址等動態文字以區系統 Config 為唯一來源（本地常識只作後備） |

`/course` 只係舊網址，會轉到 `/training`；`/calendar` 係舊網址，會轉到 `/venue#availability`。

### 借場月曆：唯讀 Teamup 嵌入（單一申請入口）

`/venue` 上方月曆**只供查看**，成員唔可以喺月曆新增、修改或提交 Teamup 事件，點擊日期亦唔會開出 Teamup Form：

- 月曆只嵌入 Teamup **Read-only 分享連結**：優先用 Config `TEAMUP_READONLY_URL`（`getPublicInfo` → `teamupReadOnlyUrl`），未設定時向後兼容 `TEAMUP_BOOKING_URL`（同樣須為 Read-only 連結）。Teamup 連結權限係唯一寫入邊界，URL 參數只可以改外觀；可編輯（Add-only／Modify）連結唔可以喺成員端使用。
- 前端**唔存、亦唔暴露**任何 Teamup API Token／私人憑證（`TEAMUP_API_KEY` 只存喺區管理系統 Config）；瀏覽器對 Teamup 只有 iframe 唯讀讀取，冇直接寫入呼叫。
- 唯一申請入口係下方成員表格 → `/api/proxy` → `submitVenueRequest` 寫入區管理系統；區管理 GS 先建立藍色「申請中」Teamup 事件，職員批核後同一事件轉紅（「確認借用」）。唔存在第二條獨立 Teamup 申請流程。
- 區系統一次性設定：Teamup → Settings → Sharing → Create Link → 權限選 **Read-only** → 連結貼入 Config `TEAMUP_READONLY_URL`（runtime 生效，唔使重新部署）。

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

- 只容許上述公開 action（管理 action 一律 `403`）；
- 對 CourseLinks、活動知會等回應再做公開欄位白名單；
- 防止 `scriptApiKey / scriptExecUrl / driveFolderId` 及領袖聯絡資料流出；
- 提交前再檢查 `getSystem`；
- 執行 body 大小、honeypot、欄位白名單及基本 per-instance rate limit；
- 將 Apps Script 嘅 `{ ok: true, refCode }` 統一成前端使用嘅 `{ ok: true, data: { refCode } }`。

> 基本 rate limit 唔取代 CDN / WAF 或 Apps Script 端限流；正式上線仍建議加 Turnstile / reCAPTCHA。

## 對接狀態（與 scout-district-portal v4.0.1 核對）

管理後台 `gs/Code.gs`（統一後台 v4.0.1）已包含兩個公開 action，合約已全部達成：

1. `GET action=listCourseLinks` ✅
   - 只回傳 `active=TRUE`、未過 deadline 嘅公開課程欄位；經 `courseLinkPublic_` 清洗，**不會回傳** `scriptExecUrl / scriptApiKey / driveFolderId`。
2. `POST action=submitCourseReg` ✅
   - 驗證課程仍開放（含 **deadline 檢查**，v4.0.1 加入）+ quota → 只喺 server 讀每班 Script URL / Key → 轉發 `addReg`（v4.0.1 起**包含 `extra` 附加資料欄位**）→ 回傳 `refCode`；另更新 `filled` 人數、寫入 `Records` 及通知職員。
3. 每班收表 Script `gs/Code.gs.course.js` 嘅 `addReg` ✅
   - 驗證、防重複（同電郵）、入數紙存 Drive、回傳 `{ ok: true, refCode }`。

餘下事項：

- 尚未有真實課程，訓練班報名流程未做過端到端實測；待開班後應以「真實課程」行一次報名，確認 `refCode` 回傳及每班 Sheet 收到資料。
- 部署前提：Vercel 設好 `MEMBER_SKW_APIKEY`，主 `Code.gs` 已部署為「任何人」可執行 Web App，並喺 `Config` 設定 `API_KEY_HASH`（可經 `getHealthCheck` 驗證，此 action 免 API Key；v4.0.1 會回報 `version: 4.0.1`）。

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
npm run build
npm audit
```

## 表單防呆機制（lib/useFormGuard.ts）

借場、借物資、活動知會、訓練班報名四張表全部有同一套防呆（移植自區系統 v4.15.0「寫入防呆」）：

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

1. **`.vercelignore` 係部署黑名單**——`.git`、`docs/`（補丁／合約文件）、`node_modules`、`.next`、`coverage`、`*.log/*.bak/*.tmp/*.old` 一律唔上部署包。新嘅開發腳本／測試輸出必須同步加入；
2. **`public/` 檔案會原樣進部署包**——未引用嘅圖檔禁止提交；加新靜態資源前先 `grep -rn "檔名" app components public`；
3. **圖示去重**——`sw.js` 與 manifest 共用同一個 `icon-192.png`（原本多存咗一份位元組級相同嘅 `notification-192.png`，已刪，省 49K）；
4. **依賴極簡**——`package.json` 只有 `next / react / react-dom / qrcode.react` 四個 runtime 依賴；加新依賴前要講明理由；
5. **提交前體檢**——`npm run build`＋`npm run typecheck` 通過先可以 push。
