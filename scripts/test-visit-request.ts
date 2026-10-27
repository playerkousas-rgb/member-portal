/** 聯絡區會：共用驗證及真實 proxy handler 的模擬 GS 測試。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET, POST } from '../app/api/proxy/route';
import { sanitizeTroopsDirectory } from '../lib/troops';
import { prepareVisitRequest, validateVisitRequestDirectory } from '../lib/visitRequest';

Object.assign(process.env, { NODE_ENV: 'test' });
process.env.MEMBER_DEV_APIBASE = 'http://mock-gs.test/exec';
const KEY = 'test-server-only-key +%=水';
process.env.MEMBER_SKW_APIKEY = KEY;
const REF = 'TR-20261027-1234';
const PRIVATE_PHONE = 'LEADER-PRIVATE-91234567';
const PRIVATE_EMAIL = 'leader-private@example.invalid';

const directory = {
  districtCode: 'SKW', districtName: '筲箕灣區', leaderPhone: PRIVATE_PHONE, leaderEmail: PRIVATE_EMAIL,
  troops: [
    {
      troop: '1745', label: '港島第1745旅', organizer: '測試學校', meetingTime: '',
      instagramUrl: '', facebookUrl: '', websiteUrl: '', leaderName: '私人領袖姓名',
      leaderPhone: PRIVATE_PHONE, leaderEmail: PRIVATE_EMAIL,
      sectionCounts: { gh: '0', cub: '', scout: '1', venture: '0', rover: '' },
      units: [{ section: 'scout', unitCode: '', label: '童軍團', meetingTime: '', location: '',
        instagramUrl: '', facebookUrl: '', websiteUrl: '', phone: PRIVATE_PHONE, email: PRIVATE_EMAIL }],
    },
    {
      troop: '82', label: '港島第82旅', organizer: '', meetingTime: '',
      instagramUrl: '', facebookUrl: '', websiteUrl: '', sectionCounts: { cub: '1' },
      units: [{ section: 'cub', unitCode: '', label: '幼童軍團' }],
    },
  ],
};
const cleanDirectory = sanitizeTroopsDirectory(directory);
const base = { type: 'visit', troop: '1745', section: 'scout', purpose: '希望區幹部來旅團交流', wantReply: false };
let ipNumber = 0;

type MockOptions = {
  directory?: unknown;
  directoryFailure?: string;
  locked?: boolean;
  submitBody?: unknown;
  submitStatus?: number;
  submitThrows?: boolean;
  directoryThrows?: boolean;
  publicData?: Record<string, unknown>;
};

function mockGs(t: import('node:test').TestContext, options: MockOptions = {}) {
  const calls: { action: string; body?: Record<string, unknown>; url: string }[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    assert.equal(url.origin, 'http://mock-gs.test');
    const posted = init?.method === 'POST' ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
    const action = posted ? String(posted.action) : String(url.searchParams.get('action'));
    calls.push({ action, body: posted, url: url.toString() });
    if (posted) assert.equal(posted.apiKey, KEY);
    else assert.equal(url.searchParams.get('apiKey'), KEY);
    if ((action === 'listDistrictTroops' && options.directoryThrows) || (action === 'submitVisitRequest' && options.submitThrows)) {
      throw new Error('mock network timeout');
    }
    let result: unknown;
    let status = 200;
    if (action === 'getSystem') result = { ok: true, data: { locked: !!options.locked, lockMessage: '維護中', leaderPhone: PRIVATE_PHONE } };
    else if (action === 'listDistrictTroops') result = options.directoryFailure
      ? { ok: false, error: options.directoryFailure }
      : { ok: true, data: options.directory === undefined ? directory : options.directory };
    else if (options.publicData && action in options.publicData) result = { ok: true, data: options.publicData[action] };
    else {
      result = options.submitBody === undefined
        ? { ok: true, data: { id: 'vr_test', refCode: REF, leaderPhone: PRIVATE_PHONE, leaderEmail: PRIVATE_EMAIL, apiKey: KEY } }
        : options.submitBody;
      status = options.submitStatus || 200;
    }
    return new Response(JSON.stringify(result), { status, headers: { 'Content-Type': 'application/json' } });
  });
  return calls;
}

async function post(body: Record<string, unknown>, action = 'submitVisitRequest') {
  const request = new NextRequest('http://member.test/api/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `test-${++ipNumber}` },
    body: JSON.stringify({ districtCode: 'SKW', action, _website: '', _startedAt: Date.now() - 3_000, ...body }),
  });
  const response = await POST(request);
  return { status: response.status, body: await response.json() as { ok: boolean; error?: string; data?: Record<string, unknown> } };
}

async function get(action: string) {
  const response = await GET(new NextRequest(`http://member.test/api/proxy?districtCode=SKW&action=${encodeURIComponent(action)}`));
  return { status: response.status, body: await response.json() as { ok: boolean; error?: string; data?: unknown } };
}

test('欄位驗證：邀請須活動名稱；回覆須有效類別及聯絡資料', () => {
  for (const input of [
    { ...base, type: 'invite', activityName: '' },
    { ...base, type: 'invite', activityName: ' '.repeat(5) },
    { ...base, wantReply: true, contactType: '', contact: '91234567' },
    { ...base, wantReply: true, contactType: 'fax', contact: '91234567' },
    { ...base, wantReply: true, contactType: 'phone', contact: '  ' },
  ]) assert.equal(prepareVisitRequest(input).ok, false);
  for (const contactType of ['phone', 'email', 'ig', 'fb']) {
    assert.equal(prepareVisitRequest({ ...base, type: 'invite', activityName: '周年典禮', wantReply: true, contactType, contact: '測試帳號' }).ok, true);
  }
});

test('欄位邊界：日期、目的、長度及正整數嚴格驗證', () => {
  for (const date of ['2026-02-29', '2026-13-01', '2026-04-31', '2026/01/01', '2026-1-01', '0000-01-01']) {
    assert.equal(prepareVisitRequest({ ...base, preferredDate: date }).ok, false, date);
  }
  for (const date of ['', '2024-02-29', '2000-02-29', '2026-12-31']) {
    assert.equal(prepareVisitRequest({ ...base, preferredDate: date }).ok, true, date);
  }
  for (const count of [0, -1, 1.5, '0', '-1', '1.5', '1e2', '0x10', 'abc', [], {}, '9007199254740992']) {
    assert.equal(prepareVisitRequest({ ...base, attendeeCount: count }).ok, false, String(count));
  }
  for (const count of ['', 1, '42', '0002']) assert.equal(prepareVisitRequest({ ...base, attendeeCount: count }).ok, true);
  assert.equal(prepareVisitRequest({ ...base, purpose: '1234' }).ok, false);
  assert.equal(prepareVisitRequest({ ...base, purpose: '12345' }).ok, true);
  assert.equal(prepareVisitRequest({ ...base, purpose: 'x'.repeat(2001) }).ok, false);
  assert.equal(prepareVisitRequest({ ...base, activityName: 'x'.repeat(200) }).ok, true);
  assert.equal(prepareVisitRequest({ ...base, activityName: 'x'.repeat(201) }).ok, false);
  assert.equal(prepareVisitRequest({ ...base, preferredTime: 'x'.repeat(41) }).ok, false);
  assert.equal(prepareVisitRequest({ ...base, location: 'x'.repeat(201) }).ok, false);
  assert.equal(prepareVisitRequest({ ...base, wantReply: true, contactName: 'x'.repeat(81), contactType: 'phone', contact: '9' }).ok, false);
  assert.equal(prepareVisitRequest({ ...base, wantReply: true, contactType: 'phone', contact: '9'.repeat(161) }).ok, false);
  assert.equal(prepareVisitRequest({ ...base, purpose: { arbitrary: 'object' } }).ok, false);
  assert.equal(prepareVisitRequest({ ...base, wantReply: 'true', contact: '9' }).ok, false);
});

test('公開名錄核對：不存在的旅、無效及未開設支部都被拒絕，全旅可以', () => {
  for (const entry of [
    { ...base, troop: '99999' }, { ...base, section: 'cub' }, { ...base, section: 'invalid' },
  ]) {
    const prepared = prepareVisitRequest(entry);
    assert.ok(!prepared.ok || validateVisitRequestDirectory(prepared.payload, cleanDirectory));
  }
  const allTroop = prepareVisitRequest({ ...base, section: '' });
  assert.ok(allTroop.ok);
  assert.equal(validateVisitRequestDirectory(allTroop.payload, cleanDirectory), '');
});

test('proxy 探訪成功：明確不要求回覆時刪除所有聯絡欄、僅轉發白名單，回傳 TR 編號', async (t) => {
  const calls = mockGs(t);
  const result = await post({ ...base, contactName: '舊稱呼', contactType: 'phone', contact: '91234567',
    status: 'accepted', districtNote: '不可傳送', apiKey: 'attacker-key', attendeeCount: '03' });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { ok: true, data: { refCode: REF } });
  const submit = calls.find((call) => call.action === 'submitVisitRequest')?.body;
  assert.ok(submit);
  assert.equal(submit.wantReply, false);
  assert.equal(submit.attendeeCount, 3);
  for (const key of ['contactName', 'contactType', 'contact', 'status', 'districtNote', '_startedAt', '_website']) {
    assert.equal(Object.hasOwn(submit, key), false, `${key} 不應被轉發`);
  }
  assert.equal(submit.apiKey, KEY, '僅 server 端注入 key，不能由 client 覆蓋');
  assert.deepEqual(calls.map((call) => call.action), ['getSystem', 'listDistrictTroops', 'submitVisitRequest']);
  assert.ok(!JSON.stringify(result.body).includes(KEY));
  assert.ok(!JSON.stringify(result.body).includes(PRIVATE_PHONE));
  assert.ok(!JSON.stringify(result.body).includes(PRIVATE_EMAIL));
});

test('不要求回覆時先刪除過長或無效的舊聯絡資料，再驗證及轉發', async (t) => {
  const calls = mockGs(t);
  const result = await post({ ...base, contactName: 'x'.repeat(6000), contactType: 'invalid', contact: 'y'.repeat(6000) });
  assert.equal(result.status, 200);
  const payload = calls.find((call) => call.action === 'submitVisitRequest')?.body;
  assert.ok(payload);
  for (const field of ['contactName', 'contactType', 'contact']) assert.equal(Object.hasOwn(payload, field), false);
});

test('proxy 邀請成功：需要回覆時只轉發自願提供嘅聯絡欄位', async (t) => {
  const calls = mockGs(t);
  const result = await post({ ...base, type: 'invite', activityName: '周年典禮', wantReply: true,
    contactName: '陳小姐', contactType: 'email', contact: 'applicant@example.invalid' });
  assert.equal(result.status, 200);
  const payload = calls.find((call) => call.action === 'submitVisitRequest')?.body;
  assert.equal(payload?.contactName, '陳小姐');
  assert.equal(payload?.contactType, 'email');
  assert.equal(payload?.contact, 'applicant@example.invalid');
  assert.equal(result.body.data?.refCode, REF);
});

test('proxy 拒絕無效表單，連模擬 GS POST 都不會發出', async (t) => {
  const calls = mockGs(t);
  const cases: { input: Record<string, unknown>; error: RegExp }[] = [
    { input: { ...base, type: 'invite' }, error: /活動名稱/ },
    { input: { ...base, wantReply: true, contact: '91234567' }, error: /聯絡方法類別/ },
    { input: { ...base, wantReply: true, contactType: 'phone' }, error: /聯絡資料/ },
    { input: { ...base, troop: '99999' }, error: /旅團/ },
    { input: { ...base, section: 'cub' }, error: /支部/ },
    { input: { ...base, section: 'xyz' }, error: /支部/ },
    { input: { ...base, purpose: '短' }, error: /5 至 2000/ },
    { input: { ...base, attendeeCount: '1.5' }, error: /正整數/ },
  ];
  for (const item of cases) {
    const response = await post(item.input);
    assert.equal(response.status, 400);
    assert.equal(response.body.ok, false);
    assert.match(response.body.error || '', item.error);
  }
  assert.equal(calls.filter((call) => call.action === 'submitVisitRequest').length, 0);
});

test('proxy 名錄讀取失敗、格式異常或系統鎖定時 fail closed', async (t) => {
  const lockedCalls = mockGs(t, { locked: true });
  const locked = await post(base);
  assert.equal(locked.status, 423);
  assert.deepEqual(lockedCalls.map((call) => call.action), ['getSystem']);
});

test('proxy 名錄錯誤明確顯示，不發送申請', async (t) => {
  const calls = mockGs(t, { directoryFailure: '名錄暫時未就緒' });
  const result = await post(base);
  assert.equal(result.status, 503);
  assert.match(result.body.error || '', /名錄暫時未就緒/);
  assert.ok(!calls.some((call) => call.action === 'submitVisitRequest'));
});

test('proxy 名錄格式異常不允許提交', async (t) => {
  const calls = mockGs(t, { directory: { troops: 'invalid' } });
  const result = await post(base);
  assert.equal(result.status, 503);
  assert.match(result.body.error || '', /名錄回應不正確/);
  assert.ok(!calls.some((call) => call.action === 'submitVisitRequest'));
});

test('名錄連線中斷時明確拒絕提交', async (t) => {
  const calls = mockGs(t, { directoryThrows: true });
  const result = await post(base);
  assert.equal(result.status, 503);
  assert.match(result.body.error || '', /未能連接公開旅團名錄/);
  assert.ok(!calls.some((call) => call.action === 'submitVisitRequest'));
});

test('提交後連線中斷須提示狀態不明，避免重複提交', async (t) => {
  mockGs(t, { submitThrows: true });
  const result = await post(base);
  assert.equal(result.status, 502);
  assert.match(result.body.error || '', /提交狀態未能確認.*切勿重複提交/);
});

test('GS 錯誤及非 2xx 回應不假裝成功；錯誤不洩露 API Key', async (t) => {
  const urlEncodedKey = new URLSearchParams({ key: KEY }).toString().slice(4);
  const calls = mockGs(t, { submitBody: { ok: false, error: `聯絡區會服務尚未就緒 ${KEY} ${encodeURIComponent(KEY)} ${urlEncodedKey}` } });
  const result = await post(base);
  assert.equal(result.status, 502);
  assert.equal(result.body.ok, false);
  assert.match(result.body.error || '', /聯絡區會服務尚未就緒/);
  for (const secret of [KEY, encodeURIComponent(KEY), urlEncodedKey]) assert.ok(!JSON.stringify(result.body).includes(secret));
  assert.ok(calls.some((call) => call.action === 'submitVisitRequest'));
});

test('上游現有限制：121 字不截斷，GS 拒絕時原樣顯示錯誤', async (t) => {
  const calls = mockGs(t, { submitBody: { ok: false, error: '活動名稱太長' } });
  const result = await post({ ...base, type: 'invite', activityName: 'a'.repeat(121) });
  assert.equal(result.status, 502);
  assert.match(result.body.error || '', /活動名稱太長/);
  assert.equal(String(calls.find((call) => call.action === 'submitVisitRequest')?.body?.activityName).length, 121);
});

test('上游現有限制：10000 人不截斷，GS 拒絕時原樣顯示錯誤', async (t) => {
  const calls = mockGs(t, { submitBody: { ok: false, error: '參加人數須為 1 至 9999 的整數' } });
  const result = await post({ ...base, attendeeCount: 10000 });
  assert.equal(result.status, 502);
  assert.match(result.body.error || '', /9999/);
  assert.equal(calls.find((call) => call.action === 'submitVisitRequest')?.body?.attendeeCount, 10000);
});

test('HTTP 錯誤即使含類似成功內容亦不得顯示成功', async (t) => {
  mockGs(t, { submitStatus: 500, submitBody: { ok: true, data: { id: 'vr_x', refCode: REF } } });
  const result = await post(base);
  assert.equal(result.status, 502);
  assert.equal(result.body.ok, false);
  assert.match(result.body.error || '', /HTTP 500/);
});

test('成功回應缺少有效 TR 編號時提示狀態未確認，避免重複提交', async (t) => {
  mockGs(t, { submitBody: { ok: true, data: { id: 'vr_x', refCode: '' } } });
  const result = await post(base);
  assert.equal(result.status, 502);
  assert.match(result.body.error || '', /未能確認.*切勿重複提交/);
});

test('公開名錄及活動回應均剝除領袖私人電話／電郵；私人聯絡 action 全部禁止', async (t) => {
  const calls = mockGs(t, { publicData: {
    listActivityNotices: [{ id: 'a', troop: '1745', activityName: '測試', leaderName: '私人姓名', leaderPhone: PRIVATE_PHONE, leaderEmail: PRIVATE_EMAIL }],
  } });
  const publicDir = await get('listDistrictTroops');
  assert.equal(publicDir.status, 200);
  const dirText = JSON.stringify(publicDir.body);
  for (const secret of [PRIVATE_PHONE, PRIVATE_EMAIL, '私人領袖姓名', KEY, 'leaderPhone', 'leaderEmail']) assert.ok(!dirText.includes(secret), secret);
  const notice = await get('listActivityNotices');
  assert.equal(notice.status, 200);
  for (const secret of [PRIVATE_PHONE, PRIVATE_EMAIL, '私人姓名', KEY]) assert.ok(!JSON.stringify(notice.body).includes(secret), secret);
  const before = calls.length;
  assert.equal((await get('getTroopContacts')).status, 403);
  assert.equal((await post({}, 'getTroopContacts')).status, 403);
  assert.equal((await get('listTroopContacts')).status, 403);
  assert.equal(calls.length, before, '私人 action 不應送到上游');
});

test('其他所有公開 GET 白名單回應不轉發額外領袖私人欄位', async (t) => {
  const secret = { leaderPhone: PRIVATE_PHONE, leaderEmail: PRIVATE_EMAIL };
  mockGs(t, { publicData: {
    getConfig: { districtName: '筲箕灣區', ...secret },
    getPublicInfo: { districtName: '筲箕灣區', troopList: ['港島第1745旅'], ...secret },
    listCourseLinks: [{ courseId: 'c1', title: '課程', contact: '公開課程查詢', ...secret }],
    listVenues: [{ venueId: 'v1', name: '區總部', ...secret }],
    listItems: [{ itemId: 'i1', name: '帳篷', ...secret }],
    listAnnouncements: [{ id: 'n1', title: '公告', ...secret }],
  } });
  for (const action of ['getConfig', 'getSystem', 'getPublicInfo', 'listCourseLinks', 'listVenues', 'listItems', 'listAnnouncements']) {
    const response = await get(action);
    assert.equal(response.status, 200, action);
    const body = JSON.stringify(response.body);
    for (const banned of [PRIVATE_PHONE, PRIVATE_EMAIL, 'leaderPhone', 'leaderEmail', KEY]) {
      assert.ok(!body.includes(banned), `${action} 不應包含 ${banned}`);
    }
  }
});

test('submitActivityNotice 既有提交欄位合約不變', async (t) => {
  const calls = mockGs(t);
  const activity = {
    year: '2026', section: '童軍', nature: '遠足', troop: '港島第1745旅', activityName: '測試活動',
    startDateTime: '2026-11-01T09:00', endDateTime: '2026-11-01T17:00', location: '學校',
    membersCount: 10, leadersCount: 2, parentsCount: 0, leaderName: '負責人', leaderPhone: '91234567',
    leaderEmail: 'leader@example.invalid', note: '備註',
  };
  const result = await post(activity, 'submitActivityNotice');
  assert.equal(result.status, 200);
  const submit = calls.find((call) => call.action === 'submitActivityNotice')?.body;
  assert.deepEqual(submit, { action: 'submitActivityNotice', apiKey: KEY, ...activity });
});
