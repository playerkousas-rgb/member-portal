import './globals.css';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import Shell from '@/components/Shell';

export const metadata: Metadata = {
  title: '成員服務門戶',
  description: '筲箕灣區公開成員服務：通告、聯絡資料、場地及物資借用、訓練班報名及旅團活動知會',
  manifest: '/manifest.webmanifest',
  themeColor: '#02133e',
  other: { 'apple-mobile-web-app-capable': 'yes', 'apple-mobile-web-app-title': '童軍成員服務' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>
        <Suspense fallback={<div className="center"><div className="spinner" /></div>}>
          <Shell>{children}</Shell>
        </Suspense>
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(function(){})}`,
          }}
        />
      </body>
    </html>
  );
}
