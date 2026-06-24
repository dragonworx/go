#!/usr/bin/env node
//
// Runs automatically after `npm install` (npm's postinstall lifecycle hook).
//
// Deliberately conservative: it does NOT edit your shell rc file. Mutating
// ~/.bashrc as a side effect of installing dependencies is surprising, so the
// rc wiring lives in the EXPLICIT setup step (`./install.sh` or
// `npm run setup` → scripts/setup-shell.js) that you run on purpose.
//
// All this hook does is seed an empty config.json and print the next step.
// It never fails the install: any problem is reported as a note and we exit 0.
// Skipped in CI and when GOTO_SKIP_POSTINSTALL is set.

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');

function note(msg) {
  console.log(`[goto] ${msg}`);
}

try {
  if (process.env.GOTO_SKIP_POSTINSTALL) {
    note('GOTO_SKIP_POSTINSTALL set — skipping postinstall.');
    process.exit(0);
  }
  if (process.env.CI) {
    note('CI detected — skipping postinstall.');
    process.exit(0);
  }

  // Seed an empty config so first use doesn't error.
  const configFile = path.join(REPO, 'config.json');
  if (!fs.existsSync(configFile)) {
    fs.writeFileSync(configFile, '{}\n', 'utf8');
    note('Created empty config.json');
  }

  note('Dependencies installed. To finish setup (link the binary and wire your');
  note('shell), run:  ./install.sh   (or: npm link && npm run setup)');
} catch (err) {
  // Never break `npm install` over setup convenience.
  note(`Postinstall note skipped (${err.message}).`);
}

process.exit(0);
