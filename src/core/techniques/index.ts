/**
 * Optimization Techniques Registry
 *
 * Central registry for all prompt optimization techniques.
 * Provides technique registration, retrieval, and recommendations.
 *
 * @module core/techniques
 */

import { TechniqueName } from '../../types/index.js';

import {
  OptimizationTechnique,
  TechniqueOptions,
  EvaluationResult,
  ScoredVariant,
  LLMProviderInterface,
} from './base-technique.js';

import {
  FeedbackIterationTechnique,
  FeedbackIterationOptions,
  createFeedbackIterationTechnique,
} from './feedback-iteration.js';

import {
  SyntheticDataTechnique,
  SyntheticDataOptions,
  SyntheticTestCase,
  createSyntheticDataTechnique,
} from './synthetic-data.js';

import {
  ChainOfThoughtTechnique,
  ChainOfThoughtOptions,
  DomainReasoningPattern,
  createChainOfThoughtTechnique,
} from './chain-of-thought.js';

import {
  FewShotSelectionTechnique,
  FewShotSelectionOptions,
  createFewShotSelectionTechnique,
} from './few-shot-selection.js';

import {
  PromptVariantsTechnique,
  PromptVariantsOptions,
  VariationStrategy,
  createPromptVariantsTechnique,
} from './prompt-variants.js';

import {
  ModelAdaptationTechnique,
  ModelAdaptationOptions,
  ModelProfile,
  ModelQuirk,
  AdaptationStrategy,
  createModelAdaptationTechnique,
} from './model-adaptation.js';

// =============================================================================
// Re-exports
// =============================================================================

// Base classes and types
export {
  OptimizationTechnique,
  TechniqueOptions,
  EvaluationResult,
  ScoredVariant,
  LLMProviderInterface,
} from './base-technique.js';

// Feedback Iteration
export {
  FeedbackIterationTechnique,
  FeedbackIterationOptions,
  createFeedbackIterationTechnique,
} from './feedback-iteration.js';

// Synthetic Data
export {
  SyntheticDataTechnique,
  SyntheticDataOptions,
  SyntheticTestCase,
  createSyntheticDataTechnique,
} from './synthetic-data.js';

// Chain of Thought
export {
  ChainOfThoughtTechnique,
  ChainOfThoughtOptions,
  DomainReasoningPattern,
  createChainOfThoughtTechnique,
} from './chain-of-thought.js';

// Few-Shot Selection
export {
  FewShotSelectionTechnique,
  FewShotSelectionOptions,
  createFewShotSelectionTechnique,
} from './few-shot-selection.js';

// Prompt Variants
export {
  PromptVariantsTechnique,
  PromptVariantsOptions,
  VariationStrategy,
  createPromptVariantsTechnique,
} from './prompt-variants.js';

// Model Adaptation
export {
  ModelAdaptationTechnique,
  ModelAdaptationOptions,
  ModelProfile,
  ModelQuirk,
  AdaptationStrategy,
  createModelAdaptationTechnique,
} from './model-adaptation.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Task types for technique recommendations
 */
export type TaskType =
  | 'code-generation'
  | 'analysis'
  | 'creative-writing'
  | 'data-extraction'
  | 'classification'
  | 'summarization'
  | 'translation'
  | 'question-answering'
  | 'reasoning'
  | 'instruction-following'
  | 'conversation'
  | 'erp-configuration'
  | 'technical-documentation';

/**
 * Options for creating techniques
 */
export interface TechniqueCreationOptions {
  feedbackIteration?: FeedbackIterationOptions;
  syntheticData?: SyntheticDataOptions;
  chainOfThought?: ChainOfThoughtOptions;
  fewShotSelection?: FewShotSelectionOptions;
  promptVariants?: PromptVariantsOptions;
  modelAdaptation?: ModelAdaptationOptions;
}

/**
 * Recommendation for a technique
 */
export interface TechniqueRecommendation {
  /** Technique name */
  technique: TechniqueName;
  /** Confidence in recommendation (0-1) */
  confidence: number;
  /** Why this technique is recommended */
  reasoning: string;
  /** Priority order (lower = apply first) */
  priority: number;
}

// =============================================================================
// Technique Registry
// =============================================================================

/**
 * Registry for optimization techniques.
 *
 * Manages technique registration, retrieval, and provides recommendations
 * based on task type and context.
 *
 * @example
 * ```typescript
 * const registry = new TechniqueRegistry();
 *
 * // Register custom technique
 * registry.register(new MyCustomTechnique());
 *
 * // Get technique by name
 * const cot = registry.get('chain_of_thought');
 *
 * // Get recommendations for a task
 * const recommendations = registry.getRecommended('code-generation');
 * ```
 */
export class TechniqueRegistry {
  private techniques: Map<TechniqueName, OptimizationTechnique> = new Map();
  private provider?: LLMProviderInterface;

  // ===========================================================================
  // Constructor
  // ===========================================================================

  /**
   * Create a new technique registry with default techniques.
   */
  constructor(options: TechniqueCreationOptions = {}) {
    this.registerDefaultTechniques(options);
  }

  // ===========================================================================
  // Public Methods
  // ===========================================================================

  /**
   * Register a technique in the registry.
   *
   * @param technique - The technique to register
   */
  register(technique: OptimizationTechnique): void {
    this.techniques.set(technique.name, technique);
    if (this.provider) {
      technique.setProvider(this.provider);
    }
  }

  /**
   * Get a technique by name.
   *
   * @param name - The technique name
   * @returns The technique or undefined if not found
   */
  get(name: TechniqueName): OptimizationTechnique | undefined {
    return this.techniques.get(name);
  }

  /**
   * Check if a technique is registered.
   *
   * @param name - The technique name
   * @returns True if registered
   */
  has(name: TechniqueName): boolean {
    return this.techniques.has(name);
  }

  /**
   * Remove a technique from the registry.
   *
   * @param name - The technique name
   * @returns True if removed
   */
  unregister(name: TechniqueName): boolean {
    return this.techniques.delete(name);
  }

  /**
   * List all registered technique names.
   *
   * @returns Array of technique names
   */
  listTechniques(): TechniqueName[] {
    return Array.from(this.techniques.keys());
  }

  /**
   * Get all registered techniques.
   *
   * @returns Array of techniques
   */
  getAllTechniques(): OptimizationTechnique[] {
    return Array.from(this.techniques.values());
  }

  /**
   * Set the LLM provider for all techniques.
   *
   * @param provider - The provider to use
   */
  setProvider(provider: LLMProviderInterface): void {
    this.provider = provider;
    for (const technique of this.techniques.values()) {
      technique.setProvider(provider);
    }
  }

  /**
   * Get recommended techniques for a task type.
   *
   * @param taskType - The type of task
   * @returns Array of recommended technique names with reasoning
   */
  getRecommended(taskType: TaskType): TechniqueRecommendation[] {
    const recommendations: TechniqueRecommendation[] = [];

    // Get base recommendations for task type
    const baseRecommendations = TASK_TECHNIQUE_MAP[taskType] || [];

    for (const rec of baseRecommendations) {
      if (this.techniques.has(rec.technique)) {
        recommendations.push(rec);
      }
    }

    // Sort by priority
    recommendations.sort((a, b) => a.priority - b.priority);

    return recommendations;
  }

  /**
   * Get techniques sorted by priority.
   *
   * @returns Techniques sorted by priority (highest first)
   */
  getByPriority(): OptimizationTechnique[] {
    return Array.from(this.techniques.values()).sort(
      (a, b) => b.priority - a.priority
    );
  }

  /**
   * Get technique metadata for all registered techniques.
   */
  getMetadata(): Array<{
    name: TechniqueName;
    priority: number;
    description: string;
  }> {
    return Array.from(this.techniques.values()).map((t) => ({
      name: t.name,
      priority: t.priority,
      description: t.description,
    }));
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Register default techniques with provided options.
   */
  private registerDefaultTechniques(options: TechniqueCreationOptions): void {
    // Register all default techniques
    this.register(createFeedbackIterationTechnique(options.feedbackIteration));
    this.register(createSyntheticDataTechnique(options.syntheticData));
    this.register(createChainOfThoughtTechnique(options.chainOfThought));
    this.register(createFewShotSelectionTechnique(options.fewShotSelection));
    this.register(createPromptVariantsTechnique(options.promptVariants));
    this.register(createModelAdaptationTechnique(options.modelAdaptation));
  }
}

// =============================================================================
// Task-Technique Mapping
// =============================================================================

/**
 * Mapping of task types to recommended techniques
 */
const TASK_TECHNIQUE_MAP: Record<TaskType, TechniqueRecommendation[]> = {
  'code-generation': [
    {
      technique: 'chain_of_thought',
      confidence: 0.9,
      reasoning: 'Step-by-step reasoning improves code generation accuracy',
      priority: 1,
    },
    {
      technique: 'few_shot',
      confidence: 0.85,
      reasoning: 'Examples help establish coding patterns and style',
      priority: 2,
    },
    {
      technique: 'decomposition',
      confidence: 0.8,
      reasoning: 'Model adaptation ensures code syntax matches target',
      priority: 3,
    },
  ],

  'analysis': [
    {
      technique: 'chain_of_thought',
      confidence: 0.95,
      reasoning: 'Analysis requires systematic reasoning',
      priority: 1,
    },
    {
      technique: 'reflection',
      confidence: 0.85,
      reasoning: 'Iterative refinement improves analysis depth',
      priority: 2,
    },
    {
      technique: 'self_consistency',
      confidence: 0.75,
      reasoning: 'Test cases validate analysis accuracy',
      priority: 3,
    },
  ],

  'creative-writing': [
    {
      technique: 'meta_prompting',
      confidence: 0.9,
      reasoning: 'Variant generation explores creative possibilities',
      priority: 1,
    },
    {
      technique: 'few_shot',
      confidence: 0.8,
      reasoning: 'Examples establish tone and style',
      priority: 2,
    },
  ],

  'data-extraction': [
    {
      technique: 'few_shot',
      confidence: 0.95,
      reasoning: 'Examples clearly show extraction patterns',
      priority: 1,
    },
    {
      technique: 'decomposition',
      confidence: 0.85,
      reasoning: 'Model-specific formatting ensures consistent output',
      priority: 2,
    },
    {
      technique: 'self_consistency',
      confidence: 0.8,
      reasoning: 'Test cases validate extraction accuracy',
      priority: 3,
    },
  ],

  'classification': [
    {
      technique: 'few_shot',
      confidence: 0.95,
      reasoning: 'Examples define classification categories clearly',
      priority: 1,
    },
    {
      technique: 'chain_of_thought',
      confidence: 0.75,
      reasoning: 'Reasoning helps with edge cases',
      priority: 2,
    },
  ],

  'summarization': [
    {
      technique: 'chain_of_thought',
      confidence: 0.8,
      reasoning: 'Systematic approach identifies key points',
      priority: 1,
    },
    {
      technique: 'meta_prompting',
      confidence: 0.75,
      reasoning: 'Variants find optimal summary length/style',
      priority: 2,
    },
  ],

  'translation': [
    {
      technique: 'few_shot',
      confidence: 0.9,
      reasoning: 'Examples establish translation quality standards',
      priority: 1,
    },
    {
      technique: 'decomposition',
      confidence: 0.85,
      reasoning: 'Model-specific adaptation for language support',
      priority: 2,
    },
  ],

  'question-answering': [
    {
      technique: 'chain_of_thought',
      confidence: 0.9,
      reasoning: 'Step-by-step reasoning improves answer accuracy',
      priority: 1,
    },
    {
      technique: 'few_shot',
      confidence: 0.8,
      reasoning: 'Examples show desired answer format',
      priority: 2,
    },
    {
      technique: 'reflection',
      confidence: 0.75,
      reasoning: 'Feedback loop refines answer quality',
      priority: 3,
    },
  ],

  'reasoning': [
    {
      technique: 'chain_of_thought',
      confidence: 0.98,
      reasoning: 'Essential for complex reasoning tasks',
      priority: 1,
    },
    {
      technique: 'reflection',
      confidence: 0.85,
      reasoning: 'Iterative improvement for reasoning chains',
      priority: 2,
    },
    {
      technique: 'self_consistency',
      confidence: 0.8,
      reasoning: 'Test cases validate reasoning correctness',
      priority: 3,
    },
  ],

  'instruction-following': [
    {
      technique: 'meta_prompting',
      confidence: 0.85,
      reasoning: 'Clear, varied instruction formulations',
      priority: 1,
    },
    {
      technique: 'decomposition',
      confidence: 0.8,
      reasoning: 'Model-specific instruction formatting',
      priority: 2,
    },
    {
      technique: 'self_consistency',
      confidence: 0.75,
      reasoning: 'Test cases verify instruction compliance',
      priority: 3,
    },
  ],

  'conversation': [
    {
      technique: 'few_shot',
      confidence: 0.85,
      reasoning: 'Examples establish conversational tone',
      priority: 1,
    },
    {
      technique: 'meta_prompting',
      confidence: 0.75,
      reasoning: 'Variants explore different conversation styles',
      priority: 2,
    },
  ],

  'erp-configuration': [
    {
      technique: 'chain_of_thought',
      confidence: 0.95,
      reasoning: 'ERP configuration requires systematic approach',
      priority: 1,
    },
    {
      technique: 'few_shot',
      confidence: 0.9,
      reasoning: 'Configuration examples are highly valuable',
      priority: 2,
    },
    {
      technique: 'reflection',
      confidence: 0.85,
      reasoning: 'Iterative refinement for complex configurations',
      priority: 3,
    },
    {
      technique: 'self_consistency',
      confidence: 0.8,
      reasoning: 'Test cases validate configuration correctness',
      priority: 4,
    },
  ],

  'technical-documentation': [
    {
      technique: 'chain_of_thought',
      confidence: 0.85,
      reasoning: 'Structured approach for technical content',
      priority: 1,
    },
    {
      technique: 'few_shot',
      confidence: 0.8,
      reasoning: 'Examples establish documentation style',
      priority: 2,
    },
    {
      technique: 'meta_prompting',
      confidence: 0.75,
      reasoning: 'Variants explore documentation formats',
      priority: 3,
    },
  ],
};

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a technique registry with all default techniques.
 *
 * @param options - Options for technique creation
 * @returns Configured technique registry
 */
export function createTechniqueRegistry(
  options: TechniqueCreationOptions = {}
): TechniqueRegistry {
  return new TechniqueRegistry(options);
}

/**
 * Create a technique by name.
 *
 * @param name - Technique name
 * @param options - Technique options
 * @returns The created technique
 */
export function createTechniqueByName(
  name: TechniqueName,
  options: TechniqueOptions = {}
): OptimizationTechnique {
  switch (name) {
    case 'chain_of_thought':
      return createChainOfThoughtTechnique(options as ChainOfThoughtOptions);

    case 'few_shot':
      return createFewShotSelectionTechnique(options as FewShotSelectionOptions);

    case 'reflection':
      return createFeedbackIterationTechnique(options as FeedbackIterationOptions);

    case 'self_consistency':
      return createSyntheticDataTechnique(options as SyntheticDataOptions);

    case 'meta_prompting':
      return createPromptVariantsTechnique(options as PromptVariantsOptions);

    case 'decomposition':
      return createModelAdaptationTechnique(options as ModelAdaptationOptions);

    // Map remaining technique names to closest implementations
    case 'role_prompting':
    case 'structured_output':
    case 'step_by_step':
      return createChainOfThoughtTechnique(options as ChainOfThoughtOptions);

    case 'tree_of_thought':
    case 'prompt_chaining':
    case 'constitutional_ai':
      return createFeedbackIterationTechnique(options as FeedbackIterationOptions);

    default:
      throw new Error(`Unknown technique: ${name}`);
  }
}

// =============================================================================
// Default Export
// =============================================================================

/**
 * Default singleton registry instance
 */
let defaultRegistry: TechniqueRegistry | null = null;

/**
 * Get the default technique registry.
 * Creates one if it doesn't exist.
 */
export function getDefaultRegistry(): TechniqueRegistry {
  if (!defaultRegistry) {
    defaultRegistry = createTechniqueRegistry();
  }
  return defaultRegistry;
}

/**
 * Reset the default registry (mainly for testing).
 */
export function resetDefaultRegistry(): void {
  defaultRegistry = null;
}
