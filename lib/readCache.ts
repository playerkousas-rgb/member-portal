/**
 * 極細嘅唯讀 GET 快取（純函數式容器，方便 node 直接測試）。
 *
 * 用途：member-portal 每個公開讀取都要經 Vercel → Google Apps Script → Google Sheet，
 * 一次往返通常遠慢過頁面本身。呢個快取只放「已清洗嘅公開唯讀資料」：
 *  - fresh：TTL 內直接回，唔使再問 Apps Script；
 *  - stale：TTL 過咗但冇過 maxStaleMs，只會喺上游失敗時頂住，唔會當新資料用；
 *  - run()：同一 key 嘅並行請求合併做一次上游呼叫，避免多人同時開頁打爆後台。
 *
 * 唔快取：POST／提交、getSystem（系統鎖定要即時）、錯誤回應、任何 key／私隱欄位
 * （proxy 存入前已做 sanitizeGet 欄位白名單）。
 */
export interface CacheLookup<T> {
  value: T;
  state: 'fresh' | 'stale';
}

export interface ReadCacheOptions {
  now?: () => number;
  maxStaleMs?: number;
  maxEntries?: number;
}

interface Entry<T> {
  value: T;
  storedAt: number;
  ttlMs: number;
}

export class ReadCache<T> {
  private readonly entries = new Map<string, Entry<T>>();
  private readonly flights = new Map<string, Promise<T>>();
  private readonly now: () => number;
  private readonly maxStaleMs: number;
  private readonly maxEntries: number;

  constructor(options: ReadCacheOptions = {}) {
    this.now = options.now || Date.now;
    this.maxStaleMs = options.maxStaleMs ?? 5 * 60_000;
    this.maxEntries = options.maxEntries ?? 200;
  }

  lookup(key: string): CacheLookup<T> | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    const age = this.now() - entry.storedAt;
    if (age <= entry.ttlMs) return { value: copy(entry.value), state: 'fresh' };
    if (age <= entry.ttlMs + this.maxStaleMs) return { value: copy(entry.value), state: 'stale' };
    this.entries.delete(key);
    return null;
  }

  set(key: string, value: T, ttlMs: number): void {
    if (!(ttlMs > 0)) return;
    this.entries.set(key, { value: copy(value), storedAt: this.now(), ttlMs });
    // 上限保護：超額先刪最舊，避免長期累積（每區 × action × 過濾參數）。
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  /** 同一 key 同時有多個請求時，共用同一個 Promise（single-flight）。 */
  async run(key: string, loader: () => Promise<T>): Promise<T> {
    const pending = this.flights.get(key);
    if (pending) return pending;
    const promise = (async () => loader())();
    this.flights.set(key, promise);
    try {
      return await promise;
    } finally {
      this.flights.delete(key);
    }
  }

  clear(): void {
    this.entries.clear();
    this.flights.clear();
  }

  get size(): number { return this.entries.size; }
}

/** 只存 JSON 資料；copy 避免呼叫方改到快取入面嘅物件。 */
function copy<T>(value: T): T {
  if (value === undefined || value === null) return value;
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
}
