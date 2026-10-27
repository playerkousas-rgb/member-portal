/** 以 DOM 模擬申請人操作；瀏覽器 API → 真實 proxy handler → 模擬 GS。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://member.test/contact-district' });
globalThis.window = dom.window;
globalThis.self = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.localStorage = dom.window.localStorage;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.HTMLInputElement = dom.window.HTMLInputElement;
globalThis.FormData = dom.window.FormData;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.confirm = () => true;
dom.window.scrollTo = () => {};
Object.assign(process.env, { NODE_ENV: 'test', MEMBER_DEV_APIBASE: 'http://mock-gs.test/exec', MEMBER_SKW_APIKEY: 'ui-test-server-key' });

const { render, screen, cleanup, within, waitFor } = await import('@testing-library/react');
const userEvent = (await import('@testing-library/user-event')).default;
const { NextRequest } = await import('next/server.js');
const { GET, POST } = await import('../app/api/proxy/route.ts');
const ContactDistrictPage = (await import('../app/contact-district/page.tsx')).default;
const React = await import('react');

const REF = 'TR-20261027-2345';
const directory = {
  districtCode: 'SKW', districtName: '筲箕灣區',
  troops: [
    { troop: '1745', label: '港島第1745旅', sectionCounts: { gh: '0', cub: '', scout: '1', venture: '0', rover: '' },
      units: [{ section: 'scout', unitCode: '', label: '童軍團' }], leaderPhone: 'PRIVATE-PHONE', leaderEmail: 'PRIVATE-EMAIL' },
    { troop: '82', label: '港島第82旅', sectionCounts: { cub: '1' }, units: [{ section: 'cub', unitCode: '', label: '幼童軍團' }] },
  ],
};
let ip = 0;

function transport(t, options = {}) {
  const browserPosts = [];
  const upstreamPosts = [];
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url || String(input), dom.window.location.origin);
    if (url.origin === 'http://member.test') {
      if (init.method === 'POST') {
        const body = JSON.parse(String(init.body));
        browserPosts.push(body);
        const request = new NextRequest(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `ui-${++ip}` }, body: JSON.stringify(body) });
        // 模擬使用者已開啟表單超過 honeypot 600ms；不修改瀏覽器發出的 payload。
        const now = Date.now;
        Date.now = () => now() + 1000;
        try { return await POST(request); } finally { Date.now = now; }
      }
      return GET(new NextRequest(url));
    }
    assert.equal(url.origin, 'http://mock-gs.test');
    const posted = init.method === 'POST' ? JSON.parse(String(init.body)) : null;
    const action = posted?.action || url.searchParams.get('action');
    let result;
    if (action === 'getSystem') result = { ok: true, data: { locked: false } };
    else if (action === 'listDistrictTroops') result = options.directoryError
      ? { ok: false, error: options.directoryError }
      : { ok: true, data: options.directory || directory };
    else if (action === 'submitVisitRequest') {
      upstreamPosts.push(posted);
      result = options.submitError
        ? { ok: false, error: options.submitError }
        : { ok: true, data: { id: 'vr_mock', refCode: REF, leaderPhone: 'PRIVATE-PHONE' } };
    } else throw new Error(`Unexpected mock action: ${action}`);
    return new Response(JSON.stringify(result), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  return { browserPosts, upstreamPosts };
}

async function openForm(t, options) {
  localStorage.clear();
  if (options?.draft) localStorage.setItem('mp:draft:visit-request:SKW', JSON.stringify({ t: Date.now(), v: options.draft }));
  t.after(() => { cleanup(); localStorage.clear(); });
  const calls = transport(t, options);
  const user = userEvent.setup({ document: dom.window.document });
  render(React.createElement(ContactDistrictPage));
  if (!options?.directoryError) await screen.findByRole('option', { name: /港島第1745旅/ });
  return { user, ...calls };
}

async function fillBasics(user, type = 'visit') {
  await user.click(screen.getByRole('radio', { name: type === 'visit' ? /申請區幹部探訪/ : /邀請區幹部出席活動/ }));
  await user.selectOptions(screen.getByLabelText(/^旅團/), '1745');
  await user.type(screen.getByLabelText(/^申請目的/), '希望區幹部到旅團集會交流');
}

test('DOM → proxy → 模擬 GS：探訪不要求回覆，顯示 TR 編號及後續提示', async (t) => {
  const { user, browserPosts, upstreamPosts } = await openForm(t);
  await fillBasics(user);
  const section = screen.getByLabelText(/^支部/);
  assert.deepEqual(within(section).getAllByRole('option').map((option) => option.value), ['', 'scout']);
  await user.selectOptions(section, 'scout');
  assert.equal(screen.queryByLabelText(/^聯絡資料/), null);
  await user.click(screen.getByRole('button', { name: '提交申請' }));
  assert.ok(await screen.findByText(REF));
  assert.ok(screen.getByText(/申請已交區會跟進/));
  assert.ok(screen.getByText(/不會自動成為探訪紀錄/));
  assert.ok(screen.getByText(/區會未必能主動聯絡你/));
  assert.equal(browserPosts.length, 1);
  assert.equal(upstreamPosts.length, 1);
  for (const payload of [browserPosts[0], upstreamPosts[0]]) {
    assert.equal(payload.wantReply, false);
    for (const field of ['contactName', 'contactType', 'contact']) assert.equal(Object.hasOwn(payload, field), false);
  }
  assert.equal(Object.hasOwn(browserPosts[0], 'apiKey'), false);
  assert.equal(upstreamPosts[0].apiKey, 'ui-test-server-key');
});

test('先填聯絡資料再取消回覆：隱藏、清除、草稿不保存，提交不傳送', async (t) => {
  const { user, browserPosts, upstreamPosts } = await openForm(t);
  await fillBasics(user);
  const checkbox = screen.getByRole('checkbox', { name: /我想收到區會回覆/ });
  await user.click(checkbox);
  await user.type(screen.getByLabelText(/^稱呼/), '申請人');
  await user.selectOptions(screen.getByLabelText(/^聯絡方法類別/), 'phone');
  await user.type(screen.getByLabelText(/^聯絡資料/), '91234567');
  // 有要求回覆期間，草稿亦不應包含任何聯絡欄位或值。
  await new Promise((resolve) => setTimeout(resolve, 900));
  const draft = localStorage.getItem('mp:draft:visit-request:SKW') || '';
  assert.ok(draft, '應有一般申請草稿');
  for (const secret of ['91234567', '申請人', 'contactName', 'contactType', 'contact']) assert.ok(!draft.includes(secret), secret);
  await user.click(checkbox);
  assert.equal(screen.queryByLabelText(/^稱呼/), null);
  assert.equal(screen.queryByLabelText(/^聯絡方法類別/), null);
  assert.equal(screen.queryByLabelText(/^聯絡資料/), null);
  await user.click(checkbox);
  assert.equal(screen.getByLabelText(/^稱呼/).value, '');
  assert.equal(screen.getByLabelText(/^聯絡方法類別/).value, '');
  assert.equal(screen.getByLabelText(/^聯絡資料/).value, '');
  await user.click(checkbox);
  await user.click(screen.getByRole('button', { name: '提交申請' }));
  assert.ok(await screen.findByText(REF));
  for (const payload of [browserPosts[0], upstreamPosts[0]]) {
    for (const field of ['contactName', 'contactType', 'contact']) assert.equal(Object.hasOwn(payload, field), false);
  }
});

test('回復草稿不恢復舊聯絡資料，取消回覆後提交依然不傳送', async (t) => {
  const draft = { type: 'visit', troop: '1745', section: 'scout', purpose: '希望區幹部到旅團交流',
    wantReply: true, contactName: '舊稱呼', contactType: 'phone', contact: '91234567' };
  const { user, browserPosts, upstreamPosts } = await openForm(t, { draft });
  await user.click(screen.getByRole('button', { name: '回復草稿' }));
  assert.equal(screen.getByLabelText(/^稱呼/).value, '');
  assert.equal(screen.getByLabelText(/^聯絡方法類別/).value, '');
  assert.equal(screen.getByLabelText(/^聯絡資料/).value, '');
  await user.click(screen.getByRole('checkbox', { name: /我想收到區會回覆/ }));
  await user.click(screen.getByRole('button', { name: '提交申請' }));
  assert.ok(await screen.findByText(REF));
  for (const payload of [browserPosts[0], upstreamPosts[0]]) {
    for (const field of ['contactName', 'contactType', 'contact']) assert.equal(Object.hasOwn(payload, field), false);
  }
});

test('DOM 驗證：邀請缺活動名稱、回覆欠類別／聯絡資料皆阻止提交', async (t) => {
  const { user, browserPosts, upstreamPosts } = await openForm(t);
  await fillBasics(user, 'invite');
  await user.click(screen.getByRole('button', { name: '提交申請' }));
  assert.ok(screen.getByRole('alert').textContent.includes('活動名稱'));
  assert.equal(browserPosts.length, 0);
  await user.type(screen.getByLabelText(/^活動名稱/), '周年典禮');
  await user.click(screen.getByRole('checkbox', { name: /我想收到區會回覆/ }));
  await user.click(screen.getByRole('button', { name: '提交申請' }));
  assert.ok(screen.getByRole('alert').textContent.includes('聯絡方法類別'));
  await user.selectOptions(screen.getByLabelText(/^聯絡方法類別/), 'email');
  await user.click(screen.getByRole('button', { name: '提交申請' }));
  assert.ok(screen.getByRole('alert').textContent.includes('聯絡資料'));
  assert.equal(browserPosts.length, 0);
  await user.type(screen.getByLabelText(/^聯絡資料/), 'test@example.invalid');
  await user.click(screen.getByRole('button', { name: '提交申請' }));
  assert.ok(await screen.findByText(REF));
  assert.equal(upstreamPosts[0].contactType, 'email');
  assert.equal(upstreamPosts[0].contact, 'test@example.invalid');
  assert.ok(screen.getByText(/區會可按你自願提供/));
});

test('DOM 驗證：目的太短及非正整數會顯示錯誤', async (t) => {
  const { user, browserPosts } = await openForm(t);
  await user.click(screen.getByRole('radio', { name: /申請區幹部探訪/ }));
  await user.selectOptions(screen.getByLabelText(/^旅團/), '1745');
  const purpose = screen.getByLabelText(/^申請目的/);
  await user.type(purpose, '太短');
  await user.click(screen.getByRole('button', { name: '提交申請' }));
  assert.ok(screen.getByRole('alert').textContent.includes('5 至 2000'));
  await user.clear(purpose);
  await user.type(purpose, '希望區幹部到旅團交流');
  const count = screen.getByLabelText(/^預計參加人數/);
  for (const bad of ['0', '-3', '1.5', '1e2']) {
    await user.clear(count);
    await user.type(count, bad);
    await user.click(screen.getByRole('button', { name: '提交申請' }));
    assert.ok(screen.getByRole('alert').textContent.includes('正整數'), bad);
  }
  assert.equal(browserPosts.length, 0);
});

test('DOM 只列公開旅號及已開設支部；篡改選項仍遭驗證拒絕', async (t) => {
  const { user, browserPosts } = await openForm(t);
  await fillBasics(user);
  const troopSelect = screen.getByLabelText(/^旅團/);
  assert.deepEqual(within(troopSelect).getAllByRole('option').map((option) => option.value), ['', '1745', '82']);
  const sectionSelect = screen.getByLabelText(/^支部/);
  const invalidSection = document.createElement('option');
  invalidSection.value = 'cub'; invalidSection.textContent = '偽造幼童軍';
  sectionSelect.append(invalidSection);
  await user.selectOptions(sectionSelect, 'cub');
  await user.click(screen.getByRole('button', { name: '提交申請' }));
  assert.ok(screen.getByRole('alert').textContent.includes('並非該旅已開設'));
  const invalidTroop = document.createElement('option');
  invalidTroop.value = '99999'; invalidTroop.textContent = '偽造旅號';
  troopSelect.append(invalidTroop);
  await user.selectOptions(troopSelect, '99999');
  await user.click(screen.getByRole('button', { name: '提交申請' }));
  assert.ok(screen.getByRole('alert').textContent.includes('不在公開名錄'));
  assert.equal(browserPosts.length, 0);
});

test('更換旅團會清除舊支部，只提供新旅實際開設的支部', async (t) => {
  const { user } = await openForm(t);
  await fillBasics(user);
  const troop = screen.getByLabelText(/^旅團/);
  const section = screen.getByLabelText(/^支部/);
  await user.selectOptions(section, 'scout');
  await user.selectOptions(troop, '82');
  assert.equal(section.value, '');
  assert.deepEqual(within(section).getAllByRole('option').map((option) => option.value), ['', 'cub']);
  await user.selectOptions(section, 'cub');
  await user.selectOptions(troop, '1745');
  assert.equal(section.value, '');
  assert.deepEqual(within(section).getAllByRole('option').map((option) => option.value), ['', 'scout']);
});

test('重新載入後支部關閉：不得靜默改成全旅，須重新選擇', async (t) => {
  const latest = structuredClone(directory);
  const { user, browserPosts } = await openForm(t, { directory: latest });
  await fillBasics(user);
  const section = screen.getByLabelText(/^支部/);
  await user.selectOptions(section, 'scout');
  latest.troops[0].sectionCounts.scout = '0';
  latest.troops[0].units = [];
  await user.click(screen.getByRole('button', { name: '重新載入名錄' }));
  await screen.findByRole('option', { name: /原選支部已不在名錄/ });
  assert.equal(section.value, 'scout');
  await user.click(screen.getByRole('button', { name: '提交申請' }));
  assert.match(screen.getByRole('alert').textContent, /並非該旅已開設/);
  assert.equal(browserPosts.length, 0);
  await user.selectOptions(section, '');
  await user.click(screen.getByRole('button', { name: '提交申請' }));
  assert.ok(await screen.findByText(REF));
  assert.equal(browserPosts[0].section, '');
});

test('GS 回傳錯誤時顯示原因，保留表單而不是顯示成功', async (t) => {
  const { user, upstreamPosts } = await openForm(t, { submitError: '聯絡區會服務尚未就緒' });
  await fillBasics(user);
  await user.click(screen.getByRole('button', { name: '提交申請' }));
  await waitFor(() => assert.match(screen.getByRole('alert').textContent, /聯絡區會服務尚未就緒/));
  assert.ok(screen.getByLabelText(/^申請目的/).value.includes('希望區幹部'));
  assert.equal(screen.queryByText('申請提交成功'), null);
  assert.equal(upstreamPosts.length, 1);
});

test('公開名錄載入失敗時可見錯誤及重試，禁止提交', async (t) => {
  const { browserPosts } = await openForm(t, { directoryError: '名錄暫時未就緒' });
  await waitFor(() => assert.match(screen.getByRole('alert').textContent, /名錄暫時未就緒/));
  assert.equal(screen.getByRole('button', { name: '提交申請' }).disabled, true);
  assert.ok(screen.getByRole('button', { name: '重試' }));
  assert.equal(browserPosts.length, 0);
});
