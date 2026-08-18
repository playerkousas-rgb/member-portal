import Link from 'next/link';

const RULES = [
  {
    href: '/rules/venue',
    icon: '🏛',
    title: '借場規則及程序',
    desc: '區總部場地借用用途、時間、手續及使用場地守則。',
    meta: '修訂 12/2022',
  },
  {
    href: '/rules/venue-terms',
    icon: '📜',
    title: '場地一般使用條件',
    desc: '借用團體須遵守嘅一般使用條件及責任。',
    meta: '修訂 03/2014',
  },
  {
    href: '/rules/cctv',
    icon: '📹',
    title: '閉路電視監察措施指引',
    desc: '區總部閉路電視嘅用途、監察、錄影及紀錄處理。',
    meta: '修訂 12/2022',
  },
  {
    href: '/rules/stock',
    icon: '📦',
    title: '借物資規定',
    desc: '區物資借用資格、申請方法、領取及歸還須知。',
    meta: '筲箕灣區版本',
  },
];

export default function RulesPage() {
  return (
    <>
      <Link href="/" className="backlink">← 返回服務首頁</Link>
      <h1 className="page-title">📘 守則及指引</h1>
      <p className="page-sub">以下守則內容已內建於本平台，供旅團及成員查閱。</p>

      <div className="rules-grid">
        {RULES.map((rule) => (
          <Link key={rule.href} href={rule.href} className="rule-card">
            <div className="r-ico">{rule.icon}</div>
            <h3>{rule.title}</h3>
            <div className="r-desc">{rule.desc}</div>
            <span className="r-meta">{rule.meta}</span>
          </Link>
        ))}
      </div>

      <p className="hint" style={{ marginTop: 22 }}>
        守則如有修訂，以區會公佈為準。有疑問請聯絡區總部職員。
      </p>
    </>
  );
}
