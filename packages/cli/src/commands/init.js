import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger.js';

export async function initCommand() {
  console.log(chalk.blue.bold('\n🎯 Initialize Implications Framework\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectName',
      message: 'Project name:',
      default: path.basename(process.cwd()),
    },
    {
      type: 'list',
      name: 'projectType',
      message: 'Project type:',
      choices: ['cms', 'booking', 'custom'],
      default: 'cms',
    },
    {
      type: 'input',
      name: 'testDir',
      message: 'Tests directory:',
      default: 'tests',
    },
  ]);

  const spinner = ora('Creating configuration...').start();

  try {
    // Create config file
    const config = {
      name: answers.projectName,
      type: answers.projectType,
      testDir: answers.testDir,
      version: '1.0.0',
      createdAt: new Date().toISOString(),
    };

    const configPath = path.join(process.cwd(), 'ai-testing.config.js');
    
    const configContent = `module.exports = ${JSON.stringify(config, null, 2)};`;
    
    await fs.writeFile(configPath, configContent, 'utf-8');

    spinner.succeed('Configuration created!');
    
    logger.success(`\n✅ Project initialized successfully!`);
    logger.info(`\nConfig file: ${chalk.cyan(configPath)}`);
    logger.info(`\nNext steps:`);
    logger.info(`  1. Run ${chalk.cyan('implications discover')} to scan your project`);
    logger.info(`  2. Run ${chalk.cyan('implications generate:implication')} to create implications`);
    
  } catch (error) {
    spinner.fail('Failed to create configuration');
    logger.error(error.message);
    process.exit(1);
  }
}