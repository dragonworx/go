#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const readline = require('readline');

const CONFIG_DIR = path.join(require('os').homedir(), 'dev/go');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const JUMP_FILE = path.join(CONFIG_DIR, '.jump_target');

// Ensure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
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

// Main function
async function main() {
  const args = process.argv.slice(2);
  const config = loadConfig();
  const command = args[0];

  // Handle --add command
  if (command === '--add') {
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

  // Handle --remove command
  if (command === '--remove') {
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
    console.log(`Bookmark removed: ${locationToRemove}`);
    return;
  }

  // Handle --list command
  if (command === '--list') {
    const locations = Object.keys(config);

    if (locations.length === 0) {
      console.log('No bookmarks saved yet. Use "go --add" to add one.');
      process.exit(0);
    }

    console.log('\nSaved bookmarks:');
    locations.forEach(name => {
      console.log(`  ${name} -> ${config[name]}`);
    });
    return;
  }

  // If no arguments, show interactive list to jump to a location
  if (args.length === 0) {
    const locations = Object.keys(config);

    if (locations.length === 0) {
      console.log('No bookmarks saved yet. Use "go --add" to add one.');
      process.exit(0);
    }

    console.log('\n[Press ESC to cancel]\n');
    const { selectedLocation } = await promptWithEscSupport([
      {
        type: 'list',
        name: 'selectedLocation',
        message: 'Select a location to jump to:',
        choices: locations
      }
    ]);

    // Write the path to temp file for shell wrapper to read
    setJumpTarget(config[selectedLocation]);
    return;
  }

  // Otherwise, treat argument as a location name
  const locationName = command;

  if (config[locationName]) {
    setJumpTarget(config[locationName]);
  } else {
    console.error(`Error: Location "${locationName}" not found`);
    console.error(`Use "go --list" to see available bookmarks or "go --add" to create one.`);
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
