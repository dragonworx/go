#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const readline = require('readline');
const colors = require('./colors');

// State lives next to the code by default, so the repo works from any clone
// location. `GO_HOME` (exported by go.sh) overrides this when set.
const CONFIG_DIR = process.env.GO_HOME || __dirname;
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const JUMP_FILE = path.join(CONFIG_DIR, '.jump_target');
const USAGE_FILE = path.join(CONFIG_DIR, '.usage.json');

// Command aliases. Each command has a short flag and a long flag.
const ADD_CMDS = ['-a', '--add'];
const REMOVE_CMDS = ['-d', '--delete'];
const LIST_CMDS = ['-l', '--list'];
const PRUNE_CMDS = ['-p', '--prune'];

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

// Order bookmark names by most-recently-used first. Never-used bookmarks keep
// their original (config) order and sort after used ones (sort is stable).
function orderByLastUsed(names, usage) {
  return [...names].sort((a, b) => (usage[b] || 0) - (usage[a] || 0));
}

// Compact human-readable "time ago" for the list view.
function timeAgo(ts) {
  if (!ts) return 'never used';
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

// Main function
async function main() {
  const rawArgs = process.argv.slice(2);
  configureColor(rawArgs);
  // Strip the global `--no-color` flag so it can sit anywhere on the line
  // without being mistaken for a command or bookmark name.
  const args = rawArgs.filter(a => a !== '--no-color');
  const config = loadConfig();
  const command = args[0];

  // Handle add command  (go -a)
  if (ADD_CMDS.includes(command)) {
    const cwd = process.cwd();
    const defaultName = path.basename(cwd);

    const { locationName } = await promptWithEscSupport([
      {
        type: 'input',
        name: 'locationName',
        message: 'Enter a name for this location:',
        default: defaultName,
        validate: (input) => {
          if (!input || input.trim().length === 0) {
            return 'Location name cannot be empty';
          }
          if (config[input]) {
            return `Location "${input}" already exists`;
          }
          return true;
        }
      }
    ]);

    // Add new location at the beginning (to show first in lists)
    const newConfig = { [locationName]: cwd, ...config };
    saveConfig(newConfig);
    console.log(`Bookmark added: ${locationName} -> ${cwd}`);
    return;
  }

  // Handle delete command  (go -d)
  if (REMOVE_CMDS.includes(command)) {
    const locations = Object.keys(config);

    if (locations.length === 0) {
      console.log('No bookmarks to remove.');
      process.exit(0);
    }

    console.log('\n[Press ESC to cancel]\n');
    const { locationToRemove } = await promptWithEscSupport([
      {
        type: 'list',
        name: 'locationToRemove',
        message: 'Select a bookmark to remove:',
        choices: locations
      }
    ]);

    delete config[locationToRemove];
    saveConfig(config);
    // Drop its usage record too.
    const usage = loadUsage();
    if (usage[locationToRemove] !== undefined) {
      delete usage[locationToRemove];
      saveUsage(usage);
    }
    console.log(`Bookmark removed: ${locationToRemove}`);
    return;
  }

  // Handle list command  (go -l) — ordered by last used, most recent first
  if (LIST_CMDS.includes(command)) {
    const locations = Object.keys(config);

    if (locations.length === 0) {
      console.log('No bookmarks saved yet. Use "go -a" to add one.');
      process.exit(0);
    }

    const usage = loadUsage();
    const ordered = orderByLastUsed(locations, usage);
    const pad = Math.max(...ordered.map(n => n.length));

    console.log('\n' + colors.bold('Bookmarks') + colors.dim(' (most recently used first):') + '\n');
    ordered.forEach(name => {
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

  // Handle prune command  (go -p) — drop bookmarks whose paths no longer exist
  if (PRUNE_CMDS.includes(command)) {
    const locations = Object.keys(config);

    if (locations.length === 0) {
      console.log('No bookmarks saved yet. Use "go -a" to add one.');
      process.exit(0);
    }

    const missing = locations.filter(name => !fs.existsSync(config[name]));

    if (missing.length === 0) {
      console.log(colors.green('All bookmarks point to existing paths. Nothing to prune.'));
      return;
    }

    const usage = loadUsage();
    missing.forEach(name => {
      console.log(`${colors.red('Removed')} ${colors.boldCyan(name)} ${colors.dim('->')} ${colors.dimStrike(config[name])}`);
      delete config[name];
      delete usage[name];
    });
    saveConfig(config);
    saveUsage(usage);
    console.log('\n' + colors.green(`Pruned ${missing.length} stale bookmark${missing.length === 1 ? '' : 's'}.`));
    return;
  }

  // If no arguments, show interactive list to jump to a location
  if (args.length === 0) {
    const locations = Object.keys(config);

    if (locations.length === 0) {
      console.log('No bookmarks saved yet. Use "go -a" to add one.');
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
        choices: ordered
      }
    ]);

    // Write the path to temp file for shell wrapper to read
    setJumpTarget(config[selectedLocation]);
    touchUsage(selectedLocation);
    return;
  }

  // Otherwise, treat argument as a location name
  const locationName = command;

  if (config[locationName]) {
    setJumpTarget(config[locationName]);
    touchUsage(locationName);
  } else {
    console.error(`Error: Location "${locationName}" not found`);
    console.error(`Use "go -l" to see available bookmarks or "go -a" to create one.`);
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
