import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://member.test/books' });
globalThis.window = dom.window;
globalThis.self = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.localStorage = dom.window.localStorage;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
process.env.NEXT_PUBLIC_PORTAL_BUILD_VERSION = 'build-one';
const React = await import('react');
const { render, screen, cleanup, waitFor } = await import('@testing-library/react');
const userEvent = (await import('@testing-library/user-event')).default;
const BookSelector = (await import('../components/BookSelector.tsx')).default;
const UpdateSettings = (await import('../components/UpdateSettings.tsx')).default;
const originalFetch = globalThis.fetch;
afterEach(() => { cleanup(); localStorage.clear(); globalThis.fetch = originalFetch; });

test('第一次選擇、下次直接開啟，亦可改選其他支部', async () => {
  const user = userEvent.setup();
  const view = render(React.createElement(BookSelector, { homeHref: '/' }));
  await user.click(screen.getByRole('button', { name: /深資童軍紀錄冊/ }));
  assert.equal(localStorage.getItem('member-portal:book-choice'), 'venture');
  assert.match(screen.getByTitle('深資童軍紀錄冊').getAttribute('src'), /vsbook-sand/);
  view.unmount();
  render(React.createElement(BookSelector, { homeHref: '/' }));
  assert.ok(await screen.findByTitle('深資童軍紀錄冊'));
  await user.click(screen.getByRole('button', { name: '← 返回平台' }));
  assert.ok(screen.getByText('已選擇：深資童軍紀錄冊'));
  assert.equal(screen.queryByRole('button', { name: /幼童軍紀錄冊/ }), null);
  await user.click(screen.getByRole('button', { name: '更改選擇' }));
  await user.click(screen.getByRole('button', { name: /幼童軍紀錄冊/ }));
  assert.equal(localStorage.getItem('member-portal:book-choice'), 'cub');
  assert.ok(screen.getByTitle('幼童軍紀錄冊'));
});

test('無效選擇會要求重新選擇，而不是開啟未知網站', () => {
  localStorage.setItem('member-portal:book-choice', 'https://invalid.example');
  render(React.createElement(BookSelector, { homeHref: '/' }));
  assert.ok(screen.getByRole('button', { name: /幼童軍紀錄冊/ }));
  assert.equal(document.querySelector('iframe'), null);
});

test('瀏覽器不允許儲存時仍可選擇並顯示提示', async (t) => {
  t.mock.method(dom.window.Storage.prototype, 'getItem', () => { throw new Error('blocked'); });
  t.mock.method(dom.window.Storage.prototype, 'setItem', () => { throw new Error('blocked'); });
  render(React.createElement(BookSelector, { homeHref: '/' }));
  assert.ok(screen.getByText(/無法儲存選擇/));
  await userEvent.setup().click(screen.getByRole('button', { name: /樂行童軍紀錄冊/ }));
  assert.ok(screen.getByTitle('樂行童軍紀錄冊'));
});

test('檢查新版本後提示更新，手動檢查網絡錯誤有提示', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ version: 'build-two' }), { status: 200 });
  render(React.createElement(UpdateSettings));
  assert.ok(await screen.findByRole('button', { name: '立即更新' }));
  assert.ok(screen.getByText(/請先儲存未完成資料/));
  globalThis.fetch = async () => { throw new Error('offline'); };
  await userEvent.setup().click(screen.getByRole('button', { name: '檢查平台更新' }));
  await waitFor(() => assert.ok(screen.getByText(/未能檢查更新/)));
});

test('版本相同時手動檢查顯示最新', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ version: 'build-one' }), { status: 200 });
  render(React.createElement(UpdateSettings));
  await userEvent.setup().click(screen.getByRole('button', { name: '檢查平台更新' }));
  assert.ok(await screen.findByText('目前已是最新版本。'));
});
