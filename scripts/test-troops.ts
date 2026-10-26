/**
 * 「區內旅團」公開名錄測試（node:test）。
 * 行法：npm run test:troops
 *
 * 覆蓋：
 *  1. proxy GET allowlist 有 listDistrictTroops，且只含公開唯讀 action
 *  2. sanitizeUnit／sanitizeTroop 欄位白名單（內部欄位 sections/note/active 唔流出）
 *  3. sectionCounts 只限五個支部 key；偽網址清空；異常輸入安全降解
 *  4. unitDetailFields／dialogFields：空欄隱藏、團無資料時回落旅層級
 *  5. TroopDialog SSR：地點欄位、外連 rel="noopener noreferrer"、回落提示、無內部欄位外洩
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  SECTION_META, safePublicUrl, sanitizeTroop, sanitizeTroopsDirectory, sanitizeUnit,
  unitDetailFields, troopFallbackFields, dialogFields,
} from '../lib/troops';
import TroopDialog from '../components/TroopDialog';
import type { DistrictTroop, DistrictUnit } from '../lib/types';

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
  assert.ok(allow.every((name) => name.startsWith('get') || name.startsWith('list')));
});

test('safePublicUrl：只接受 http(s)，偽造協議一律清空', () => {
  assert.equal(safePublicUrl('https://example.com/a'), 'https://example.com/a');
  assert.equal(safePublicUrl('javascript:alert(1)'), '');
  assert.equal(safePublicUrl('data:text/html,<script>'), '');
  assert.equal(safePublicUrl('not a url'), '');
  assert.equal(safePublicUrl(null), '');
});

test('SECTION_META：對齊官網五個支部，順序固定', () => {
  assert.deepEqual(SECTION_META.map((s) => s.key), ['gh', 'cub', 'scout', 'venture', 'rover']);
  assert.deepEqual(SECTION_META.map((s) => s.label), ['小童軍', '幼童軍', '童軍', '深資童軍', '樂行童軍']);
});

test('sanitizeUnit：只保留 8 個公開欄位，非法支部清走，內部旗標唔流出', () => {
  const clean = sanitizeUnit({
    troop: '101', section: 'scout', unitCode: 'A1', label: '空童軍團',
    meetingTime: '星期六 14:00', location: '校本部',
    instagramUrl: 'https://ig.test/x', facebookUrl: '', websiteUrl: '',
    active: true, publicVisible: true, note: '內部備註',
  });
  assert.deepEqual(Object.keys(clean).sort(),
    ['facebookUrl', 'instagramUrl', 'label', 'location', 'meetingTime', 'section', 'unitCode', 'websiteUrl'].sort());
  assert.equal(clean.section, 'scout');
  assert.equal(clean.unitCode, 'A1');
  assert.equal(clean.location, '校本部');
  assert.ok(!JSON.stringify(clean).includes('內部備註'));
  assert.equal(sanitizeUnit({ section: 'hack', label: 'x' }).section, '');
  assert.equal(sanitizeUnit({ section: 'scout', instagramUrl: 'javascript:alert(1)' }).instagramUrl, '');
});

test('sanitizeTroop：旅層級 7 欄＋sectionCounts 五支部白名單＋units 巢狀清洗', () => {
  const clean = sanitizeTroop({
    troop: '101', label: '港島第101旅', organizer: '筲箕灣東官立中學',
    meetingTime: '', instagramUrl: '', facebookUrl: '', websiteUrl: '',
    sectionCounts: { scout: '1+A1', venture: '1+A1+S1', gh: '', hack: '999' },
    units: [
      { section: 'scout', unitCode: '', label: '童軍團', meetingTime: '星期六', location: '學校',
        instagramUrl: 'https://ig.test', facebookUrl: '', websiteUrl: '', note: 'secret' },
      { section: 'hack', unitCode: '', label: '假支部', meetingTime: '', location: '',
        instagramUrl: '', facebookUrl: '', websiteUrl: '' },
    ],
    note: '內部備註', active: true, publicVisible: true,
  });
  assert.equal(clean.troop, '101');
  assert.deepEqual(Object.keys(clean.sectionCounts || {}).sort(), ['scout', 'venture']);
  assert.equal(clean.sectionCounts?.scout, '1+A1');
  assert.equal(clean.units?.length, 1, '非法支部嘅團被過濾');
  assert.equal(clean.units?.[0].location, '學校');
  const serialized = JSON.stringify(clean);
  for (const banned of ['secret', '內部備註', '"active"', 'publicVisible', 'hack']) {
    assert.ok(!serialized.includes(banned), `公開輸出唔應包含 ${banned}`);
  }
});

test('sanitizeTroopsDirectory：上游結構異常都安全降解，空列被過濾', () => {
  const dir = sanitizeTroopsDirectory({
    districtCode: ' SKW ', districtName: '筲箕灣區',
    troops: [
      { troop: '17', label: '第十七旅', units: 'nope' },
      { troop: '', label: '' },
      { label: '冇旅號嘅旅', sectionCounts: { cub: '2' } },
      null,
    ],
  });
  assert.equal(dir.districtCode, 'SKW');
  assert.equal(dir.troops.length, 2);
  assert.deepEqual(dir.troops[0].units, []);
  assert.equal(dir.troops[1].sectionCounts?.cub, '2');
  assert.deepEqual(sanitizeTroopsDirectory(null).troops, []);
  assert.deepEqual(sanitizeTroopsDirectory({}).troops, []);
});

test('欄位生成：空欄唔顯示；團無獨立資料時 dialogFields 回落旅層級並標示', () => {
  const troop: DistrictTroop = {
    troop: '17', label: '港島第17旅', organizer: '慈幼中學',
    meetingTime: '逢星期六 14:00', instagramUrl: 'https://ig.test/17',
    facebookUrl: '', websiteUrl: 'https://web.test',
  };
  const richUnit: DistrictUnit = {
    section: 'scout', unitCode: '', label: '童軍團',
    meetingTime: '逢星期日 09:00', location: '東區會所',
    instagramUrl: '', facebookUrl: 'https://fb.test/scout', websiteUrl: '',
  };
  const rich = dialogFields(troop, richUnit);
  assert.equal(rich.fallback, false);
  const labels = rich.fields.map((f) => f.label);
  assert.deepEqual(labels, ['主辦機構', '集會時間', '集會地點', 'Facebook']);
  assert.equal(rich.fields.find((f) => f.label === '集會地點')?.value, '東區會所');

  const emptyUnit: DistrictUnit = {
    section: 'cub', unitCode: '', label: '幼童軍團',
    meetingTime: '', location: '', instagramUrl: '', facebookUrl: '', websiteUrl: '',
  };
  const fallback = dialogFields(troop, emptyUnit);
  assert.equal(fallback.fallback, true);
  assert.deepEqual(fallback.fields.map((f) => f.label), ['主辦機構', '集會時間', 'Instagram', '網頁']);
  assert.equal(unitDetailFields(emptyUnit).length, 0);
  assert.ok(troopFallbackFields(troop).length >= 2);
});

test('TroopDialog：渲染團獨立資料（含地點），外連全部新分頁＋noopener noreferrer', () => {
  const troop: DistrictTroop = {
    troop: '101', label: '港島第101旅', organizer: '筲箕灣東官立中學',
    meetingTime: '', instagramUrl: '', facebookUrl: '', websiteUrl: '',
  };
  const unit: DistrictUnit = {
    section: 'scout', unitCode: 'A1', label: '空童軍團',
    meetingTime: '逢星期六 14:00–16:00', location: '校本部禮堂',
    instagramUrl: 'https://ig.test/skw101a1', facebookUrl: 'https://fb.test/skw101a1',
    websiteUrl: 'https://web.test/101a1',
  };
  const html = renderToStaticMarkup(
    createElement(TroopDialog, { troop, unit, districtName: '筲箕灣區', onClose: () => {} }),
  );
  assert.ok(html.includes('role="dialog"') && html.includes('aria-modal="true"'));
  assert.ok(html.includes('空童軍團'));
  assert.ok(html.includes('A1'));
  assert.ok(html.includes('校本部禮堂'));
  assert.ok(html.includes('筲箕灣東官立中學'));
  assert.equal((html.match(/target="_blank"/g) || []).length, 3);
  assert.equal((html.match(/rel="noopener noreferrer"/g) || []).length, 3);
  assert.ok(!html.includes('fallback-note'));
});

test('TroopDialog：團無資料時顯示回落提示同旅層級欄位；完全空白顯示 fallback 文案', () => {
  const troop: DistrictTroop = {
    troop: '42', label: '港島第42旅', organizer: '主辦 A',
    meetingTime: '', instagramUrl: '', facebookUrl: '', websiteUrl: '',
  };
  const emptyUnit: DistrictUnit = {
    section: 'gh', unitCode: '', label: '小童軍團',
    meetingTime: '', location: '', instagramUrl: '', facebookUrl: '', websiteUrl: '',
  };
  const html = renderToStaticMarkup(
    createElement(TroopDialog, { troop, unit: emptyUnit, onClose: () => {} }),
  );
  assert.ok(html.includes('此團暫未提供獨立資料'));
  assert.ok(html.includes('主辦 A'));
  assert.ok(!/<a /g.test(html));

  const blankTroop: DistrictTroop = {
    troop: '99', label: '第九十九旅', organizer: '',
    meetingTime: '', instagramUrl: '', facebookUrl: '', websiteUrl: '',
  };
  const blank = renderToStaticMarkup(
    createElement(TroopDialog, { troop: blankTroop, unit: emptyUnit, onClose: () => {} }),
  );
  assert.ok(blank.includes('暫時未有更詳細資料'));
});
