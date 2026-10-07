import './globals.css';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import Script from 'next/script';
import Shell from '@/components/Shell';

export const metadata: Metadata = {
  title: '成員服務門戶',
  description: '筲箕灣區公開成員服務：通告、聯絡資料、場地及物資借用、訓練班報名及旅團活動知會',
  manifest: '/manifest.webmanifest',
  themeColor: '#02133e',
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
  other: { 'apple-mobile-web-app-capable': 'yes', 'apple-mobile-web-app-title': '童軍成員服務' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>
        <Suspense fallback={<div className="center"><div className="spinner" /></div>}>
          <Shell>{children}</Shell>
        </Suspense>
        {/* Scout Admin 統一回報系統（scout-admin repo）：一行 widget，data-app 認來源。
            資料直接送去區會 Apps Script 接收端，唔經本站後端、唔使 API key、可以匿名。 */}
        <Script
          src="https://scout-admin-blue.vercel.app/widget.js"
          data-app="成員系統"
          strategy="lazyOnload"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(function(){})}`,
          }}
        />
      </body>
    </html>
  );
}
