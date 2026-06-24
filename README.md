# goto - Quick Directory Navigation Tool

A small command-line tool for bookmarking directories and jumping between them.
Bookmarks are ordered by how recently you used them, so your busiest folders
stay at the top.

> **Note on the name:** `goto` is installed as a shell *function* that wraps a
> Node helper (it has to change your shell's directory, which a child process
> can't do). The function is named `goto` to avoid shadowing the Go toolchain's
> `go` command. If you already have another `goto` on your `PATH`, the function
> will take precedence in interactive shells.

## Commands

| Command              | Action                                                       |
|----------------------|--------------------------------------------------------------|
| `goto`               | Interactive picker — jump to a bookmark (recent first)       |
| `goto <name>`        | Jump straight to a bookmark by name (tab-completes)         |
| `goto -a [name]`     | Bookmark the current directory (prompts if no name given)   |
| `goto -d [name]`     | Delete a bookmark (interactive picker if no name given)     |
| `goto -r [old] [new]`| Rename a bookmark, preserving its recency (interactive too) |
| `goto -l`            | List all bookmarks, most recently used first                |
| `goto -p`            | Prune bookmarks whose paths no longer exist                 |
| `goto -h`            | Show available commands and usage                           |
| `goto -v`            | Print the version                                            |

The long flags `--add`, `--delete`, `--rename`, `--list`, `--prune`, `--help`,
and `--version` are aliases for the short forms. Add `--force` (`-f`) to `goto -a`
to overwrite an existing bookmark. Add `--no-color` to any command for plain,
un-colored output (colors are also disabled automatically when output isn't a
terminal or when `NO_COLOR` is set).

Bookmark names must be a single token — no spaces, and not starting with `-`
(those are reserved for flags) — so `goto <name>` and tab-completion work
cleanly.

## Installation

**Requires:** Node.js **≥ 16** and npm (the `goto-helper` binary runs on Node;
`install.sh` checks for `npm`).

Clone anywhere — the tool figures out its own location, so you are not tied to
a specific path.

```bash
git clone <repo-url> goto
cd goto
./install.sh
```

`./install.sh` does three things:

1. `npm install` — installs dependencies (`inquirer`) into this repo's own
   `node_modules`. **This step is required.** A global/link install only
   *symlinks* the `goto-helper` binary back to this source tree; Node then
   resolves `require('inquirer')` starting from here, so without a local
   `node_modules` the linked binary fails at runtime with
   `Error: Cannot find module 'inquirer'`.
2. `npm link` — puts the `goto-helper` binary on your `PATH`.
3. `npm run setup` — seeds an empty `config.json` (if you don't have one) and
   adds `source "<repo>/goto.sh"` to your `~/.bashrc` (or `~/.zshrc`),
   idempotently — re-running never duplicates the line.

Then start a new shell (or `source ~/.bashrc`) and you're ready.

### Why setup is a separate, explicit step

Editing your shell rc file is done **only** by the explicit setup step
(`./install.sh` or `npm run setup`) — never silently as a side effect of
`npm install`. The `postinstall` hook that npm runs automatically just seeds
`config.json` and prints the next step; it does not touch your rc file or your
`PATH`.

### Manual install

If you'd rather wire it by hand:

```bash
npm install                                     # local deps (so the link resolves them)
npm link                                        # goto-helper on PATH
echo 'source "'"$PWD"'/goto.sh"' >> ~/.bashrc   # or ~/.zshrc
```

### How it finds its files

`goto.sh` resolves its own directory and exports `GOTO_HOME`, which `index.js`
and the completion scripts read. State (`config.json`, `.usage.json`,
`.jump_target`) lives inside the repo and is git-ignored, so each machine keeps
its own bookmarks and the repo stays clean. To store state elsewhere, export
`GOTO_HOME=/some/path` before sourcing `goto.sh`.

## Usage

### Jumping

Run `goto` with no arguments for an interactive list (most recently used
first), or jump directly by name:

```bash
goto            # pick from the list
goto myapp      # jump straight there (Tab completes names and commands)
```

Jumping to a bookmark whose directory no longer exists is refused with a hint
to run `goto -p`; the bookmark's recency is left untouched so stale entries
don't float to the top.

### Adding a bookmark

```bash
cd ~/projects/my-app
goto -a                 # prompts for a name (defaults to the folder name)
goto -a myapp           # or name it directly, no prompt
goto -a myapp --force   # overwrite an existing 'myapp' with the current dir
```

### Renaming a bookmark

```bash
goto -r oldname newname   # direct
goto -r                   # interactive: pick one, then type the new name
```

The recency timestamp follows the bookmark across the rename.

### Listing

```bash
goto -l
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
goto -l --no-color
```

### Pruning stale bookmarks

Over time some bookmarked directories get moved or deleted. `goto -p` (or
`goto --prune`) walks every bookmark and removes the ones whose paths no longer
exist, reporting what it dropped:

```bash
goto -p
```

```
Removed oldproject -> /home/you/projects/old
Removed scratch    -> /tmp/scratch

Pruned 2 stale bookmarks.
```

If everything still resolves it reports `Nothing to prune` and leaves your
bookmarks untouched. Their usage timestamps are cleaned up alongside the
removed entries.

### Deleting

```bash
goto -d           # pick the bookmark to delete from the list
goto -d myapp     # or name it directly
```

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

## Development

```bash
npm install
npm test          # runs the unit + CLI test suite (node --test)
```

Pure bookmark logic lives in `lib.js` (unit-tested in `test/lib.test.js`); the
CLI wiring in `index.js` is exercised end-to-end in `test/cli.test.js`, which
runs the real binary against a throwaway `GOTO_HOME`.

## Troubleshooting

If `goto` isn't found after installing:
1. Start a new shell, or `source ~/.bashrc` (or `~/.zshrc`).
2. Confirm the line is present: `grep goto.sh ~/.bashrc`.
3. Confirm the binary is linked: `command -v goto-helper`.

If `goto` runs but fails with `Error: Cannot find module 'inquirer'` (or another
dependency), the repo is missing its local `node_modules`. The global install
only symlinks the `goto-helper` binary back here, so Node resolves dependencies
from this tree. Fix it by installing deps in the repo:

```bash
cd <repo> && npm install
```

If tab completion isn't working, reload your shell config. `jq` makes
completion faster but isn't required (there's a grep/sed fallback).

## Uninstalling

```bash
npm unlink -g goto-cli
# Remove the "source .../goto.sh" line from your ~/.bashrc or ~/.zshrc
# Then delete the repo directory.
```

## License

MIT — see [LICENSE](LICENSE).
