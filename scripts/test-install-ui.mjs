import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://member.test/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let standalone = false;
window.matchMedia = () => ({ matches: standalone });
const React = await import('react');
const { render, screen, cleanup, act } = await import('@testing-library/react');
const userEvent = (await import('@testing-library/user-event')).default;
const InstallPrompt = (await import('../components/InstallPrompt.tsx')).default;
afterEach(() => { cleanup(); standalone = false; });

test('沒有原生安裝提示時提供 iOS、Android 同電腦步驟', async () => {
  render(React.createElement(InstallPrompt));
  await userEvent.setup().click(screen.getByRole('button', { name: '查看安裝方法' }));
  assert.ok(screen.getByText(/用 Safari 開啟本站/));
  assert.ok(screen.getByText(/用 Chrome 開啟本站/));
  assert.ok(screen.getByText(/部分服務仍需網絡連線/));
});

test('瀏覽器支援時呼叫安裝提示，安裝後隱藏入口', async () => {
  render(React.createElement(InstallPrompt));
  let called = 0;
  const event = new window.Event('beforeinstallprompt', { cancelable: true });
  event.prompt = async () => { called++; };
  event.userChoice = Promise.resolve({ outcome: 'accepted' });
  act(() => window.dispatchEvent(event));
  assert.equal(event.defaultPrevented, true);
  await userEvent.setup().click(screen.getByRole('button', { name: '安裝服務平台' }));
  assert.equal(called, 1);
  act(() => window.dispatchEvent(new window.Event('appinstalled')));
  assert.equal(screen.queryByText('📱 加入主畫面'), null);
});

test('已在主畫面獨立模式開啟時不顯示安裝入口', () => {
  standalone = true;
  render(React.createElement(InstallPrompt));
  assert.equal(screen.queryByText('📱 加入主畫面'), null);
});
