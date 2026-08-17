import Link from 'next/link';
import { DISTRICT_LIST, getDistrictStatusColor, getDistrictStatusLabel } from '@/lib/district';

export default function DistrictsPage() {
  return (
    <>
      <Link href="/" className="backlink">← 返回服務首頁</Link>
      <h1 className="page-title">🌏 使用地區</h1>
      <p className="page-sub">每區嘅成員系統會同該區管理系統共用同一張主 Sheet 及同一個 Apps Script /exec；不同區之間資料互不相通。</p>
      <section className="panel">
        {DISTRICT_LIST.map((district) => (
          <div className="item-row" key={district.code}>
            <span className="iname">{district.name}</span>
            <span className="icat">{district.code}</span>
            <span className="pill" style={{ background: getDistrictStatusColor(district.status), color: '#fff' }}>
              {getDistrictStatusLabel(district.status)}
            </span>
          </div>
        ))}
      </section>
    </>
  );
}
