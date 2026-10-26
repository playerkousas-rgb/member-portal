# 後台 Apps Script（Code.gs）版本庫

呢度係**貼去 Apps Script 嘅正式 GS 檔案持久倉**。點解放喺 member-portal：scout-district-portal（管理系統 repo）目前只授權咗唯讀存取，git push 同 API 寫入都回 403，環境重置又會清走本機檔案；所以每個正式版本嘅 GS 快照統一收發喺呢個有寫入權限嘅 repo，確保唔會再丟失，亦方便日後同步管理系統。

## 目錄結構

```
backend/
├── gs-releases/              ← 每個後台版本一個只讀快照，直接貼 Apps Script
│   ├── README.md
│   └── Code-v4.29.0.gs
└── patches/
    └── admin-v4.29.0.patch   ← 該版本喺 scout-district-portal 嘅完整改動（22 個檔案），
                                日後恢復 push 權限後可 git apply 重建管理端 commit
```

## 版本約定

- 檔名：`Code-v<版本號>.gs`，一份快照對應一個 `getHealthCheck_` 回傳嘅 version。
- 快照一經 PR 合併即凍結，唔再修改；新版本加新檔，唔覆蓋舊檔。
- 每個快照同時有一份 admin patch（`backend/patches/admin-v<版本號>.patch`），記錄埋管理端 Next.js 嘅配套改動（型別、`UnitSectionsEditor`、demo、文檔等）。

## 部署 Apps Script 步驟（區方執行）

1. 下載對應版本快照（例如 `Code-v4.29.0.gs`），備份現有 Apps Script 專案內容。
2. 打開 Apps Script 編輯器，全選貼上覆蓋，儲存。
3. 執行選單「🧱 補建缺失表（不清空資料）」（即 `setupSheets()`），v4.29.0 會自動補建 `UnitSections` 分頁。
4. 「管理部署 → 編輯 → 新版本」重新發布 Web App。
5. 免 API Key 驗證：開 `https://你嘅網址/exec?action=getHealthCheck`，確認 `version` 同快照版本一致。
6. 上線次序：**先 GS、後成員端**。舊版 GS 下成員端會回落單一团条目，唔會壞版。

## 重建 scout-district-portal 改動（恢復 push 權限後）

```bash
git clone https://github.com/playerkousas-rgb/scout-district-portal.git
cd scout-district-portal
git checkout -b arena/v4.29.0
git apply /path/to/admin-v4.29.0.patch
npm ci && npx tsc --noEmit && npm run build
# 跑 scripts/test-*-gs.js 同 test-demo-engine.ts 驗證後 push、開 PR
```

## 現有版本

| 版本 | 快照 | 重點 | admin patch |
|---|---|---|---|
| v4.29.0 | `Code-v4.29.0.gs` | 旅→團階層名錄：`UnitSections` 表、團級集會時間／地點／社交帳戶、`saveUnitSections` | `admin-v4.29.0.patch` |

> v4.28.1 或之前嘅歷史版本喺 scout-district-portal 嘅 Git history 入面；由 v4.29.0 起先喺呢度留獨立快照。
