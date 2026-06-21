#!/bin/bash
# Bash completion for the 'go' directory navigation tool

_go_completion() {
  local cur="${COMP_WORDS[COMP_CWORD]}"
  local config_file="$HOME/dev/go/config.json"

  # If config file doesn't exist, no completion
  if [ ! -f "$config_file" ]; then
    return 0
  fi

  # Extract location names from config.json
  # This uses jq if available, otherwise falls back to basic parsing
  local locations
  if command -v jq &> /dev/null; then
    locations=$(jq -r 'keys[]' "$config_file" 2>/dev/null)
  else
    # Fallback: extract keys using grep and sed
    locations=$(grep -o '"[^"]*"[[:space:]]*:' "$config_file" | sed 's/"//g' | sed 's/[[:space:]]*://')
  fi

  # Add command flags
  local flags="--add --remove --list --help"

  # Combine locations and flags for completion
  local options="$locations $flags"

  # Generate completions
  COMPREPLY=($(compgen -W "$options" -- "$cur"))

  return 0
}

# Register the completion function for the 'go' command
complete -F _go_completion go
