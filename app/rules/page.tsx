'use client';
import Link from 'next/link';
import { useDistrict } from '@/lib/useDistrict';

const RULES = [
  {
    href: '/rules/venue',
    icon: '🏛',
    title: '借場規則及程序',
    meta: '修訂 12/2022',
  },
  {
    href: '/rules/venue-terms',
    icon: '📜',
    title: '場地一般使用條件',
    meta: '修訂 03/2014',
  },
  {
    href: '/rules/cctv',
    icon: '📹',
    title: '閉路電視監察措施指引',
    meta: '修訂 12/2022',
  },
  {
    href: '/rules/stock',
    icon: '📦',
    title: '借物資規定',
    meta: '筲箕灣區版本',
  },
];

export default function RulesPage() {
  const { withDistrict } = useDistrict();

  return (
    <>
      <Link href={withDistrict('/')} className="backlink">← 返回服務首頁</Link>
      <h1 className="page-title">📘 守則及指引</h1>
      <p className="page-sub">以下守則內容已內建於借用區總部及借用物資頁面，供旅團及成員查閱。</p>

      <div className="rules-grid">
        {RULES.map((rule) => (
          <Link key={rule.href} href={withDistrict(rule.href)} className="rule-card">
            <div className="r-ico">{rule.icon}</div>
            <h3>{rule.title}</h3>
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
