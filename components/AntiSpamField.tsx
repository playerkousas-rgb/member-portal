'use client';

import type { SubmissionMeta } from '@/lib/types';

/**
 * 基本 honeypot。真正限流及系統鎖定檢查亦會在 /api/proxy 執行。
 */
export function AntiSpamField() {
  return (
    <div className="hp-field" aria-hidden="true">
      <label htmlFor="website">網站</label>
      <input id="website" name="_website" type="text" tabIndex={-1} autoComplete="off" />
    </div>
  );
}

export function getSubmissionMeta(form: HTMLFormElement, startedAt: number): SubmissionMeta {
  return {
    _website: String(new FormData(form).get('_website') || ''),
    _startedAt: startedAt,
  };
}
