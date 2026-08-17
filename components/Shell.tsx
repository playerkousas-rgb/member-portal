'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import DistrictPicker from '@/components/DistrictPicker';
import SocialLinks from '@/components/SocialLinks';
import { api } from '@/lib/api';
import {
  DISTRICT_LIST, MULTI_DISTRICT_MODE, PLATFORM_COPYRIGHT, PLATFORM_NAME,
  clearStoredDistrictCode, getDistrictStatusLabel,
  isDistrictCode, setStoredDistrictCode,
} from '@/lib/district';
import type { DistrictConfig, SystemState } from '@/lib/types';
import { useDistrict } from '@/lib/useDistrict';

const PUBLIC_PATHS = ['/', '/districts', '/guide'];
const NAV_ITEMS = [
  { href: '/', label: '🏠 公開服務' },
  { href: '/districts', label: '🌏 使用地區' },
  { href: '/guide', label: '📖 使用指南' },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { district, districtCode, hasDistrict, withDistrict } = useDistrict();
  const [config, setConfig] = useState<DistrictConfig | null>(null);
  const [system, setSystem] = useState<SystemState | null>(null);
  const [connectionError, setConnectionError] = useState(false);

  const currentQuery = useMemo(() => searchParams.toString(), [searchParams]);
  const isPublic = PUBLIC_PATHS.includes(pathname);
  const title = config?.districtName || district?.name || PLATFORM_NAME;

  useEffect(() => {
    if (!districtCode) {
      setConfig(null);
      setSystem(null);
      setConnectionError(false);
      return;
    }
    let cancelled = false;
    Promise.all([api.getConfig(), api.getSystem()]).then(([configResult, systemResult]) => {
      if (cancelled) return;
      if (configResult.ok && configResult.data) setConfig(configResult.data);
      if (systemResult.ok && systemResult.data) setSystem(systemResult.data);
      setConnectionError(!configResult.ok || !systemResult.ok);
    });
    return () => { cancelled = true; };
  }, [districtCode]);

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
    const query = params.toString();
    router.push(`${pathname}${query ? `?${query}` : ''}`);
  }

  const gateNeeded = !hasDistrict && !isPublic;

  return (
    <>
      <header className="shell-head">
        <div className="top">
          <div>
            <Link href={withDistrict('/')} className="brand" style={{ color: '#fff' }}>
              {config?.logoText || '🧭'} {title} — 成員服務
            </Link>
            <div className="sub">
              {MULTI_DISTRICT_MODE
                ? (district
                  ? `目前地區：${district.name}（${district.code}）· ${getDistrictStatusLabel(district.status)}`
                  : '未選擇地區')
                : '公開自助服務 · 無需登入'}
            </div>
          </div>
          {MULTI_DISTRICT_MODE && (
            <div className="ctrls">
              <select value={districtCode || ''} onChange={(event) => changeDistrict(event.target.value)}>
                <option value="">選擇地區…</option>
                {DISTRICT_LIST.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.name}（{item.code}）{item.status === 'disabled' ? '·暫停' : item.status === 'testing' ? '·測試' : ''}
                  </option>
                ))}
              </select>
              {districtCode && <button className="ghost" onClick={clearDistrict}>清除地區</button>}
            </div>
          )}
        </div>
        {MULTI_DISTRICT_MODE && (
          <nav className="shell-nav">
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={withDistrict(item.href)} className={pathname === item.href ? 'active' : ''}>
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <main className="shell-main">
        {connectionError && districtCode && !system?.locked && (
          <div className="warning-banner" role="status">
            ⚠️ 未能連接區會後台；資料讀取及表單提交可能暫時不可用。
          </div>
        )}

        {gateNeeded ? (
          <DistrictPicker
            title="呢個功能需要先選擇地區"
            description="每個地區使用自己嘅主 Sheet。請先選擇地區，再繼續使用公開服務。"
          />
        ) : system?.locked ? (
          <section className="maintenance-card" role="alert">
            <div className="maintenance-icon">🛠️</div>
            <h1>服務暫停</h1>
            <p>{system.lockMessage}</p>
            <p className="hint">系統解鎖後即可繼續讀取及提交表單。</p>
          </section>
        ) : children}
      </main>

      <footer className="shell-foot">
        <SocialLinks links={district?.links} variant="footer" districtName={district?.name} />
        <div>{PLATFORM_COPYRIGHT}</div>
        <div style={{ marginTop: 6 }}>公開成員服務 · 所有管理及批核由區管理系統處理</div>
        <div style={{ marginTop: 8 }}>
          <Link href={withDistrict('/guide')} style={{ color: '#64748b', fontSize: 12 }}>使用指南</Link>
        </div>
      </footer>
    </>
  );
}
