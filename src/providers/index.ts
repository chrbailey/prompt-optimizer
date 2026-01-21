/**
 * LLM Provider Abstraction Layer
 *
 * This module provides a unified interface for interacting with multiple LLM providers
 * (Anthropic, OpenAI, Google). It includes:
 *
 * - Base provider interface and abstract class
 * - Provider implementations for each supported backend
 * - Provider registry for managing multiple providers
 * - Model configurations with pricing and capabilities
 *
 * @module providers
 *
 * @example
 * ```typescript
 * import {
 *   ProviderRegistry,
 *   AnthropicProvider,
 *   OpenAIProvider,
 *   GoogleProvider,
 * } from './providers';
 *
 * // Create and configure registry
 * const registry = new ProviderRegistry();
 *
 * registry.registerFactory('anthropic', (config) => new AnthropicProvider(config));
 * registry.registerFactory('openai', (config) => new OpenAIProvider(config));
 * registry.registerFactory('google', (config) => new GoogleProvider(config));
 *
 * // Configure providers with API keys
 * registry.configure('anthropic', { apiKey: process.env.ANTHROPIC_API_KEY! });
 * registry.configure('openai', { apiKey: process.env.OPENAI_API_KEY! });
 * registry.configure('google', { apiKey: process.env.GOOGLE_API_KEY! });
 *
 * // Get best model for a task
 * const recommendation = registry.getBestModelFor({
 *   taskType: 'coding',
 *   budget: { maxCostPerRequest: 0.05 },
 *   preferredTier: 'balanced',
 * });
 *
 * // Use the recommended provider
 * const provider = registry.get(recommendation.provider);
 * const response = await provider.complete({
 *   model: recommendation.model,
 *   messages: [{ role: 'user', content: 'Write a function...' }],
 * });
 * ```
 */

// Local imports for use in helper functions
import { AnthropicProvider } from './anthropic/index.js';
import { OpenAIProvider } from './openai/index.js';
import { GoogleProvider } from './google/index.js';
import { ProviderRegistry } from './registry.js';

// Base provider exports
export {
  BaseLLMProvider,
  ProviderError,
  isLLMProvider,
  type LLMProvider,
  type ProviderCapabilities,
  type ProviderHealth,
  type ProviderConfig,
  type ProviderErrorCode,
} from './base-provider.js';

// Anthropic provider exports
export {
  AnthropicProvider,
  type AnthropicProviderConfig,
  ANTHROPIC_MODELS,
  DEFAULT_ANTHROPIC_MODEL,
  CLAUDE_3_HAIKU,
  CLAUDE_3_5_HAIKU,
  CLAUDE_3_5_SONNET,
  CLAUDE_SONNET_4,
  CLAUDE_OPUS_4,
  getAnthropicModel,
  getRecommendedAnthropicModel,
} from './anthropic/index.js';

// OpenAI provider exports
export {
  OpenAIProvider,
  type OpenAIProviderConfig,
  OPENAI_MODELS,
  DEFAULT_OPENAI_MODEL,
  GPT_4O_MINI,
  GPT_4O,
  GPT_4O_LATEST,
  GPT_4_TURBO,
  O1,
  O1_MINI,
  O3_MINI,
  getOpenAIModel,
  getRecommendedOpenAIModel,
} from './openai/index.js';

// Google provider exports
export {
  GoogleProvider,
  type GoogleProviderConfig,
  GOOGLE_MODELS,
  DEFAULT_GOOGLE_MODEL,
  GEMINI_2_0_FLASH,
  GEMINI_2_0_FLASH_LITE,
  GEMINI_1_5_FLASH,
  GEMINI_1_5_FLASH_8B,
  GEMINI_1_5_PRO,
  GEMINI_2_0_FLASH_THINKING,
  getGoogleModel,
  getRecommendedGoogleModel,
} from './google/index.js';

// Registry exports
export {
  ProviderRegistry,
  defaultRegistry,
  createRegistry,
  type ModelSelectionCriteria,
  type ModelRecommendation,
} from './registry.js';

/**
 * Quick setup helper for common use cases
 *
 * Creates a registry with all providers configured from environment variables.
 *
 * @returns Configured provider registry
 *
 * @example
 * ```typescript
 * const registry = setupProvidersFromEnv();
 * const provider = registry.get('anthropic');
 * ```
 */
export function setupProvidersFromEnv(): ProviderRegistry {
  const registry = new ProviderRegistry();

  // Register factories using already-imported providers
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
  registry.registerFactory('anthropic', (config) => new AnthropicProvider(config));
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
  registry.registerFactory('openai', (config) => new OpenAIProvider(config));
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
  registry.registerFactory('google', (config) => new GoogleProvider(config));

  // Configure from environment variables
  if (process.env.ANTHROPIC_API_KEY) {
    registry.configure('anthropic', {
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  if (process.env.OPENAI_API_KEY) {
    registry.configure('openai', {
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  if (process.env.GOOGLE_API_KEY) {
    registry.configure('google', {
      apiKey: process.env.GOOGLE_API_KEY,
    });
  }

  return registry;
}
