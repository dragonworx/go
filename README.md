# go - Quick Directory Navigation Tool

A small command-line tool for bookmarking directories and jumping between them.
Bookmarks are ordered by how recently you used them, so your busiest folders
stay at the top.

## Commands

| Command  | Action                                                  |
|----------|---------------------------------------------------------|
| `go`     | Interactive picker — jump to a bookmark (recent first)  |
| `go <name>` | Jump straight to a bookmark by name (tab-completes)  |
| `go +`   | Add the current directory as a bookmark                 |
| `go -`   | Remove a bookmark (interactive picker)                  |
| `go ?`   | List all bookmarks, most recently used first            |
| `go !`   | Prune bookmarks whose paths no longer exist             |

The long flags `--add`, `--remove`, `--list`, and `--prune` still work as
aliases. Add `--no-color` to any command for plain, un-colored output (colors
are also disabled automatically when output isn't a terminal or when `NO_COLOR`
is set).

## Installation

**Requires:** Node.js and npm (the `go-helper` binary runs on Node; `install.sh`
checks for `npm`).

Clone anywhere — the tool figures out its own location, so you are not tied to
a specific path.

```bash
git clone <repo-url> go
cd go
npm install -g .          # links the binary AND runs setup
```

That single command:
1. links the `go-helper` binary onto your `PATH`,
2. triggers the **postinstall hook**, which seeds an empty `config.json` (if you
   don't have one) and adds `source "<repo>/go.sh"` to your `~/.bashrc` (or
   `~/.zshrc`).

Then start a new shell (or `source ~/.bashrc`) and you're ready.

`./install.sh` does the same thing (`npm install` + `npm link`) if you prefer a
script.

### The postinstall hook

`npm install` runs `scripts/postinstall.js` automatically. It seeds the config
and wires your shell rc (idempotently — re-running never duplicates the line).
It does **not** put `go-helper` on your `PATH` — only a global/link install
does that — so use `npm install -g .` or `npm link`, not a bare local install.

The hook is skipped when `CI` is set, when run with `npm install
--ignore-scripts`, or when `GO_SKIP_POSTINSTALL=1` is exported. In those cases
run `./install.sh` (or add the `source` line) yourself.

### Manual install

If you'd rather wire it by hand:

```bash
npm link                                       # go-helper on PATH
echo 'source "'"$PWD"'/go.sh"' >> ~/.bashrc    # or ~/.zshrc
```

### How it finds its files

`go.sh` resolves its own directory and exports `GO_HOME`, which `index.js` and
the completion scripts read. State (`config.json`, `.usage.json`,
`.jump_target`) lives inside the repo and is git-ignored, so each machine keeps
its own bookmarks and the repo stays clean. To store state elsewhere, export
`GO_HOME=/some/path` before sourcing `go.sh`.

## Usage

### Jumping

Run `go` with no arguments for an interactive list (most recently used first),
or jump directly by name:

```bash
go            # pick from the list
go myapp      # jump straight there (Tab completes names and commands)
```

### Adding a bookmark

```bash
cd ~/projects/my-app
go +
# Enter a name (defaults to the folder name)
```

### Listing

```bash
go ?
```

```
Bookmarks (most recently used first):

  myapp     /home/you/projects/my-app  (just now)
  configs   /etc/nginx                 (3d ago)
  docs      /home/you/documents        (never used)
```

The list is colorized: names in bold cyan, paths in green, and the "time ago"
in yellow. A bookmark whose path no longer exists is shown struck-through with
a red `(missing)` marker so you can spot stale entries at a glance. Pass
`--no-color` for plain output:

```bash
go ? --no-color
```

### Pruning stale bookmarks

Over time some bookmarked directories get moved or deleted. `go !` (or
`go --prune`) walks every bookmark and removes the ones whose paths no longer
exist, reporting what it dropped:

```bash
go !
```

```
Removed oldproject -> /home/you/projects/old
Removed scratch    -> /tmp/scratch

Pruned 2 stale bookmarks.
```

If everything still resolves it reports `Nothing to prune` and leaves your
bookmarks untouched. Their usage timestamps are cleaned up alongside the
removed entries.

### Removing

```bash
go -
# Pick the bookmark to delete from the list
```

> **Note on `go ?` and `go !`:** `?` is a shell glob and `!` triggers history
> expansion in interactive bash. In the rare case the shell rewrites them
> before `go` sees them, quote the token (`go '?'`, `go '!'`) or use the long
> form (`go --list`, `go --prune`).

### Editing bookmarks manually

`config.json` is a plain `{ "name": "/path" }` map you can edit directly:

```json
{
  "myapp": "/home/you/projects/my-app",
  "configs": "/etc/nginx"
}
```

Usage timestamps are tracked separately in `.usage.json`, so editing
`config.json` never disturbs your recency ordering.

## Troubleshooting

If `go` isn't found after installing:
1. Start a new shell, or `source ~/.bashrc` (or `~/.zshrc`).
2. Confirm the line is present: `grep go.sh ~/.bashrc`.
3. Confirm the binary is linked: `command -v go-helper`.

If tab completion isn't working, reload your shell config. `jq` makes
completion faster but isn't required (there's a grep/sed fallback).

## Uninstalling

```bash
npm unlink -g go-cli
# Remove the "source .../go.sh" line from your ~/.bashrc or ~/.zshrc
# Then delete the repo directory.
```
