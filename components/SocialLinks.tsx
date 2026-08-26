import Link from 'next/link';
import type { DistrictLinks } from '@/lib/district';

type Variant = 'footer' | 'hero' | 'panel';

type SocialKey = keyof DistrictLinks | 'contact';

interface SocialItemConfig {
  key: SocialKey;
  label: string;
  short: string;
  className: string;
  defaultHref?: string;
  isExternal?: boolean;
}

const ITEMS: SocialItemConfig[] = [
  { key: 'instagram', label: 'Instagram', short: 'IG', className: 'social-ig', isExternal: true },
  { key: 'facebook', label: 'Facebook', short: 'FB', className: 'social-fb', isExternal: true },
  { key: 'website', label: '區會網頁', short: '網頁', className: 'social-web', isExternal: true },
  { key: 'contact', label: '聯絡及查詢', short: '查詢', className: 'social-contact', defaultHref: '/contact', isExternal: false },
];

function Icon({ kind }: { kind: SocialKey }) {
  if (kind === 'instagram') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="4.1" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="17.15" cy="6.85" r="1.05" fill="currentColor" />
      </svg>
    );
  }
  if (kind === 'facebook') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M14.6 8.4V6.7c0-.7.5-1 1.2-1h1.7V3h-2.9C11.8 3 11 5 11 6.8v1.6H9v2.7h2V21h3.6v-9.9h2.5l.4-2.7h-2.9z"
        />
      </svg>
    );
  }
  if (kind === 'contact') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
        <path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <ellipse cx="12" cy="12" rx="3.4" ry="8.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4.2 12h15.6M5.1 8.2h13.8M5.1 15.8h13.8" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export default function SocialLinks({
  links,
  variant = 'footer',
  districtName,
  showContact,
  contactHref,
}: {
  links?: DistrictLinks;
  variant?: Variant;
  districtName?: string;
  showContact?: boolean;
  contactHref?: string;
}) {
  const shouldIncludeContact = showContact ?? (variant === 'hero');

  const resolvedItems = ITEMS.map((item) => {
    if (item.key === 'contact') {
      if (!shouldIncludeContact) return null;
      const href = contactHref || links?.contact || item.defaultHref || '/contact';
      return { ...item, href };
    }
    const href = links?.[item.key as keyof DistrictLinks];
    if (!href) return null;
    return { ...item, href };
  }).filter((item): item is SocialItemConfig & { href: string } => !!item);

  if (!resolvedItems.length) return null;

  const hasContact = resolvedItems.some((item) => item.key === 'contact');
  const heading = districtName
    ? (hasContact ? `關注及聯絡${districtName}` : `關注${districtName}`)
    : (hasContact ? '關注及聯絡區會' : '關注區會');

  return (
    <div className={`social-links social-${variant}`}>
      {variant !== 'footer' && <div className="social-heading">{heading}</div>}
      <div className="social-row">
        {resolvedItems.map((item) => {
          const isInternal = !item.isExternal && item.href.startsWith('/');
          const content = (
            <>
              <span className="social-ico">
                <Icon kind={item.key} />
              </span>
              <span className="social-label">
                <strong>{item.short}</strong>
                <em>{item.label}</em>
              </span>
            </>
          );

          if (isInternal) {
            return (
              <Link
                key={item.key}
                className={`social-btn ${item.className}`}
                href={item.href}
                aria-label={`${districtName || '區會'} ${item.label}`}
                title={item.label}
              >
                {content}
              </Link>
            );
          }

          return (
            <a
              key={item.key}
              className={`social-btn ${item.className}`}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${districtName || '區會'} ${item.label}`}
              title={item.label}
            >
              {content}
            </a>
          );
        })}
      </div>
    </div>
  );
}
