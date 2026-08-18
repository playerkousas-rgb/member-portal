import Link from 'next/link';

const SOURCE_URL = 'https://www.skwscout.org.hk/%e7%ad%b2%e7%ae%95%e7%81%a3%e5%8d%80%e6%88%90%e7%ab%8b%e5%8f%8a%e7%99%bc%e5%b1%95%e5%8f%b2/%e8%81%af%e7%b5%a1%e5%8f%8a%e6%9f%a5%e8%a9%a2/';

const CONTACTS = [
  { label: '一般查詢', email: 'info@skwscout.org.hk' },
  { label: '區總監', email: 'dc@skwscout.org.hk' },
  { label: '副區總監（行政）', email: 'ddc.admin@skwscout.org.hk' },
  { label: '副區總監（訓練）', email: 'ddc.training@skwscout.org.hk' },
  { label: '小童軍支部', email: 'adc.gh@skwscout.org.hk' },
  { label: '幼童軍支部', email: 'adc.cub@skwscout.org.hk' },
  { label: '童軍支部', email: 'adc.scout@skwscout.org.hk' },
  { label: '深資童軍支部', email: 'adc.venture@skwscout.org.hk' },
  { label: '樂行童軍支部', email: 'adc.rover@skwscout.org.hk' },
  { label: '網頁管理', email: 'it@skwscout.org.hk' },
];

export default function ContactPage() {
  return (
    <>
      <Link href="/" className="backlink">← 返回服務首頁</Link>
      <h1 className="page-title">☎️ 聯絡及查詢</h1>
      <p className="page-sub">香港童軍總會筲箕灣區聯絡資料</p>

      <section className="contact-primary">
        <a className="contact-primary-card" href="tel:+85225579838">
          <span className="contact-icon">☎</span>
          <span><small>電話</small><strong>2557 9838</strong></span>
        </a>
        <div className="contact-primary-card">
          <span className="contact-icon">📠</span>
          <span><small>傳真</small><strong>3747 2924</strong></span>
        </div>
        <a className="contact-primary-card" href="mailto:info@skwscout.org.hk">
          <span className="contact-icon">✉</span>
          <span><small>一般查詢</small><strong>info@skwscout.org.hk</strong></span>
        </a>
      </section>

      <section className="panel">
        <div className="section-heading-row">
          <div>
            <div className="eyebrow">按查詢類別聯絡</div>
            <h2>部門及支部電郵</h2>
          </div>
        </div>
        <div className="contact-list">
          {CONTACTS.map((contact) => (
            <a key={contact.email} className="contact-row" href={`mailto:${contact.email}`}>
              <span>{contact.label}</span>
              <strong>{contact.email}</strong>
              <span aria-hidden="true">↗</span>
            </a>
          ))}
        </div>
      </section>

      <p className="source-note">
        資料來源：
        <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">筲箕灣區官方網站「聯絡及查詢」</a>
      </p>
    </>
  );
}
