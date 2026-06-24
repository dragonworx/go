#!/bin/bash
# Shell wrapper for the 'goto' directory navigation tool.
# This must be sourced in your .bashrc or .zshrc to work properly.

# Resolve the directory this script lives in, for both bash and zsh, so the
# tool works no matter where the repo was cloned (or renamed). Exported so
# index.js and the completion scripts use the same location for config/state.
#
# We derive the location from the script itself on every source rather than
# trusting a pre-existing GOTO_HOME: an exported-but-stale value (e.g. after the
# repo folder is renamed) would otherwise stick across `source ~/.bashrc` and
# point the completion/config at a path that no longer exists.
_goto_script_dir=""
if [ -n "$BASH_VERSION" ]; then
  _goto_script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
elif [ -n "$ZSH_VERSION" ]; then
  _goto_script_dir="$(cd "$(dirname "${(%):-%x}")" && pwd)"
fi

if [ -n "$_goto_script_dir" ]; then
  # Sourced from a shell that exposes the script path — this is authoritative.
  GOTO_HOME="$_goto_script_dir"
elif [ -z "$GOTO_HOME" ] || [ ! -f "$GOTO_HOME/goto.sh" ]; then
  # No script path available and no valid GOTO_HOME — fall back.
  GOTO_HOME="$HOME/.goto"
fi
export GOTO_HOME
unset _goto_script_dir

goto() {
  local jump_file="$GOTO_HOME/.jump_target"

  # Remove any existing jump target file
  [ -f "$jump_file" ] && rm -f "$jump_file"

  # Run the helper (allows interactive prompts to show)
  goto-helper "$@"
  local exit_code=$?

  # Check if a jump target was written
  if [ -f "$jump_file" ]; then
    local target_dir
    target_dir=$(cat "$jump_file")
    rm -f "$jump_file"

    # Change to the target directory
    if [ -d "$target_dir" ]; then
      cd "$target_dir" || return 1
    else
      echo "Error: Directory not found: $target_dir"
      return 1
    fi
  fi

  return $exit_code
}

# Load shell completion
if [ -n "$BASH_VERSION" ]; then
  source "$GOTO_HOME/goto-completion.bash"
elif [ -n "$ZSH_VERSION" ]; then
  source "$GOTO_HOME/goto-completion.zsh"
fi
