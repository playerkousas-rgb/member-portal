/**
 * 「加入主畫面後唔使重新下載／重裝就更新」嘅前台協定測試。
 * 覆蓋：worker waiting → 更新提示；SKIP_WAITING 只喺用戶按更新後送出。
 */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://member.test/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.CustomEvent = dom.window.CustomEvent;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
process.env.NEXT_PUBLIC_PORTAL_BUILD_VERSION = 'build-one';

let remoteVersion = 'build-one';
globalThis.fetch = async () => new Response(JSON.stringify({ version: remoteVersion }), { status: 200 });

const React = await import('react');
const { render, screen, cleanup, waitFor } = await import('@testing-library/react');
const UpdateSettings = (await import('../components/UpdateSettings.tsx')).default;
const { PWA_UPDATE_EVENT, applyPwaUpdate, registerPwa } = await import('../lib/pwa.ts');

afterEach(() => {
  cleanup();
  remoteVersion = 'build-one';
  delete dom.window.navigator.serviceWorker;
});

test('新 worker 等候接手時彈更新提示，講明唔使重新加入主畫面', async () => {
  render(React.createElement(UpdateSettings));
  assert.equal(screen.queryByRole('button', { name: '立即更新' }), null);
  window.dispatchEvent(new CustomEvent(PWA_UPDATE_EVENT, { detail: { version: 'build-two' } }));
  assert.ok(await screen.findByRole('button', { name: '立即更新' }));
  assert.ok(screen.getByText(/請先儲存未完成資料/));
  assert.ok(screen.getByText(/唔使重新加入主畫面或重新安裝/));
});

test('前景查更新 → SKIP_WAITING 協定：偵測 waiting，用戶確認先叫新 worker 接手', async () => {
  const posted = [];
  let updates = 0;
  let registers = 0;
  const swListeners = {};
  const regListeners = {};
  const reg = {
    waiting: { postMessage: (message) => posted.push(message) },
    installing: null,
    addEventListener: (type, fn) => { regListeners[type] = fn; },
    update: async () => { updates += 1; return reg; },
  };
  Object.defineProperty(dom.window.navigator, 'serviceWorker', {
    configurable: true,
    value: {
      controller: {},
      register: async () => { registers += 1; return reg; },
      getRegistration: async () => reg,
      addEventListener: (type, fn) => { swListeners[type] = fn; },
    },
  });
  // 唔好留低計時器／後備重載（jsdom 無實作導航）。
  dom.window.setInterval = () => 0;
  dom.window.setTimeout = () => 0;
  remoteVersion = 'build-two';

  const events = [];
  const onUpdate = (event) => events.push(event.detail);
  window.addEventListener(PWA_UPDATE_EVENT, onUpdate);

  registerPwa();
  // readyState 未 complete 時靠 load 事件啟動；complete 時 start() 已行，呢個事件冇副作用。
  window.dispatchEvent(new dom.window.Event('load'));
  await waitFor(() => assert.equal(registers, 1));
  // start() → watch() → checkWaiting() → announce()，以及開頁主動 reg.update()。
  await waitFor(() => assert.ok(events.length >= 1));
  assert.ok(updates >= 1, '開頁／回前景要主動 reg.update()');
  assert.equal(events[0].version, 'build-two');

  assert.deepEqual(posted, [], '未經用戶確認唔可以自己 skipWaiting／重載');
  await applyPwaUpdate();
  assert.deepEqual(posted, [{ type: 'SKIP_WAITING' }]);
  assert.ok(typeof swListeners.controllerchange === 'function', 'controllerchange 要註冊先可以自動換新版');
  assert.ok(typeof regListeners.updatefound === 'function');
  window.removeEventListener(PWA_UPDATE_EVENT, onUpdate);
});
