# 後台 Apps Script（Code.gs）版本庫

呢度係**貼去 Apps Script 嘅正式 GS 檔案持久倉**。每個正式版本嘅 GS 快照統一收發喺呢個 repo，方便隨時比對、回溯及同步兩端改動。

## 目錄結構

```
backend/
├── gs-releases/                     ← 每個後台版本一個只讀快照，直接貼 Apps Script
│   ├── README.md
│   ├── Code-v4.29.0.gs .. Code-v4.37.0.gs   ← 自 scout-district-portal 同步嘅上游發布快照
│   ├── Code-v4.37.1.gs              ← 修復借場確認／密碼電郵、重寄電郵與多分隔符職員通知
│   └── Code-v4.37.2.gs              ← 服務改名「邀請探訪/出席活動」、缺 VisitRequests 表自動補建與保護
└── patches/
    ├── admin-v4.29.0.patch
    ├── admin-v4.37.1-venue-email.patch  ← 套用於 scout-district-portal HEAD (b1427ee) 嘅配套改動
    └── admin-v4.37.2-visit-rename.patch ← 套用於 scout-district-portal HEAD (70809bb) 嘅改名及 GS v4.37.2 補丁
```

## 每次改動前必做：雙向 GS 同步檢查（比較邊一邊較新）

**每次開始任何改動前**，必須先檢查並比較 `playerkousas-rgb/scout-district-portal`（`gs/Code.gs` 與 `gs/releases/`）及本倉（`backend/gs-releases/`）兩邊嘅 GS 版本及最新 commit，先睇清**邊一邊較新**：

1. 若 `scout-district-portal` 嘅 `gs/Code.gs` / `gs/releases/` 較新：先把新版快照及 `gs/Code.gs` 同步到本倉 `backend/gs-releases/`，確保基於最新版本改動、唔會覆寫對方已上線功能。
2. 若本倉 `backend/gs-releases/` 較新或今次需要修改 GS：基於最新版輸出新版本 `Code-v<版本號>.gs`，並將對應補丁存於 `backend/patches/`，方便對方同步到 `scout-district-portal`。
3. 確認兩邊 `Code.gs` 版本狀態後（上游 `scout-district-portal` 現為 `v4.37.1`，本倉最新快照為 `v4.37.2` 並附 `admin-v4.37.2-visit-rename.patch`），先繼續進行改動與測試。

## 版本約定

- 檔名：`Code-v<版本號>.gs`，一份快照對應一個 `getHealthCheck` 回傳嘅 `version`。
- 快照一經合併即凍結，唔再修改；新版本加新檔，唔覆蓋舊檔。
- 本倉改動如有對應 `scout-district-portal`（管理端 / `gs/Code.gs` / `public/downloads/Code.gs.txt`）修改，一併輸出 patch 放於 `backend/patches/`，方便管理端 repo 同步。

## 部署 Apps Script 步驟（區方執行）

1. 下載對應版本快照（最新為 `Code-v4.37.2.gs`），備份現有 Apps Script 專案內容。
2. 打開 Apps Script 編輯器，全選貼上覆蓋，儲存。
3. 執行選單「🧱 補建缺失表（不清空資料）」（即 `setupSheets()`）；所有舊資料與設定會原封不動保留，只補缺失欄位／工作表。
4. 如需新借場申請通知職員，於 `Config` 分頁填寫 `NOTIFY_STAFF_EMAIL`（支援英文／中文逗號、分號或空格分隔多個電郵）；如需自訂寄件顯示名稱，填寫 `notifyFrom`。
5. 「部署 → 管理部署項目 → 鉛筆編輯 → 版本選**新版本** → 部署」（保持原 `/exec` 網址不變）。
6. 重要：Apps Script 首次加入或使用 `MailApp` 時，請於編輯器手動執行一次 `setupSheets()` 或測試函式完成 Google 電郵寄送授權（Grant permissions），否則 Web App 寄信會無權限執行。
7. 免 API Key 驗證：開 `https://你嘅網址/exec?action=getHealthCheck`，確認 `version` 為 `4.37.2`。
8. 關於 `listActivityNotices`：`member-portal` 公開端已停用活動知會公開清單（proxy 回 403），但 `scout-district-portal` 管理端仍使用 `listActivityNotices`，故 GS 保留該 action 不刪除。

## 重建 scout-district-portal 改動

```bash
git clone https://github.com/playerkousas-rgb/scout-district-portal.git
cd scout-district-portal
git checkout -b arena/v4.37.2-visit-rename
git apply /path/to/member-portal/backend/patches/admin-v4.37.2-visit-rename.patch
node scripts/test-visit-gs.js
```

## 現有版本

| 版本 | 快照 | 重點 | admin patch |
|---|---|---|---|
| v4.29.0 | `Code-v4.29.0.gs` | 旅→團階層名錄：`UnitSections` 表、團級集會時間／地點／社交帳戶、`saveUnitSections` | `admin-v4.29.0.patch` |
| v4.29.1 | `Code-v4.29.1.gs` | 區團隊與旅團探訪／權限同步調整 | — |
| v4.30.0 | `Code-v4.30.0.gs` | 權限與借場／Teamup 穩定化修正 | — |
| v4.31.0 | `Code-v4.31.0.gs` | 訓練班／借場流程更新 | — |
| v4.32.0 | `Code-v4.32.0.gs` | 旅團聯絡資料隔離 (`TroopContacts`) 與探訪／出席邀請 (`submitVisitRequest`) | — |
| v4.33.0 | `Code-v4.33.0.gs` | 常用連結 (`Links`)、重要日期 (`KeyDates`)、實體密碼 (`Passcodes`) 與區會行事曆審計 | — |
| v4.35.0 | `Code-v4.35.0.gs` | 訓練班／區通告與 Teamup 日曆增強 | — |
| v4.36.0 | `Code-v4.36.0.gs` | 借場 Teamup 衝突 fail-closed 與 TTLock 防撞碼強化 | — |
| v4.37.0 | `Code-v4.37.0.gs` | 上游 `gs/Code.gs`（`b1427ee`）：Teamup 區總部使用情況唯讀支援同步 | — |
| v4.37.1 | `Code-v4.37.1.gs` | 借場提交申請確認電郵、密碼電郵純文字備份、多分隔符 `NOTIFY_STAFF_EMAIL`、`Email` 欄名兼容、電郵錯誤紀錄與 `resendVenueApprovalEmail` 重寄 | `admin-v4.37.1-venue-email.patch` |
| v4.37.2 | `Code-v4.37.2.gs` | 「邀請探訪/出席活動」改名、缺 `VisitRequests` 表時自動補建與保護（不再誤報「尚未就緒」） | `admin-v4.37.2-visit-rename.patch` |

> v4.28.1 或之前嘅歷史版本喺 scout-district-portal 嘅 Git history 入面；由 v4.29.0 起統一於此留快照。
