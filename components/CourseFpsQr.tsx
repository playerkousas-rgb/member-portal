'use client';
/**
 * 訓練班收費 FPS QR（成員系統顯示端）
 * 資料來源：管理系統「訓練班管理」為每班生成並儲存喺 CourseLinks 嘅
 * fpsQrPayload / fpsAmount / fpsReference / fpsAccountName / fpsAccountNumber。
 * 呢度只負責畫 QR 同顯示戶口／銀碼，唔會自己計 payload。
 */
import { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import type { CourseLink } from '@/lib/types';

export default function CourseFpsQr({ course }: { course: CourseLink }) {
  const ref = useRef<HTMLDivElement>(null);
  const [msg, setMsg] = useState('');
  if (!course.fpsQrPayload) return null;
  const amount = course.fpsAmount || String(course.fee || '');

  async function download() {
    const canvas = ref.current?.querySelector('canvas');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url; a.download = `fps-${course.courseNo || course.courseId}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    setMsg('QR 已下載，可在銀行 App「掃描相簿圖片」付款。');
  }
  async function copy(text: string, label: string) {
    try { await navigator.clipboard.writeText(text); setMsg(`${label}已複製`); } catch { setMsg('此瀏覽器不支援複製'); }
  }

  return (
    <div className="course-fps">
      <div ref={ref} className="course-fps-qr">
        <QRCodeCanvas value={course.fpsQrPayload} size={480} level="M" marginSize={4} style={{ width: '100%', height: 'auto', display: 'block' }} />
      </div>
      <div className="course-fps-info">
        <div className="course-fps-amt">HK$ {amount}</div>
        <div className="course-fps-row"><span>收款戶口</span><b>{course.fpsAccountName || '—'}</b></div>
        <div className="course-fps-row"><span>FPS ID</span><b>{course.fpsAccountNumber || '—'}</b>{course.fpsAccountNumber && <button type="button" onClick={() => copy(course.fpsAccountNumber!, 'FPS ID ')}>複製</button>}</div>
        {course.fpsReference && <div className="course-fps-row"><span>付款參考</span><b>{course.fpsReference}</b><button type="button" onClick={() => copy(course.fpsReference!, '參考編號')}>複製</button></div>}
        <div className="course-fps-help">
          用銀行／轉數快 App 掃描上方 QR（銀碼同參考已預設），或手動輸入 FPS ID 轉賬 <b>HK$ {amount}</b>，備註填課程編號。
          完成後請截圖入數紙，喺下方上傳。
        </div>
        <div className="course-fps-actions">
          <button type="button" className="btn-sm" onClick={download}>⬇️ 儲存 QR 圖片</button>
        </div>
        {msg && <div className="course-fps-msg">✓ {msg}</div>}
      </div>
    </div>
  );
}
