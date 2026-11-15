/**
 * 首頁／守則卡片版面同 Scout System 來源標示測試。
 */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://member.test/' });
globalThis.window = dom.window;
globalThis.self = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.localStorage = dom.window.localStorage;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Element = dom.window.Element;
dom.window.matchMedia = () => ({ matches: false });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = await import('react');
const { render, screen, cleanup, fireEvent, waitFor } = await import('@testing-library/react');
const userEvent = (await import('@testing-library/user-event')).default;
const { default: ScoutSystemCredit, SCOUT_SYSTEM_URL } = await import('../components/ScoutSystemCredit.tsx');
const {
  applyCardOrder,
  cardOrderStorageKey,
  clearCardOrder,
  isCustomCardOrder,
  loadCardOrder,
  moveCardInList,
  saveCardOrder,
} = await import('../lib/cardOrder.ts');

afterEach(() => {
  cleanup();
  dom.window.localStorage.clear();
});

test('服務卡同守則卡嘅小字介紹已全刪', () => {
  const home = read('app/page.tsx');
  const rules = read('app/rules/page.tsx');
  assert.ok(!home.includes('className="desc"'));
  assert.ok(!/desc:\s*'/.test(home));
  assert.ok(!rules.includes('r-desc'));
  assert.ok(!/desc:\s*'/.test(rules));
  assert.ok(!read('app/globals.css').includes('.card .desc{'));
  assert.ok(!read('components/InstallPrompt.tsx').includes('將服務平台加到手機或電腦主畫面'));
});

test('手機版面：服務格同守則格都係每行兩張', () => {
  const css = read('app/globals.css');
  assert.match(css, /\.grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\);gap:10px;\}/);
  assert.match(css, /\.rules-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\);gap:10px;\}/);
  assert.match(css, /\.card \.src\{/);
});

test('四個借用服務喺首頁都有可見來源，牌子連去 Scout App Store 網址', () => {
  const page = read('app/page.tsx');
  const credit = read('components/ScoutSystemCredit.tsx');
  assert.equal((page.match(/borrowed: true/g) || []).length, 3, '三張服務卡要有 Scout System 小標籤');
  assert.ok(page.includes('ScoutSystemCredit variant="inline"'), '查看通告區要有來源');
  assert.ok(page.includes('<ScoutSystemCredit />'), '服務格下方要有完整來源列');
  assert.ok(read('components/BookSelector.tsx').includes('ScoutSystemCredit'), '紀錄冊頁要有來源');
  assert.equal(SCOUT_SYSTEM_URL, 'https://scoutappstore.vercel.app/');
  assert.ok(credit.includes('https://scoutappstore.vercel.app/'));
  assert.ok(!credit.includes('scoutsystem.vercel.app'), '唔好當 scoutsystem.vercel.app 係品牌官網');
  assert.ok(!page.includes('scoutsystem.vercel.app'));
});

test('來源標示列晒四個借用服務、Scout System 版權同原站連結', () => {
  render(React.createElement(ScoutSystemCredit));
  assert.ok(screen.getByText('服務來源：'));
  for (const label of ['我的紀錄冊', '查看通告', 'GEMINI 輔助系統', 'SCOUT APP STORE']) {
    assert.ok(screen.getByRole('link', { name: label }), `缺少 ${label} 來源連結`);
  }
  assert.ok(screen.getAllByText(/© 2026 Scout System/).length >= 1);
  assert.equal(screen.getByRole('link', { name: '查看通告' }).getAttribute('href'), 'https://scout-circulars.vercel.app/');
  assert.equal(screen.getByRole('link', { name: 'GEMINI 輔助系統' }).getAttribute('rel'), 'noopener noreferrer');
  assert.equal(screen.getByRole('link', { name: 'SCOUT APP STORE' }).getAttribute('target'), '_blank');
  const brand = screen.getByRole('link', { name: 'Scout System' });
  assert.equal(brand.getAttribute('href'), SCOUT_SYSTEM_URL);
  assert.equal(brand.getAttribute('rel'), 'noopener noreferrer');
  assert.equal(brand.getAttribute('target'), '_blank');
});

test('inline 版來源標示：短句、牌子名連去 Scout App Store', () => {
  render(React.createElement(ScoutSystemCredit, { variant: 'inline' }));
  assert.ok(screen.getAllByText(/借用自/).length >= 1);
  const brand = screen.getByRole('link', { name: 'Scout System' });
  assert.equal(brand.getAttribute('href'), SCOUT_SYSTEM_URL);
  assert.equal(brand.getAttribute('rel'), 'noopener noreferrer');
});

test('cardOrder 純函數：搬移、localStorage 保存／讀取／損壞容錯、未知／新增卡片合併及還原', () => {
  const sample = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  assert.deepEqual(moveCardInList(sample, 0, 2).map((x) => x.id), ['b', 'c', 'a', 'd']);
  assert.deepEqual(moveCardInList(sample, 3, 1).map((x) => x.id), ['a', 'd', 'b', 'c']);
  assert.deepEqual(moveCardInList(sample, -1, 2).map((x) => x.id), ['a', 'b', 'c', 'd']);

  assert.equal(isCustomCardOrder(sample, sample), false);
  assert.equal(isCustomCardOrder(moveCardInList(sample, 0, 1), sample), true);

  assert.deepEqual(
    applyCardOrder(sample, ['c', 'ghost', 'c', 'a']).map((x) => x.id),
    ['c', 'a', 'b', 'd'],
    '應保留有效儲存順序、忽略已刪除卡片、並將未記錄預設卡片補喺最後',
  );

  saveCardOrder('skw', ['c', 'a', 'b', 'd']);
  assert.equal(cardOrderStorageKey('skw'), 'mp:card-order:SKW');
  assert.deepEqual(loadCardOrder('SKW'), ['c', 'a', 'b', 'd']);

  dom.window.localStorage.setItem('mp:card-order:SKW', '{bad json');
  assert.deepEqual(loadCardOrder('SKW'), []);

  saveCardOrder('SKW', ['d', 'c']);
  clearCardOrder('SKW');
  assert.deepEqual(loadCardOrder('SKW'), []);
});

test('首頁預設次序：GEMINI 輔助系統與 SCOUT APP STORE 放最後兩格，並支援拖拉、調整模式及還原預設', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ ok: true, data: [] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  }));

  const { default: HomePage } = await import('../app/page.tsx');

  const { container } = render(React.createElement(HomePage));
  const titles = () => [...container.querySelectorAll('.grid .card h3')].map((el) => el.textContent);
  const tagsByTitle = () => Object.fromEntries(
    [...container.querySelectorAll('.grid .card')].map((card) => [
      card.querySelector('h3')?.textContent,
      card.querySelector('.tag')?.textContent,
    ]),
  );

  assert.equal(titles().length, 11);
  assert.ok(titles().includes('邀請探訪/出席活動'), '首頁服務卡應改名為「邀請探訪/出席活動」');
  assert.ok(!titles().includes('聯絡區會'), '首頁服務卡不應保留舊名「聯絡區會」');
  const tags = tagsByTitle();
  for (const name of ['借用物資', '訓練班報名', '旅團活動知會', '邀請探訪/出席活動']) {
    assert.equal(tags[name], '提交', `${name} 標籤應改名為「提交」`);
  }
  assert.ok(!Object.values(tags).includes('公開提交'), '首頁卡片不應顯示「公開提交」');
  assert.ok(!Object.values(tags).includes('公開報名'), '首頁卡片不應顯示「公開報名」');
  assert.deepEqual(titles().slice(-2), ['GEMINI 輔助系統', 'SCOUT APP STORE']);
  assert.equal(screen.queryByRole('button', { name: '↺ 還原預設次序' }), null, '預設次序時唔顯示還原掣');

  // 1) 桌面 HTML5 Drag & Drop：將最後一張「SCOUT APP STORE」拖到第 1 格
  const slots = () => [...container.querySelectorAll('.grid .card-item')];
  const lastIndex = titles().length - 1;
  fireEvent.dragStart(slots()[lastIndex], { dataTransfer: { effectAllowed: '', setData: () => {} } });
  fireEvent.dragOver(slots()[0], { dataTransfer: { dropEffect: '' } });
  fireEvent.drop(slots()[0]);
  fireEvent.dragEnd(slots()[0]);

  assert.equal(titles()[0], 'SCOUT APP STORE');
  assert.deepEqual(loadCardOrder('SKW')[0], 'app-store');

  // 2) 鍵盤方向鍵微調：喺第 1 格按 ArrowRight 移去第 2 格
  const firstGrip = container.querySelector('[data-card-id="app-store"] .drag-grip');
  fireEvent.keyDown(firstGrip, { key: 'ArrowRight' });
  assert.equal(titles()[1], 'SCOUT APP STORE');

  // 3) 觸控模式（⇄ 調整次序）：拖動觸控手把，用 elementFromPoint 跨卡重排
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: '⇄ 調整次序' }));
  assert.ok(screen.getByRole('button', { name: '✓ 完成調整' }));

  const targetSlot = container.querySelectorAll('.grid .card-item')[0];
  const origElementFromPoint = dom.window.document.elementFromPoint;
  dom.window.document.elementFromPoint = () => targetSlot;
  try {
    const secondGrip = container.querySelectorAll('.grid .card-item')[2].querySelector('.drag-grip');
    fireEvent.touchStart(secondGrip, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchMove(secondGrip, { touches: [{ clientX: 10, clientY: 10 }] });
    fireEvent.touchEnd(secondGrip);
  } finally {
    dom.window.document.elementFromPoint = origElementFromPoint;
  }

  // 4) 還原預設次序
  const resetBtn = await screen.findByRole('button', { name: '↺ 還原預設次序' });
  await user.click(resetBtn);
  await waitFor(() => {
    assert.deepEqual(titles().slice(-2), ['GEMINI 輔助系統', 'SCOUT APP STORE']);
  });
  assert.deepEqual(loadCardOrder('SKW'), []);
});
