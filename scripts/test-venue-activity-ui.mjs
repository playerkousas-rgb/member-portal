/**
 * 借場必填電郵驗證＋活動知會頁純提交行為（DOM → 真實 proxy → 模擬 GS）。
 */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://member.test/venue' });
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
Object.assign(process.env, {
  NODE_ENV: 'test',
  MEMBER_DEV_APIBASE: 'http://mock-gs.test/exec',
  MEMBER_SKW_APIKEY: 'ui-test-server-key',
  MEMBER_PORTAL_DISABLE_CACHE: '1',
});

const React = await import('react');
const { render, screen, cleanup, waitFor } = await import('@testing-library/react');
const userEvent = (await import('@testing-library/user-event')).default;
const { NextRequest } = await import('next/server.js');
const { GET, POST } = await import('../app/api/proxy/route.ts');
const VenuePage = (await import('../app/venue/page.tsx')).default;
const ActivityPage = (await import('../app/activity/page.tsx')).default;

let ip = 0;

function installTransport(t, options = {}) {
  const upstreamGets = [];
  const upstreamPosts = [];
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url || String(input), dom.window.location.origin);
    if (url.origin === 'http://member.test') {
      if (init.method === 'POST') {
        const body = JSON.parse(String(init.body));
        const request = new NextRequest(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-forwarded-for': `venue-ui-${++ip}` },
          body: JSON.stringify(body),
        });
        const now = Date.now;
        Date.now = () => now() + 1000;
        try {
          return await POST(request);
        } finally {
          Date.now = now;
        }
      }
      return await GET(new NextRequest(url));
    }

    if (url.origin === 'http://mock-gs.test') {
      if (init.method === 'POST') {
        const body = JSON.parse(String(init.body));
        upstreamPosts.push(body);
        if (body.action === 'submitVenueRequest') {
          return new Response(
            JSON.stringify({ ok: true, data: { refCode: 'VB-20270515-001', emailSent: options.venueEmailSent ?? true } }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        return new Response(
          JSON.stringify({ ok: true, data: { refCode: 'AN-20270515-001' } }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }

      const action = url.searchParams.get('action') || '';
      upstreamGets.push(action);
      const dataMap = {
        getSystem: { locked: false, lockMessage: '' },
        getPublicInfo: {
          districtName: '筲箕灣區',
          districtCode: 'SKW',
          venueRules: '1. 測試借場守則',
          stockRules: '',
          troopList: ['港島第82旅'],
          cctvUrl: '',
          teamupBookingUrl: '',
          teamupReadOnlyUrl: 'https://teamup.com/ksreadonly',
          fpsAccountName: '',
          fpsAccountNumber: '',
        },
        listVenues: [{ venueId: 'HQ-1704', name: '區總部', location: '筲箕灣', capacity: 40, note: '' }],
      };
      return new Response(JSON.stringify({ ok: true, data: dataMap[action] ?? [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
  return { upstreamGets, upstreamPosts };
}

afterEach(() => {
  cleanup();
  dom.window.localStorage.clear();
});

test('借用區總部表單：電郵為必填及須通過格式檢查，成功提交後顯示確認編號與電郵提示', async (t) => {
  const { upstreamPosts } = installTransport(t, { venueEmailSent: true });
  const { container } = render(React.createElement(VenuePage));
  await waitFor(() => assert.ok(screen.getByText('區總部')));

  const user = userEvent.setup();
  const dtInputs = container.querySelectorAll('input[type="datetime-local"]');
  await user.type(dtInputs[0], '2027-05-15T19:00');
  await user.type(dtInputs[1], '2027-05-15T21:00');

  const textInputs = [...container.querySelectorAll('form input:not([type]), form input[type="tel"], form input[type="email"], form input[type="number"]')];
  // textInputs: [0] 姓名, [1] 電話, [2] 電郵, [3] 旅團, [4] 活動名稱, [5] 參加人數, [6] 職位, [7] 用途
  const nameInput = textInputs[0];
  const phoneInput = textInputs[1];
  const emailInput = container.querySelector('input[type="email"]');
  const activityInput = textInputs[4];
  const countInput = textInputs[5];

  await user.type(nameInput, '陳大文');
  await user.type(phoneInput, '91234567');
  await user.type(activityInput, '旅集會');
  await user.type(countInput, '25');
  await user.click(container.querySelector('form input[type="checkbox"]'));

  // 1) 未填電郵
  await user.click(screen.getByRole('button', { name: '提交申請' }));
  assert.ok(screen.getByRole('alert').textContent.includes('電郵'));
  assert.equal(upstreamPosts.length, 0);

  // 2) 無效電郵格式
  await user.type(emailInput, 'bad-email');
  await user.click(screen.getByRole('button', { name: '提交申請' }));
  assert.ok(screen.getByRole('alert').textContent.includes('有效電郵'));
  assert.equal(upstreamPosts.length, 0);

  // 3) 有效電郵 → 成功提交到模擬 GS
  await user.clear(emailInput);
  await user.type(emailInput, 'chan@example.com');
  await user.click(screen.getByRole('button', { name: '提交申請' }));

  await waitFor(() => assert.ok(screen.getByText('VB-20270515-001')));
  assert.ok(screen.getByText(/已寄出申請確認電郵/));
  assert.equal(upstreamPosts.length, 1);
  assert.equal(upstreamPosts[0].action, 'submitVenueRequest');
  assert.equal(upstreamPosts[0].email, 'chan@example.com');
});

test('活動知會頁：純提交表單，不發出 listActivityNotices 且不顯示公開列表', async (t) => {
  const { upstreamGets, upstreamPosts } = installTransport(t);
  const { container } = render(React.createElement(ActivityPage));
  await waitFor(() => assert.ok(screen.getByRole('button', { name: '提交知會' })));

  assert.ok(!upstreamGets.includes('listActivityNotices'), '不得呼叫 listActivityNotices');
  assert.equal(screen.queryByText('已遞交嘅活動知會'), null);
  assert.ok(screen.getByText(/本頁只提供遞交，已提交記錄不會公開顯示/));

  const user = userEvent.setup();
  const selects = container.querySelectorAll('form select');
  await user.type(container.querySelector('input[list="troop-options"]'), '港島第82旅');
  const allTextInputs = [...container.querySelectorAll('form input:not([type])')];
  // [0]=troop(list), [1]=activityName, [2]=location, [3]=leaderName, [4]=other
  await user.type(allTextInputs[1], '大潭遠足');
  await user.selectOptions(selects[0], '童軍');
  await user.selectOptions(selects[1], '遠足');
  const dts = container.querySelectorAll('input[type="datetime-local"]');
  await user.type(dts[0], '2027-06-01T09:00');
  await user.type(dts[1], '2027-06-01T17:00');
  await user.type(allTextInputs[2], '大潭郊野公園');
  const nums = container.querySelectorAll('input[type="number"]');
  await user.type(nums[0], '20');
  await user.type(nums[1], '3');
  await user.type(allTextInputs[3], '李領袖');
  await user.type(container.querySelector('input[type="tel"]'), '98765432');

  await user.click(screen.getByRole('button', { name: '提交知會' }));
  await waitFor(() => assert.ok(screen.getByText('AN-20270515-001')));
  assert.ok(!upstreamGets.includes('listActivityNotices'));
  assert.equal(upstreamPosts.length, 1);
  assert.equal(upstreamPosts[0].action, 'submitActivityNotice');
});
