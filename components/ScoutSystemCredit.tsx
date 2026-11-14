'use client';
import Link from 'next/link';

/**
 * 借用服務嘅來源標示（W8：第三方服務要標來源）。
 * 「我的紀錄冊／查看通告／GEMINI 輔助系統／SCOUT APP STORE」都係借用自
 * Scout System（© 2026 Scout System），唔係本區服務平台自研。
 * 用戶確認：Scout System 嘅來源網址就係 SCOUT APP STORE 個網址，
 * 所以牌子名直接連去 https://scoutappstore.vercel.app/；唔用其他
 * 未確認嘅品牌網域。四個服務各自亦連去原站／入口。
 */
export const SCOUT_SYSTEM_URL = 'https://scoutappstore.vercel.app/';
export const SCOUT_APP_STORE_URL = SCOUT_SYSTEM_URL;

export const BORROWED_SERVICES = [
  { label: '我的紀錄冊', href: '/books', external: false },
  { label: '查看通告', href: 'https://scout-circulars.vercel.app/', external: true },
  { label: 'GEMINI 輔助系統', href: 'https://gemini-woad-sigma.vercel.app/', external: true },
  { label: 'SCOUT APP STORE', href: SCOUT_SYSTEM_URL, external: true },
] as const;

function externalProps() {
  return { target: '_blank', rel: 'noopener noreferrer' } as const;
}

export default function ScoutSystemCredit({ variant = 'bar' }: { variant?: 'bar' | 'inline' }) {
  if (variant === 'inline') {
    return (
      <p className="scout-credit scout-credit-inline" role="note">
        借用自{' '}
        <a href={SCOUT_SYSTEM_URL} {...externalProps()}>Scout System</a>
        {' '}（© 2026 Scout System）· 資料及更新由原系統提供
      </p>
    );
  }

  return (
    <p className="scout-credit" role="note">
      <strong>服務來源：</strong>
      {BORROWED_SERVICES.map((service, index) => (
        <span key={service.label}>
          {index > 0 ? ' · ' : ''}
          {service.external ? (
            <a href={service.href} {...externalProps()}>{service.label}</a>
          ) : (
            <Link href={service.href}>{service.label}</Link>
          )}
        </span>
      ))}
      {' '}均借用自{' '}
      <a href={SCOUT_SYSTEM_URL} {...externalProps()}>Scout System</a>
      {' '}（© 2026 Scout System），資料及更新由各原系統提供。
    </p>
  );
}
