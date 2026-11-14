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
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = await import('react');
const { render, screen, cleanup } = await import('@testing-library/react');
const { default: ScoutSystemCredit, SCOUT_SYSTEM_URL } = await import('../components/ScoutSystemCredit.tsx');

afterEach(() => cleanup());

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
