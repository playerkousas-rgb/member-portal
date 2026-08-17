'use client';
export default function GuidePage() {
  return (
    <>
      <h1 className="page-title">📖 使用指南</h1>
      <p className="page-sub">成員與職員的基本操作說明。</p>

      <div className="panel">
        <h2>🏛 借用場地</h2>
        <ol style={{ paddingLeft: 20, lineHeight: 2, fontSize: 13.5 }}>
          <li>先去 TeamUp 登記你想用嘅時段。</li>
          <li>返到本平台填借用申請（場地 + 時間要同 TeamUp 一致）。</li>
          <li>職員批核後，電子鎖密碼會自動電郵俾你。</li>
        </ol>
      </div>

      <div className="panel">
        <h2>📦 借用物資</h2>
        <ol style={{ paddingLeft: 20, lineHeight: 2, fontSize: 13.5 }}>
          <li>喺「借用物資」揀物資、數量、借用日期。</li>
          <li>交表後等職員批核（電郵通知）。</li>
          <li>批核後按約定時間到區總部領取。</li>
        </ol>
      </div>

      <div className="panel">
        <h2>🎓 訓練班報名</h2>
        <ol style={{ paddingLeft: 20, lineHeight: 2, fontSize: 13.5 }}>
          <li>去「訓練班報名」揀想報嘅班，睇節次、資格同費用。</li>
          <li>填報名表（個人、童軍、監護人／領袖、FPS 繳費資料）。</li>
          <li>以轉數快（FPS）繳費，貼上入數紙截圖連結。</li>
          <li>提交後取得報名編號；負責職員喺該班專屬 Sheet 睇名單及核對。</li>
        </ol>
      </div>

      <div className="panel">
        <h2>📋 旅團活動知會</h2>
        <ol style={{ paddingLeft: 20, lineHeight: 2, fontSize: 13.5 }}>
          <li>根據總會規定，旅團進行戶外活動（參觀、露營、遠足）須以書面知會區會存檔。</li>
          <li>喺主控台撳「旅團活動知會」，直接喺本平台填表即可，提交後寫入區會存檔。</li>
        </ol>
      </div>

      <div className="panel">
        <h2>🔐 職員（批核人）</h2>
        <p style={{ fontSize: 13.5 }}>喺右上角「職員入口」登入後台，可批核借場／借物資／報班申請，並管理物資、班別及場地。</p>
      </div>
    </>
  );
}
