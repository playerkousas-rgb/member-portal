'use client';
import Link from 'next/link';
import { useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import DistrictPicker from '@/components/DistrictPicker';
import {
  DISTRICT_LIST, MULTI_DISTRICT_MODE, PLATFORM_COPYRIGHT, PLATFORM_NAME,
  clearStoredDistrictCode, getDistrictStatusLabel,
  isDistrictCode, setStoredDistrictCode,
} from '@/lib/district';
import { useDistrict } from '@/lib/useDistrict';

// 不需選區即可瀏覽的公開頁
const PUBLIC_PATHS = ['/', '/setup', '/districts', '/updates', '/downloads', '/guide'];

const ALL_NAV_ITEMS = [
  { href: '/', label: '🏠 主控台' },
  { href: '/setup', label: '🧩 區接入' },
  { href: '/districts', label: '🌏 使用地區' },
  { href: '/updates', label: '📢 更新' },
  { href: '/downloads', label: '⬇️ 下載' },
];

// 單區模式：隱藏「區接入」「使用地區」等對外呈現多區的入口
const navItems = MULTI_DISTRICT_MODE
  ? ALL_NAV_ITEMS
  : ALL_NAV_ITEMS.filter((it) => it.href === '/' || it.href === '/updates' || it.href === '/downloads');

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { district, districtCode, hasDistrict, withDistrict } = useDistrict();

  const isPublic = PUBLIC_PATHS.includes(pathname);
  const title = district ? `${district.name} — 成員服務` : PLATFORM_NAME;
  const currentQuery = useMemo(() => searchParams.toString(), [searchParams]);

  function changeDistrict(code: string) {
    if (!isDistrictCode(code)) return;
    setStoredDistrictCode(code);
    const params = new URLSearchParams(currentQuery);
    params.set('d', code);
    router.push(`${pathname}?${params.toString()}`);
  }
  function clearDistrict() {
    clearStoredDistrictCode();
    const params = new URLSearchParams(currentQuery);
    params.delete('d');
    const q = params.toString();
    router.push(`${pathname}${q ? `?${q}` : ''}`);
  }

  const gateNeeded = !hasDistrict && !isPublic;

  return (
    <>
      <header className="shell-head">
        <div className="top">
          <div>
            <Link href={withDistrict('/')} className="brand" style={{ color: '#fff' }}>
              🧭 {title}
            </Link>
            <div className="sub">
              {MULTI_DISTRICT_MODE
                ? (district
                  ? `目前地區：${district.name}（${district.code}）· ${getDistrictStatusLabel(district.status)}`
                  : '未選擇地區')
                : '旅團及成員自助服務'}
            </div>
          </div>
          <div className="ctrls">
            {MULTI_DISTRICT_MODE && (
              <select value={districtCode || ''} onChange={(e) => changeDistrict(e.target.value)}>
                <option value="">選擇地區…</option>
                {DISTRICT_LIST.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.name}（{d.code}）{d.status === 'disabled' ? '·暫停' : d.status === 'testing' ? '·測試' : ''}
                  </option>
                ))}
              </select>
            )}
            {MULTI_DISTRICT_MODE && districtCode && <button className="ghost" onClick={clearDistrict}>清除地區</button>}
            <Link href="/staff" className="ctrl">🔐 職員入口</Link>
          </div>
        </div>
        <nav className="shell-nav">
          {navItems.map((it) => (
            <Link key={it.href} href={withDistrict(it.href)} className={pathname === it.href ? 'active' : ''}>
              {it.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="shell-main">
        {gateNeeded ? (
          <DistrictPicker
            title="呢個功能需要先選擇地區"
            description="每個地區都有自己獨立的後台資料。請先選擇你所屬地區，再繼續使用。"
          />
        ) : (
          children
        )}
      </main>

      <footer className="shell-foot">
        <div>{PLATFORM_COPYRIGHT}</div>
        {MULTI_DISTRICT_MODE && <div style={{ marginTop: 6 }}>Multi-district platform powered by SKWSCOUT SYSTEM</div>}
      </footer>
    </>
  );
}
