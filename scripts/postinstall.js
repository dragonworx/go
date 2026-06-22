#!/usr/bin/env node
//
// Runs automatically after `npm install` (npm's postinstall lifecycle hook).
// It does the parts of setup that npm itself doesn't:
//   1. seed an empty config.json if there isn't one,
//   2. add `source "<repo>/go.sh"` to the user's shell rc (idempotent).
//
// Putting the `go-helper` binary on PATH is npm's job (the "bin" field), which
// only happens on a global/link install — so this hook reminds you to run
// `npm link` if it isn't found.
//
// It never fails the install: any problem is reported as a note and we exit 0.
// Skipped in CI and when GO_SKIP_POSTINSTALL is set.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const GO_SH = path.join(REPO, 'go.sh');
const SOURCE_LINE = `source "${GO_SH}"`;

function note(msg) {
  console.log(`[go] ${msg}`);
}

try {
  // Don't touch developer/CI machines or when scripts are opted out.
  if (process.env.GO_SKIP_POSTINSTALL) {
    note('GO_SKIP_POSTINSTALL set — skipping shell setup.');
    process.exit(0);
  }
  if (process.env.CI) {
    note('CI detected — skipping shell rc setup.');
    process.exit(0);
  }

  // 1. Seed an empty config so first use doesn't error.
  const configFile = path.join(REPO, 'config.json');
  if (!fs.existsSync(configFile)) {
    fs.writeFileSync(configFile, '{}\n', 'utf8');
    note('Created empty config.json');
  }

  // 2. Wire the wrapper into the right shell rc (idempotent).
  const shell = process.env.SHELL || '';
  const rc = shell.includes('zsh')
    ? path.join(os.homedir(), '.zshrc')
    : path.join(os.homedir(), '.bashrc');

  const existing = fs.existsSync(rc) ? fs.readFileSync(rc, 'utf8') : '';
  // Detect an existing reference whether it was written as an absolute path or
  // a ~-relative one, so re-running never appends a duplicate.
  const tildeSh = GO_SH.startsWith(os.homedir())
    ? '~' + GO_SH.slice(os.homedir().length)
    : GO_SH;
  const alreadyWired = existing.includes(GO_SH) || existing.includes(tildeSh);
  if (alreadyWired) {
    note(`Already wired into ${rc}`);
  } else {
    fs.appendFileSync(rc, `\n# Load 'go' directory navigation tool\n${SOURCE_LINE}\n`);
    note(`Added wrapper to ${rc}`);
  }

  // 3. Remind about PATH if the binary isn't linked yet (local install).
  let linked = false;
  try {
    execSync('command -v go-helper', { stdio: 'ignore', shell: '/bin/bash' });
    linked = true;
  } catch (_) {}

  if (!linked) {
    note('Run `npm link` (or install with `npm install -g .`) to put go-helper on your PATH.');
  }

  note(`Done. Start a new shell or run: ${SOURCE_LINE}`);
  note('Then: go -a  (add)   go -d  (delete)   go -l  (list)   go  (jump)');
} catch (err) {
  // Never break `npm install` over setup convenience.
  note(`Setup skipped (${err.message}). You can run ./install.sh manually.`);
}

process.exit(0);
