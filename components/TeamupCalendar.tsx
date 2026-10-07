export const TEAMUP_OPEN_URL = 'https://teamup.com/ksgaj8fr1jieiuje7s';

/** 後備網址：區系統 Config（TEAMUP_BOOKING_URL，經 getPublicInfo）未設定時先用內建網址 */
function embedUrl(openUrl: string) {
  return `${openUrl}?view=w` +
    '&showHeader=0' +
    '&showProfileAndInfo=0' +
    '&showSidepanel=1' +
    '&disableSidepanel=1' +
    '&showViewSelector=0' +
    '&showMenu=0' +
    '&showViewHeader=1' +
    '&showDateControls=1';
}

export default function TeamupCalendar({ url }: { url?: string }) {
  const openUrl = (url || '').trim() || TEAMUP_OPEN_URL;
  return (
    <section id="availability" className="panel calendar-panel">
      <div className="calendar-intro">
        <div>
          <div className="eyebrow">申請前先查看</div>
          <h2>📅 區總部場地行事曆</h2>
          <p>查看心儀日期有冇其他申請或已確認借用；行事曆資料由 Teamup 提供。</p>
        </div>
        <a className="btn-ghost" href={openUrl} target="_blank" rel="noopener noreferrer">
          新視窗開啟 ↗
        </a>
      </div>
      <iframe
        src={embedUrl(openUrl)}
        title="筲箕灣區總部場地借用行事曆"
        width="100%"
        height="680"
        allowFullScreen
      />
      <p className="calendar-note">
        行事曆只供查看場地使用情況，並不代表該時段已獲預留。選定時段後，請在下方遞交正式申請。
      </p>
    </section>
  );
}
