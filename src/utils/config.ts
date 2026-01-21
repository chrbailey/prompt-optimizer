/**
 * Configuration management for prompt-optimizer
 * Supports config file, environment variables, and runtime configuration
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { z } from 'zod';
import dotenv from 'dotenv';
import { logger, type LogLevel } from './logger.js';

// Local type definitions for configuration
export type Provider = 'anthropic' | 'openai' | 'google';

export type ModelId =
  | 'claude-opus-4-5-20251101'
  | 'claude-sonnet-4-20250514'
  | 'claude-3-5-haiku-20241022'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'o1'
  | 'o1-mini'
  | 'gemini-2.0-flash'
  | 'gemini-1.5-pro'
  | 'gemini-1.5-flash';

export type OutputFormat = 'text' | 'json' | 'markdown' | 'code' | 'structured';

export type OptimizationTechnique =
  | 'chain_of_thought'
  | 'chain-of-thought'
  | 'few_shot'
  | 'few-shot'
  | 'role_prompting'
  | 'role-prompting'
  | 'structured_output'
  | 'structured-output'
  | 'step_by_step'
  | 'step-by-step'
  | 'tree_of_thought'
  | 'tree-of-thought'
  | 'decomposition'
  | 'meta_prompting';

// Re-export LogLevel from logger module
export type { LogLevel };

export interface Config {
  providers: {
    anthropic?: { apiKey: string };
    openai?: { apiKey: string };
    google?: { apiKey: string };
  };
  defaults: {
    model: ModelId;
    outputFormat: OutputFormat;
    maxCost: number;
    techniques: OptimizationTechnique[];
  };
  logging: {
    level: LogLevel;
    file?: string;
    console: boolean;
  };
}

export class ConfigError extends Error {
  constructor(
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ConfigError';
  }
}

// Load .env file
dotenv.config();

// Configuration directory and file paths
const CONFIG_DIR = join(homedir(), '.prompt-optimizer');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
const KEYS_FILE = join(CONFIG_DIR, 'keys.json');

// Zod schemas for validation
const ProviderConfigSchema = z.object({
  anthropic: z.object({ apiKey: z.string() }).optional(),
  openai: z.object({ apiKey: z.string() }).optional(),
  google: z.object({ apiKey: z.string() }).optional(),
});

const DefaultConfigSchema = z.object({
  model: z.string() as z.ZodType<ModelId>,
  outputFormat: z.enum(['text', 'json', 'markdown', 'code', 'structured']) as z.ZodType<OutputFormat>,
  maxCost: z.number().positive(),
  techniques: z.array(z.string() as z.ZodType<OptimizationTechnique>),
});

const LoggingConfigSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']) as z.ZodType<LogLevel>,
  file: z.string().optional(),
  console: z.boolean(),
});

const ConfigSchema = z.object({
  providers: ProviderConfigSchema,
  defaults: DefaultConfigSchema,
  logging: LoggingConfigSchema,
});

// Default configuration
const DEFAULT_CONFIG: Config = {
  providers: {},
  defaults: {
    model: 'claude-sonnet-4-20250514',
    outputFormat: 'text',
    maxCost: 1.0,
    techniques: ['chain-of-thought', 'structured-output'],
  },
  logging: {
    level: 'info',
    console: true,
  },
};

// Environment variable mapping
const ENV_MAPPINGS: Record<string, { path: string[]; transform?: (v: string) => unknown }> = {
  ANTHROPIC_API_KEY: { path: ['providers', 'anthropic', 'apiKey'] },
  OPENAI_API_KEY: { path: ['providers', 'openai', 'apiKey'] },
  GOOGLE_API_KEY: { path: ['providers', 'google', 'apiKey'] },
  PROMPT_OPTIMIZER_MODEL: { path: ['defaults', 'model'] },
  PROMPT_OPTIMIZER_OUTPUT_FORMAT: { path: ['defaults', 'outputFormat'] },
  PROMPT_OPTIMIZER_MAX_COST: { path: ['defaults', 'maxCost'], transform: parseFloat },
  PROMPT_OPTIMIZER_LOG_LEVEL: { path: ['logging', 'level'] },
  PROMPT_OPTIMIZER_LOG_FILE: { path: ['logging', 'file'] },
};

class ConfigManager {
  private config: Config;
  private initialized = false;

  constructor() {
    this.config = structuredClone(DEFAULT_CONFIG);
  }

  /**
   * Initialize configuration from all sources
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    // 1. Start with defaults
    this.config = structuredClone(DEFAULT_CONFIG);

    // 2. Load from config file if exists
    await this.loadConfigFile();

    // 3. Load API keys from keys file
    await this.loadKeysFile();

    // 4. Override with environment variables
    this.loadEnvVariables();

    this.initialized = true;
    logger.debug('Configuration initialized', { config: this.getSafeConfig() });
  }

  /**
   * Load configuration from file
   */
  private async loadConfigFile(): Promise<void> {
    if (!existsSync(CONFIG_FILE)) {
      logger.debug('No config file found, using defaults');
      return;
    }

    try {
      const content = await readFile(CONFIG_FILE, 'utf-8');
      const fileConfig = JSON.parse(content);
      this.mergeConfig(fileConfig);
      logger.debug('Loaded config from file');
    } catch (error) {
      logger.warn('Failed to load config file', { error: String(error) });
    }
  }

  /**
   * Load API keys from separate keys file
   */
  private async loadKeysFile(): Promise<void> {
    if (!existsSync(KEYS_FILE)) {
      return;
    }

    try {
      const content = await readFile(KEYS_FILE, 'utf-8');
      const keys = JSON.parse(content);

      if (keys.anthropic) {
        this.config.providers.anthropic = { apiKey: keys.anthropic };
      }
      if (keys.openai) {
        this.config.providers.openai = { apiKey: keys.openai };
      }
      if (keys.google) {
        this.config.providers.google = { apiKey: keys.google };
      }

      logger.debug('Loaded API keys from keys file');
    } catch (error) {
      logger.warn('Failed to load keys file', { error: String(error) });
    }
  }

  /**
   * Load environment variables
   */
  private loadEnvVariables(): void {
    for (const [envKey, mapping] of Object.entries(ENV_MAPPINGS)) {
      const value = process.env[envKey];
      if (value !== undefined) {
        const transformed = mapping.transform ? mapping.transform(value) : value;
        this.setNestedValue(mapping.path, transformed);
        logger.debug(`Loaded ${envKey} from environment`);
      }
    }
  }

  /**
   * Set a nested value in the config object
   */
  private setNestedValue(path: string[], value: unknown): void {
    let current: Record<string, unknown> = this.config as unknown as Record<string, unknown>;

    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }

    current[path[path.length - 1]] = value;
  }

  /**
   * Merge partial config into current config
   */
  private mergeConfig(partial: Partial<Config>): void {
    if (partial.providers) {
      this.config.providers = { ...this.config.providers, ...partial.providers };
    }
    if (partial.defaults) {
      this.config.defaults = { ...this.config.defaults, ...partial.defaults };
    }
    if (partial.logging) {
      this.config.logging = { ...this.config.logging, ...partial.logging };
    }
  }

  /**
   * Get the full configuration
   */
  get(): Config {
    return this.config;
  }

  /**
   * Get configuration with API keys masked (for logging)
   */
  getSafeConfig(): Record<string, unknown> {
    const safe = structuredClone(this.config) as unknown as Record<string, Record<string, Record<string, string>>>;

    for (const provider of Object.keys(safe.providers || {})) {
      if (safe.providers[provider]?.apiKey) {
        const key = safe.providers[provider].apiKey;
        safe.providers[provider].apiKey = key.slice(0, 8) + '...' + key.slice(-4);
      }
    }

    return safe as unknown as Record<string, unknown>;
  }

  /**
   * Get API key for a provider
   */
  getApiKey(provider: Provider): string | undefined {
    return this.config.providers[provider]?.apiKey;
  }

  /**
   * Check if a provider is configured
   */
  hasProvider(provider: Provider): boolean {
    return !!this.getApiKey(provider);
  }

  /**
   * Get list of configured providers
   */
  getConfiguredProviders(): Provider[] {
    const providers: Provider[] = [];
    if (this.hasProvider('anthropic')) providers.push('anthropic');
    if (this.hasProvider('openai')) providers.push('openai');
    if (this.hasProvider('google')) providers.push('google');
    return providers;
  }

  /**
   * Get default model
   */
  getDefaultModel(): ModelId {
    return this.config.defaults.model;
  }

  /**
   * Get default output format
   */
  getDefaultOutputFormat(): OutputFormat {
    return this.config.defaults.outputFormat;
  }

  /**
   * Get default techniques
   */
  getDefaultTechniques(): OptimizationTechnique[] {
    return this.config.defaults.techniques;
  }

  /**
   * Get max cost limit
   */
  getMaxCost(): number {
    return this.config.defaults.maxCost;
  }

  /**
   * Get logging configuration
   */
  getLoggingConfig() {
    return this.config.logging;
  }

  /**
   * Update configuration at runtime
   */
  set(partial: Partial<Config>): void {
    this.mergeConfig(partial);
  }

  /**
   * Save current configuration to file
   */
  async save(): Promise<void> {
    try {
      await mkdir(CONFIG_DIR, { recursive: true });

      // Save config without API keys
      const configToSave = {
        defaults: this.config.defaults,
        logging: this.config.logging,
      };

      await writeFile(CONFIG_FILE, JSON.stringify(configToSave, null, 2));
      logger.info('Configuration saved');
    } catch (error) {
      throw new ConfigError('Failed to save configuration', { error: String(error) });
    }
  }

  /**
   * Save API keys to keys file
   */
  async saveKeys(keys: { anthropic?: string; openai?: string; google?: string }): Promise<void> {
    try {
      await mkdir(CONFIG_DIR, { recursive: true });

      // Load existing keys
      let existingKeys: Record<string, string> = {};
      if (existsSync(KEYS_FILE)) {
        const content = await readFile(KEYS_FILE, 'utf-8');
        existingKeys = JSON.parse(content);
      }

      // Merge and save
      const newKeys = { ...existingKeys, ...keys };
      await writeFile(KEYS_FILE, JSON.stringify(newKeys, null, 2), { mode: 0o600 });

      // Update in-memory config
      if (keys.anthropic) this.config.providers.anthropic = { apiKey: keys.anthropic };
      if (keys.openai) this.config.providers.openai = { apiKey: keys.openai };
      if (keys.google) this.config.providers.google = { apiKey: keys.google };

      logger.info('API keys saved');
    } catch (error) {
      throw new ConfigError('Failed to save API keys', { error: String(error) });
    }
  }

  /**
   * Validate the current configuration
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      ConfigSchema.parse(this.config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        errors.push(...error.errors.map(e => `${e.path.join('.')}: ${e.message}`));
      }
    }

    // Check for at least one provider
    if (this.getConfiguredProviders().length === 0) {
      errors.push('No API providers configured. Set at least one API key.');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Reset to default configuration
   */
  reset(): void {
    this.config = structuredClone(DEFAULT_CONFIG);
  }

  /**
   * Get the configuration directory path
   */
  getConfigDir(): string {
    return CONFIG_DIR;
  }

  /**
   * Get the configuration file path
   */
  getConfigFile(): string {
    return CONFIG_FILE;
  }
}

// Singleton instance
export const config = new ConfigManager();

// Convenience function to initialize config
export async function initConfig(): Promise<Config> {
  await config.init();
  return config.get();
}

// Export the manager class for testing
export { ConfigManager };
