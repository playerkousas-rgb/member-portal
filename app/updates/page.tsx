'use client';
export default function UpdatesPage() {
  return (
    <>
      <h1 className="page-title">📢 更新公告</h1>
      <p className="page-sub">平台版本與更新紀錄。</p>
      <div className="panel">
        <h2>v1.0 — 首版（基本模版 + 卡片）</h2>
        <ul style={{ paddingLeft: 20, lineHeight: 2, fontSize: 13.5 }}>
          <li>統一前端 + 各區獨立後台（區目錄 mapping）</li>
          <li>四個服務入口：借用場地、借用物資、報讀訓練班、專科徽章（外連 DBS）</li>
          <li>公開表單提交（無需登入）+ 職員批核後台</li>
          <li>借場整合：TeamUp 登記 + Sciener 電子鎖密碼 + 電郵回傳</li>
        </ul>
      </div>
      <div className="panel">
        <h2>後台程式碼</h2>
        <p style={{ fontSize: 13.5 }}>各區接入所需的 <code>Code.gs</code> 可於「⬇️ 下載」頁取得。</p>
      </div>
    </>
  );
}
