'use strict';

// End-to-end tests that drive the real CLI as a subprocess. Each test gets an
// isolated GOTO_HOME (a temp dir) so config/usage/jump state never leaks
// between cases or onto the developer's machine. Interactive prompts are
// avoided by always passing names on the command line.

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const INDEX = path.join(__dirname, '..', 'index.js');

let home; // fresh GOTO_HOME per test
let target; // an existing directory to bookmark

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'goto-test-'));
  target = path.join(home, 'target');
  fs.mkdirSync(target);
});

afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true });
});

// Run the CLI. `cwd` defaults to the bookmarkable target dir so `goto -a`
// records a real, existing path.
function run(args, { cwd = target } = {}) {
  return spawnSync(process.execPath, [INDEX, ...args], {
    cwd,
    env: { ...process.env, GOTO_HOME: home, NO_COLOR: '1' },
    encoding: 'utf8',
  });
}

const readJSON = (file) =>
  fs.existsSync(path.join(home, file)) ? JSON.parse(fs.readFileSync(path.join(home, file), 'utf8')) : null;

test('--help prints usage and exits 0', () => {
  const r = run(['--help']);
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /jump between bookmarked directories/);
});

test('--version prints the package version', () => {
  const r = run(['--version']);
  assert.strictEqual(r.status, 0);
  const { version } = require('../package.json');
  assert.match(r.stdout, new RegExp(`goto v${version.replace(/\./g, '\\.')}`));
});

test('add with an explicit name records the current directory', () => {
  const r = run(['-a', 'proj']);
  assert.strictEqual(r.status, 0);
  assert.deepStrictEqual(readJSON('config.json'), { proj: target });
});

test('add rejects an invalid (dash-leading) name', () => {
  const r = run(['-a', '-l']);
  // -l is parsed as the list command, not a name; nothing is added.
  assert.strictEqual(readJSON('config.json'), null);
});

test('list shows an added bookmark', () => {
  run(['-a', 'proj']);
  const r = run(['-l']);
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /proj/);
  assert.match(r.stdout, new RegExp(target));
});

test('jump by name writes the jump target and bumps usage', () => {
  run(['-a', 'proj']);
  const r = run(['proj']);
  assert.strictEqual(r.status, 0);
  assert.strictEqual(fs.readFileSync(path.join(home, '.jump_target'), 'utf8'), target);
  assert.ok(typeof readJSON('.usage.json').proj === 'number');
});

test('add --force overwrites an existing bookmark path', () => {
  run(['-a', 'proj']); // points at target
  const other = path.join(home, 'other');
  fs.mkdirSync(other);
  const r = run(['-a', 'proj', '--force'], { cwd: other });
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /updated/);
  assert.strictEqual(readJSON('config.json').proj, other);
});

test('add without --force refuses to overwrite (exit 1)', () => {
  run(['-a', 'proj']);
  const r = run(['-a', 'proj']);
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /already exists/);
});

test('rename preserves the usage timestamp', () => {
  run(['-a', 'proj']);
  run(['proj']); // touch usage
  const before = readJSON('.usage.json').proj;
  const r = run(['-r', 'proj', 'work']);
  assert.strictEqual(r.status, 0);
  assert.deepStrictEqual(Object.keys(readJSON('config.json')), ['work']);
  assert.strictEqual(readJSON('.usage.json').work, before);
});

test('delete by name removes the bookmark', () => {
  run(['-a', 'proj']);
  const r = run(['-d', 'proj']);
  assert.strictEqual(r.status, 0);
  assert.deepStrictEqual(readJSON('config.json'), {});
});

test('prune removes bookmarks whose paths no longer exist', () => {
  fs.writeFileSync(
    path.join(home, 'config.json'),
    JSON.stringify({ good: target, dead: '/no/such/path/xyz' })
  );
  const r = run(['-p']);
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /Pruned 1 stale bookmark\b/);
  assert.deepStrictEqual(readJSON('config.json'), { good: target });
});

test('jumping to a missing path errors and writes no target', () => {
  fs.writeFileSync(path.join(home, 'config.json'), JSON.stringify({ dead: '/no/such/path/xyz' }));
  const r = run(['dead']);
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /missing path/);
  assert.match(r.stderr, /goto -p/);
  assert.ok(!fs.existsSync(path.join(home, '.jump_target')));
});

test('unknown bookmark name errors with guidance', () => {
  const r = run(['nope']);
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /not found/);
});
