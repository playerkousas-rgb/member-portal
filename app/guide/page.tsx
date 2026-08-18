import Link from 'next/link';

export default function GuidePage() {
  return (
    <>
      <Link href="/" className="backlink">← 返回服務首頁</Link>
      <h1 className="page-title">📖 公開服務使用指南</h1>
      <p className="page-sub">所有服務無需登入；管理、批核、權限及設定全部由另一套區管理系統處理。</p>

      <section className="panel">
        <h2>🏛 借用場地</h2>
        <ol style={{ paddingLeft: 20, lineHeight: 2, fontSize: 13.5 }}>
          <li>進入借場頁後，先在 Teamup 行事曆查看區總部使用情況。</li>
          <li>選擇合適時段，填寫用途及聯絡資料，再提交申請。</li>
          <li>提交唔代表已獲批准；請等區會跟進。</li>
        </ol>
      </section>

      <section className="panel">
        <h2>📦 借用物資</h2>
        <ol style={{ paddingLeft: 20, lineHeight: 2, fontSize: 13.5 }}>
          <li>先填寫一次申請人、用途及借還日期。</li>
          <li>在每款可借物資旁輸入需要數量；可同時選擇多款物資。</li>
          <li>最後按一次遞交，所有項目會以同一批次編號寫入區會 Sheet，方便跟進。</li>
          <li>庫存扣減、歸還及批核只會喺區管理系統進行。</li>
        </ol>
      </section>

      <section className="panel">
        <h2>🎓 訓練班報名</h2>
        <ol style={{ paddingLeft: 20, lineHeight: 2, fontSize: 13.5 }}>
          <li>由主 Sheet「CourseLinks」查看開放中嘅訓練班。</li>
          <li>按課程通告繳費，填寫報名資料並上傳入數紙。</li>
          <li>主後台會將報名轉發到該班專屬 Script 及「表格回應」分頁。</li>
          <li>取錄及批核由該班負責領袖處理。</li>
        </ol>
      </section>

      <section className="panel">
        <h2>📋 旅團活動知會</h2>
        <ol style={{ paddingLeft: 20, lineHeight: 2, fontSize: 13.5 }}>
          <li>可按年份、支部及性質查看公開活動知會。</li>
          <li>填妥活動及負責領袖資料後提交到主 Sheet。</li>
          <li>公開清單不會顯示領袖姓名、電話或電郵。</li>
        </ol>
      </section>

      <section className="panel">
        <h2>📘 守則及指引</h2>
        <p style={{ fontSize: 13.5, marginBottom: 8 }}>
          借場、借物資及閉路電視等守則已內建於本平台，無需另開網頁：
        </p>
        <ul style={{ paddingLeft: 20, lineHeight: 2, fontSize: 13.5 }}>
          <li><Link href="/rules/venue">借場規則及程序</Link></li>
          <li><Link href="/rules/venue-terms">場地一般使用條件</Link></li>
          <li><Link href="/rules/cctv">閉路電視監察措施指引</Link></li>
          <li><Link href="/rules/stock">借物資規定</Link></li>
        </ul>
      </section>

      <p className="hint">請記低提交後顯示嘅參考編號，以便向區會查詢。</p>
    </>
  );
}
