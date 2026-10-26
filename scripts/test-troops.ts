/**
 * 「區內旅團」公開名錄測試（node:test）。
 * 行法：node --experimental-strip-types --experimental-transform-types scripts/test-troops.ts
 *
 * 覆蓋：
 *  1. proxy GET allowlist 有 listDistrictTroops，且管理／登入 action 唔可以混入
 *  2. sanitizeTroopsDirectory 欄位白名單（內部欄位 sections/note/active/publicVisible 唔流出）
 *  3. 網址驗證（javascript:/data: 偽連結清走）、空列過濾、異常輸入
 *  4. troopDetailFields 空白欄位唔顯示、外連欄位帶 href
 *  5. TroopDialog SSR：詳情內容、rel="noopener noreferrer"＋target="_blank"、無內部欄位外洩
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { safePublicUrl, sanitizeTroop, sanitizeTroopsDirectory, troopDetailFields } from '../lib/troops';
import TroopDialog from '../components/TroopDialog';
import type { DistrictTroop } from '../lib/types';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROXY_ROUTE = path.join(HERE, '..', 'app', 'api', 'proxy', 'route.ts');

/** 直接讀 proxy 原始碼抽出 GET_ACTIONS，同 check-member-alignment 用同一 regex，守住安全邊界。 */
function readProxyGetAllowlist(): string[] {
  const src = readFileSync(PROXY_ROUTE, 'utf8');
  const block = (src.match(/GET_ACTIONS\s*=\s*new Set\(\[([\s\S]*?)\]\)/) || [])[1] || '';
  return [...block.matchAll(/'([A-Za-z0-9_]+)'/g)].map((m) => m[1]);
}

test('proxy allowlist：名錄 action 獲放行，白名單同預期公開清單精確一致（管理 action 唔可以混入）', () => {
  const allow = readProxyGetAllowlist();
  assert.deepEqual(
    [...allow].sort(),
    [
      'getConfig',
      'getPublicInfo',
      'getSystem',
      'listActivityNotices',
      'listAnnouncements',
      'listCourseLinks',
      'listDistrictTroops',
      'listItems',
      'listVenues',
    ].sort(),
  );
  // 合約規定：白名單只可以係公開唯讀 action
  assert.ok(allow.every((name) => name.startsWith('get') || name.startsWith('list')));
});

test('safePublicUrl：只接受 http(s)，偽造協議一律清空', () => {
  assert.equal(safePublicUrl('https://example.com/a'), 'https://example.com/a');
  assert.equal(safePublicUrl('http://example.com'), 'http://example.com/');
  assert.equal(safePublicUrl('javascript:alert(1)'), '');
  assert.equal(safePublicUrl('data:text/html,<script>'), '');
  assert.equal(safePublicUrl('  '), '');
  assert.equal(safePublicUrl('not a url'), '');
  assert.equal(safePublicUrl(null), '');
});

test('sanitizeTroop：只保留 7 個公開欄位，內部欄位全部剝走', () => {
  const clean = sanitizeTroop({
    troop: '17', label: '筲箕灣第十七旅', org: '某辦學團體', organizer: '主辦機構 A',
    meetingTime: '逢星期六 14:00', instagramUrl: 'https://ig.com/x',
    facebookUrl: 'https://fb.com/x', websiteUrl: 'https://x.test',
    // 以下係內部欄位，唔可以流出
    gh: 1, cub: 1, scout: 0, venture: 0, rover: 0,
    sections: { gh: 1 }, note: '內部備註：領袖人手不足', active: true, publicVisible: true,
  });
  assert.deepEqual(Object.keys(clean).sort(),
    ['facebookUrl', 'instagramUrl', 'label', 'meetingTime', 'organizer', 'troop', 'websiteUrl'].sort());
  assert.equal(clean.troop, '17');
  assert.equal(clean.organizer, '主辦機構 A');
  const serialized = JSON.stringify(clean);
  for (const leaked of ['內部備註', 'sections', 'publicVisible', '"note"', '"active"']) {
    assert.ok(!serialized.includes(leaked), `公開輸出唔應包含 ${leaked}`);
  }
});

test('sanitizeTroopsDirectory：上游結構異常都安全降解，空列被過濾、偽連結被清走', () => {
  const upstream = {
    districtCode: ' SKW ', districtName: '筲箕灣區',
    troops: [
      { troop: '17', label: '第十七旅', instagramUrl: 'javascript:alert(1)', note: 'secret' },
      { troop: '', label: '' },
      { label: '冇旅號嘅旅', websiteUrl: 'https://web.test' },
      'not-an-object',
    ],
  };
  const dir = sanitizeTroopsDirectory(upstream);
  assert.equal(dir.districtCode, 'SKW');
  assert.equal(dir.districtName, '筲箕灣區');
  assert.equal(dir.troops.length, 2);
  assert.equal(dir.troops[0].instagramUrl, '');
  assert.ok(!JSON.stringify(dir).includes('secret'));
  assert.equal(dir.troops[1].troop, '');
  // URL 建構子會標準化（補尾斜線），屬預期行為
  assert.equal(dir.troops[1].websiteUrl, 'https://web.test/');

  assert.deepEqual(sanitizeTroopsDirectory(null).troops, []);
  assert.deepEqual(sanitizeTroopsDirectory({ troops: 'nope' }).troops, []);
  assert.deepEqual(sanitizeTroopsDirectory({}).troops, []);
});

test('troopDetailFields：空白欄位唔顯示，外連欄位帶 href＋external 標記', () => {
  const partial: DistrictTroop = {
    troop: '17', label: '第十七旅', organizer: '主辦 A', meetingTime: '',
    instagramUrl: 'https://ig.test', facebookUrl: '', websiteUrl: '',
  };
  const fields = troopDetailFields(partial);
  assert.deepEqual(fields.map((f) => f.key), ['organizer', 'instagramUrl']);
  const ig = fields.find((f) => f.key === 'instagramUrl')!;
  assert.equal(ig.href, 'https://ig.test');
  assert.equal(ig.external, true);
  assert.equal(troopDetailFields({
    troop: '99', label: '全空旅', organizer: '', meetingTime: '',
    instagramUrl: '', facebookUrl: '', websiteUrl: '',
  }).length, 0);
});

test('TroopDialog：渲染已填欄位、隱藏空白欄位，外連全部新分頁＋noopener noreferrer', () => {
  const troop: DistrictTroop = {
    troop: '17', label: '筲箕灣第十七旅', organizer: '主辦機構 A', meetingTime: '逢星期六 14:00–16:00',
    instagramUrl: 'https://ig.test/skw17', facebookUrl: 'https://fb.test/skw17',
    websiteUrl: 'https://web.test',
  };
  const html = renderToStaticMarkup(
    createElement(TroopDialog, { troop, districtName: '筲箕灣區', onClose: () => {} }),
  );

  assert.ok(html.includes('role="dialog"'));
  assert.ok(html.includes('aria-modal="true"'));
  assert.ok(html.includes('筲箕灣第十七旅'));
  assert.ok(html.includes('主辦機構 A'));
  assert.ok(html.includes('逢星期六 14:00–16:00'));
  assert.ok(html.includes('旅團編號：17'));

  const anchorCount = (html.match(/<a /g) || []).length;
  assert.equal(anchorCount, 3, 'IG／FB／網頁三個外連');
  assert.equal((html.match(/target="_blank"/g) || []).length, 3);
  assert.equal((html.match(/rel="noopener noreferrer"/g) || []).length, 3);
  for (const url of ['https://ig.test/skw17', 'https://fb.test/skw17', 'https://web.test']) {
    assert.ok(html.includes(url));
  }
});

test('TroopDialog：空白資料唔顯示空行；冇任何詳情時顯示 fallback；內部欄位唔渲染', () => {
  const minimal: DistrictTroop = {
    troop: '42', label: '第四十二旅', organizer: '', meetingTime: '',
    instagramUrl: '', facebookUrl: '', websiteUrl: '',
  };
  const html = renderToStaticMarkup(
    createElement(TroopDialog, { troop: minimal, onClose: () => {} }),
  );
  assert.ok(html.includes('暫時未有更詳細資料'));
  assert.ok(!html.includes('主辦機構</dt>'));
  assert.ok(!html.includes('集會時間</dt>'));
  assert.ok(!/<a /g.test(html));
});
