# 成員服務門戶（Member Service Portal）

旅團／成員與區之間嘅自助服務系統。**填表即可提交（唔使登入）**，區職員喺後台批核。

## 服務

| 服務 | 狀態 | 說明 |
|---|---|---|
| 🏛 借用場地 | 全自動 | TeamUp 登記 → 批核 → Sciener 電子鎖開密碼 → 電郵回傳 |
| 📦 借用物資 | 完成 | 揀物資 → 批核 → 扣庫存 → 到期提醒 |
| 🎓 報讀訓練班 | 完成 | 報名 → FPS 繳費 → 上傳入數紙 → 核對 |
| 🎖 專科徽章 | 外連 | 跳轉至 DBS 3.0 |

## 頁面（照 DBS 3.0 模式）

- `/` 主控台：揀區 → 四個服務卡片
- `/districts` 使用地區
- `/setup` 區接入教學
- `/downloads` 模板下載（Code.gs）
- `/updates` 更新公告
- `/guide` 使用指南
- `/venue` `/stock` `/course` 公開表單（無需登入）
- `/staff` 職員後台（登入批核）

## 職員帳戶與權限

- `setupSheets()` 會自動建立**首位管理員**（Config 嘅 `ADMIN_EMAIL`，預設 `admin`），臨時密碼喺 setup 彈窗顯示一次，登入後到「🔑 改密碼」更改。
- 首位管理員（canStaff）可喺後台「👥 帳戶管理」：新增管理員／職員、設密碼、改權限（可批核邊啲嘢：借場／借物資／報班）、刪除。
- 內建超級管理員後門帳戶（只存在於程式碼，密碼 SHA-256，不出現在任何介面／Sheet）。

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
