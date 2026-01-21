/**
 * Few-Shot Selection Technique
 *
 * Dynamically selects the best examples from a knowledge base to include
 * in prompts for few-shot learning. Uses similarity-based retrieval
 * with diversity optimization.
 *
 * Key concepts:
 * - Semantic similarity to select relevant examples
 * - Diversity optimization to avoid redundant examples
 * - Context window management for token efficiency
 * - Quality-weighted selection
 *
 * @module core/techniques/few-shot-selection
 */

import {
  TechniqueName,
  OptimizationContext,
  PromptVariant,
  Example,
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
 * Configuration specific to few-shot selection
 */
export interface FewShotSelectionOptions extends TechniqueOptions {
  /** Maximum number of examples to include */
  maxExamples?: number;
  /** Selection strategy */
  selectionStrategy?: 'similarity' | 'diversity' | 'hybrid' | 'quality';
  /** Minimum similarity threshold (0-1) */
  similarityThreshold?: number;
  /** Tokens reserved for actual task (not examples) */
  reservedTokens?: number;
  /** Maximum tokens per example */
  maxTokensPerExample?: number;
  /** Whether to include example explanations */
  includeExplanations?: boolean;
  /** Diversity weight (0-1) in hybrid mode */
  diversityWeight?: number;
}

/**
 * A scored example for selection
 */
interface ScoredExample extends Example {
  /** Similarity score to the input */
  similarityScore: number;
  /** Diversity score (how different from already selected) */
  diversityScore: number;
  /** Combined selection score */
  selectionScore: number;
  /** Token count */
  tokenCount: number;
}

/**
 * Example selection result
 */
interface SelectionResult {
  /** Selected examples */
  examples: ScoredExample[];
  /** Total tokens used by examples */
  totalTokens: number;
  /** Selection metadata */
  metadata: {
    strategy: string;
    candidatesConsidered: number;
    averageSimilarity: number;
    diversityScore: number;
  };
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Few-Shot Selection Technique
 *
 * Optimizes prompts by selecting the most effective examples from
 * a knowledge base. Balances relevance, diversity, and token efficiency.
 *
 * @example
 * ```typescript
 * const technique = new FewShotSelectionTechnique({
 *   maxExamples: 3,
 *   selectionStrategy: 'hybrid',
 *   similarityThreshold: 0.7
 * });
 *
 * const variants = await technique.apply(prompt, context);
 * ```
 */
export class FewShotSelectionTechnique extends OptimizationTechnique {
  // ===========================================================================
  // Properties
  // ===========================================================================

  readonly name: TechniqueName = 'few_shot';
  readonly priority: number = 8;
  readonly description: string =
    'Select optimal examples for few-shot learning from knowledge base';

  private fewShotOptions: FewShotSelectionOptions;

  // ===========================================================================
  // Constructor
  // ===========================================================================

  constructor(options: FewShotSelectionOptions = {}) {
    super(options);
    this.fewShotOptions = {
      maxExamples: 3,
      selectionStrategy: 'hybrid',
      similarityThreshold: 0.5,
      reservedTokens: 1000,
      maxTokensPerExample: 500,
      includeExplanations: false,
      diversityWeight: 0.3,
      ...options,
    };
  }

  // ===========================================================================
  // Public Methods
  // ===========================================================================

  /**
   * Apply few-shot selection to enhance a prompt.
   */
  async apply(
    prompt: string,
    context: OptimizationContext
  ): Promise<PromptVariant[]> {
    const variants: PromptVariant[] = [];

    // Check if we have examples to work with
    if (!context.examples || context.examples.length === 0) {
      // Generate variant without examples
      variants.push(
        this.createVariant(
          prompt + '\n\n(No examples available)',
          0.5
        )
      );
      return variants;
    }

    // Generate variants with different selection strategies
    const strategies: Array<FewShotSelectionOptions['selectionStrategy']> = [
      'similarity',
      'diversity',
      'hybrid',
      'quality',
    ];

    for (const strategy of strategies) {
      const selection = await this.selectExamples(
        prompt,
        context.examples,
        strategy!
      );

      const enhancedPrompt = this.formatPromptWithExamples(
        prompt,
        selection
      );

      // Score based on selection quality
      const score = this.calculateSelectionScore(selection);
      variants.push(this.createVariant(enhancedPrompt, score));
    }

    // Generate variant with optimal example count
    const optimalSelection = await this.selectOptimalCount(
      prompt,
      context.examples
    );
    const optimalPrompt = this.formatPromptWithExamples(prompt, optimalSelection);
    variants.push(
      this.createVariant(optimalPrompt, this.calculateSelectionScore(optimalSelection))
    );

    return variants.sort((a, b) => b.score - a.score);
  }

  /**
   * Evaluate few-shot enhanced variants.
   */
  async evaluate(variants: PromptVariant[]): Promise<EvaluationResult> {
    const scoredVariants: ScoredVariant[] = [];
    const startTime = Date.now();

    for (const variant of variants) {
      const scores = this.evaluateFewShotQuality(variant);
      scoredVariants.push({
        ...variant,
        scores,
        feedback: this.generateFewShotFeedback(variant, scores),
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

    return {
      variants: scoredVariants,
      best,
      metrics: {
        variantsEvaluated: scoredVariants.length,
        averageScore: avgScore,
        scoreVariance: variance,
        improvementOverOriginal: (best.scores.overall - 0.5) * 200,
        evaluationTimeMs: Date.now() - startTime,
      },
      recommendations: this.generateRecommendations(scoredVariants),
    };
  }

  /**
   * Select examples for a prompt using specified strategy.
   */
  async selectExamples(
    prompt: string,
    examples: Example[],
    strategy: NonNullable<FewShotSelectionOptions['selectionStrategy']>
  ): Promise<SelectionResult> {
    // Score all examples
    const scoredExamples = await this.scoreExamples(prompt, examples);

    // Select based on strategy
    let selected: ScoredExample[];
    switch (strategy) {
      case 'similarity':
        selected = this.selectBySimilarity(scoredExamples);
        break;
      case 'diversity':
        selected = this.selectByDiversity(scoredExamples);
        break;
      case 'hybrid':
        selected = this.selectHybrid(scoredExamples);
        break;
      case 'quality':
        selected = this.selectByQuality(scoredExamples);
        break;
      default:
        selected = this.selectHybrid(scoredExamples);
    }

    // Apply token budget
    selected = this.applyTokenBudget(selected);

    const totalTokens = selected.reduce((sum, ex) => sum + ex.tokenCount, 0);
    const avgSimilarity =
      selected.reduce((sum, ex) => sum + ex.similarityScore, 0) /
      (selected.length || 1);

    return {
      examples: selected,
      totalTokens,
      metadata: {
        strategy,
        candidatesConsidered: examples.length,
        averageSimilarity: avgSimilarity,
        diversityScore: this.calculateDiversityScore(selected),
      },
    };
  }

  // ===========================================================================
  // Private Methods - Example Scoring
  // ===========================================================================

  /**
   * Score all examples against the prompt.
   */
  private async scoreExamples(
    prompt: string,
    examples: Example[]
  ): Promise<ScoredExample[]> {
    const scoredExamples: ScoredExample[] = [];

    for (const example of examples) {
      const similarityScore = await this.calculateSimilarity(prompt, example);
      const tokenCount = this.estimateTokens(
        example.beforePrompt + example.afterPrompt
      );

      scoredExamples.push({
        ...example,
        similarityScore,
        diversityScore: 1, // Initial diversity score
        selectionScore: similarityScore, // Will be updated during selection
        tokenCount,
      });
    }

    return scoredExamples;
  }

  /**
   * Calculate similarity between prompt and example.
   */
  private async calculateSimilarity(
    prompt: string,
    example: Example
  ): Promise<number> {
    // Simple keyword-based similarity (in production, use embeddings)
    const promptWords = new Set(
      prompt.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
    );
    const exampleWords = new Set(
      (example.beforePrompt + ' ' + example.afterPrompt)
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3)
    );

    const intersection = new Set(
      [...promptWords].filter((w) => exampleWords.has(w))
    );
    const union = new Set([...promptWords, ...exampleWords]);

    const jaccardSimilarity = intersection.size / (union.size || 1);

    // Category match bonus
    const categoryBonus = example.category
      ? prompt.toLowerCase().includes(example.category.toLowerCase())
        ? 0.2
        : 0
      : 0;

    // Quality factor
    const qualityFactor = example.expectedImprovement || 0.5;

    return Math.min(1, jaccardSimilarity * 0.6 + categoryBonus + qualityFactor * 0.2);
  }

  // ===========================================================================
  // Private Methods - Selection Strategies
  // ===========================================================================

  /**
   * Select examples by similarity only.
   */
  private selectBySimilarity(examples: ScoredExample[]): ScoredExample[] {
    return examples
      .filter((ex) => ex.similarityScore >= this.fewShotOptions.similarityThreshold!)
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, this.fewShotOptions.maxExamples);
  }

  /**
   * Select examples maximizing diversity.
   */
  private selectByDiversity(examples: ScoredExample[]): ScoredExample[] {
    const selected: ScoredExample[] = [];
    const remaining = [...examples];

    // Start with highest quality example
    remaining.sort(
      (a, b) => (b.expectedImprovement || 0) - (a.expectedImprovement || 0)
    );

    while (
      selected.length < this.fewShotOptions.maxExamples! &&
      remaining.length > 0
    ) {
      if (selected.length === 0) {
        // First selection: pick highest similarity above threshold
        const validCandidates = remaining.filter(
          (ex) => ex.similarityScore >= this.fewShotOptions.similarityThreshold!
        );
        if (validCandidates.length > 0) {
          validCandidates.sort((a, b) => b.similarityScore - a.similarityScore);
          selected.push(validCandidates[0]);
          remaining.splice(remaining.indexOf(validCandidates[0]), 1);
        } else {
          break;
        }
      } else {
        // Subsequent selections: maximize diversity from selected set
        for (const candidate of remaining) {
          candidate.diversityScore = this.calculateDiversityFromSet(
            candidate,
            selected
          );
          candidate.selectionScore =
            candidate.similarityScore * 0.3 + candidate.diversityScore * 0.7;
        }

        remaining.sort((a, b) => b.selectionScore - a.selectionScore);
        const next = remaining.shift()!;

        if (next.similarityScore >= this.fewShotOptions.similarityThreshold! * 0.8) {
          selected.push(next);
        }
      }
    }

    return selected;
  }

  /**
   * Select examples using hybrid approach (similarity + diversity).
   */
  private selectHybrid(examples: ScoredExample[]): ScoredExample[] {
    const diversityWeight = this.fewShotOptions.diversityWeight || 0.3;
    const similarityWeight = 1 - diversityWeight;

    const selected: ScoredExample[] = [];
    const remaining = [...examples].filter(
      (ex) => ex.similarityScore >= this.fewShotOptions.similarityThreshold!
    );

    while (
      selected.length < this.fewShotOptions.maxExamples! &&
      remaining.length > 0
    ) {
      // Update selection scores
      for (const candidate of remaining) {
        if (selected.length > 0) {
          candidate.diversityScore = this.calculateDiversityFromSet(
            candidate,
            selected
          );
        }
        candidate.selectionScore =
          candidate.similarityScore * similarityWeight +
          candidate.diversityScore * diversityWeight;
      }

      remaining.sort((a, b) => b.selectionScore - a.selectionScore);
      selected.push(remaining.shift()!);
    }

    return selected;
  }

  /**
   * Select examples by quality score only.
   */
  private selectByQuality(examples: ScoredExample[]): ScoredExample[] {
    return examples
      .filter((ex) => ex.similarityScore >= this.fewShotOptions.similarityThreshold! * 0.7)
      .sort((a, b) => (b.expectedImprovement || 0) - (a.expectedImprovement || 0))
      .slice(0, this.fewShotOptions.maxExamples);
  }

  /**
   * Calculate diversity of a candidate from already selected examples.
   */
  private calculateDiversityFromSet(
    candidate: ScoredExample,
    selected: ScoredExample[]
  ): number {
    if (selected.length === 0) return 1;

    const similarities = selected.map((ex) =>
      this.calculateExampleSimilarity(candidate, ex)
    );

    // Diversity is inverse of max similarity to any selected example
    const maxSimilarity = Math.max(...similarities);
    return 1 - maxSimilarity;
  }

  /**
   * Calculate similarity between two examples.
   */
  private calculateExampleSimilarity(a: ScoredExample, b: ScoredExample): number {
    // Simple word overlap
    const aWords = new Set(
      (a.beforePrompt + ' ' + a.afterPrompt).toLowerCase().split(/\s+/)
    );
    const bWords = new Set(
      (b.beforePrompt + ' ' + b.afterPrompt).toLowerCase().split(/\s+/)
    );

    const intersection = [...aWords].filter((w) => bWords.has(w)).length;
    const union = new Set([...aWords, ...bWords]).size;

    const wordSimilarity = intersection / (union || 1);

    // Category match
    const categoryMatch = a.category === b.category ? 0.3 : 0;

    return Math.min(1, wordSimilarity * 0.7 + categoryMatch);
  }

  /**
   * Calculate overall diversity score for selected examples.
   */
  private calculateDiversityScore(examples: ScoredExample[]): number {
    if (examples.length <= 1) return 1;

    let totalDiversity = 0;
    let pairs = 0;

    for (let i = 0; i < examples.length; i++) {
      for (let j = i + 1; j < examples.length; j++) {
        const similarity = this.calculateExampleSimilarity(
          examples[i],
          examples[j]
        );
        totalDiversity += 1 - similarity;
        pairs++;
      }
    }

    return pairs > 0 ? totalDiversity / pairs : 1;
  }

  // ===========================================================================
  // Private Methods - Token Management
  // ===========================================================================

  /**
   * Apply token budget to selected examples.
   */
  private applyTokenBudget(examples: ScoredExample[]): ScoredExample[] {
    const maxTokensPerExample = this.fewShotOptions.maxTokensPerExample!;
    const result: ScoredExample[] = [];
    let totalTokens = 0;

    // Estimate available budget (assuming ~4000 token context)
    const availableTokens = 4000 - this.fewShotOptions.reservedTokens!;

    for (const example of examples) {
      // Truncate if needed
      if (example.tokenCount > maxTokensPerExample) {
        example.tokenCount = maxTokensPerExample;
        // In production, would actually truncate the content
      }

      if (totalTokens + example.tokenCount <= availableTokens) {
        result.push(example);
        totalTokens += example.tokenCount;
      }
    }

    return result;
  }

  /**
   * Select optimal number of examples based on quality vs quantity tradeoff.
   */
  private async selectOptimalCount(
    prompt: string,
    examples: Example[]
  ): Promise<SelectionResult> {
    const scoredExamples = await this.scoreExamples(prompt, examples);

    // Try different counts and estimate effectiveness
    const counts = [1, 2, 3, 5];
    let bestSelection: SelectionResult | null = null;
    let bestScore = -1;

    for (const count of counts) {
      const tempOptions = { ...this.fewShotOptions, maxExamples: count };
      this.fewShotOptions.maxExamples = count;

      const selection = {
        examples: this.selectHybrid(scoredExamples),
        totalTokens: 0,
        metadata: {
          strategy: 'optimal-count',
          candidatesConsidered: examples.length,
          averageSimilarity: 0,
          diversityScore: 0,
        },
      };

      selection.totalTokens = selection.examples.reduce(
        (sum, ex) => sum + ex.tokenCount,
        0
      );
      selection.metadata.averageSimilarity =
        selection.examples.reduce((sum, ex) => sum + ex.similarityScore, 0) /
        (selection.examples.length || 1);
      selection.metadata.diversityScore = this.calculateDiversityScore(
        selection.examples
      );

      // Score: balance similarity, diversity, and efficiency
      const score =
        selection.metadata.averageSimilarity * 0.4 +
        selection.metadata.diversityScore * 0.3 +
        (1 - selection.totalTokens / 2000) * 0.3;

      if (score > bestScore) {
        bestScore = score;
        bestSelection = selection;
      }
    }

    // Restore original option
    this.fewShotOptions.maxExamples = 3;

    return bestSelection!;
  }

  // ===========================================================================
  // Private Methods - Formatting
  // ===========================================================================

  /**
   * Format prompt with selected examples.
   */
  private formatPromptWithExamples(
    prompt: string,
    selection: SelectionResult
  ): string {
    if (selection.examples.length === 0) {
      return prompt;
    }

    const examplesText = selection.examples
      .map((ex, idx) => this.formatExample(ex, idx + 1))
      .join('\n\n---\n\n');

    return `Here are some examples to guide your response:

${examplesText}

---

Now, please handle the following:

${prompt}`;
  }

  /**
   * Format a single example.
   */
  private formatExample(example: ScoredExample, index: number): string {
    let formatted = `Example ${index}:`;

    if (example.category) {
      formatted += ` [${example.category}]`;
    }

    formatted += `

Input: ${example.beforePrompt}

Output: ${example.afterPrompt}`;

    if (this.fewShotOptions.includeExplanations && example.expectedImprovement) {
      formatted += `

(This example shows a ${(example.expectedImprovement * 100).toFixed(0)}% improvement)`;
    }

    return formatted;
  }

  // ===========================================================================
  // Private Methods - Scoring & Evaluation
  // ===========================================================================

  /**
   * Calculate overall selection score.
   */
  private calculateSelectionScore(selection: SelectionResult): number {
    if (selection.examples.length === 0) return 0.3;

    const avgSimilarity = selection.metadata.averageSimilarity;
    const diversity = selection.metadata.diversityScore;
    const avgQuality =
      selection.examples.reduce((sum, ex) => sum + (ex.expectedImprovement || 0.5), 0) /
      selection.examples.length;

    // Token efficiency
    const tokenEfficiency = 1 - Math.min(1, selection.totalTokens / 2000);

    return (
      avgSimilarity * 0.35 +
      diversity * 0.2 +
      avgQuality * 0.3 +
      tokenEfficiency * 0.15
    );
  }

  /**
   * Evaluate few-shot quality dimensions.
   */
  private evaluateFewShotQuality(variant: PromptVariant): ScoredVariant['scores'] {
    const content = variant.content;
    const tokens = this.estimateTokens(content);

    // Count examples in the prompt
    const exampleCount = (content.match(/Example \d+:/g) || []).length;

    // Clarity: clear example structure
    const hasStructure =
      content.includes('Input:') && content.includes('Output:');
    const clarity = hasStructure ? 0.85 : 0.6;

    // Specificity: has category or context
    const hasCategory = /\[[\w-]+\]/i.test(content);
    const specificity = hasCategory ? 0.8 : 0.7;

    // Task alignment: has clear task instruction
    const hasTaskInstruction =
      content.includes('Now, please') || content.includes('Your task');
    const taskAlignment = hasTaskInstruction ? 0.85 : 0.65;

    // Efficiency: balance of examples vs length
    const efficiency =
      exampleCount > 0
        ? Math.min(1, 0.5 + exampleCount * 0.15 - tokens / 4000)
        : 0.5;

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
   * Generate feedback for few-shot variant.
   */
  private generateFewShotFeedback(
    variant: PromptVariant,
    scores: ScoredVariant['scores']
  ): string {
    const feedback: string[] = [];
    const exampleCount = (variant.content.match(/Example \d+:/g) || []).length;

    feedback.push(`${exampleCount} examples included`);

    if (scores.clarity >= 0.8) {
      feedback.push('Well-structured examples');
    }

    if (scores.efficiency < 0.6) {
      feedback.push('Consider reducing example count for efficiency');
    }

    if (scores.specificity < 0.75) {
      feedback.push('Add category labels for better context');
    }

    return feedback.join('. ');
  }

  /**
   * Generate recommendations.
   */
  private generateRecommendations(variants: ScoredVariant[]): string[] {
    const recommendations: string[] = [];
    const best = variants[0];

    if (best.scores.efficiency < 0.7) {
      recommendations.push('Try using fewer but higher-quality examples');
    }

    if (best.scores.specificity < 0.75) {
      recommendations.push('Add category labels to examples for better context');
    }

    // Check if diversity strategy performed well
    const diversityVariant = variants.find((v) =>
      v.feedback?.includes('diversity')
    );
    if (diversityVariant && diversityVariant.scores.overall > best.scores.overall * 0.95) {
      recommendations.push('Diversity-based selection shows good results');
    }

    return recommendations;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a few-shot selection technique with default or custom options.
 */
export function createFewShotSelectionTechnique(
  options?: FewShotSelectionOptions
): FewShotSelectionTechnique {
  return new FewShotSelectionTechnique(options);
}
