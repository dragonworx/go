#!/bin/bash
# Shell wrapper for the 'go' directory navigation tool
# This must be sourced in your .bashrc or .zshrc to work properly

go() {
  local jump_file="$HOME/dev/go/.jump_target"

  # Remove any existing jump target file
  [ -f "$jump_file" ] && rm -f "$jump_file"

  # Run the helper (allows interactive prompts to show)
  go-helper "$@"
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
  source "$HOME/dev/go/go-completion.bash"
elif [ -n "$ZSH_VERSION" ]; then
  source "$HOME/dev/go/go-completion.zsh"
fi
