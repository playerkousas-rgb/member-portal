// 職員 session（localStorage）
import type { StaffSession } from './types';
import { resolveDistrictCode } from './district';

function key() {
  const code = resolveDistrictCode() || 'NONE';
  return `member_staff_session_${code}`;
}

export function saveSession(s: StaffSession) {
  if (typeof window !== 'undefined') localStorage.setItem(key(), JSON.stringify(s));
}
export function loadSession(): StaffSession | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(key());
  if (!raw) return null;
  try { return JSON.parse(raw) as StaffSession; } catch { return null; }
}
export function clearSession() {
  if (typeof window !== 'undefined') localStorage.removeItem(key());
}
