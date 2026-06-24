'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const {
  validateName,
  addBookmark,
  removeBookmark,
  renameBookmark,
  pruneBookmarks,
  orderByLastUsed,
  timeAgo,
} = require('../lib');

test('validateName trims and accepts a clean name', () => {
  const res = validateName('  myapp  ', {});
  assert.deepStrictEqual(res, { ok: true, name: 'myapp' });
});

test('validateName rejects empty / whitespace-only', () => {
  assert.strictEqual(validateName('   ', {}).ok, false);
  assert.strictEqual(validateName('', {}).ok, false);
  assert.strictEqual(validateName(undefined, {}).ok, false);
});

test('validateName rejects whitespace inside the name', () => {
  assert.strictEqual(validateName('my app', {}).ok, false);
});

test('validateName rejects names starting with a dash', () => {
  assert.strictEqual(validateName('-l', {}).ok, false);
  assert.strictEqual(validateName('--list', {}).ok, false);
});

test('validateName rejects duplicates unless forced', () => {
  const config = { myapp: '/a' };
  assert.strictEqual(validateName('myapp', config).ok, false);
  assert.deepStrictEqual(validateName('myapp', config, { force: true }), { ok: true, name: 'myapp' });
});

test('addBookmark prepends the new entry and reports added vs updated', () => {
  const config = { a: '/a', b: '/b' };
  const res = addBookmark(config, 'c', '/c');
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.updated, false);
  assert.deepStrictEqual(Object.keys(res.config), ['c', 'a', 'b']);
  // original config is untouched (pure)
  assert.deepStrictEqual(config, { a: '/a', b: '/b' });
});

test('addBookmark with force overwrites the path and flags updated', () => {
  const config = { a: '/old' };
  const res = addBookmark(config, 'a', '/new', { force: true });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.updated, true);
  assert.strictEqual(res.config.a, '/new');
});

test('addBookmark without force refuses to overwrite', () => {
  assert.strictEqual(addBookmark({ a: '/old' }, 'a', '/new').ok, false);
});

test('removeBookmark drops the entry and its usage', () => {
  const res = removeBookmark({ a: '/a', b: '/b' }, { a: 5, b: 6 }, 'a');
  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(res.config, { b: '/b' });
  assert.deepStrictEqual(res.usage, { b: 6 });
});

test('removeBookmark errors on unknown name', () => {
  assert.strictEqual(removeBookmark({}, {}, 'nope').ok, false);
});

test('renameBookmark carries the usage timestamp across', () => {
  const res = renameBookmark({ old: '/p', other: '/o' }, { old: 42 }, 'old', 'new');
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.config.new, '/p');
  assert.ok(!('old' in res.config));
  assert.strictEqual(res.usage.new, 42);
  assert.ok(!('old' in res.usage));
});

test('renameBookmark to the same name is a harmless no-op', () => {
  const res = renameBookmark({ a: '/p' }, { a: 1 }, 'a', 'a');
  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(res.config, { a: '/p' });
  assert.deepStrictEqual(res.usage, { a: 1 });
});

test('renameBookmark rejects collision with a different existing name', () => {
  assert.strictEqual(renameBookmark({ a: '/a', b: '/b' }, {}, 'a', 'b').ok, false);
});

test('renameBookmark errors on unknown source', () => {
  assert.strictEqual(renameBookmark({}, {}, 'nope', 'x').ok, false);
});

test('pruneBookmarks removes only missing paths', () => {
  const config = { keep: '/keep', gone: '/gone' };
  const exists = (p) => p === '/keep';
  const res = pruneBookmarks(config, { keep: 1, gone: 2 }, exists);
  assert.deepStrictEqual(res.removed, ['gone']);
  assert.deepStrictEqual(res.config, { keep: '/keep' });
  assert.deepStrictEqual(res.usage, { keep: 1 });
});

test('orderByLastUsed sorts recent first, keeping never-used in place', () => {
  const names = ['a', 'b', 'c'];
  const usage = { a: 100, c: 200 };
  assert.deepStrictEqual(orderByLastUsed(names, usage), ['c', 'a', 'b']);
});

test('timeAgo formats relative times with an injected now', () => {
  const now = 1_000_000_000_000;
  assert.strictEqual(timeAgo(0, now), 'never used');
  assert.strictEqual(timeAgo(undefined, now), 'never used');
  assert.strictEqual(timeAgo(now - 5_000, now), 'just now');
  assert.strictEqual(timeAgo(now - 5 * 60_000, now), '5m ago');
  assert.strictEqual(timeAgo(now - 3 * 3600_000, now), '3h ago');
  assert.strictEqual(timeAgo(now - 2 * 86400_000, now), '2d ago');
  assert.strictEqual(timeAgo(now - 60 * 86400_000, now), '2mo ago');
  assert.strictEqual(timeAgo(now - 400 * 86400_000, now), '1y ago');
});
