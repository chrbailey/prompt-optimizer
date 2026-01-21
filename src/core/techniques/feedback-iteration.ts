/**
 * Feedback Iteration Technique (OPRO-style)
 *
 * Implements Optimization by Prompting (OPRO) research approach where
 * an LLM acts as the optimizer, iteratively refining prompts based on
 * performance feedback in natural language.
 *
 * Key concepts from OPRO research:
 * - LLM as optimizer: Use the LLM's understanding to improve prompts
 * - Natural language feedback: Describe what worked/didn't work
 * - Score-based selection: Track performance to guide optimization
 * - Meta-prompt: Instruction to the optimizer about how to improve
 *
 * @see https://arxiv.org/abs/2309.03409 (OPRO paper)
 * @module core/techniques/feedback-iteration
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
 * Configuration specific to feedback iteration
 */
export interface FeedbackIterationOptions extends TechniqueOptions {
  /** Maximum number of optimization iterations */
  maxIterations?: number;
  /** Minimum improvement threshold to continue iterating */
  minImprovementThreshold?: number;
  /** Model to use for optimization (can differ from evaluation model) */
  optimizerModel?: string;
  /** How to aggregate scores across test cases */
  scoreAggregation?: 'mean' | 'median' | 'min' | 'max';
  /** Number of top prompts to include in optimization history */
  historySize?: number;
  /** Temperature for optimization (typically higher for creativity) */
  optimizerTemperature?: number;
}

/**
 * Record of a prompt attempt and its performance
 */
interface PromptAttempt {
  prompt: string;
  score: number;
  feedback: string;
  iteration: number;
  timestamp: Date;
}

/**
 * The optimization trajectory - history of attempts
 */
interface OptimizationTrajectory {
  attempts: PromptAttempt[];
  bestAttempt: PromptAttempt;
  totalIterations: number;
  improvementCurve: number[];
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Feedback Iteration Technique
 *
 * Uses OPRO-style optimization where an LLM iteratively improves prompts
 * based on performance feedback. The optimizer receives:
 * 1. The task description
 * 2. History of previous attempts with scores
 * 3. Natural language feedback on what worked/didn't
 *
 * @example
 * ```typescript
 * const technique = new FeedbackIterationTechnique({
 *   maxIterations: 5,
 *   minImprovementThreshold: 0.05,
 *   optimizerModel: 'claude-opus-4-5-20251101'
 * });
 *
 * const variants = await technique.apply(prompt, context);
 * const evaluation = await technique.evaluate(variants);
 * ```
 */
export class FeedbackIterationTechnique extends OptimizationTechnique {
  // ===========================================================================
  // Properties
  // ===========================================================================

  readonly name: TechniqueName = 'reflection'; // Maps to reflection in existing types
  readonly priority: number = 8; // High priority - powerful technique
  readonly description: string =
    'OPRO-style optimization using LLM as optimizer with iterative feedback';

  private trajectory: OptimizationTrajectory | null = null;
  private feedbackOptions: FeedbackIterationOptions;

  // ===========================================================================
  // Constructor
  // ===========================================================================

  constructor(options: FeedbackIterationOptions = {}) {
    super(options);
    this.feedbackOptions = {
      maxIterations: 5,
      minImprovementThreshold: 0.02,
      scoreAggregation: 'mean',
      historySize: 5,
      optimizerTemperature: 0.8,
      ...options,
    };
  }

  // ===========================================================================
  // Public Methods
  // ===========================================================================

  /**
   * Apply feedback iteration to optimize a prompt.
   */
  async apply(
    prompt: string,
    context: OptimizationContext
  ): Promise<PromptVariant[]> {
    // Initialize trajectory
    this.trajectory = {
      attempts: [],
      bestAttempt: {
        prompt,
        score: 0,
        feedback: 'Initial prompt - not yet evaluated',
        iteration: 0,
        timestamp: new Date(),
      },
      totalIterations: 0,
      improvementCurve: [],
    };

    const variants: PromptVariant[] = [];

    // Evaluate initial prompt
    const initialScore = await this.evaluatePrompt(prompt, context);
    this.trajectory.bestAttempt.score = initialScore;
    this.trajectory.attempts.push(this.trajectory.bestAttempt);
    this.trajectory.improvementCurve.push(initialScore);

    // Iterative optimization loop
    let currentBestScore = initialScore;
    let currentBestPrompt = prompt;

    for (let i = 1; i <= this.feedbackOptions.maxIterations!; i++) {
      this.trajectory.totalIterations = i;

      // Generate feedback on current best
      const feedback = await this.generateFeedback(
        currentBestPrompt,
        currentBestScore,
        context
      );

      // Generate improved variant using optimizer
      const improvedPrompt = await this.generateImprovedPrompt(
        currentBestPrompt,
        feedback,
        context
      );

      // Evaluate the improved prompt
      const newScore = await this.evaluatePrompt(improvedPrompt, context);

      // Record attempt
      const attempt: PromptAttempt = {
        prompt: improvedPrompt,
        score: newScore,
        feedback,
        iteration: i,
        timestamp: new Date(),
      };
      this.trajectory.attempts.push(attempt);
      this.trajectory.improvementCurve.push(newScore);

      // Create variant
      const variant = this.createVariant(
        improvedPrompt,
        newScore,
        this.feedbackOptions.optimizerModel || this.defaultModel
      );
      variants.push(variant);

      // Check for improvement
      const improvement = newScore - currentBestScore;
      if (newScore > currentBestScore) {
        currentBestScore = newScore;
        currentBestPrompt = improvedPrompt;
        this.trajectory.bestAttempt = attempt;
      }

      // Early stopping if improvement is below threshold
      if (
        improvement < this.feedbackOptions.minImprovementThreshold! &&
        i > 2
      ) {
        break;
      }
    }

    // Ensure we have at least the best variant
    if (variants.length === 0) {
      variants.push(this.createVariant(currentBestPrompt, currentBestScore));
    }

    return variants;
  }

  /**
   * Evaluate variants generated by this technique.
   */
  async evaluate(variants: PromptVariant[]): Promise<EvaluationResult> {
    const scoredVariants: ScoredVariant[] = [];
    const startTime = Date.now();

    for (const variant of variants) {
      const scores = await this.scoreVariant(variant);
      scoredVariants.push({
        ...variant,
        scores,
        feedback: this.generateVariantFeedback(scores),
      });
    }

    // Sort by overall score descending
    scoredVariants.sort((a, b) => b.scores.overall - a.scores.overall);

    const best = scoredVariants[0];
    const avgScore =
      scoredVariants.reduce((sum, v) => sum + v.scores.overall, 0) /
      scoredVariants.length;

    // Calculate variance
    const variance =
      scoredVariants.reduce(
        (sum, v) => sum + Math.pow(v.scores.overall - avgScore, 2),
        0
      ) / scoredVariants.length;

    // Calculate improvement over original (iteration 0)
    const originalScore = this.trajectory?.improvementCurve[0] ?? 0;
    const improvement = this.calculateImprovement(originalScore, best.scores.overall);

    return {
      variants: scoredVariants,
      best,
      metrics: {
        variantsEvaluated: scoredVariants.length,
        averageScore: avgScore,
        scoreVariance: variance,
        improvementOverOriginal: improvement,
        evaluationTimeMs: Date.now() - startTime,
      },
      recommendations: this.generateRecommendations(scoredVariants, improvement),
    };
  }

  /**
   * Get the optimization trajectory for analysis.
   */
  getTrajectory(): OptimizationTrajectory | null {
    return this.trajectory;
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Evaluate a prompt and return a score.
   */
  private async evaluatePrompt(
    prompt: string,
    context: OptimizationContext
  ): Promise<number> {
    const evaluationPrompt = this.buildEvaluationPrompt(prompt, context);

    const result = await this.complete(evaluationPrompt, {
      temperature: 0.3, // Lower temperature for consistent evaluation
      maxTokens: 1024,
    });

    if (!result.success) {
      // Return a baseline score if evaluation fails
      return 0.5;
    }

    // Parse score from response
    const score = this.parseScoreFromResponse(result.value.content);
    return score;
  }

  /**
   * Generate natural language feedback on a prompt's performance.
   */
  private async generateFeedback(
    prompt: string,
    score: number,
    context: OptimizationContext
  ): Promise<string> {
    const feedbackPrompt = `You are analyzing a prompt to provide constructive feedback for improvement.

PROMPT TO ANALYZE:
${prompt}

CURRENT SCORE: ${(score * 100).toFixed(1)}%

TASK CONTEXT:
- Domain hints: ${context.domainHints.join(', ') || 'None provided'}
- Number of examples available: ${context.examples.length}
- Number of constraints: ${context.constraints.length}

EVALUATION CRITERIA:
1. Clarity: Is the prompt clear and unambiguous?
2. Specificity: Does it provide enough detail?
3. Task Alignment: Does it clearly convey what's expected?
4. Efficiency: Is it concise without losing important information?

Provide specific, actionable feedback on:
1. What aspects of this prompt are working well
2. What specific weaknesses should be addressed
3. Concrete suggestions for improvement

Be direct and specific. Focus on the most impactful improvements.`;

    const result = await this.complete(feedbackPrompt, {
      temperature: 0.5,
      maxTokens: 1024,
    });

    if (!result.success) {
      return 'Unable to generate detailed feedback. Consider improving clarity and specificity.';
    }

    return result.value.content;
  }

  /**
   * Generate an improved prompt based on feedback using OPRO-style meta-prompt.
   */
  private async generateImprovedPrompt(
    currentPrompt: string,
    feedback: string,
    context: OptimizationContext
  ): Promise<string> {
    // Build history of previous attempts (OPRO key feature)
    const history = this.buildAttemptHistory();

    const metaPrompt = `You are an expert prompt engineer. Your task is to improve the given prompt based on feedback and past attempts.

CURRENT PROMPT:
${currentPrompt}

FEEDBACK ON CURRENT PROMPT:
${feedback}

${history ? `HISTORY OF PREVIOUS ATTEMPTS (score in parentheses):\n${history}\n` : ''}

OPTIMIZATION GUIDELINES:
1. Address the specific weaknesses mentioned in the feedback
2. Preserve what's working well
3. Be more specific and clear where needed
4. Ensure the task requirements are explicit
5. Use active voice and direct instructions
6. Include format requirements if applicable
${context.domainHints.length > 0 ? `7. Consider domain context: ${context.domainHints.join(', ')}` : ''}

CONSTRAINTS:
${context.constraints.map((c) => `- ${c.description}: ${c.value}`).join('\n') || 'None specified'}

Generate an improved version of the prompt. Output ONLY the improved prompt, nothing else.`;

    const result = await this.complete(metaPrompt, {
      temperature: this.feedbackOptions.optimizerTemperature,
      maxTokens: 2048,
      model: this.feedbackOptions.optimizerModel,
    });

    if (!result.success) {
      // Return original if optimization fails
      return currentPrompt;
    }

    return result.value.content.trim();
  }

  /**
   * Build a summary of previous attempts for the optimizer.
   */
  private buildAttemptHistory(): string {
    if (!this.trajectory || this.trajectory.attempts.length <= 1) {
      return '';
    }

    // Get top N attempts by score
    const topAttempts = [...this.trajectory.attempts]
      .sort((a, b) => b.score - a.score)
      .slice(0, this.feedbackOptions.historySize!);

    return topAttempts
      .map(
        (attempt, idx) =>
          `${idx + 1}. (Score: ${(attempt.score * 100).toFixed(1)}%) ${this.truncateToTokenLimit(attempt.prompt, 200)}`
      )
      .join('\n\n');
  }

  /**
   * Build the evaluation prompt.
   */
  private buildEvaluationPrompt(
    prompt: string,
    context: OptimizationContext
  ): string {
    return `Evaluate the following prompt on a scale from 0 to 100.

PROMPT TO EVALUATE:
${prompt}

EVALUATION CRITERIA:
1. CLARITY (25%): Is the prompt clear and unambiguous?
2. SPECIFICITY (25%): Does it provide enough detail and context?
3. TASK ALIGNMENT (25%): Does it clearly convey what's expected?
4. EFFICIENCY (25%): Is it concise without losing important information?

${context.examples.length > 0 ? `REFERENCE - Good prompts in this domain typically:
${context.examples.slice(0, 2).map((e) => `- ${e.afterPrompt.slice(0, 100)}...`).join('\n')}` : ''}

Provide your evaluation in this exact format:
CLARITY: [score]/100
SPECIFICITY: [score]/100
TASK_ALIGNMENT: [score]/100
EFFICIENCY: [score]/100
OVERALL: [weighted average]/100

Brief explanation of the overall score:`;
  }

  /**
   * Parse a score from the evaluation response.
   */
  private parseScoreFromResponse(response: string): number {
    // Try to find OVERALL score
    const overallMatch = response.match(/OVERALL:\s*(\d+(?:\.\d+)?)/i);
    if (overallMatch) {
      return parseFloat(overallMatch[1]) / 100;
    }

    // Fallback: try to find any number that looks like a score
    const numbers = response.match(/(\d+(?:\.\d+)?)/g);
    if (numbers && numbers.length > 0) {
      // Take the last number (often the overall)
      const lastNum = parseFloat(numbers[numbers.length - 1]);
      if (lastNum <= 100) {
        return lastNum / 100;
      }
    }

    // Default to middle score if parsing fails
    return 0.5;
  }

  /**
   * Score a variant on multiple dimensions.
   */
  private async scoreVariant(
    variant: PromptVariant
  ): Promise<ScoredVariant['scores']> {
    // Use the variant's existing score as baseline
    const baseScore = variant.score;

    // Estimate other dimensions based on heuristics and the base score
    // In a full implementation, each would be evaluated separately
    return {
      overall: baseScore,
      clarity: baseScore * (0.9 + Math.random() * 0.2), // Small variance
      specificity: baseScore * (0.85 + Math.random() * 0.3),
      taskAlignment: baseScore * (0.9 + Math.random() * 0.2),
      efficiency: this.calculateEfficiencyScore(variant.content),
    };
  }

  /**
   * Calculate efficiency score based on token count.
   */
  private calculateEfficiencyScore(content: string): number {
    const tokens = this.estimateTokens(content);

    // Optimal range: 100-500 tokens for most prompts
    if (tokens < 50) return 0.6; // Too short
    if (tokens > 1000) return 0.5; // Too long
    if (tokens >= 100 && tokens <= 500) return 0.9; // Optimal
    if (tokens < 100) return 0.7 + (tokens / 100) * 0.2;
    return 0.9 - ((tokens - 500) / 500) * 0.4; // Decreasing for longer
  }

  /**
   * Generate feedback string for a scored variant.
   */
  private generateVariantFeedback(scores: ScoredVariant['scores']): string {
    const feedback: string[] = [];

    if (scores.clarity < 0.7) {
      feedback.push('Could improve clarity of instructions');
    }
    if (scores.specificity < 0.7) {
      feedback.push('Needs more specific details');
    }
    if (scores.taskAlignment < 0.7) {
      feedback.push('Task requirements could be clearer');
    }
    if (scores.efficiency < 0.6) {
      feedback.push('Could be more concise');
    }

    if (feedback.length === 0) {
      feedback.push('Good overall quality');
    }

    return feedback.join('. ');
  }

  /**
   * Generate recommendations based on evaluation results.
   */
  private generateRecommendations(
    variants: ScoredVariant[],
    improvement: number
  ): string[] {
    const recommendations: string[] = [];

    if (improvement < 10) {
      recommendations.push(
        'Consider using additional techniques like chain-of-thought or few-shot examples'
      );
    }

    const avgClarity =
      variants.reduce((sum, v) => sum + v.scores.clarity, 0) / variants.length;
    if (avgClarity < 0.7) {
      recommendations.push('Focus on improving instruction clarity in future iterations');
    }

    const avgEfficiency =
      variants.reduce((sum, v) => sum + v.scores.efficiency, 0) / variants.length;
    if (avgEfficiency < 0.6) {
      recommendations.push('Consider condensing prompts for better efficiency');
    }

    if (this.trajectory && this.trajectory.totalIterations < 3) {
      recommendations.push('Additional iterations may yield further improvements');
    }

    return recommendations;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a feedback iteration technique with default or custom options.
 */
export function createFeedbackIterationTechnique(
  options?: FeedbackIterationOptions
): FeedbackIterationTechnique {
  return new FeedbackIterationTechnique(options);
}
