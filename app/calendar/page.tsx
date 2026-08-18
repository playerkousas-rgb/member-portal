import Link from 'next/link';

const TEAMUP_EMBED_URL =
  'https://teamup.com/ksgaj8fr1jieiuje7s' +
  '?view=w' +
  '&showHeader=0' +
  '&showProfileAndInfo=0' +
  '&showSidepanel=1' +
  '&disableSidepanel=1' +
  '&showViewSelector=0' +
  '&showMenu=0' +
  '&showViewHeader=1' +
  '&showDateControls=1';

const TEAMUP_OPEN_URL = 'https://teamup.com/ksgaj8fr1jieiuje7s';

export default function CalendarPage() {
  return (
    <>
      <Link href="/" className="backlink">← 返回服務首頁</Link>
      <h1 className="page-title">📅 區會行事曆</h1>
      <p className="page-sub">
        區總部場地借用狀況（申請借用／確認借用狀態），由 TeamUp 提供。
      </p>

      <section className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <iframe
          src={TEAMUP_EMBED_URL}
          title="區總部行事曆及借用申請"
          width="100%"
          height="680"
          style={{ border: 0, display: 'block' }}
          allowFullScreen
        />
      </section>

      <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>
        借場前請先查看行事曆了解可用時段，再填寫借用申請。
        如嵌入顯示不正常，可
        <a
          href={TEAMUP_OPEN_URL}
          target="_blank"
          rel="noopener"
          style={{ color: 'var(--p2)', fontWeight: 700, textDecoration: 'underline' }}
        >
          喺新視窗開啟行事曆
        </a>
        。
      </p>
    </>
  );
}
