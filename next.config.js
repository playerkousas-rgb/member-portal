/** @type {import('next').NextConfig} */

/**
 * 區官網行事曆頁（https://www.skwscout.org.hk/行事曆/）以 iframe 嵌入本站 /venue。
 * 用 CSP frame-ancestors 明確放行區官網（www 及非 www）＋本站自己；
 * 其他網站一律禁止嵌入，防止 clickjacking。
 *
 * 注意：千祈唔好加 X-Frame-Options——ALLOW-FROM 早已廢棄，現代瀏覽器一律唔理，
 * 加 DENY／SAMEORIGIN 只會直接封死區官網嵌入。frame-ancestors 係唯一正確做法。
 */
const EMBED_FRAME_ANCESTORS = [
  "'self'",
  'https://www.skwscout.org.hk',
  'https://skwscout.org.hk',
].join(' ');

const nextConfig = {
  images: { unoptimized: true },
  async headers() {
    return [
      {
        // 所有頁面（包括 /venue、/calendar 及任何未來想嵌入區官網嘅頁）＋ API 都跟同一政策。
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: `frame-ancestors ${EMBED_FRAME_ANCESTORS}` },
        ],
      },
    ];
  },
};
module.exports = nextConfig;
