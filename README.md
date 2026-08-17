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
| `/stock` | `listItems` | `submitStockRequest` |
| `/training` | `listCourseLinks` | `submitCourseReg` → 每班 Script `addReg` |
| `/activity` | `listActivityNotices` | `submitActivityNotice` |
| 全站 | `getConfig`、`getSystem` | 系統鎖定時 server 拒絕提交 |

`/course` 只係舊網址，會轉到 `/training`。

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

## 管理後台尚要完成嘅兩個 action

成員前端已經按合約接好，但 `scout-district-portal` 主 `Code.gs` 必須先加入：

1. `GET action=listCourseLinks`
   - 只回傳 `active=TRUE`、未過 deadline 嘅公開課程欄位；**不可回傳** `scriptExecUrl / scriptApiKey / driveFolderId`。
2. `POST action=submitCourseReg`
   - 驗證課程仍開放 → 由 `CourseLinks` 取每班 Script URL / Key → 轉發 `addReg` → 回傳 `refCode`。

未加入前，訓練班頁會清楚顯示後台 action 錯誤；其他三個公開服務仍可獨立運作。

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
