# 成員服務門戶（Member Service Portal）

區內童軍／旅團嘅**公共服務入口**。**100% 公開，無需登入**；所有表單直接寫入 Google Sheet，
批核／管理／output 由另一邊嘅**區管理系統**直接接入同一批 Sheet 處理。

## 服務

| 服務 | 說明 | 資料寫入 |
|---|---|---|
| 🏛 借用場地 | 填表申請 | 主 Sheet「VenueBookings」 |
| 📦 借用物資 | 揀物資 + 填表 | 主 Sheet「StockRequests」 |
| 🎓 訓練班報名 | 每班 1 張專屬 Sheet | 該班專屬 Sheet「Regs」 |
| 📋 旅團活動知會 | 內建填表 | 主 Sheet「ActivityNotices」 |
| 🎖 專科徽章 | 外連 DBS 3.0 | — |

## 頁面

- `/` 主控台：揀區 → 服務卡片
- `/training` 訓練班報名（公開，任何人可填）
- `/districts` 使用地區
- `/setup` 區接入教學
- `/downloads` 模板下載（Code.gs + Code.gs.course）
- `/updates` 更新公告
- `/guide` 使用指南
- `/venue` `/stock` `/course` 公開表單（無需登入）

> 無任何登入入口；批核／電郵密碼／output 全部由區管理系統直接接入 Google Sheet 處理。

## 訓練班報名（每班專屬 Sheet）

成員門戶只負責**報名寫入**；開班、文件、output、收費管理喺另一邊區管理系統做。

```
用戶填 /training
  → POST /api/proxy（主區後台）
  → submitCourseReg_ 查 CourseLinks 表
  → 轉發去該班專屬 Apps Script（/exec）
  → 寫入該班自己張 Sheet（Regs 分頁）
```

- 每個訓練班：1 張 Google Sheet + 1 份收表 Script（模板：`downloads/Code.gs.course.txt`）。
- 入數紙截圖由申請人於報名時上傳，經該班 Script 存入該班嘅 Google Drive 資料夾
  （`setupCourseSheet()` 會自動建立資料夾，亦可喺選單「📁 設定入數紙資料夾」改）。未繳費／未上傳不獲處理。
- 新班接入：喺主 Sheet「CourseLinks」分頁加一行（課程資料 + /exec 網址 + API Key + active=TRUE），
  或由區管理系統直接寫入該分頁。deadline 過咗／active=FALSE 自動唔顯示。
- 目前只服務筲箕灣區：任何人入 `/training` 自動預設 SKW，唔使揀區。

## 職員／權限（Code.gs 保留，前端已無登入入口）

- 門戶前端已移除登入入口；所有批核／管理由區管理系統直接接入 Sheet。
- Code.gs 仍保留職員 API（staffLogin / 批核 / Sciener / TeamUp / 電郵）同後門帳戶，
  供區管理系統以 API Key + token 直接呼叫（可選用），或由區管理系統自己喺 Sheet 層面處理。

## 借用規定

借場／借物資頁面會顯示「借用規定」並要求申請人勾選同意：
- 借場：內建預設根據《借場規則及程序》《場地一般使用條件》及《閉路電視監察措施指引》摘要；Config 可加 PDF 連結。
- 借物資：內建預設根據港島地域物資中心借用規則摘要。
- 想自訂：喺 Config 填 `VENUE_RULES` / `STOCK_RULES`（多行文字），留空即用內建預設。

## 單區模式開關

`lib/district.ts` 嘅 `MULTI_DISTRICT_MODE`：
- `true`（現設）：顯示揀區畫面 + 多區資訊頁（DBS 模式）
- `false`：對外隱藏多區，固定預設區，隱藏地區下拉／「區接入」「使用地區」入口

## 架構（同 DBS 3.0 / 幹部門戶同一 pattern）

```
Next.js（Vercel） → /api/proxy → 該區 Google Apps Script → 該區 Google Sheet
```

API Key 存喺 Vercel env（`MEMBER_{區碼}_APIKEY`），唔會流出前端。

## 部署步驟

### 1. 起後台（Google Sheet + Apps Script）
1. 新開一張 Google Sheet → 擴充功能 → Apps Script。
2. 貼上 `gs/Code.gs`，儲存。
3. 行 `setupSheets()`（首次授權：Review permissions → Advanced → Allow）。
4. 彈窗會顯示 **API Key**（只顯示一次！）請即複製。
5. 喺 `Config` 分頁填：
   - `SCIENER_CLIENT_ID` / `SCIENER_CLIENT_SECRET`（開放平台 open.sciener.com 註冊攞）
   - `TEAMUP_API_KEY` / `TEAMUP_CALENDAR_KEY` / `TEAMUP_PENDING_SUBCAL_ID`（藍）/ `TEAMUP_APPROVED_SUBCAL_ID`（紅）/ `TEAMUP_BOOKING_URL`
   - `FPS_ACCOUNT_NAME` / `FPS_ACCOUNT_NUMBER`
   - `NOTIFY_STAFF_EMAIL`
6. 喺 `Staff` 分頁加職員（passwordHash = SHA-256，可用 `setupSheets` 時建 MASTER_EMAIL 帳號）。
7. 部署 → 新增部署 → 網頁應用程式（執行身分：我自己；存取：所有人）→ 攞 `/exec` 網址。

### 2. 部署前端（Vercel）
1. Push 上 GitHub → Vercel import。
2. Environment Variables 加 `MEMBER_SKW_APIKEY = <上面攞嘅 API Key>`。
3. 改 `lib/district.ts` 入面 `SKW.apiBase` = 你嘅 `/exec` 網址。
4. Deploy。

## Sciener（科技侠/TTLock）開放平台要點
- 註冊開放平台 → 攞 `client_id` + `client_secret`（即 `SCIENER_CLIENT_ID/SECRET`）。
- 鎖要有 Wi-Fi 網關先可以遠端開密碼。
- 自訂密碼要 V4 passcode 版本嘅鎖（`keyboardPwdVersion: 4`）。
- 唔同區域主機：`open.sciener.com` / `euopen.sciener.com` / `cnopen.sciener.com`，喺 `SCIENER_API_BASE` 改。
- API 參數以官方文檔為準，正式接駁時用你嘅 clientId 測試一次。

## 密碼規則（PWD_MODE）
- `phone4`（預設）：電話頭 4 位；如同一電話已有進行中批核，自動轉尾 4 位。
- `random`：隨機 4 位（可設 `PWD_LENGTH`）。

## 擴充到多區
1. `lib/district.ts` 嘅 `DISTRICTS` 加一筆 + Vercel 加 `MEMBER_{code}_APIKEY`。
2. 新區自己開新 Sheet 行 `setupSheets()`。
3. 每張表第一欄都有 `district_code`，多區零改動。
