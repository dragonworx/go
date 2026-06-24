#!/bin/zsh
# Zsh completion for the 'goto' directory navigation tool

_goto_completion() {
  local config_file="${GOTO_HOME:-$HOME/.goto}/config.json"

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

  # Add command tokens (short flags plus their long-flag aliases)
  local -a flags
  flags=(
    '-a:Add current directory as a bookmark'
    '-d:Delete a saved bookmark'
    '-r:Rename a bookmark'
    '-l:List bookmarks, most recently used first'
    '-p:Prune bookmarks whose paths no longer exist'
    '-h:Show help information'
    '-v:Show the version'
    '-f:With --add, overwrite an existing bookmark'
    '--add:Add current directory as a bookmark'
    '--delete:Delete a saved bookmark'
    '--rename:Rename a bookmark'
    '--list:List bookmarks, most recently used first'
    '--prune:Prune bookmarks whose paths no longer exist'
    '--help:Show help information'
    '--version:Show the version'
    '--force:With --add, overwrite an existing bookmark'
    '--no-color:Plain output with no ANSI colors'
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

# Register the completion function for the 'goto' command
compdef _goto_completion goto
