# Agent 開發守則（member-portal）

1. **每次改動前必做：先檢查並比較另一邊嘅 GS（睇清楚邊一邊較新）**
   - 本平台（`playerkousas-rgb/member-portal`）與管理端（`playerkousas-rgb/scout-district-portal`）共用同一份 Apps Script `Code.gs`。
   - 每次開始任何改動前，先檢查 `playerkousas-rgb/scout-district-portal` 最新 `main` 的 `gs/Code.gs` 與 `gs/releases/`，同本倉 `backend/gs-releases/` 比較版本號及檔案雜湊（sha256）：
     - 若管理端較新：先將管理端新版本 GS 快照同步到 `backend/gs-releases/`。
     - 若本倉較新或需要更新 GS：基於最新一版新增 `backend/gs-releases/Code-v<版本>.gs` 及對應 `backend/patches/`，方便管理端同步。
2. **Vercel 部署瘦身**
   - `backend/`、`docs/`、`scripts/`、`AGENTS.md` 不入部署包（見 `.vercelignore`）；請保持依賴極簡並通過 `npm run typecheck && npm test && npm run build`。
3. **公開安全邊界**
   - 所有寫入／讀取經 `/api/proxy` 白名單轉發，API Key 只放伺服器環境變數（`MEMBER_{CODE}_APIKEY`），不可外洩至瀏覽器。
