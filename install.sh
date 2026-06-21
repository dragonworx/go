#!/usr/bin/env bash
#
# Installer for the 'go' directory navigation tool.
# Run once after cloning:  ./install.sh
#
# It is safe to re-run; it won't duplicate the line in your shell rc.

set -euo pipefail

# Absolute path to this repo (works regardless of where it was cloned).
GO_HOME="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_LINE="source \"$GO_HOME/go.sh\""

echo "Installing 'go' from: $GO_HOME"

# 1. Dependencies + put the 'go-helper' binary on PATH.
if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is required but was not found on PATH." >&2
  exit 1
fi

echo "Installing dependencies..."
npm install --prefix "$GO_HOME" --silent

echo "Linking 'go-helper' globally..."
npm link --prefix "$GO_HOME" >/dev/null

# 2. Seed an empty config if none exists yet (keeps your bookmarks per-machine).
if [ ! -f "$GO_HOME/config.json" ]; then
  echo '{}' > "$GO_HOME/config.json"
  echo "Created empty config.json"
fi

# 3. Wire the wrapper into the right shell rc file.
case "${SHELL:-}" in
  *zsh) RC="$HOME/.zshrc" ;;
  *)    RC="$HOME/.bashrc" ;;
esac

if [ -f "$RC" ] && grep -qF "$GO_HOME/go.sh" "$RC"; then
  echo "Already wired into $RC"
else
  {
    echo ""
    echo "# Load 'go' directory navigation tool"
    echo "$SOURCE_LINE"
  } >> "$RC"
  echo "Added wrapper to $RC"
fi

echo ""
echo "Done. Start a new shell, or run:  $SOURCE_LINE"
echo "Then use:  go +   (add)   go -   (remove)   go ?   (list)   go   (jump)"
