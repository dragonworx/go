#!/usr/bin/env node
//
// Explicit shell-setup step. Run on purpose (via `./install.sh` or
// `npm run setup`) — NOT automatically on `npm install`. Because the user opts
// into it, it is allowed to edit the shell rc file. It:
//   1. seeds an empty config.json if there isn't one,
//   2. adds `source "<repo>/goto.sh"` to the user's shell rc (idempotent),
//   3. reminds about PATH if the goto-helper binary isn't linked yet.
//
// It never throws: any problem is reported as a note and we exit 0.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const GOTO_SH = path.join(REPO, 'goto.sh');
const SOURCE_LINE = `source "${GOTO_SH}"`;

function note(msg) {
  console.log(`[goto] ${msg}`);
}

try {
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
  const tildeSh = GOTO_SH.startsWith(os.homedir())
    ? '~' + GOTO_SH.slice(os.homedir().length)
    : GOTO_SH;
  const alreadyWired = existing.includes(GOTO_SH) || existing.includes(tildeSh);
  if (alreadyWired) {
    note(`Already wired into ${rc}`);
  } else {
    fs.appendFileSync(rc, `\n# Load 'goto' directory navigation tool\n${SOURCE_LINE}\n`);
    note(`Added wrapper to ${rc}`);
  }

  // 3. Remind about PATH if the binary isn't linked yet (local install).
  let linked = false;
  try {
    execSync('command -v goto-helper', { stdio: 'ignore', shell: '/bin/bash' });
    linked = true;
  } catch (_) {}

  if (!linked) {
    note('Run `npm link` (or install with `npm install -g .`) to put goto-helper on your PATH.');
  }

  note(`Done. Start a new shell or run: ${SOURCE_LINE}`);
  note('Then: goto -a  (add)   goto -d  (delete)   goto -l  (list)   goto  (jump)');
} catch (err) {
  note(`Setup skipped (${err.message}). You can re-run: npm run setup`);
}

process.exit(0);
