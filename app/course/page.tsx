import { redirect } from 'next/navigation';

/** 保留舊連結；訓練班唯一公開入口為 /training。 */
export default function LegacyCoursePage() {
  redirect('/training');
}
