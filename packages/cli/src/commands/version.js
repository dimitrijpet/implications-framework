import chalk from 'chalk';
import { logger } from '../utils/logger.js';

export async function versionCommand() {
  console.log(chalk.blue.bold('\n🎯 Implications Framework\n'));
  
  logger.info(`CLI Version: ${chalk.cyan('1.0.0')}`);
  logger.info(`Node Version: ${chalk.cyan(process.version)}`);
  logger.info(`Platform: ${chalk.cyan(process.platform)}`);
  
  console.log();
}