#!/usr/bin/env bash
#
# Installer for the 'go' directory navigation tool.
# Run once after cloning:  ./install.sh
#
# This just runs the two npm steps; the actual setup (seeding config.json and
# wiring your shell rc) is done by scripts/postinstall.js, which npm runs
# automatically. It is safe to re-run.

set -euo pipefail

GO_HOME="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Installing 'go' from: $GO_HOME"

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is required but was not found on PATH." >&2
  exit 1
fi

# Installs deps and triggers the postinstall hook (seed config + wire rc).
echo "Installing dependencies..."
npm install --prefix "$GO_HOME"

# Puts the 'go-helper' binary on PATH (npm's job, not the hook's).
echo "Linking 'go-helper' globally..."
npm link --prefix "$GO_HOME" >/dev/null

echo "Install complete."
