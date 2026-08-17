import type { DistrictLinks } from '@/lib/district';

type Variant = 'footer' | 'hero' | 'panel';

const ITEMS: Array<{
  key: keyof DistrictLinks;
  label: string;
  short: string;
  className: string;
}> = [
  { key: 'instagram', label: 'Instagram', short: 'IG', className: 'social-ig' },
  { key: 'facebook', label: 'Facebook', short: 'FB', className: 'social-fb' },
  { key: 'website', label: '區會網頁', short: '網頁', className: 'social-web' },
];

function Icon({ kind }: { kind: keyof DistrictLinks }) {
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
}: {
  links?: DistrictLinks;
  variant?: Variant;
  districtName?: string;
}) {
  const available = ITEMS.filter((item) => !!links?.[item.key]);
  if (!available.length) return null;

  const heading = districtName ? `關注${districtName}` : '關注區會';

  return (
    <div className={`social-links social-${variant}`}>
      {variant !== 'footer' && <div className="social-heading">{heading}</div>}
      <div className="social-row">
        {available.map((item) => (
          <a
            key={item.key}
            className={`social-btn ${item.className}`}
            href={links?.[item.key]}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${heading} ${item.label}`}
            title={item.label}
          >
            <span className="social-ico">
              <Icon kind={item.key} />
            </span>
            <span className="social-label">
              <strong>{item.short}</strong>
              <em>{item.label}</em>
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
