/**
 * Prompt Variants Technique
 *
 * Generates and tests multiple variations of a prompt to find the
 * most effective formulation. Uses various transformation strategies
 * including rephrasing, restructuring, and emphasis changes.
 *
 * Key concepts:
 * - Generate diverse variants through different transformations
 * - Test variants against evaluation criteria
 * - Select best performing formulation
 * - Learn patterns from successful variants
 *
 * @module core/techniques/prompt-variants
 */

import {
  TechniqueName,
  OptimizationContext,
  PromptVariant,
} from '../../types/index.js';

import {
  OptimizationTechnique,
  TechniqueOptions,
  EvaluationResult,
  ScoredVariant,
} from './base-technique.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration specific to prompt variants technique
 */
export interface PromptVariantsOptions extends TechniqueOptions {
  /** Number of variants to generate */
  numVariants?: number;
  /** Which variation strategies to apply */
  variationStrategies?: VariationStrategy[];
  /** Creativity level (0-1, higher = more diverse variants) */
  creativityLevel?: number;
  /** Whether to combine multiple strategies */
  combineStrategies?: boolean;
  /** Minimum similarity to original (0-1) to ensure relevance */
  minSimilarityToOriginal?: number;
}

/**
 * Types of variation strategies
 */
export type VariationStrategy =
  | 'rephrase'       // Different wording, same meaning
  | 'restructure'    // Different organization/structure
  | 'reorder'        // Different instruction order
  | 'emphasize'      // Add emphasis to key instructions
  | 'simplify'       // Remove unnecessary complexity
  | 'elaborate'      // Add more detail and context
  | 'formalize'      // Make more formal/structured
  | 'conversational' // Make more natural/conversational
  | 'directive'      // Make more direct and commanding
  | 'interrogative'; // Use questions instead of statements

/**
 * A transformation applied to create a variant
 */
interface VariantTransformation {
  strategy: VariationStrategy;
  description: string;
  changes: string[];
}

// =============================================================================
// Strategy Implementations
// =============================================================================

/**
 * Strategy implementation functions
 */
const STRATEGY_PROMPTS: Record<VariationStrategy, string> = {
  rephrase: `Rephrase this prompt using different words while keeping the exact same meaning and intent.
Maintain the same level of detail and specificity. Just change the wording.`,

  restructure: `Restructure this prompt with a different organization:
- Group related instructions together
- Use a different logical flow
- Consider using sections, bullets, or numbered lists if not already present
- Or convert from structured to flowing prose if it's already structured`,

  reorder: `Reorder the instructions in this prompt:
- Put the most important information first
- Consider what the model needs to know before processing
- Group related items but change their sequence`,

  emphasize: `Add emphasis to the key instructions in this prompt:
- Use formatting (caps, asterisks) for critical points sparingly
- Add "IMPORTANT:" or "Note:" prefixes where appropriate
- Repeat key requirements in different ways
- Add explicit priorities`,

  simplify: `Simplify this prompt:
- Remove redundant phrases
- Use shorter sentences
- Eliminate unnecessary qualifiers
- Keep only essential instructions
- Make it more concise without losing important information`,

  elaborate: `Elaborate on this prompt:
- Add more context and background
- Explain the "why" behind requirements
- Include examples where helpful
- Add clarifying details
- Make implicit requirements explicit`,

  formalize: `Make this prompt more formal and structured:
- Use professional language
- Add clear section headers
- Use consistent formatting
- Add explicit constraints and requirements
- Structure as a formal specification`,

  conversational: `Make this prompt more conversational and natural:
- Use a friendly, approachable tone
- Phrase instructions as helpful suggestions
- Add transitional phrases
- Make it read like a natural request`,

  directive: `Make this prompt more direct and commanding:
- Use imperative mood (do this, avoid that)
- Be explicit about expectations
- Remove hedging language
- State requirements clearly and firmly`,

  interrogative: `Convert parts of this prompt to questions:
- Use questions to guide thinking
- Ask "What if..." or "How would..."
- Make the model actively consider constraints
- Use Socratic style where appropriate`,
};

// =============================================================================
// Implementation
// =============================================================================

/**
 * Prompt Variants Technique
 *
 * Creates multiple variations of a prompt using different transformation
 * strategies to find the most effective formulation.
 *
 * @example
 * ```typescript
 * const technique = new PromptVariantsTechnique({
 *   numVariants: 5,
 *   variationStrategies: ['rephrase', 'simplify', 'emphasize'],
 *   creativityLevel: 0.7
 * });
 *
 * const variants = await technique.apply(prompt, context);
 * ```
 */
export class PromptVariantsTechnique extends OptimizationTechnique {
  // ===========================================================================
  // Properties
  // ===========================================================================

  readonly name: TechniqueName = 'meta_prompting';
  readonly priority: number = 6;
  readonly description: string =
    'Generate and test prompt variations to find optimal formulation';

  private variantOptions: PromptVariantsOptions;

  // ===========================================================================
  // Constructor
  // ===========================================================================

  constructor(options: PromptVariantsOptions = {}) {
    super(options);
    this.variantOptions = {
      numVariants: 5,
      variationStrategies: [
        'rephrase',
        'restructure',
        'simplify',
        'emphasize',
        'directive',
      ],
      creativityLevel: 0.6,
      combineStrategies: false,
      minSimilarityToOriginal: 0.5,
      ...options,
    };
  }

  // ===========================================================================
  // Public Methods
  // ===========================================================================

  /**
   * Apply prompt variation strategies to generate variants.
   */
  async apply(
    prompt: string,
    context: OptimizationContext
  ): Promise<PromptVariant[]> {
    const variants: PromptVariant[] = [];
    const strategies = this.variantOptions.variationStrategies!;

    // Generate variants for each strategy
    for (const strategy of strategies) {
      if (variants.length >= this.variantOptions.numVariants!) break;

      const variant = await this.generateVariant(prompt, strategy, context);
      if (variant) {
        variants.push(variant);
      }
    }

    // Generate combined strategy variants if enabled
    if (this.variantOptions.combineStrategies) {
      const combinedVariants = await this.generateCombinedVariants(
        prompt,
        strategies,
        context
      );
      variants.push(...combinedVariants);
    }

    // Add original for comparison
    variants.push(this.createVariant(prompt, 0.5));

    // Sort by score
    variants.sort((a, b) => b.score - a.score);

    return variants.slice(0, this.variantOptions.numVariants!);
  }

  /**
   * Evaluate prompt variants.
   */
  async evaluate(variants: PromptVariant[]): Promise<EvaluationResult> {
    const scoredVariants: ScoredVariant[] = [];
    const startTime = Date.now();

    for (const variant of variants) {
      const scores = await this.scoreVariant(variant);
      scoredVariants.push({
        ...variant,
        scores,
        feedback: this.generateVariantFeedback(variant, scores),
      });
    }

    scoredVariants.sort((a, b) => b.scores.overall - a.scores.overall);

    const best = scoredVariants[0];
    const avgScore =
      scoredVariants.reduce((sum, v) => sum + v.scores.overall, 0) /
      scoredVariants.length;

    const variance =
      scoredVariants.reduce(
        (sum, v) => sum + Math.pow(v.scores.overall - avgScore, 2),
        0
      ) / scoredVariants.length;

    // Find original for comparison
    const original = scoredVariants.find(
      (v) => v.technique === this.name && v.content === variants[variants.length - 1]?.content
    );
    const originalScore = original?.scores.overall || 0.5;

    return {
      variants: scoredVariants,
      best,
      metrics: {
        variantsEvaluated: scoredVariants.length,
        averageScore: avgScore,
        scoreVariance: variance,
        improvementOverOriginal: this.calculateImprovement(
          originalScore,
          best.scores.overall
        ),
        evaluationTimeMs: Date.now() - startTime,
      },
      recommendations: this.generateRecommendations(scoredVariants),
    };
  }

  /**
   * Get available variation strategies.
   */
  getAvailableStrategies(): VariationStrategy[] {
    return Object.keys(STRATEGY_PROMPTS) as VariationStrategy[];
  }

  // ===========================================================================
  // Private Methods - Variant Generation
  // ===========================================================================

  /**
   * Generate a variant using a specific strategy.
   */
  private async generateVariant(
    prompt: string,
    strategy: VariationStrategy,
    context: OptimizationContext
  ): Promise<PromptVariant | null> {
    const strategyPrompt = STRATEGY_PROMPTS[strategy];

    const generationPrompt = `You are an expert prompt engineer. Your task is to transform the following prompt using a specific strategy.

ORIGINAL PROMPT:
${prompt}

TRANSFORMATION STRATEGY: ${strategy.toUpperCase()}
${strategyPrompt}

${context.domainHints.length > 0 ? `DOMAIN CONTEXT: ${context.domainHints.join(', ')}` : ''}

CONSTRAINTS:
- Preserve the core intent and requirements
- Don't add information that wasn't implied by the original
- Keep it focused and clear
${this.variantOptions.creativityLevel! > 0.7 ? '- Be creative with the transformation' : '- Stay close to the original style'}

Output ONLY the transformed prompt, nothing else.`;

    const result = await this.complete(generationPrompt, {
      temperature: this.variantOptions.creativityLevel,
      maxTokens: 2048,
    });

    if (!result.success) {
      return null;
    }

    const transformedPrompt = result.value.content.trim();

    // Validate similarity to original
    const similarity = this.calculateSimilarity(prompt, transformedPrompt);
    if (similarity < this.variantOptions.minSimilarityToOriginal!) {
      return null;
    }

    // Estimate quality score
    const score = await this.estimateVariantQuality(
      prompt,
      transformedPrompt,
      strategy
    );

    return this.createVariant(transformedPrompt, score);
  }

  /**
   * Generate variants combining multiple strategies.
   */
  private async generateCombinedVariants(
    prompt: string,
    strategies: VariationStrategy[],
    context: OptimizationContext
  ): Promise<PromptVariant[]> {
    const combinedVariants: PromptVariant[] = [];

    // Generate a few strategic combinations
    const combinations: VariationStrategy[][] = [
      ['simplify', 'emphasize'],
      ['restructure', 'directive'],
      ['elaborate', 'formalize'],
    ];

    for (const combo of combinations) {
      const validCombo = combo.filter((s) => strategies.includes(s));
      if (validCombo.length < 2) continue;

      const combinedPrompt = `You are an expert prompt engineer. Transform the following prompt by combining these strategies:

ORIGINAL PROMPT:
${prompt}

STRATEGIES TO COMBINE:
${validCombo.map((s) => `- ${s.toUpperCase()}: ${STRATEGY_PROMPTS[s]}`).join('\n\n')}

Combine these approaches thoughtfully. Output ONLY the transformed prompt.`;

      const result = await this.complete(combinedPrompt, {
        temperature: this.variantOptions.creativityLevel! * 1.1, // Slightly higher for combinations
        maxTokens: 2048,
      });

      if (result.success) {
        const transformed = result.value.content.trim();
        const score = await this.estimateVariantQuality(
          prompt,
          transformed,
          'rephrase' // Use generic for combined
        );
        combinedVariants.push(this.createVariant(transformed, score));
      }
    }

    return combinedVariants;
  }

  // ===========================================================================
  // Private Methods - Scoring
  // ===========================================================================

  /**
   * Estimate quality of a variant.
   */
  private async estimateVariantQuality(
    original: string,
    variant: string,
    strategy: VariationStrategy
  ): Promise<number> {
    let score = 0.6; // Base score

    // Length ratio (prefer similar length or slightly shorter)
    const lengthRatio = variant.length / original.length;
    if (lengthRatio >= 0.8 && lengthRatio <= 1.2) score += 0.1;
    else if (lengthRatio < 0.8) score += 0.05; // Slightly good for conciseness
    else score -= 0.05; // Penalize much longer

    // Similarity check (not too different, not identical)
    const similarity = this.calculateSimilarity(original, variant);
    if (similarity >= 0.7 && similarity < 0.95) score += 0.1;
    else if (similarity >= 0.95) score -= 0.1; // Too similar
    else if (similarity < 0.5) score -= 0.1; // Too different

    // Strategy-specific adjustments
    switch (strategy) {
      case 'simplify':
        if (variant.length < original.length * 0.9) score += 0.1;
        break;
      case 'elaborate':
        if (variant.length > original.length * 1.1) score += 0.05;
        break;
      case 'emphasize':
        if (/IMPORTANT|Note:|must|critical/i.test(variant)) score += 0.05;
        break;
      case 'directive':
        if (/^(Do|Create|Generate|Provide|List|Explain)/im.test(variant)) score += 0.05;
        break;
      case 'restructure':
        if ((variant.match(/\n/g) || []).length !== (original.match(/\n/g) || []).length) {
          score += 0.05;
        }
        break;
    }

    return Math.min(1, Math.max(0, score));
  }

  /**
   * Score a variant on multiple dimensions.
   */
  private async scoreVariant(variant: PromptVariant): Promise<ScoredVariant['scores']> {
    const content = variant.content;
    const tokens = this.estimateTokens(content);

    // Clarity: well-structured and readable
    const hasStructure = /\n[-*\d]|\n\n/.test(content);
    const avgSentenceLength =
      content.split(/[.!?]/).reduce((sum, s) => sum + s.length, 0) /
      (content.split(/[.!?]/).length || 1);
    const clarity =
      hasStructure || avgSentenceLength < 150
        ? 0.8 + Math.random() * 0.1
        : 0.6 + Math.random() * 0.15;

    // Specificity: contains specific instructions
    const hasSpecifics = /\b(must|should|exactly|specific|format|include)\b/i.test(
      content
    );
    const specificity = hasSpecifics
      ? 0.75 + Math.random() * 0.15
      : 0.55 + Math.random() * 0.2;

    // Task alignment: clear task indication
    const hasTaskIndication = /\b(task|goal|objective|create|generate|analyze)\b/i.test(
      content
    );
    const taskAlignment = hasTaskIndication
      ? 0.8 + Math.random() * 0.1
      : 0.6 + Math.random() * 0.15;

    // Efficiency: good information density
    const efficiency = tokens < 300 ? 0.9 : tokens < 500 ? 0.8 : tokens < 800 ? 0.7 : 0.5;

    const overall = (clarity + specificity + taskAlignment + efficiency) / 4;

    return {
      overall,
      clarity,
      specificity,
      taskAlignment,
      efficiency,
    };
  }

  /**
   * Calculate similarity between two prompts.
   */
  private calculateSimilarity(a: string, b: string): number {
    const aWords = new Set(a.toLowerCase().split(/\s+/));
    const bWords = new Set(b.toLowerCase().split(/\s+/));

    const intersection = [...aWords].filter((w) => bWords.has(w)).length;
    const union = new Set([...aWords, ...bWords]).size;

    return intersection / (union || 1);
  }

  // ===========================================================================
  // Private Methods - Feedback
  // ===========================================================================

  /**
   * Generate feedback for a variant.
   */
  private generateVariantFeedback(
    variant: PromptVariant,
    scores: ScoredVariant['scores']
  ): string {
    const feedback: string[] = [];

    // Identify the strategy used (from technique name if available)
    feedback.push(`Variant using ${variant.technique}`);

    if (scores.clarity >= 0.8) feedback.push('Good clarity');
    if (scores.clarity < 0.7) feedback.push('Could improve structure');

    if (scores.efficiency >= 0.8) feedback.push('Concise');
    if (scores.efficiency < 0.6) feedback.push('Could be more concise');

    if (scores.specificity >= 0.8) feedback.push('Specific instructions');
    if (scores.specificity < 0.7) feedback.push('Add more specific guidance');

    return feedback.join('. ');
  }

  /**
   * Generate recommendations from evaluation.
   */
  private generateRecommendations(variants: ScoredVariant[]): string[] {
    const recommendations: string[] = [];
    const best = variants[0];

    // Analyze which strategies performed well
    const strategyPerformance = new Map<string, number[]>();
    for (const v of variants) {
      const scores = strategyPerformance.get(v.technique) || [];
      scores.push(v.scores.overall);
      strategyPerformance.set(v.technique, scores);
    }

    // Check if simplification helped
    if (best.scores.efficiency < 0.7) {
      recommendations.push('Try the simplify strategy for better efficiency');
    }

    // Check if structure helped
    if (best.scores.clarity >= 0.85) {
      recommendations.push('Current structure works well - maintain it');
    } else {
      recommendations.push('Consider restructuring for better clarity');
    }

    // Check variance
    const variance =
      variants.reduce(
        (sum, v) => sum + Math.pow(v.scores.overall - (variants[0].scores.overall + variants[variants.length - 1].scores.overall) / 2, 2),
        0
      ) / variants.length;

    if (variance < 0.01) {
      recommendations.push(
        'Variants are very similar - increase creativityLevel for more diversity'
      );
    }

    return recommendations;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a prompt variants technique with default or custom options.
 */
export function createPromptVariantsTechnique(
  options?: PromptVariantsOptions
): PromptVariantsTechnique {
  return new PromptVariantsTechnique(options);
}
