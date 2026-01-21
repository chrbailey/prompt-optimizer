/**
 * Base Provider Abstraction Layer
 *
 * Defines the common interface and types for all LLM providers.
 * This abstraction allows the prompt optimizer to work with multiple
 * LLM backends (Anthropic, OpenAI, Google) through a unified API.
 *
 * @module providers/base-provider
 */

import type {
  ModelConfig,
  CompletionRequest,
  CompletionResponse,
  CostEstimate,
} from '../types/index.js';

/**
 * Provider capability flags
 */
export interface ProviderCapabilities {
  /** Supports streaming responses */
  streaming: boolean;
  /** Supports function/tool calling */
  functionCalling: boolean;
  /** Supports vision/image inputs */
  vision: boolean;
  /** Supports JSON mode output */
  jsonMode: boolean;
  /** Supports system messages */
  systemMessages: boolean;
}

/**
 * Provider health status
 */
export interface ProviderHealth {
  /** Whether the provider is currently available */
  available: boolean;
  /** Current latency estimate in ms */
  latencyMs?: number;
  /** Any active incidents or degradation */
  status: 'operational' | 'degraded' | 'outage';
  /** Last successful API call timestamp */
  lastChecked?: Date;
  /** Error message if unavailable */
  error?: string;
}

/**
 * Configuration options for provider initialization
 */
export interface ProviderConfig {
  /** API key for authentication */
  apiKey: string;
  /** Optional base URL override (for proxies or custom endpoints) */
  baseUrl?: string;
  /** Default timeout in milliseconds */
  timeout?: number;
  /** Maximum retry attempts for failed requests */
  maxRetries?: number;
  /** Default model to use if not specified in request */
  defaultModel?: string;
}

/**
 * Abstract base class for LLM providers
 *
 * All provider implementations must extend this class and implement
 * the abstract methods. This ensures consistent behavior across providers.
 *
 * @example
 * ```typescript
 * class MyProvider extends BaseLLMProvider {
 *   constructor(config: ProviderConfig) {
 *     super('my-provider', config);
 *   }
 *
 *   async complete(request: CompletionRequest): Promise<CompletionResponse> {
 *     // Implementation
 *   }
 * }
 * ```
 */
export abstract class BaseLLMProvider {
  /** Unique provider identifier */
  public readonly name: string;

  /** Provider configuration */
  protected readonly config: ProviderConfig;

  /** Cached model configurations */
  protected modelCache: Map<string, ModelConfig> = new Map();

  constructor(name: string, config: ProviderConfig) {
    this.name = name;
    this.config = config;
  }

  /**
   * Get all available models for this provider
   */
  abstract get models(): ModelConfig[];

  /**
   * Get provider capabilities
   */
  abstract get capabilities(): ProviderCapabilities;

  /**
   * Execute a completion request
   *
   * @param request - The completion request parameters
   * @returns Promise resolving to the completion response
   * @throws ProviderError if the request fails
   */
  abstract complete(request: CompletionRequest): Promise<CompletionResponse>;

  /**
   * Execute a streaming completion request
   *
   * @param request - The completion request parameters
   * @returns AsyncIterable yielding response chunks
   * @throws ProviderError if streaming is not supported or request fails
   */
  abstract completeStream(
    request: CompletionRequest
  ): AsyncIterable<CompletionResponse>;

  /**
   * Estimate the cost of a completion request before execution
   *
   * @param request - The completion request to estimate
   * @returns Cost estimate with breakdown
   */
  abstract estimateCost(request: CompletionRequest): CostEstimate;

  /**
   * Validate that the API key is valid and has necessary permissions
   *
   * @returns Promise resolving to true if valid, false otherwise
   */
  abstract validateApiKey(): Promise<boolean>;

  /**
   * Check the current health status of the provider
   *
   * @returns Promise resolving to health status
   */
  abstract checkHealth(): Promise<ProviderHealth>;

  /**
   * List all available models with their configurations
   *
   * @returns Array of model configurations
   */
  listModels(): ModelConfig[] {
    return this.models;
  }

  /**
   * Get configuration for a specific model
   *
   * @param modelId - The model identifier
   * @returns Model configuration or undefined if not found
   */
  getModel(modelId: string): ModelConfig | undefined {
    // Check cache first
    if (this.modelCache.has(modelId)) {
      return this.modelCache.get(modelId);
    }

    const model = this.models.find(m => m.id === modelId);
    if (model) {
      this.modelCache.set(modelId, model);
    }
    return model;
  }

  /**
   * Check if a specific model is available
   *
   * @param modelId - The model identifier to check
   * @returns true if the model is available
   */
  hasModel(modelId: string): boolean {
    return this.models.some(m => m.id === modelId);
  }

  /**
   * Get the default model for this provider
   *
   * @returns Default model configuration
   */
  getDefaultModel(): ModelConfig {
    if (this.config.defaultModel) {
      const model = this.getModel(this.config.defaultModel);
      if (model) return model;
    }
    // Return first model as fallback
    return this.models[0];
  }

  /**
   * Calculate token count for a given text
   * Providers should override with provider-specific tokenization
   *
   * @param text - Text to count tokens for
   * @returns Estimated token count
   */
  estimateTokens(text: string): number {
    // Default rough estimation: ~4 characters per token
    // Providers should override with accurate tokenization
    return Math.ceil(text.length / 4);
  }
}

/**
 * LLM Provider interface for dependency injection
 *
 * This interface defines the contract that all providers must fulfill.
 * Use this interface for type annotations when you need provider abstraction.
 */
export interface LLMProvider {
  /** Unique provider name (e.g., 'anthropic', 'openai', 'google') */
  readonly name: string;

  /** Available models for this provider */
  readonly models: ModelConfig[];

  /** Provider capabilities */
  readonly capabilities: ProviderCapabilities;

  /**
   * Execute a completion request
   */
  complete(request: CompletionRequest): Promise<CompletionResponse>;

  /**
   * Execute a streaming completion request
   */
  completeStream(request: CompletionRequest): AsyncIterable<CompletionResponse>;

  /**
   * Estimate cost before execution
   */
  estimateCost(request: CompletionRequest): CostEstimate;

  /**
   * List available models
   */
  listModels(): ModelConfig[];

  /**
   * Get a specific model configuration
   */
  getModel(modelId: string): ModelConfig | undefined;

  /**
   * Validate API key
   */
  validateApiKey(): Promise<boolean>;

  /**
   * Check provider health
   */
  checkHealth(): Promise<ProviderHealth>;

  /**
   * Estimate token count for text
   */
  estimateTokens(text: string): number;
}

/**
 * Custom error class for provider-specific errors
 */
export class ProviderError extends Error {
  /** The provider that generated this error */
  public readonly provider: string;

  /** Error code for programmatic handling */
  public readonly code: ProviderErrorCode;

  /** HTTP status code if applicable */
  public readonly statusCode?: number;

  /** Whether this error is retryable */
  public readonly retryable: boolean;

  /** Original error from the provider SDK */
  public readonly cause?: Error;

  constructor(
    message: string,
    provider: string,
    code: ProviderErrorCode,
    options?: {
      statusCode?: number;
      retryable?: boolean;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = 'ProviderError';
    this.provider = provider;
    this.code = code;
    this.statusCode = options?.statusCode;
    this.retryable = options?.retryable ?? false;
    this.cause = options?.cause;

    // Maintain proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ProviderError);
    }
  }
}

/**
 * Standard error codes for provider errors
 */
export type ProviderErrorCode =
  | 'AUTHENTICATION_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'INVALID_REQUEST'
  | 'MODEL_NOT_FOUND'
  | 'CONTEXT_LENGTH_EXCEEDED'
  | 'CONTENT_FILTER'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'UNKNOWN';

/**
 * Type guard to check if an object implements LLMProvider
 */
export function isLLMProvider(obj: unknown): obj is LLMProvider {
  if (!obj || typeof obj !== 'object') return false;

  const provider = obj as Record<string, unknown>;
  return (
    typeof provider.name === 'string' &&
    Array.isArray(provider.models) &&
    typeof provider.complete === 'function' &&
    typeof provider.estimateCost === 'function' &&
    typeof provider.listModels === 'function' &&
    typeof provider.validateApiKey === 'function'
  );
}
