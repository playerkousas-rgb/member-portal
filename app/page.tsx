'use client';
import Link from 'next/link';
import SocialLinks from '@/components/SocialLinks';
import { useDistrict } from '@/lib/useDistrict';

const ANNOUNCEMENT_URL = 'https://scout-circulars.vercel.app/';

const SERVICES = [
  {
    href: '/venue', icon: '🏛', title: '借用區總部',
    desc: '先用 Teamup 查看區總部行事曆，再填寫場地借用申請。',
    tag: '查看／提交', external: false,
  },
  {
    href: '/stock', icon: '📦', title: '借用物資',
    desc: '填一次申請人資料，可同時為多款 Sheet 物資填數量並一併遞交。',
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
    desc: '查看公開知會，或將旅團戶外活動資料提交到主 Sheet 存檔。',
    tag: '查看／提交', external: false,
  },
  {
    href: '/rules', icon: '📘', title: '守則及指引',
    desc: '借場規則、場地使用條件、閉路電視指引及借物資規定（內建）。',
    tag: '查閱', external: false,
  },
  {
    href: '/contact', icon: '☎️', title: '聯絡及查詢',
    desc: '查看區總部電話、傳真及各部門電郵聯絡資料。',
    tag: '聯絡資料', external: false,
  },
];

export default function HomePage() {
  const { district, withDistrict } = useDistrict();

  return (
    <>
      <div className="hero">
        <h1>{district?.name} — 成員服務 👋</h1>
        <p>呢度係區為旅團及成員提供嘅自助服務入口。填表即可提交，無需登入；區會收到後會跟進處理。</p>
        <SocialLinks links={district?.links} variant="hero" districtName={district?.name} />
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
        <a
          className="btn"
          href={ANNOUNCEMENT_URL}
          target="_blank"
          rel="noopener"
          style={{ width: 'auto', padding: '11px 20px' }}
        >
          📢 瀏覽全港最新通告
        </a>
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
