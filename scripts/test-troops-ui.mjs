/**
 * 「區內旅團」篩選 chips ＋ 排序選單嘅 DOM 測試（唔需要 router／後台）。
 */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://member.test/troops' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = await import('react');
const { render, screen, cleanup } = await import('@testing-library/react');
const userEvent = (await import('@testing-library/user-event')).default;
const TroopDirectoryControls = (await import('../components/TroopDirectoryControls.tsx')).default;

afterEach(() => cleanup());

const counts = { all: 4, open: 1, organization: 1, school: 1, unknown: 1 };

function setup(overrides = {}) {
  const state = { filter: 'all', sort: 'troop', ...overrides };
  const changes = { filter: [], sort: [] };
  const view = render(React.createElement(TroopDirectoryControls, {
    counts,
    filter: state.filter,
    sort: state.sort,
    shownUnits: 6,
    onFilterChange: (value) => changes.filter.push(value),
    onSortChange: (value) => changes.sort.push(value),
  }));
  return { ...view, changes };
}

test('显示全部／公開旅／機構旅／學校旅／未分類同各自數量', () => {
  setup();
  for (const label of ['全部 (4)', '公開旅 (1)', '機構旅 (1)', '學校旅 (1)', '未分類 (1)']) {
    assert.ok(screen.getByRole('button', { name: label }), `缺少 ${label}`);
  }
  assert.ok(screen.getByText(/顯示 4 \/ 4 個旅團 · 6 個團/));
  assert.ok(screen.getByText(/學校旅多數只收校內學生/));
});

test('冇未分類旅團時唔顯示該 chip', () => {
  render(React.createElement(TroopDirectoryControls, {
    counts: { ...counts, all: 3, unknown: 0 },
    filter: 'all', sort: 'troop', shownUnits: 3,
    onFilterChange: () => {}, onSortChange: () => {},
  }));
  assert.equal(screen.queryByRole('button', { name: /未分類/ }), null);
});

test('撳篩選同改排序會回傳新值，選單四個選項齊', async () => {
  const { changes } = setup();
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: '機構旅 (1)' }));
  assert.deepEqual(changes.filter, ['organization']);
  await user.selectOptions(screen.getByLabelText('排序方式'), 'schoolFirst');
  assert.deepEqual(changes.sort, ['schoolFirst']);
  assert.deepEqual(
    [...screen.getByLabelText('排序方式').options].map((option) => option.value),
    ['troop', 'openFirst', 'organizationFirst', 'schoolFirst'],
  );
});

test('目前篩選會標 active，摘要列出該類別提示', () => {
  setup({ filter: 'school', sort: 'openFirst' });
  assert.equal(screen.getByRole('button', { name: '學校旅 (1)' }).getAttribute('aria-pressed'), 'true');
  assert.equal(screen.getByRole('button', { name: '全部 (4)' }).getAttribute('aria-pressed'), 'false');
  assert.ok(screen.getByText(/顯示 1 \/ 4 個旅團/));
  // 摘要同分類說明都會提到「只收校內學生」，用 getAllByText  assert 至少一處。
  assert.ok(screen.getAllByText(/多數只收校內學生/).length >= 1);
});
