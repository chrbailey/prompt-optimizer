/**
 * Provider Registry
 *
 * Central registry for managing LLM providers. Provides factory methods
 * for creating providers and intelligent model selection based on task
 * requirements and budget constraints.
 *
 * @module providers/registry
 */

import type { LLMProvider, ProviderConfig, ProviderHealth } from './base-provider.js';
import { ProviderError } from './base-provider.js';
import type { ModelConfig, TaskType, Budget } from '../types/index.js';

/**
 * Provider factory function type
 */
type ProviderFactory = (config: ProviderConfig) => LLMProvider;

/**
 * Registered provider entry
 */
interface RegisteredProvider {
  /** Factory function to create provider instances */
  factory: ProviderFactory;
  /** Provider instance (lazy initialized) */
  instance?: LLMProvider;
  /** Provider configuration */
  config?: ProviderConfig;
}

/**
 * Model selection criteria
 */
export interface ModelSelectionCriteria {
  /** Task type for optimization */
  taskType?: TaskType;
  /** Budget constraints */
  budget?: Budget;
  /** Required capabilities */
  requiredCapabilities?: {
    streaming?: boolean;
    functionCalling?: boolean;
    vision?: boolean;
    jsonMode?: boolean;
    systemMessages?: boolean;
  };
  /** Minimum context window size */
  minContextWindow?: number;
  /** Preferred tier (fast, balanced, quality) */
  preferredTier?: 'fast' | 'balanced' | 'quality';
  /** Preferred providers (in order of preference) */
  preferredProviders?: string[];
}

/**
 * Model recommendation result
 */
export interface ModelRecommendation {
  /** Provider name */
  provider: string;
  /** Model ID */
  model: string;
  /** Model configuration */
  config: ModelConfig;
  /** Score indicating fit for criteria (0-100) */
  score: number;
  /** Reason for recommendation */
  reason: string;
}

/**
 * Provider Registry for managing LLM providers
 *
 * @example
 * ```typescript
 * const registry = new ProviderRegistry();
 *
 * // Register providers
 * registry.registerFactory('anthropic', (config) => new AnthropicProvider(config));
 * registry.registerFactory('openai', (config) => new OpenAIProvider(config));
 *
 * // Configure and get provider
 * registry.configure('anthropic', { apiKey: process.env.ANTHROPIC_API_KEY });
 * const provider = registry.get('anthropic');
 *
 * // Or get best model for a task
 * const recommendation = registry.getBestModelFor({
 *   taskType: 'coding',
 *   budget: { maxCostPerRequest: 0.05 },
 * });
 * ```
 */
export class ProviderRegistry {
  /** Registered providers */
  private providers: Map<string, RegisteredProvider> = new Map();

  /**
   * Register a provider factory
   *
   * @param name - Unique provider name
   * @param factory - Factory function to create provider instances
   */
  registerFactory(name: string, factory: ProviderFactory): void {
    if (this.providers.has(name)) {
      throw new Error(`Provider '${name}' is already registered`);
    }

    this.providers.set(name, { factory });
  }

  /**
   * Register a pre-configured provider instance
   *
   * @param provider - The provider instance to register
   */
  register(provider: LLMProvider): void {
    const name = provider.name;

    if (this.providers.has(name)) {
      const existing = this.providers.get(name)!;
      existing.instance = provider;
    } else {
      this.providers.set(name, {
        factory: () => provider,
        instance: provider,
      });
    }
  }

  /**
   * Configure a provider with API credentials
   *
   * @param name - Provider name
   * @param config - Provider configuration
   */
  configure(name: string, config: ProviderConfig): void {
    const registered = this.providers.get(name);

    if (!registered) {
      throw new Error(`Provider '${name}' is not registered. Register a factory first.`);
    }

    registered.config = config;
    // Clear existing instance to force re-creation with new config
    registered.instance = undefined;
  }

  /**
   * Get a provider instance
   *
   * @param name - Provider name
   * @returns Provider instance
   * @throws Error if provider is not registered or not configured
   */
  get(name: string): LLMProvider {
    const registered = this.providers.get(name);

    if (!registered) {
      throw new Error(`Provider '${name}' is not registered`);
    }

    if (!registered.instance) {
      if (!registered.config) {
        throw new Error(`Provider '${name}' is not configured. Call configure() first.`);
      }

      registered.instance = registered.factory(registered.config);
    }

    return registered.instance;
  }

  /**
   * Check if a provider is registered
   *
   * @param name - Provider name
   * @returns true if provider is registered
   */
  has(name: string): boolean {
    return this.providers.has(name);
  }

  /**
   * Check if a provider is configured and ready to use
   *
   * @param name - Provider name
   * @returns true if provider is configured
   */
  isConfigured(name: string): boolean {
    const registered = this.providers.get(name);
    return !!(registered?.config || registered?.instance);
  }

  /**
   * Remove a provider from the registry
   *
   * @param name - Provider name
   * @returns true if provider was removed
   */
  remove(name: string): boolean {
    return this.providers.delete(name);
  }

  /**
   * List all registered provider names
   *
   * @returns Array of provider names
   */
  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * List all configured (ready to use) provider names
   *
   * @returns Array of configured provider names
   */
  listConfiguredProviders(): string[] {
    return Array.from(this.providers.entries())
      .filter(([_, registered]) => registered.config || registered.instance)
      .map(([name]) => name);
  }

  /**
   * Get all available models across all configured providers
   *
   * @returns Array of model configurations with provider info
   */
  listAllModels(): Array<ModelConfig & { providerName: string }> {
    const models: Array<ModelConfig & { providerName: string }> = [];

    for (const [name, registered] of this.providers) {
      if (registered.instance || registered.config) {
        try {
          const provider = this.get(name);
          for (const model of provider.models) {
            models.push({ ...model, providerName: name });
          }
        } catch {
          // Provider not fully configured, skip
        }
      }
    }

    return models;
  }

  /**
   * Get the best model for a given task and constraints
   *
   * @param criteria - Model selection criteria
   * @returns Model recommendation or null if no suitable model found
   */
  getBestModelFor(criteria: ModelSelectionCriteria): ModelRecommendation | null {
    const recommendations = this.getModelRecommendations(criteria);
    return recommendations.length > 0 ? recommendations[0] : null;
  }

  /**
   * Get ranked model recommendations for given criteria
   *
   * @param criteria - Model selection criteria
   * @param limit - Maximum number of recommendations (default: 5)
   * @returns Sorted array of model recommendations
   */
  getModelRecommendations(
    criteria: ModelSelectionCriteria,
    limit: number = 5
  ): ModelRecommendation[] {
    const allModels = this.listAllModels();
    const scoredModels: ModelRecommendation[] = [];

    for (const model of allModels) {
      const { score, reason } = this.scoreModel(model, criteria);

      if (score > 0) {
        scoredModels.push({
          provider: model.providerName,
          model: model.id,
          config: model,
          score,
          reason,
        });
      }
    }

    // Sort by score descending
    scoredModels.sort((a, b) => b.score - a.score);

    return scoredModels.slice(0, limit);
  }

  /**
   * Score a model against selection criteria
   */
  private scoreModel(
    model: ModelConfig & { providerName: string },
    criteria: ModelSelectionCriteria
  ): { score: number; reason: string } {
    let score = 50; // Base score
    const reasons: string[] = [];

    // Check required capabilities
    if (criteria.requiredCapabilities) {
      const caps = criteria.requiredCapabilities;
      const modelCaps = model.capabilities;

      if (caps.streaming && !modelCaps.streaming) {
        return { score: 0, reason: 'Does not support streaming' };
      }
      if (caps.functionCalling && !modelCaps.functionCalling) {
        return { score: 0, reason: 'Does not support function calling' };
      }
      if (caps.vision && !modelCaps.vision) {
        return { score: 0, reason: 'Does not support vision' };
      }
      if (caps.jsonMode && !modelCaps.jsonMode) {
        return { score: 0, reason: 'Does not support JSON mode' };
      }
      if (caps.systemMessages && !modelCaps.systemMessages) {
        return { score: 0, reason: 'Does not support system messages' };
      }
    }

    // Check minimum context window
    if (criteria.minContextWindow && model.contextWindow < criteria.minContextWindow) {
      return { score: 0, reason: `Context window too small (${model.contextWindow} < ${criteria.minContextWindow})` };
    }

    // Check budget
    if (criteria.budget?.maxCostPerRequest) {
      // Estimate cost for a typical request (1K input, 500 output tokens)
      const estimatedCost =
        (1 * model.pricing.inputPer1k) + (0.5 * model.pricing.outputPer1k);

      if (estimatedCost > criteria.budget.maxCostPerRequest) {
        score -= 30;
        reasons.push('Exceeds budget');
      } else {
        // Bonus for being under budget
        const budgetEfficiency =
          1 - (estimatedCost / criteria.budget.maxCostPerRequest);
        score += Math.floor(budgetEfficiency * 15);
        reasons.push('Within budget');
      }
    }

    // Prefer specified tier
    if (criteria.preferredTier) {
      if (model.tier === criteria.preferredTier) {
        score += 20;
        reasons.push(`Matches preferred tier: ${criteria.preferredTier}`);
      } else if (
        (criteria.preferredTier === 'fast' && model.tier === 'balanced') ||
        (criteria.preferredTier === 'quality' && model.tier === 'balanced')
      ) {
        score += 10; // Adjacent tier is acceptable
      }
    }

    // Prefer specified providers
    if (criteria.preferredProviders?.length) {
      const providerIndex = criteria.preferredProviders.indexOf(model.providerName);
      if (providerIndex >= 0) {
        // Higher bonus for earlier in the preference list
        score += Math.max(0, 15 - (providerIndex * 5));
        reasons.push(`Preferred provider: ${model.providerName}`);
      }
    }

    // Task-specific scoring
    if (criteria.taskType) {
      const taskScore = this.scoreForTask(model, criteria.taskType);
      score += taskScore.bonus;
      if (taskScore.reason) {
        reasons.push(taskScore.reason);
      }
    }

    // Cap score at 100
    score = Math.min(100, Math.max(0, score));

    return {
      score,
      reason: reasons.length > 0 ? reasons.join('; ') : 'General purpose model',
    };
  }

  /**
   * Score a model for a specific task type
   */
  private scoreForTask(
    model: ModelConfig,
    taskType: TaskType
  ): { bonus: number; reason?: string } {
    switch (taskType) {
      case 'coding':
        if (model.tier === 'quality' || model.tier === 'balanced') {
          return { bonus: 15, reason: 'Good for coding tasks' };
        }
        break;

      case 'analysis':
        if (model.tier === 'quality') {
          return { bonus: 20, reason: 'Excellent for analysis' };
        }
        if (model.contextWindow >= 100000) {
          return { bonus: 10, reason: 'Large context for analysis' };
        }
        break;

      case 'creative':
        if (model.tier === 'quality') {
          return { bonus: 15, reason: 'Good for creative tasks' };
        }
        break;

      case 'classification':
        if (model.tier === 'fast') {
          return { bonus: 20, reason: 'Fast model ideal for classification' };
        }
        break;

      case 'extraction':
        if (model.capabilities.jsonMode) {
          return { bonus: 15, reason: 'JSON mode for structured extraction' };
        }
        break;

      case 'conversation':
        if (model.tier === 'balanced') {
          return { bonus: 15, reason: 'Balanced model for conversation' };
        }
        break;

      case 'summarization':
        if (model.contextWindow >= 100000) {
          return { bonus: 15, reason: 'Large context for summarization' };
        }
        break;

      default:
        break;
    }

    return { bonus: 0 };
  }

  /**
   * Check health of all configured providers
   *
   * @returns Map of provider names to health status
   */
  async checkAllHealth(): Promise<Map<string, ProviderHealth>> {
    const healthMap = new Map<string, ProviderHealth>();
    const configuredProviders = this.listConfiguredProviders();

    const healthChecks = configuredProviders.map(async name => {
      try {
        const provider = this.get(name);
        const health = await provider.checkHealth();
        healthMap.set(name, health);
      } catch (error) {
        healthMap.set(name, {
          available: false,
          status: 'outage',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    await Promise.all(healthChecks);

    return healthMap;
  }

  /**
   * Validate API keys for all configured providers
   *
   * @returns Map of provider names to validation status
   */
  async validateAllApiKeys(): Promise<Map<string, boolean>> {
    const validationMap = new Map<string, boolean>();
    const configuredProviders = this.listConfiguredProviders();

    const validations = configuredProviders.map(async name => {
      try {
        const provider = this.get(name);
        const isValid = await provider.validateApiKey();
        validationMap.set(name, isValid);
      } catch {
        validationMap.set(name, false);
      }
    });

    await Promise.all(validations);

    return validationMap;
  }
}

/**
 * Singleton registry instance
 *
 * Use this for application-wide provider management
 */
export const defaultRegistry = new ProviderRegistry();

/**
 * Helper to create and configure registry with common providers
 *
 * @param configs - Map of provider names to configurations
 * @returns Configured registry
 */
export function createRegistry(
  configs: Record<string, ProviderConfig>
): ProviderRegistry {
  const registry = new ProviderRegistry();

  // Import providers dynamically to avoid circular dependencies
  // These will be registered when used
  return registry;
}

// Re-export types for convenience
export type { LLMProvider, ProviderConfig, ProviderHealth };
