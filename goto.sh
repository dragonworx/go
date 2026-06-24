#!/bin/bash
# Shell wrapper for the 'goto' directory navigation tool.
# This must be sourced in your .bashrc or .zshrc to work properly.

# Resolve the directory this script lives in, for both bash and zsh, so the
# tool works no matter where the repo was cloned. Exported so index.js and the
# completion scripts use the same location for config/state.
if [ -z "$GOTO_HOME" ]; then
  if [ -n "$BASH_VERSION" ]; then
    GOTO_HOME="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  elif [ -n "$ZSH_VERSION" ]; then
    GOTO_HOME="$(cd "$(dirname "${(%):-%x}")" && pwd)"
  else
    GOTO_HOME="$HOME/.goto"
  fi
  export GOTO_HOME
fi

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
