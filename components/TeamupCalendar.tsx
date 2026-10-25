/**
 * Teamup 月曆（唯讀嵌入）。
 *
 * 安全重點（方案 1：單一申請入口）：
 * - 只嵌入 Teamup「唯讀（Read-only）」分享連結。連結權限係 Teamup 唯一嘅寫入邊界——
 *   URL 參數只可以改外觀，冇任何參數可以將可編輯連結降格做唯讀，所以可編輯
 *   （Add-only／Modify）連結唔可以喺成員端使用。
 * - 月曆只供查看，點擊日期唔會開出可填寫嘅 Teamup Form；所有借用申請一律經下方
 *   成員表格 → /api/proxy → submitVenueRequest，由區管理 GS 統一建立事件。
 * - 前端唔存、亦唔暴露 TEAMUP_API_KEY 等憑證；瀏覽器對 Teamup 只有 iframe 唯讀讀取，
 *   冇任何直接寫入呼叫。
 */

/** 最後後備連結：區系統 Config 兩個 Teamup 網址都未設定時先用；必須係一條「唯讀」分享連結。 */
export const TEAMUP_READONLY_FALLBACK_URL = 'https://teamup.com/ksgaj8fr1jieiuje7s';

/** 只接受 teamup.com 嘅 http(s) 分享連結，避免 Config 誤填其他網址或危險 scheme。 */
export function safeTeamupUrl(raw: string | undefined | null): string {
  const value = (raw || '').trim();
  if (!value) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    const host = url.hostname.toLowerCase();
    if (host !== 'teamup.com' && !host.endsWith('.teamup.com')) return '';
    return url.toString();
  } catch {
    return '';
  }
}

/**
 * 揀最終嵌入連結：優先用明確標示為唯讀嘅 TEAMUP_READONLY_URL，
 * 否則向後兼容舊 TEAMUP_BOOKING_URL（部署上須同樣係唯讀連結），最後先用內建後備。
 */
function resolveCalendarUrl(readOnlyUrl?: string, legacyUrl?: string): string {
  const explicit = safeTeamupUrl(readOnlyUrl);
  if (explicit) return explicit;
  const legacy = safeTeamupUrl(legacyUrl);
  if (legacy) {
    if (process.env.NODE_ENV !== 'production') {
      // 提示操作者：舊網址可能係可編輯連結，應盡快改設專用唯讀連結。
      console.warn(
        '[TeamupCalendar] 未設定唯讀連結 TEAMUP_READONLY_URL，暫用 TEAMUP_BOOKING_URL；'
        + '請確認該 Teamup 分享連結權限為 Read-only，否則月曆仍可被新增事件。',
      );
    }
    return legacy;
  }
  return TEAMUP_READONLY_FALLBACK_URL;
}

/**
 * 唯讀外觀參數：收窄畫面元素，唔提供任何新增／編輯入口。
 * 注意：實際寫入封鎖由 Teamup 連結權限保證，參數只係隱藏介面。
 */
function embedUrl(openUrl: string): string {
  return `${openUrl}?view=w` +
    '&showHeader=0' +
    '&showLogo=0' +
    '&showTitle=0' +
    '&showProfileAndInfo=0' +
    '&showSidepanel=1' +
    '&disableSidepanel=1' +
    '&showViewSelector=0' +
    '&showMenu=0' +
    '&showSearch=0' +
    '&showViewHeader=1' +
    '&showDateControls=1';
}

interface TeamupCalendarProps {
  /** Config TEAMUP_READONLY_URL：專為公開嵌入而設嘅唯讀分享連結（首選）。 */
  readOnlyUrl?: string;
  /** Config TEAMUP_BOOKING_URL：舊設定，向後兼容；同樣必須係唯讀連結。 */
  url?: string;
}

export default function TeamupCalendar({ readOnlyUrl, url }: TeamupCalendarProps) {
  const openUrl = resolveCalendarUrl(readOnlyUrl, url);
  return (
    <section id="availability" className="panel calendar-panel">
      <div className="calendar-intro">
        <div>
          <div className="eyebrow">申請前先查看</div>
          <h2>
            📅 區總部場地行事曆
            <span className="calendar-readonly-badge">🔒 唯讀</span>
          </h2>
          <p>查看心儀日期有冇其他申請或已確認借用；月曆只供查看，唔可以喺月曆新增或修改事件。選定時段後，請拉落下方「提交借用申請」表格登記，區會先會喺月曆建立對應事件。</p>
        </div>
        <a className="btn-ghost" href={openUrl} target="_blank" rel="noopener noreferrer">
          新視窗開啟 ↗
        </a>
      </div>
      <iframe
        src={embedUrl(openUrl)}
        title="筲箕灣區總部場地借用行事曆（唯讀）"
        width="100%"
        height="680"
        allowFullScreen
      />
      <p className="calendar-note">
        行事曆為唯讀模式，只供查看場地使用情況，並不代表該時段已獲預留；喺月曆內按日期唔會開啟申請表。
        選定時段後，請喺下方「提交借用申請」表格遞交申請，區會先會喺行事曆建立同申請對應嘅事件。
      </p>
    </section>
  );
}
