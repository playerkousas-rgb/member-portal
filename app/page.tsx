'use client';
import Link from 'next/link';
import AnnouncementBanner from '@/components/AnnouncementBanner';
import PushSettings from '@/components/PushSettings';
import SocialLinks from '@/components/SocialLinks';
import { useDistrict } from '@/lib/useDistrict';

const ANNOUNCEMENT_URL = 'https://scout-circulars.vercel.app/';

const SERVICES = [
  {
    href: '/venue', icon: '🏛', title: '借用區總部',
    desc: '先用 Teamup 查看區總部行事曆，再填寫場地借用申請（內置借場守則及指引）。',
    tag: '查看／提交', external: false,
  },
  {
    href: '/stock', icon: '📦', title: '借用物資',
    desc: '填一次申請人資料，可同時為多款 Sheet 物資填數量並一併遞交（內置借物資規定）。',
    tag: '公開提交', external: false,
  },
  {
    href: '/training', icon: '🎓', title: '訓練班報名',
    desc: '瀏覽開放中嘅訓練班；報名會轉發到該班專屬收表 Sheet。',
    tag: '公開報名', external: false,
  },
  {
    href: 'https://districtbadgesystem30.vercel.app/', icon: '🎖', title: '專科徽章系統',
    desc: '考生報考、主考評核、結果查詢（跳轉至 DBS 系統）。',
    tag: '外連', external: true,
  },
  {
    href: '/activity', icon: '📋', title: '旅團活動知會',
    desc: '將旅團戶外活動資料交區會存檔；已遞交嘅知會可喺本頁查看記錄（只顯示公開欄位）。',
    tag: '公開提交', external: false,
  },
];

export default function HomePage() {
  const { district, withDistrict } = useDistrict();

  return (
    <>
      <AnnouncementBanner />

      <div className="hero">
        <h1>{district?.name} — 成員服務 👋</h1>
        <p>呢度係區為旅團及成員提供嘅自助服務入口。填表即可提交，無需登入；區會收到後會跟進處理。</p>
        <SocialLinks
          links={district?.links}
          variant="hero"
          districtName={district?.name}
          showContact
          contactHref={withDistrict('/contact')}
        />
      </div>

      <section
        className="panel"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 16, flexWrap: 'wrap', borderLeft: '6px solid var(--p2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 38 }}>📢</div>
          <div>
            <h2 style={{ margin: 0 }}>查看通告</h2>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
              瀏覽總會、地域及各區嘅全港最新通告
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <a
            className="btn"
            href={ANNOUNCEMENT_URL}
            target="_blank"
            rel="noopener"
            style={{ width: 'auto', padding: '11px 20px' }}
          >
            📢 瀏覽全港最新通告
          </a>
          <PushSettings />
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
            有新通告時用手機或電腦通知我
          </span>
        </div>
      </section>

      <div className="grid">
        {SERVICES.map((s) =>
          s.external ? (
            <a key={s.title} className="card" href={s.href} target="_blank" rel="noopener">
              <span className="tag">{s.tag}</span>
              <div className="ico">{s.icon}</div>
              <h3>{s.title}</h3>
              <div className="desc">{s.desc}</div>
            </a>
          ) : (
            <Link key={s.title} className="card" href={withDistrict(s.href)}>
              <span className="tag pub">{s.tag}</span>
              <div className="ico">{s.icon}</div>
              <h3>{s.title}</h3>
              <div className="desc">{s.desc}</div>
            </Link>
          )
        )}
      </div>

      <p className="hint" style={{ marginTop: 22 }}>
        有疑問？<Link href={withDistrict('/contact')} style={{ color: 'var(--p2)', fontWeight: 700 }}>查看聯絡及查詢資料</Link>。
        所有申請由區職員審批，你提交嘅資料只供本區使用。
      </p>
    </>
  );
}
