'use client';
export default function SetupPage() {
  return (
    <>
      <h1 className="page-title">🧩 區接入教學</h1>
      <p className="page-sub">本平台採「統一前端 + 各區獨立 Google Sheet / Apps Script 後台」。你這區不用寫程式，照步驟建立自己的後台，再把 Web App /exec 網址和 API Key 交給平台管理員即可。</p>

      <div className="panel">
        <h2>你需要先準備</h2>
        <ul style={{ paddingLeft: 20, lineHeight: 2, fontSize: 13.5 }}>
          <li>Google 帳號 1 個（建議用區的公用帳號）</li>
          <li>空白 Google Sheet 1 張</li>
          <li>區碼（例如 CHW）、區名（例如 柴灣區）</li>
          <li>如啟用借場：Sciener 開放平台 clientId/clientSecret、TeamUp API Key</li>
        </ul>
      </div>

      <div className="panel">
        <h2>詳細步驟</h2>
        <ol style={{ paddingLeft: 20, lineHeight: 2.1, fontSize: 13.5 }}>
          <li>到「⬇️ 下載」取得後台程式碼 <code>Code.gs</code>。</li>
          <li>建立一張全新的 Google Sheet。</li>
          <li>選單：擴充功能 → Apps Script，把 <code>Code.gs</code> 整份貼上、儲存。</li>
          <li>函數選 <code>setupSheets</code> → 執行（首次需授權：Review permissions → 你的帳戶 → Advanced → Allow）。</li>
          <li>🔑 Setup 彈窗會顯示你的 <b>API Key</b>（只顯示一次！）。請即複製。</li>
          <li>喺 <code>Config</code> 分頁填：區名、Sciener clientId/clientSecret、TeamUp API Key、FPS 帳戶等。</li>
          <li>部署 → 新增部署 → 網頁應用程式（執行身分：我自己；存取：所有人）。</li>
          <li>複製 <code>/exec</code> 網址。</li>
          <li>把「區碼 + 區名 + /exec 網址 + API Key」交給平台管理員登記。</li>
        </ol>
      </div>

      <div className="panel">
        <h2>🔑 API Key 是甚麼？</h2>
        <p style={{ fontSize: 13.5 }}>API Key 是你區後台與前端之間的通訊密鑰。前端每次呼叫你的後台時，都會附帶這把 Key 來證明身份。沒有這把 Key，任何人都無法讀取或修改你的資料。</p>
        <ul style={{ paddingLeft: 20, lineHeight: 2, fontSize: 13.5, marginTop: 8 }}>
          <li>Setup 時自動生成，只顯示一次</li>
          <li>忘記了？到 Apps Script 選單 → 🔑 重新生成 API Key</li>
          <li>懷疑洩漏？重新生成即可，舊 Key 即刻失效</li>
          <li>Config 表只存雜湊值，連管理員也無法還原</li>
        </ul>
      </div>
    </>
  );
}
