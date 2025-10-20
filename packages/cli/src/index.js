import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from './commands/init.js';
import { versionCommand } from './commands/version.js';

const program = new Command();

program
  .name('implications')
  .description('Code generator for implications-based testing')
  .version('1.0.0');

// Commands
program
  .command('init')
  .description('Initialize a new implications project')
  .action(initCommand);

program
  .command('version')
  .description('Show version information')
  .action(versionCommand);

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  console.log(chalk.blue.bold('\n🎯 Implications Framework CLI\n'));
  program.outputHelp();
}