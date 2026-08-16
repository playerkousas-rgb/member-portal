'use client';
import Link from 'next/link';
import { useDistrict } from '@/lib/useDistrict';
import DistrictPicker from '@/components/DistrictPicker';

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
    href: '/course', icon: '🎓', title: '報讀訓練班',
    desc: '瀏覽開辦中嘅班，網上報名，FPS 繳費後上傳入數紙。',
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

const INFO_LINKS = [
  { href: '/setup', icon: '🧩', title: '區接入教學', desc: '其他區如欲使用本平台，可先查看接入流程、初始化方式及提交方法。' },
  { href: '/downloads', icon: '⬇️', title: '模板下載', desc: '直接下載或複製初始後台模板（Code.gs），供其他區建立空白 Sheet。' },
  { href: '/districts', icon: '🌏', title: '現已使用地區', desc: '查看目前已開通或測試中的地區。' },
  { href: '/updates', icon: '📢', title: '更新公告', desc: '平台版本與更新紀錄。' },
  { href: '/guide', icon: '📖', title: '使用指南', desc: '成員及職員的基本操作說明。' },
];

export default function HomePage() {
  const { district, hasDistrict, withDistrict } = useDistrict();

  // 未揀區：顯示揀區 + 資訊連結
  if (!hasDistrict) {
    return (
      <>
        <DistrictPicker />
        <h2 style={{ color: '#003366', fontSize: 16, margin: '26px 0 12px' }}>平台資訊</h2>
        <div className="grid">
          {INFO_LINKS.map((i) => (
            <Link key={i.href} className="card" href={i.href}>
              <div className="ico">{i.icon}</div>
              <h3>{i.title}</h3>
              <div className="desc">{i.desc}</div>
            </Link>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="hero">
        <h1>{district?.name} — 成員服務 👋</h1>
        <p>呢度係區為旅團及成員提供嘅自助服務。大部分服務填表即可提交，無需登入；由區職員喺後台批核。</p>
      </div>

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

      <h2 style={{ color: '#003366', fontSize: 16, margin: '26px 0 12px' }}>相關資訊</h2>
      <div className="grid">
        {INFO_LINKS.map((i) => (
          <Link key={i.href} className="card" href={withDistrict(i.href)}>
            <div className="ico">{i.icon}</div>
            <h3>{i.title}</h3>
            <div className="desc">{i.desc}</div>
          </Link>
        ))}
      </div>

      <p className="hint" style={{ marginTop: 22 }}>
        有疑問？請聯絡區總部職員。所有申請由區職員審批，你提交嘅資料只供本區使用。
      </p>
    </>
  );
}
