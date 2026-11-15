const KEY_PREFIX = 'mp:card-order:';

export function cardOrderStorageKey(districtCode: string): string {
  const normalized = String(districtCode || '').trim().toUpperCase();
  return `${KEY_PREFIX}${normalized || 'DEFAULT'}`;
}

export function loadCardOrder(districtCode: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(cardOrderStorageKey(districtCode));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
  } catch {
    return [];
  }
}

export function saveCardOrder(districtCode: string, ids: readonly string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(cardOrderStorageKey(districtCode), JSON.stringify([...ids]));
  } catch {
    // 瀏覽器隱私模式或配額已滿時靜默略過
  }
}

export function clearCardOrder(districtCode: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(cardOrderStorageKey(districtCode));
  } catch {
    // 忽略儲存區錯誤
  }
}

export function applyCardOrder<T extends { id: string }>(
  defaults: readonly T[],
  savedIds: readonly string[],
): T[] {
  if (!savedIds.length) return [...defaults];
  const byId = new Map(defaults.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const ordered: T[] = [];
  for (const id of savedIds) {
    const item = byId.get(id);
    if (item && !seen.has(id)) {
      ordered.push(item);
      seen.add(id);
    }
  }
  for (const item of defaults) {
    if (!seen.has(item.id)) ordered.push(item);
  }
  return ordered;
}

export function moveCardInList<T>(items: readonly T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return [...items];
  }
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function isCustomCardOrder<T extends { id: string }>(
  items: readonly T[],
  defaults: readonly T[],
): boolean {
  if (items.length !== defaults.length) return true;
  return items.some((item, index) => item.id !== defaults[index].id);
}
