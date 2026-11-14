'use client';
import Link from 'next/link';
import AnnouncementBanner from '@/components/AnnouncementBanner';
import PushSettings from '@/components/PushSettings';
import SocialLinks from '@/components/SocialLinks';
import InstallPrompt from '@/components/InstallPrompt';
import ScoutSystemCredit from '@/components/ScoutSystemCredit';
import { useDistrict } from '@/lib/useDistrict';

const ANNOUNCEMENT_URL = 'https://scout-circulars.vercel.app/';

const SERVICES = [
  {
    href: '/books', icon: '📚', title: '我的紀錄冊', borrowed: true,
    tag: '個人紀錄', external: false,
  },
  {
    href: '/venue', icon: '🏛', title: '借用區總部',
    tag: '查看／提交', external: false,
  },
  {
    href: '/stock', icon: '📦', title: '借用物資',
    tag: '公開提交', external: false,
  },
  {
    href: '/training', icon: '🎓', title: '訓練班報名',
    tag: '公開報名', external: false,
  },
  {
    href: 'https://districtbadgesystem30.vercel.app/', icon: '🎖', title: '專科徽章系統',
    tag: '外連', external: true,
  },
  {
    href: 'https://gemini-woad-sigma.vercel.app/', icon: '✨', title: 'GEMINI 輔助系統', borrowed: true,
    tag: '外連', external: true,
  },
  {
    href: 'https://scoutappstore.vercel.app/', icon: '🧰', title: 'SCOUT APP STORE', borrowed: true,
    tag: '外連', external: true,
  },
  {
    href: '/activity', icon: '📋', title: '旅團活動知會',
    tag: '公開提交', external: false,
  },
  {
    href: '/troops', icon: '🧭', title: '區內旅團',
    tag: '公開名錄', external: false,
  },
  {
    href: '/contact-district', icon: '📨', title: '聯絡區會',
    tag: '公開提交', external: false,
  },
  {
    href: '/feedback', icon: '💬', title: '你講我聽',
    tag: '匿名留言', external: false,
  },
];

export default function HomePage() {
  const { district, withDistrict } = useDistrict();

  return (
    <>
      <AnnouncementBanner />

      <div className="hero">
        <h1>{district?.name ? `${district.name} — 服務平台` : '服務平台'} 👋</h1>
        <p>呢度係區為旅團及成員提供嘅自助服務入口。填表即可提交，無需登入；區會收到後會跟進處理。</p>
        <SocialLinks
          links={district?.links}
          variant="hero"
          districtName={district?.name}
          showContact
          contactHref={withDistrict('/contact')}
        />
      </div>

      <InstallPrompt />

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
            <ScoutSystemCredit variant="inline" />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <a
            className="btn"
            href={ANNOUNCEMENT_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ width: 'auto', padding: '11px 20px' }}
          >
            📢 瀏覽全港最新通告
          </a>
          <PushSettings />
        </div>
      </section>

      <div className="grid">
        {SERVICES.map((s) =>
          s.external ? (
            <a key={s.title} className="card" href={s.href} target="_blank" rel="noopener noreferrer">
              <span className="tag">{s.tag}</span>
              <div className="ico">{s.icon}</div>
              <h3>{s.title}</h3>
              {'borrowed' in s && s.borrowed && <span className="src">Scout System</span>}
            </a>
          ) : (
            <Link key={s.title} className="card" href={withDistrict(s.href)}>
              <span className="tag pub">{s.tag}</span>
              <div className="ico">{s.icon}</div>
              <h3>{s.title}</h3>
              {'borrowed' in s && s.borrowed && <span className="src">Scout System</span>}
            </Link>
          )
        )}
      </div>

      <ScoutSystemCredit />

      <p className="hint" style={{ marginTop: 22 }}>
        有疑問？<Link href={withDistrict('/contact')} style={{ color: 'var(--p2)', fontWeight: 700 }}>查看聯絡及查詢資料</Link>。
        所有申請由區職員審批，你提交嘅資料只供本區使用。
      </p>
    </>
  );
}
