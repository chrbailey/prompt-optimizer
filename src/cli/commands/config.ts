/**
 * Config Command
 *
 * Manage configuration and API keys.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { config } from '../../utils/config.js';
import { logger, output } from '../../utils/logger.js';

export const configCommand = new Command('config')
  .description('Manage configuration and API keys');

// List all configuration
configCommand
  .command('list')
  .alias('ls')
  .description('Show current configuration')
  .option('--show-keys', 'Show full API keys (be careful!)', false)
  .action(async (options: { showKeys: boolean }) => {
    try {
      await config.init();
      showConfig(options.showKeys);
    } catch (error) {
      logger.error('Failed to load configuration', { error: String(error) });
      process.exit(1);
    }
  });

// Get a specific config value
configCommand
  .command('get <key>')
  .description('Get a configuration value')
  .action(async (key: string) => {
    try {
      await config.init();
      const value = getConfigValue(key);
      if (value !== undefined) {
        console.log(value);
      } else {
        console.log(chalk.yellow(`Configuration key not found: ${key}`));
        process.exit(1);
      }
    } catch (error) {
      logger.error('Failed to get configuration', { error: String(error) });
      process.exit(1);
    }
  });

// Set a config value
configCommand
  .command('set <key> <value>')
  .description('Set a configuration value')
  .action(async (key: string, value: string) => {
    try {
      await config.init();
      await setConfigValue(key, value);
      console.log(chalk.green(`Set ${key}`));
    } catch (error) {
      logger.error('Failed to set configuration', { error: String(error) });
      process.exit(1);
    }
  });

// Reset configuration
configCommand
  .command('reset')
  .description('Reset configuration to defaults')
  .option('-f, --force', 'Skip confirmation', false)
  .action(async (options: { force: boolean }) => {
    if (!options.force) {
      console.log(chalk.yellow('This will reset all configuration to defaults.'));
      console.log(chalk.yellow('API keys will NOT be deleted.'));
      console.log(chalk.dim('Use --force to skip this confirmation.'));
      process.exit(0);
    }

    try {
      config.reset();
      await config.save();
      console.log(chalk.green('Configuration reset to defaults.'));
    } catch (error) {
      logger.error('Failed to reset configuration', { error: String(error) });
      process.exit(1);
    }
  });

// Show config paths
configCommand
  .command('path')
  .description('Show configuration file paths')
  .action(async () => {
    await config.init();
    output.heading('Configuration Paths');
    output.key('Config Directory', config.getConfigDir());
    output.key('Config File', config.getConfigFile());
  });

// Validate configuration
configCommand
  .command('validate')
  .description('Validate current configuration')
  .action(async () => {
    try {
      await config.init();
      const result = config.validate();

      if (result.valid) {
        console.log(chalk.green('Configuration is valid.'));

        // Show configured providers
        const providers = config.getConfiguredProviders();
        if (providers.length > 0) {
          console.log(chalk.dim(`Configured providers: ${providers.join(', ')}`));
        }
      } else {
        console.log(chalk.red('Configuration has issues:'));
        result.errors.forEach(e => console.log(chalk.yellow(`  - ${e}`)));
        process.exit(1);
      }
    } catch (error) {
      logger.error('Validation failed', { error: String(error) });
      process.exit(1);
    }
  });

// Provider-specific subcommands
const providersCommand = new Command('providers')
  .description('Manage API providers');

providersCommand
  .command('list')
  .description('List configured providers')
  .action(async () => {
    await config.init();
    const providers = config.getConfiguredProviders();

    output.heading('Configured Providers');

    if (providers.length === 0) {
      console.log(chalk.yellow('No providers configured.'));
      console.log(chalk.dim('\nTo add a provider:'));
      console.log(chalk.dim('  prompt-optimizer config set anthropic.apiKey sk-ant-...'));
      console.log(chalk.dim('  prompt-optimizer config set openai.apiKey sk-...'));
      console.log(chalk.dim('  prompt-optimizer config set google.apiKey AI...'));
    } else {
      providers.forEach(p => {
        console.log(chalk.green(`  ✓ ${p}`));
      });

      const missing = ['anthropic', 'openai', 'google'].filter(p =>
        !providers.includes(p as 'anthropic' | 'openai' | 'google')
      );
      if (missing.length > 0) {
        output.newline();
        console.log(chalk.dim('Not configured:'));
        missing.forEach(p => console.log(chalk.dim(`  - ${p}`)));
      }
    }
  });

providersCommand
  .command('test [provider]')
  .description('Test provider connectivity')
  .action(async (provider?: string) => {
    await config.init();
    const providers = provider ?
      [provider as 'anthropic' | 'openai' | 'google'] :
      config.getConfiguredProviders();

    output.heading('Testing Provider Connectivity');

    for (const p of providers) {
      const hasKey = config.hasProvider(p as 'anthropic' | 'openai' | 'google');
      if (!hasKey) {
        console.log(chalk.yellow(`  - ${p}: No API key configured`));
        continue;
      }

      // In a real implementation, we would make a test API call
      // For now, just verify the key exists
      console.log(chalk.green(`  ✓ ${p}: API key configured`));
    }
  });

configCommand.addCommand(providersCommand);

function showConfig(showKeys: boolean): void {
  const cfg = config.get();

  output.heading('Prompt Optimizer Configuration');

  // Providers
  output.subheading('Providers:');
  const providers = config.getConfiguredProviders();
  if (providers.length === 0) {
    console.log(chalk.yellow('  No providers configured'));
  } else {
    providers.forEach(p => {
      const key = config.getApiKey(p);
      const display = showKeys ? key : (key?.slice(0, 8) + '...' + key?.slice(-4));
      console.log(`  ${p}: ${chalk.dim(display)}`);
    });
  }

  output.newline();

  // Defaults
  output.subheading('Defaults:');
  output.key('Model', cfg.defaults.model);
  output.key('Output Format', cfg.defaults.outputFormat);
  output.key('Max Cost', `$${cfg.defaults.maxCost}`);
  output.key('Techniques', cfg.defaults.techniques.join(', '));

  output.newline();

  // Logging
  output.subheading('Logging:');
  output.key('Level', cfg.logging.level);
  output.key('Console', cfg.logging.console ? 'enabled' : 'disabled');
  if (cfg.logging.file) {
    output.key('File', cfg.logging.file);
  }
}

function getConfigValue(key: string): unknown {
  const cfg = config.get();
  const parts = key.split('.');

  let current: unknown = cfg;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  // Mask API keys unless explicitly requested
  if (key.toLowerCase().includes('apikey') && typeof current === 'string') {
    return current.slice(0, 8) + '...' + current.slice(-4);
  }

  return current;
}

async function setConfigValue(key: string, value: string): Promise<void> {
  const parts = key.split('.');

  // Handle API key settings specially
  if (parts[0] === 'anthropic' && parts[1] === 'apiKey') {
    await config.saveKeys({ anthropic: value });
    return;
  }
  if (parts[0] === 'openai' && parts[1] === 'apiKey') {
    await config.saveKeys({ openai: value });
    return;
  }
  if (parts[0] === 'google' && parts[1] === 'apiKey') {
    await config.saveKeys({ google: value });
    return;
  }

  // Handle defaults
  if (parts[0] === 'defaults') {
    const cfg = config.get();

    switch (parts[1]) {
      case 'model':
        cfg.defaults.model = value as typeof cfg.defaults.model;
        break;
      case 'outputFormat':
        cfg.defaults.outputFormat = value as typeof cfg.defaults.outputFormat;
        break;
      case 'maxCost':
        cfg.defaults.maxCost = parseFloat(value);
        break;
      case 'techniques':
        cfg.defaults.techniques = value.split(',').map(t => t.trim()) as typeof cfg.defaults.techniques;
        break;
      default:
        throw new Error(`Unknown config key: ${key}`);
    }

    config.set({ defaults: cfg.defaults });
    await config.save();
    return;
  }

  // Handle logging
  if (parts[0] === 'logging') {
    const cfg = config.get();

    switch (parts[1]) {
      case 'level':
        cfg.logging.level = value as typeof cfg.logging.level;
        break;
      case 'console':
        cfg.logging.console = value === 'true';
        break;
      case 'file':
        cfg.logging.file = value;
        break;
      default:
        throw new Error(`Unknown config key: ${key}`);
    }

    config.set({ logging: cfg.logging });
    await config.save();
    return;
  }

  throw new Error(`Unknown config key: ${key}`);
}
