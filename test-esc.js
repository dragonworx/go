#!/usr/bin/env node

const inquirer = require('inquirer');
const readline = require('readline');

async function promptWithEscSupport(questions) {
  // Create a custom prompt module with our options
  const ui = new inquirer.ui.Prompt(inquirer.prompts);

  // Set up ESC key handler on the readline input
  const onKeypress = (str, key) => {
    if (key && key.name === 'escape') {
      // Remove listener and emit SIGINT on the readline to trigger cancellation
      ui.rl.input.removeListener('keypress', onKeypress);
      ui.rl.emit('SIGINT');
    }
  };

  // Enable keypress events on the readline input
  readline.emitKeypressEvents(ui.rl.input);
  ui.rl.input.on('keypress', onKeypress);

  // Run the prompts and clean up when done
  try {
    const answers = await ui.run(questions);
    ui.rl.input.removeListener('keypress', onKeypress);
    return answers;
  } catch (err) {
    ui.rl.input.removeListener('keypress', onKeypress);
    throw err;
  }
}

async function test() {
  console.log('Testing ESC key handling...');
  console.log('Press ESC to cancel, or select an option\n');

  try {
    const { choice } = await promptWithEscSupport([
      {
        type: 'list',
        name: 'choice',
        message: 'Select an option (ESC to cancel):',
        choices: ['Option 1', 'Option 2', 'Option 3']
      }
    ]);
    console.log('\nYou selected:', choice);
  } catch (err) {
    console.log('\nCancelled.');
    process.exit(0);
  }
}

test();
