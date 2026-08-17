'use client';
export default function DownloadsPage() {
  return (
    <>
      <h1 className="page-title">⬇️ 模板下載</h1>
      <p className="page-sub">直接下載或複製初始後台模板，供其他區建立空白 Sheet 後快速接入。</p>
      <div className="grid">
        <div className="panel" style={{ textAlign: 'center', padding: 30 }}>
          <div style={{ fontSize: 40 }}>📄</div>
          <h2 style={{ margin: '10px 0' }}>區後台程式碼 Code.gs</h2>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 18 }}>
            區嘅主後台（借場／借物資／活動知會）。喺 Apps Script 貼上整份，執行 <code>setupSheets()</code> 一鍵建表。
          </p>
          <a className="btn" href="/downloads/Code.gs.txt" download="Code.gs" style={{ display: 'inline-block', maxWidth: 260 }}>
            ⬇️ 下載 Code.gs
          </a>
        </div>
        <div className="panel" style={{ textAlign: 'center', padding: 30 }}>
          <div style={{ fontSize: 40 }}>🎓</div>
          <h2 style={{ margin: '10px 0' }}>訓練班收表 Script（Code.gs.course）</h2>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 18 }}>
            每個訓練班 1 張 Sheet 用呢份。執行 <code>setupCourseSheet()</code> 建表後，將 /exec 網址 + API Key 交俾管理員加入 <code>/training</code>。
          </p>
          <a className="btn" href="/downloads/Code.gs.course.txt" download="Code.gs.course" style={{ display: 'inline-block', maxWidth: 260 }}>
            ⬇️ 下載 Code.gs.course
          </a>
        </div>
      </div>
    </>
  );
}
