#!/bin/zsh
# Zsh completion for the 'go' directory navigation tool

_go_completion() {
  local config_file="$HOME/dev/go/config.json"

  # If config file doesn't exist, no completion
  if [ ! -f "$config_file" ]; then
    return 0
  fi

  # Extract location names from config.json
  local -a locations
  if command -v jq &> /dev/null; then
    locations=(${(f)"$(jq -r 'keys[]' "$config_file" 2>/dev/null)"})
  else
    # Fallback: extract keys using grep and sed
    locations=(${(f)"$(grep -o '"[^"]*"[[:space:]]*:' "$config_file" | sed 's/"//g' | sed 's/[[:space:]]*://')"})
  fi

  # Add command flags
  local -a flags
  flags=(
    '--add:Add current directory as a bookmark'
    '--remove:Remove a saved bookmark'
    '--list:List all saved bookmarks'
    '--help:Show help information'
  )

  # Offer completions
  _arguments \
    '1: :->location_or_flag'

  case $state in
    location_or_flag)
      _describe 'locations' locations
      _describe 'flags' flags
      ;;
  esac
}

# Register the completion function for the 'go' command
compdef _go_completion go
