#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const readline = require('readline');
const colors = require('./colors');
const pkg = require('./package.json');
const {
  validateName,
  addBookmark,
  removeBookmark,
  renameBookmark,
  pruneBookmarks,
  orderByLastUsed,
  timeAgo,
} = require('./lib');

// State lives next to the code by default, so the repo works from any clone
// location. `GOTO_HOME` (exported by goto.sh) overrides this when set.
const CONFIG_DIR = process.env.GOTO_HOME || __dirname;
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const JUMP_FILE = path.join(CONFIG_DIR, '.jump_target');
const USAGE_FILE = path.join(CONFIG_DIR, '.usage.json');

// Command aliases. Each command has a short flag and a long flag.
const ADD_CMDS = ['-a', '--add'];
const REMOVE_CMDS = ['-d', '--delete'];
const RENAME_CMDS = ['-r', '--rename'];
const LIST_CMDS = ['-l', '--list'];
const PRUNE_CMDS = ['-p', '--prune'];
const HELP_CMDS = ['-h', '--help'];
const VERSION_CMDS = ['-v', '--version'];

// Ensure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// Decide whether to emit ANSI colors. Disabled by `--no-color`, by NO_COLOR
// (https://no-color.org/), or when stdout isn't a TTY (e.g. piped output).
function configureColor(args) {
  const off = args.includes('--no-color') || process.env.NO_COLOR || !process.stdout.isTTY;
  colors.setEnabled(!off);
}

// Wrapper for inquirer.prompt that adds ESC key support
async function promptWithEscSupport(questions) {
  return new Promise((resolve, reject) => {
    let promptFinished = false;

    // Set up keypress event handling on stdin
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    const onKeypress = (str, key) => {
      if (key && key.name === 'escape' && !promptFinished) {
        promptFinished = true;
        cleanup();
        // Create a user cancellation error
        const err = new Error('User cancelled with ESC');
        reject(err);
      }
    };

    const cleanup = () => {
      process.stdin.removeListener('keypress', onKeypress);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
    };

    process.stdin.on('keypress', onKeypress);

    // Run inquirer prompt
    inquirer.prompt(questions)
      .then((answers) => {
        if (!promptFinished) {
          promptFinished = true;
          cleanup();
          resolve(answers);
        }
      })
      .catch((err) => {
        if (!promptFinished) {
          promptFinished = true;
          cleanup();
          reject(err);
        }
      });
  });
}

// Load or initialize config
function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(data);
    } catch (err) {
      console.error('Error reading config file:', err.message);
      return {};
    }
  }
  return {};
}

// Save config
function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving config file:', err.message);
    process.exit(1);
  }
}

// Write jump target for shell wrapper
function setJumpTarget(targetPath) {
  try {
    fs.writeFileSync(JUMP_FILE, targetPath, 'utf8');
  } catch (err) {
    console.error('Error writing jump target:', err.message);
  }
}

// Load last-used timestamps ({ name: epochMillis }). Stored separately from
// config.json so the bookmark file stays a clean { name: path } map.
function loadUsage() {
  if (fs.existsSync(USAGE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8'));
    } catch (err) {
      return {};
    }
  }
  return {};
}

function saveUsage(usage) {
  try {
    fs.writeFileSync(USAGE_FILE, JSON.stringify(usage, null, 2), 'utf8');
  } catch (err) {
    // Usage tracking is best-effort; ignore write failures.
  }
}

// Record that a bookmark was just jumped to.
function touchUsage(name) {
  const usage = loadUsage();
  usage[name] = Date.now();
  saveUsage(usage);
}

// Resolve a bookmark and jump to it: verify the path still exists (so a stale
// entry doesn't silently bump its recency), write the target for the shell
// wrapper, and record the use. Returns false if the path is missing.
function jumpTo(name, config) {
  if (!fs.existsSync(config[name])) {
    console.error(`Error: "${name}" points to a missing path: ${config[name]}`);
    console.error('Run "goto -p" to prune stale bookmarks.');
    return false;
  }
  setJumpTarget(config[name]);
  touchUsage(name);
  return true;
}

// Print usage / available commands.
function printHelp() {
  const b = colors.boldCyan;
  console.log(`
${colors.bold('goto')} — jump between bookmarked directories

${colors.bold('Usage:')}
  ${b('goto')}                Interactively select a bookmark to jump to
  ${b('goto <name>')}         Jump to the bookmark named <name>

${colors.bold('Commands:')}
  ${b('-a, --add [name]')}    Bookmark the current directory (prompts if no name)
  ${b('-d, --delete [name]')} Remove a bookmark (interactive if no name)
  ${b('-r, --rename [o] [n]')} Rename a bookmark (interactive if args omitted)
  ${b('-l, --list')}          List bookmarks, most recently used first
  ${b('-p, --prune')}         Remove bookmarks whose paths no longer exist
  ${b('-h, --help')}          Show this help
  ${b('-v, --version')}       Show the version

${colors.bold('Options:')}
  ${b('-f, --force')}         With --add, overwrite an existing bookmark
  ${b('--no-color')}          Disable colored output
`);
}

// Main function
async function main() {
  const rawArgs = process.argv.slice(2);
  configureColor(rawArgs);
  // The force flag may sit anywhere on the line; pull it out before positional
  // parsing. `--no-color` is likewise global and stripped here.
  const force = rawArgs.includes('--force') || rawArgs.includes('-f');
  const args = rawArgs.filter((a) => a !== '--no-color' && a !== '--force' && a !== '-f');
  const config = loadConfig();
  const command = args[0];

  // goto -h / --help
  if (HELP_CMDS.includes(command)) {
    printHelp();
    return;
  }

  // goto -v / --version
  if (VERSION_CMDS.includes(command)) {
    console.log(`goto v${pkg.version}`);
    return;
  }

  // goto -a [name] [--force]
  if (ADD_CMDS.includes(command)) {
    const cwd = process.cwd();
    let name = args[1];

    // Prompt only when no name was given on the command line.
    if (name === undefined) {
      const answers = await promptWithEscSupport([
        {
          type: 'input',
          name: 'locationName',
          message: 'Enter a name for this location:',
          default: path.basename(cwd),
          validate: (input) => {
            const res = validateName(input, config, { force });
            return res.ok ? true : res.error;
          },
        },
      ]);
      name = answers.locationName;
    }

    const result = addBookmark(config, name, cwd, { force });
    if (!result.ok) {
      console.error(`Error: ${result.error}`);
      process.exit(1);
    }
    saveConfig(result.config);
    console.log(`Bookmark ${result.updated ? 'updated' : 'added'}: ${result.name} -> ${cwd}`);
    return;
  }

  // goto -d [name]
  if (REMOVE_CMDS.includes(command)) {
    const locations = Object.keys(config);
    if (locations.length === 0) {
      console.log('No bookmarks to remove.');
      process.exit(0);
    }

    let name = args[1];
    if (name === undefined) {
      console.log('\n[Press ESC to cancel]\n');
      const answers = await promptWithEscSupport([
        {
          type: 'list',
          name: 'selected',
          message: 'Select a bookmark to remove:',
          choices: locations,
        },
      ]);
      name = answers.selected;
    }

    const usage = loadUsage();
    const result = removeBookmark(config, usage, name);
    if (!result.ok) {
      console.error(`Error: ${result.error}`);
      process.exit(1);
    }
    saveConfig(result.config);
    saveUsage(result.usage);
    console.log(`Bookmark removed: ${result.name}`);
    return;
  }

  // goto -r [oldName] [newName]
  if (RENAME_CMDS.includes(command)) {
    const locations = Object.keys(config);
    if (locations.length === 0) {
      console.log('No bookmarks to rename.');
      process.exit(0);
    }

    let oldName = args[1];
    if (oldName === undefined) {
      console.log('\n[Press ESC to cancel]\n');
      const answers = await promptWithEscSupport([
        {
          type: 'list',
          name: 'old',
          message: 'Select a bookmark to rename:',
          choices: locations,
        },
      ]);
      oldName = answers.old;
    }

    if (!Object.prototype.hasOwnProperty.call(config, oldName)) {
      console.error(`Error: Bookmark "${oldName}" not found`);
      process.exit(1);
    }

    let newName = args[2];
    if (newName === undefined) {
      const { [oldName]: _omit, ...rest } = config;
      const answers = await promptWithEscSupport([
        {
          type: 'input',
          name: 'next',
          message: `New name for "${oldName}":`,
          default: oldName,
          validate: (input) => {
            const res = validateName(input, rest);
            return res.ok ? true : res.error;
          },
        },
      ]);
      newName = answers.next;
    }

    const usage = loadUsage();
    const result = renameBookmark(config, usage, oldName, newName);
    if (!result.ok) {
      console.error(`Error: ${result.error}`);
      process.exit(1);
    }
    saveConfig(result.config);
    saveUsage(result.usage);
    console.log(`Bookmark renamed: ${result.oldName} -> ${result.newName}`);
    return;
  }

  // goto -l — ordered by last used, most recent first
  if (LIST_CMDS.includes(command)) {
    const locations = Object.keys(config);
    if (locations.length === 0) {
      console.log('No bookmarks saved yet. Use "goto -a" to add one.');
      process.exit(0);
    }

    const usage = loadUsage();
    const ordered = orderByLastUsed(locations, usage);
    const pad = Math.max(...ordered.map((n) => n.length));

    console.log('\n' + colors.bold('Bookmarks') + colors.dim(' (most recently used first):') + '\n');
    ordered.forEach((name) => {
      // Pad on the visible text first, then color — padEnd must run before the
      // (zero-width) escape codes are added or alignment breaks.
      const label = colors.boldCyan(name.padEnd(pad));
      // Dim and flag missing paths so stale bookmarks stand out.
      const exists = fs.existsSync(config[name]);
      const pathCol = exists
        ? colors.green(config[name])
        : colors.dimStrike(config[name]) + colors.red(' (missing)');
      const ago = colors.yellow(timeAgo(usage[name]));
      console.log(`  ${label}  ${pathCol}  ${colors.dim('(') + ago + colors.dim(')')}`);
    });
    return;
  }

  // goto -p — drop bookmarks whose paths no longer exist
  if (PRUNE_CMDS.includes(command)) {
    const locations = Object.keys(config);
    if (locations.length === 0) {
      console.log('No bookmarks saved yet. Use "goto -a" to add one.');
      process.exit(0);
    }

    const usage = loadUsage();
    const { removed, config: nextConfig, usage: nextUsage } = pruneBookmarks(
      config,
      usage,
      (p) => fs.existsSync(p)
    );

    if (removed.length === 0) {
      console.log(colors.green('All bookmarks point to existing paths. Nothing to prune.'));
      return;
    }

    removed.forEach((name) => {
      console.log(`${colors.red('Removed')} ${colors.boldCyan(name)} ${colors.dim('->')} ${colors.dimStrike(config[name])}`);
    });
    saveConfig(nextConfig);
    saveUsage(nextUsage);
    console.log('\n' + colors.green(`Pruned ${removed.length} stale bookmark${removed.length === 1 ? '' : 's'}.`));
    return;
  }

  // No arguments — interactive list to jump to a location
  if (args.length === 0) {
    const locations = Object.keys(config);
    if (locations.length === 0) {
      console.log('No bookmarks saved yet. Use "goto -a" to add one.');
      process.exit(0);
    }

    // Most-recently-used bookmarks float to the top of the menu.
    const ordered = orderByLastUsed(locations, loadUsage());

    console.log('\n[Press ESC to cancel]\n');
    const { selectedLocation } = await promptWithEscSupport([
      {
        type: 'list',
        name: 'selectedLocation',
        message: 'Select a location to jump to:',
        choices: ordered,
      },
    ]);

    if (!jumpTo(selectedLocation, config)) {
      process.exit(1);
    }
    return;
  }

  // Otherwise, treat the argument as a bookmark name to jump to.
  const locationName = command;
  if (config[locationName]) {
    if (!jumpTo(locationName, config)) {
      process.exit(1);
    }
  } else {
    console.error(`Error: Location "${locationName}" not found`);
    console.error('Use "goto -l" to see available bookmarks or "goto -a" to create one.');
    process.exit(1);
  }
}

main().catch((err) => {
  if (err.isTtyError) {
    console.error('Prompt couldn\'t be rendered in the current environment');
    process.exit(1);
  } else if (err.message && (err.message.includes('User force closed') || err.message.includes('User cancelled with ESC'))) {
    // User pressed ESC or Ctrl+C - exit gracefully
    console.log('\nCancelled.');
    process.exit(0);
  } else {
    console.error('An error occurred:', err.message);
    process.exit(1);
  }
});
