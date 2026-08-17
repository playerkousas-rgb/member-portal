'use client';
import Link from 'next/link';
import { useDistrict } from '@/lib/useDistrict';

const ANNOUNCEMENT_URL = 'https://scout-circulars.vercel.app/';

const SERVICES = [
  {
    href: '/venue', icon: '🏛', title: '借用場地',
    desc: '喺 TeamUp 登記時間，經呢度交表。批核後電子鎖密碼會自動發送俾你。',
    tag: '自助', external: false,
  },
  {
    href: '/stock', icon: '📦', title: '借用物資',
    desc: '睇吓有咩物資可以借，揀好數量同日期，交表等職員批核。',
    tag: '自助', external: false,
  },
  {
    href: '/training', icon: '🎓', title: '訓練班報名',
    desc: '瀏覽開辦中嘅訓練班，網上報名，FPS 繳費後上傳入數紙。',
    tag: '自助', external: false,
  },
  {
    href: 'https://districtbadgesystem30.vercel.app/', icon: '🎖', title: '專科徽章系統',
    desc: '考生報考、主考評核、結果查詢（跳轉至 DBS 系統）。',
    tag: '外連', external: true,
  },
  {
    href: '/activity', icon: '📋', title: '旅團活動知會',
    desc: '戶外活動（參觀、露營、遠足）書面知會區會存檔，直接喺呢度填表。',
    tag: '自助', external: false,
  },
];

export default function HomePage() {
  const { district, withDistrict } = useDistrict();

  return (
    <>
      <div className="hero">
        <h1>{district?.name} — 成員服務 👋</h1>
        <p>呢度係區為旅團及成員提供嘅自助服務入口。填表即可提交，無需登入；區會收到後會跟進處理。</p>
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
              瀏覽最新通告
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
          📢 瀏覽最新通告
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
        有疑問？請聯絡區總部職員。所有申請由區職員審批，你提交嘅資料只供本區使用。
      </p>
    </>
  );
}
