# go - Quick Directory Navigation Tool

A simple command-line tool for bookmarking and quickly jumping to frequently used directories.

## Installation

The tool is already installed and configured! The `go` command is now available in your shell.

## Location

- Tool directory: `~/dev/go`
- Config file: `~/dev/go/config.json`
- Shell wrapper: `~/dev/go/go.sh`

## Usage

### Jumping to a location (main use)

Simply run `go` with no arguments to see an interactive list of your bookmarked locations:

```bash
go
```

Use arrow keys to select a location and press Enter. You'll be instantly transported to that directory!

### Jumping directly by name

If you know the exact name of your bookmark, you can jump directly:

```bash
go myapp
```

**Tab completion is supported!** Start typing a location name and press Tab to auto-complete:

```bash
go de<TAB>    # Completes to "go demo" if "demo" is a saved location
go --a<TAB>   # Completes to "go --add"
```

### Adding a bookmark

Navigate to a directory you want to bookmark, then run:

```bash
go --add
```

You'll be prompted to enter a memorable name (e.g., "projects", "docs", "configs").

Example:
```bash
cd ~/projects/my-app
go --add
# Name: myapp
```

### Listing all bookmarks

To see all your saved bookmarks:

```bash
go --list
```

This displays all bookmarks in the format: `name -> path`

### Removing a bookmark

To remove a bookmark:

```bash
go --remove
```

You'll see an interactive list to select which bookmark to delete.

### Editing bookmarks manually

The bookmarks are stored in `~/dev/go/config.json` as a simple JSON file:

```json
{
  "myapp": "/home/user/projects/my-app",
  "configs": "/etc/nginx",
  "docs": "/home/user/documents"
}
```

You can edit this file directly to add, remove, or update bookmarks.

## Examples

```bash
# Bookmark your home directory
cd ~
go --add
# Name it "home"

# Bookmark a project
cd ~/projects/important-project
go --add
# Name it "important"

# List all bookmarks
go --list

# Jump to bookmarked location (interactive)
go
# Select "important" from the list

# Or jump directly
go home

# Remove a bookmark
go --remove
# Select which one to delete
```

## Troubleshooting

If the `go` command is not found after installation:
1. Make sure `~/.bashrc` has been sourced: `source ~/.bashrc`
2. Verify the line was added to `~/.bashrc`: `tail ~/.bashrc`
3. For new terminal sessions, the command will be automatically available

If tab completion is not working:
1. Reload your shell configuration: `source ~/.bashrc` (or `source ~/.zshrc` for zsh)
2. Verify the completion scripts exist in `~/dev/go/`
3. The completion script requires `jq` for optimal performance (falls back to grep/sed if not available)

## Uninstalling

To remove the tool:

```bash
# Remove the npm global link
cd ~/dev/go && npm unlink -g

# Remove the tool directory
rm -rf ~/dev/go

# Remove the line from .bashrc
# Edit ~/.bashrc and remove the lines:
# # Load 'go' directory navigation tool
# source ~/dev/go/go.sh
```
