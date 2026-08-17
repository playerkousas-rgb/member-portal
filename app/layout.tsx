import './globals.css';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import Shell from '@/components/Shell';

export const metadata: Metadata = {
  title: '成員服務門戶',
  description: '無需登入嘅公開服務：借用場地、借用物資、訓練班報名及旅團活動知會',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>
        <Suspense fallback={<div className="center"><div className="spinner" /></div>}>
          <Shell>{children}</Shell>
        </Suspense>
      </body>
    </html>
  );
}
