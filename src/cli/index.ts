#!/usr/bin/env node
/**
 * Prompt Optimizer CLI
 *
 * AI-powered prompt optimization with multi-agent architecture.
 * Supports multiple LLM providers (Anthropic, OpenAI, Google) and
 * various optimization techniques.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { optimizeCommand } from './commands/optimize.js';
import { routeCommand } from './commands/route.js';
import { evaluateCommand } from './commands/evaluate.js';
import { batchCommand } from './commands/batch.js';
import { configCommand } from './commands/config.js';
import { initConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';

const VERSION = '0.1.0';

const BANNER = `
${chalk.cyan('╔═══════════════════════════════════════════════════════════╗')}
${chalk.cyan('║')}  ${chalk.bold.white('Prompt Optimizer')} ${chalk.dim('v' + VERSION)}                                 ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.dim('AI-powered prompt optimization with multi-agent architecture')} ${chalk.cyan('║')}
${chalk.cyan('╚═══════════════════════════════════════════════════════════╝')}
`;

async function main() {
  const program = new Command();

  program
    .name('prompt-optimizer')
    .description('AI-powered prompt optimization with multi-agent architecture')
    .version(VERSION, '-v, --version', 'Display version number')
    .option('-d, --debug', 'Enable debug mode')
    .option('-q, --quiet', 'Suppress non-essential output')
    .option('--no-color', 'Disable colored output')
    .hook('preAction', async (thisCommand) => {
      // Initialize configuration before any command runs
      try {
        await initConfig();

        // Set log level based on flags
        const opts = thisCommand.opts();
        if (opts.debug) {
          logger.setLevel('debug');
        } else if (opts.quiet) {
          logger.setLevel('error');
        }
      } catch (error) {
        logger.error('Failed to initialize configuration', { error: String(error) });
        process.exit(1);
      }
    });

  // Register commands
  program.addCommand(optimizeCommand);
  program.addCommand(routeCommand);
  program.addCommand(evaluateCommand);
  program.addCommand(batchCommand);
  program.addCommand(configCommand);

  // Default action (no command specified)
  program.action(() => {
    console.log(BANNER);
    program.outputHelp();
  });

  // Custom help
  program.addHelpText('after', `

${chalk.bold('Examples:')}
  ${chalk.dim('# Optimize a prompt')}
  $ prompt-optimizer optimize "Write a function to sort an array"

  ${chalk.dim('# Optimize with specific techniques')}
  $ prompt-optimizer optimize "Explain quantum computing" -t chain_of_thought,few_shot

  ${chalk.dim('# Route to the best model')}
  $ prompt-optimizer route "Complex analysis task" -q best

  ${chalk.dim('# Evaluate prompt quality')}
  $ prompt-optimizer evaluate "Your prompt here" -m

  ${chalk.dim('# Compare two prompts')}
  $ prompt-optimizer evaluate "Prompt A" -c "Prompt B"

  ${chalk.dim('# Batch process prompts from file')}
  $ prompt-optimizer batch prompts.txt -o results.json

  ${chalk.dim('# Configure API keys')}
  $ prompt-optimizer config set anthropic.apiKey sk-ant-...

${chalk.bold('Documentation:')}
  ${chalk.dim('https://github.com/christopherbailey/prompt-optimizer')}

${chalk.bold('Report Issues:')}
  ${chalk.dim('https://github.com/christopherbailey/prompt-optimizer/issues')}
`);

  // Error handling
  program.exitOverride();

  try {
    await program.parseAsync(process.argv);
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message.includes('commander.help')) {
        // Help was displayed, exit normally
        process.exit(0);
      }
      if (error.message.includes('commander.version')) {
        // Version was displayed, exit normally
        process.exit(0);
      }

      logger.error('Command failed', { error: error.message });

      // Show helpful error message
      if (error.message.includes('missing required argument')) {
        console.log(chalk.yellow('\nTip: Use --help to see usage information'));
      }

      process.exit(1);
    }
  }
}

// Run the CLI
main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
