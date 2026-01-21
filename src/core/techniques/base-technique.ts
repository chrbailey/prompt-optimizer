/**
 * Base Optimization Technique
 *
 * Abstract base class that all optimization techniques must extend.
 * Provides common functionality and enforces the technique contract.
 *
 * @module core/techniques/base-technique
 */

import {
  TechniqueName,
  OptimizationContext,
  PromptVariant,
  TechniqueResult,
  CompletionRequest,
  CompletionResponse,
  Result,
  OptimizerError,
} from '../../types/index.js';

// =============================================================================
// Types for Techniques
// =============================================================================

/**
 * Configuration passed to techniques during initialization
 */
export interface TechniqueOptions {
  /** Maximum number of variants to generate */
  maxVariants?: number;
  /** Temperature for LLM calls (0-2) */
  temperature?: number;
  /** Timeout for the technique in milliseconds */
  timeoutMs?: number;
  /** Whether to include detailed reasoning */
  includeReasoning?: boolean;
  /** Model to use for this technique */
  model?: string;
  /** Additional technique-specific options */
  [key: string]: unknown;
}

/**
 * Evaluation result for a set of variants
 */
export interface EvaluationResult {
  /** All evaluated variants with scores */
  variants: ScoredVariant[];
  /** Best performing variant */
  best: ScoredVariant;
  /** Evaluation metrics */
  metrics: EvaluationMetrics;
  /** Recommendations for improvement */
  recommendations: string[];
}

/**
 * A variant with its evaluation score
 */
export interface ScoredVariant extends PromptVariant {
  /** Evaluation scores */
  scores: {
    /** Overall quality score (0-1) */
    overall: number;
    /** Clarity of the prompt (0-1) */
    clarity: number;
    /** Specificity of instructions (0-1) */
    specificity: number;
    /** Task alignment (0-1) */
    taskAlignment: number;
    /** Token efficiency (0-1) */
    efficiency: number;
  };
  /** Detailed evaluation feedback */
  feedback?: string;
}

/**
 * Metrics from evaluation
 */
export interface EvaluationMetrics {
  /** Number of variants evaluated */
  variantsEvaluated: number;
  /** Average score across variants */
  averageScore: number;
  /** Score variance */
  scoreVariance: number;
  /** Improvement over original */
  improvementOverOriginal: number;
  /** Time taken for evaluation in ms */
  evaluationTimeMs: number;
}

/**
 * Provider interface for LLM calls
 * Techniques receive this to make completions without knowing provider details
 */
export interface LLMProviderInterface {
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  estimateTokens(text: string): number;
}

// =============================================================================
// Abstract Base Class
// =============================================================================

/**
 * Abstract base class for all optimization techniques.
 *
 * Each technique implements a specific strategy for improving prompts.
 * Techniques can:
 * - Generate multiple prompt variants
 * - Evaluate variant quality
 * - Provide recommendations for improvement
 *
 * @example
 * ```typescript
 * class MyTechnique extends OptimizationTechnique {
 *   name: TechniqueName = 'chain_of_thought';
 *   priority = 5;
 *   description = 'Adds step-by-step reasoning to prompts';
 *
 *   async apply(prompt: string, context: OptimizationContext): Promise<PromptVariant[]> {
 *     // Implementation here
 *   }
 *
 *   async evaluate(variants: PromptVariant[]): Promise<EvaluationResult> {
 *     // Implementation here
 *   }
 * }
 * ```
 */
export abstract class OptimizationTechnique {
  // ===========================================================================
  // Abstract Properties (must be implemented by subclasses)
  // ===========================================================================

  /**
   * Unique name identifying this technique
   */
  abstract readonly name: TechniqueName;

  /**
   * Priority level (1-10, higher = applied earlier in pipeline)
   * Used when multiple techniques are applicable
   */
  abstract readonly priority: number;

  /**
   * Human-readable description of what this technique does
   */
  abstract readonly description: string;

  // ===========================================================================
  // Instance Properties
  // ===========================================================================

  /**
   * Configuration options for this technique
   */
  protected options: TechniqueOptions;

  /**
   * LLM provider for making completions
   */
  protected provider?: LLMProviderInterface;

  /**
   * Default model to use if not specified
   */
  protected defaultModel: string = 'claude-sonnet-4-20250514';

  // ===========================================================================
  // Constructor
  // ===========================================================================

  constructor(options: TechniqueOptions = {}) {
    this.options = {
      maxVariants: 3,
      temperature: 0.7,
      timeoutMs: 30000,
      includeReasoning: true,
      ...options,
    };
  }

  // ===========================================================================
  // Abstract Methods (must be implemented by subclasses)
  // ===========================================================================

  /**
   * Apply this technique to generate optimized prompt variants.
   *
   * @param prompt - The original prompt to optimize
   * @param context - Context including examples, constraints, and domain hints
   * @returns Array of optimized prompt variants
   */
  abstract apply(
    prompt: string,
    context: OptimizationContext
  ): Promise<PromptVariant[]>;

  /**
   * Evaluate a set of prompt variants and determine quality scores.
   *
   * @param variants - The variants to evaluate
   * @returns Evaluation results with scores and recommendations
   */
  abstract evaluate(variants: PromptVariant[]): Promise<EvaluationResult>;

  // ===========================================================================
  // Public Methods
  // ===========================================================================

  /**
   * Set the LLM provider for this technique.
   *
   * @param provider - The provider to use for completions
   */
  setProvider(provider: LLMProviderInterface): void {
    this.provider = provider;
  }

  /**
   * Check if this technique is applicable to the given context.
   *
   * @param context - The optimization context
   * @returns True if the technique can be applied
   */
  isApplicable(context: OptimizationContext): boolean {
    // Base implementation - subclasses can override
    return true;
  }

  /**
   * Get the recommended model for this technique.
   *
   * @returns Model identifier
   */
  getRecommendedModel(): string {
    return this.options.model || this.defaultModel;
  }

  /**
   * Get technique metadata for logging/debugging.
   */
  getMetadata(): {
    name: TechniqueName;
    priority: number;
    description: string;
    options: TechniqueOptions;
  } {
    return {
      name: this.name,
      priority: this.priority,
      description: this.description,
      options: this.options,
    };
  }

  // ===========================================================================
  // Protected Helper Methods
  // ===========================================================================

  /**
   * Make an LLM completion request.
   *
   * @param prompt - The prompt to send
   * @param options - Additional options
   * @returns The completion response
   */
  protected async complete(
    prompt: string,
    options: Partial<CompletionRequest> = {}
  ): Promise<Result<CompletionResponse, OptimizerError>> {
    if (!this.provider) {
      return {
        success: false,
        error: {
          code: 'PROVIDER_ERROR',
          message: 'No LLM provider configured for this technique',
          recoverable: true,
          suggestion: 'Call setProvider() before using the technique',
        },
      };
    }

    try {
      const request: CompletionRequest = {
        model: this.options.model || this.defaultModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: this.options.temperature,
        maxTokens: options.maxTokens || 2048,
        timeoutMs: this.options.timeoutMs,
        ...options,
      };

      const response = await this.provider.complete(request);
      return { success: true, value: response };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'PROVIDER_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          recoverable: true,
          details: { error },
        },
      };
    }
  }

  /**
   * Estimate token count for text.
   *
   * @param text - Text to estimate
   * @returns Estimated token count
   */
  protected estimateTokens(text: string): number {
    if (this.provider) {
      return this.provider.estimateTokens(text);
    }
    // Fallback: rough estimate of ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Generate a unique ID for a variant.
   */
  protected generateVariantId(): string {
    return `${this.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a prompt variant object.
   *
   * @param content - The optimized prompt content
   * @param technique - The technique name
   * @param score - Quality score
   * @param model - Target model
   */
  protected createVariant(
    content: string,
    score: number,
    model: string = this.defaultModel
  ): PromptVariant {
    return {
      content,
      technique: this.name,
      score,
      model,
    };
  }

  /**
   * Parse JSON from LLM response, handling common issues.
   *
   * @param text - Text that may contain JSON
   * @returns Parsed object or null if parsing fails
   */
  protected parseJSON<T>(text: string): T | null {
    try {
      // Try direct parse first
      return JSON.parse(text);
    } catch {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1]);
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  /**
   * Calculate improvement score between original and optimized prompts.
   *
   * @param originalScore - Score of original prompt
   * @param optimizedScore - Score of optimized prompt
   * @returns Improvement percentage
   */
  protected calculateImprovement(
    originalScore: number,
    optimizedScore: number
  ): number {
    if (originalScore === 0) return optimizedScore > 0 ? 100 : 0;
    return ((optimizedScore - originalScore) / originalScore) * 100;
  }

  /**
   * Truncate text to fit within token limit.
   *
   * @param text - Text to truncate
   * @param maxTokens - Maximum tokens allowed
   * @returns Truncated text
   */
  protected truncateToTokenLimit(text: string, maxTokens: number): string {
    const estimatedTokens = this.estimateTokens(text);
    if (estimatedTokens <= maxTokens) {
      return text;
    }

    // Estimate characters per token and truncate
    const charsPerToken = text.length / estimatedTokens;
    const targetChars = Math.floor(maxTokens * charsPerToken * 0.95); // 5% buffer
    return text.substring(0, targetChars) + '...';
  }

  /**
   * Validate that the context has required elements.
   *
   * @param context - The context to validate
   * @param required - Required elements
   * @returns Validation result
   */
  protected validateContext(
    context: OptimizationContext,
    required: Array<'examples' | 'constraints' | 'domainHints' | 'symbols'>
  ): Result<void, OptimizerError> {
    for (const req of required) {
      const value = context[req];
      if (!value || (Array.isArray(value) && value.length === 0)) {
        return {
          success: false,
          error: {
            code: 'INVALID_CONFIG',
            message: `Context missing required element: ${req}`,
            recoverable: true,
            suggestion: `Provide ${req} in the optimization context`,
          },
        };
      }
    }
    return { success: true, value: undefined };
  }
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if a value is a valid TechniqueName.
 */
export function isTechniqueName(value: unknown): value is TechniqueName {
  const validNames: TechniqueName[] = [
    'chain_of_thought',
    'few_shot',
    'role_prompting',
    'structured_output',
    'step_by_step',
    'tree_of_thought',
    'self_consistency',
    'prompt_chaining',
    'meta_prompting',
    'constitutional_ai',
    'reflection',
    'decomposition',
  ];
  return typeof value === 'string' && validNames.includes(value as TechniqueName);
}

/**
 * Check if a value is a valid PromptVariant.
 */
export function isPromptVariant(value: unknown): value is PromptVariant {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.content === 'string' &&
    typeof v.technique === 'string' &&
    typeof v.score === 'number' &&
    typeof v.model === 'string'
  );
}
