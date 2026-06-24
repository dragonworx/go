#!/usr/bin/env bash
#
# Installer for the 'goto' directory navigation tool.
# Run once after cloning:  ./install.sh
#
# Steps:
#   1. npm install   — local deps (so the linked binary resolves them)
#   2. npm link      — puts the 'goto-helper' binary on PATH
#   3. setup-shell   — seeds config.json and wires your shell rc (idempotent)
#
# It is safe to re-run.

set -euo pipefail

GOTO_HOME="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Installing 'goto' from: $GOTO_HOME"

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is required but was not found on PATH." >&2
  exit 1
fi

if command -v goto >/dev/null 2>&1 && [ "$(type -t goto 2>/dev/null)" != "function" ]; then
  echo "Warning: a 'goto' command already exists on your PATH; the shell function will shadow it." >&2
fi

echo "Installing dependencies..."
npm install --prefix "$GOTO_HOME"

echo "Linking 'goto-helper' globally..."
# Run from inside the repo: `npm link --prefix` does not reliably register the
# global link, so cd into the package directory in a subshell.
( cd "$GOTO_HOME" && npm link >/dev/null )

echo "Wiring shell setup..."
node "$GOTO_HOME/scripts/setup-shell.js"

echo "Install complete."
