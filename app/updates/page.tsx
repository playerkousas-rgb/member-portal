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
        <h2>v1.1 — 訓練班報名系統</h2>
        <ul style={{ paddingLeft: 20, lineHeight: 2, fontSize: 13.5 }}>
          <li>新頁 <code>/training</code>：訓練班列表 + 完整報名表（個人／童軍／監護人／領袖／FPS 繳費）</li>
          <li>每個訓練班各自 1 張 Google Sheet + 收表 Script，報名自動轉發寫入</li>
          <li>職員後台新增「🎓 訓練班管理」：加入／隱藏訓練班收表 Script</li>
          <li>下載頁新增 <code>Code.gs.course</code> 訓練班收表模板</li>
          <li>活動知會表對齊原有 Google Form（旅號／支部／性質／日期／人數／領袖資料）</li>
        </ul>
      </div>
      <div className="panel">
        <h2>後台程式碼</h2>
        <p style={{ fontSize: 13.5 }}>各區接入所需的 <code>Code.gs</code> 可於「⬇️ 下載」頁取得。</p>
      </div>
    </>
  );
}
