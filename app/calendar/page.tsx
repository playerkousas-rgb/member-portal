'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { useDistrict } from '@/lib/useDistrict';

/** 保留舊網址，統一將使用者帶到借場頁內的 Teamup 行事曆。 */
export default function CalendarPage() {
  const { withDistrict } = useDistrict();
  const destination = withDistrict('/venue#availability');

  useEffect(() => {
    window.location.replace(destination);
  }, [destination]);

  return (
    <div className="center">
      <div className="spinner" />
      <p>正在前往借用區總部行事曆…</p>
      <Link className="backlink" href={destination}>按此繼續</Link>
    </div>
  );
}
