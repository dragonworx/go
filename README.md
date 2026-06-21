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

The long flags `--add`, `--remove`, and `--list` still work as aliases.

## Installation

**Requires:** Node.js and npm (the `go-helper` binary runs on Node; `install.sh`
checks for `npm`).

Clone anywhere — the tool figures out its own location, so you are not tied to
a specific path.

```bash
git clone <repo-url> go
cd go
./install.sh
```

The installer:
1. installs dependencies (`npm install`),
2. links the `go-helper` binary onto your `PATH` (`npm link`),
3. creates an empty `config.json` if you don't have one yet,
4. adds `source "<repo>/go.sh"` to your `~/.bashrc` (or `~/.zshrc`).

Then start a new shell (or `source ~/.bashrc`) and you're ready.

### Manual install

If you'd rather not run the script:

```bash
npm install
npm link
echo 'source "'"$PWD"'/go.sh"' >> ~/.bashrc   # or ~/.zshrc
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

### Removing

```bash
go -
# Pick the bookmark to delete from the list
```

> **Note on `go ?`:** `?` is a shell glob. In the rare case your current
> directory contains a single-character filename, the shell may expand `?`
> before `go` sees it — quote it (`go '?'`) or use `go --list` in that case.

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
