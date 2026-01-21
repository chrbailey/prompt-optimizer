/**
 * Evaluator Agent - Specialist Agent for Quality Assessment
 *
 * This agent is responsible for evaluating the quality of prompts and
 * optimization results. It provides:
 * - Accuracy estimation
 * - Latency prediction
 * - Cost calculation
 * - A/B comparison between variants
 * - Quality issue detection
 *
 * @module core/agents/evaluator-agent
 */

import { BaseAgent, type BaseAgentConfig } from './base-agent.js';
import type {
  AgentTask,
  AgentResult,
  PromptVariant,
  ResultMetrics,
  OptimizationContext,
} from '../../types/index.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration specific to the evaluator agent.
 */
export interface EvaluatorAgentConfig extends BaseAgentConfig {
  /** Minimum quality score to pass evaluation */
  minQualityThreshold: number;
  /** Whether to perform detailed analysis */
  detailedAnalysis: boolean;
  /** Quality dimensions to evaluate */
  evaluationDimensions: QualityDimension[];
  /** Whether to compare against original prompt */
  compareWithOriginal: boolean;
}

/**
 * Dimensions of quality to evaluate.
 */
export type QualityDimension =
  | 'clarity'
  | 'specificity'
  | 'structure'
  | 'completeness'
  | 'coherence'
  | 'safety'
  | 'efficiency';

/**
 * Quality issue found during evaluation.
 */
export interface QualityIssue {
  /** Type of issue */
  type: QualityDimension | 'ambiguity' | 'length' | 'format';
  /** Severity level */
  severity: 'low' | 'medium' | 'high';
  /** Description of the issue */
  description: string;
  /** Suggested fix */
  suggestion: string;
  /** Location in text (if applicable) */
  location?: { start: number; end: number };
}

/**
 * Evaluation scores breakdown.
 */
export interface EvaluationScores {
  /** Overall quality score (0-1) */
  overall: number;
  /** Score by dimension */
  dimensions: Record<QualityDimension, number>;
  /** Confidence in the evaluation */
  confidence: number;
}

/**
 * A/B comparison result.
 */
export interface ComparisonResult {
  /** Winner: 'a', 'b', or 'tie' */
  winner: 'a' | 'b' | 'tie';
  /** Score difference */
  scoreDifference: number;
  /** Detailed comparison */
  comparison: {
    dimension: QualityDimension;
    scoreA: number;
    scoreB: number;
    winner: 'a' | 'b' | 'tie';
  }[];
  /** Summary explanation */
  summary: string;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_EVALUATOR_CONFIG: Partial<EvaluatorAgentConfig> = {
  minQualityThreshold: 0.6,
  detailedAnalysis: true,
  evaluationDimensions: [
    'clarity',
    'specificity',
    'structure',
    'completeness',
    'coherence',
  ],
  compareWithOriginal: true,
};

// =============================================================================
// Evaluator Agent Class
// =============================================================================

/**
 * Specialist agent for quality evaluation.
 *
 * The EvaluatorAgent assesses prompt quality across multiple dimensions
 * and provides detailed feedback for improvement.
 */
export class EvaluatorAgent extends BaseAgent {
  readonly name = 'evaluator';
  readonly capabilities = ['evaluate', 'compare'];

  private evaluatorConfig: EvaluatorAgentConfig;

  constructor(config: Partial<EvaluatorAgentConfig> = {}) {
    super(config);
    this.evaluatorConfig = {
      ...DEFAULT_EVALUATOR_CONFIG,
      ...config,
    } as EvaluatorAgentConfig;
  }

  // ===========================================================================
  // Abstract Method Implementation
  // ===========================================================================

  /**
   * Execute quality evaluation.
   *
   * @param task - The evaluation task
   * @returns Evaluation result with quality scores
   */
  async execute(task: AgentTask): Promise<AgentResult> {
    this.log('info', `Evaluating prompt quality (${task.prompt.length} chars)`);

    // Get symbol context (internal only)
    const enrichedContext = await this.getSymbolContext(task);

    // Evaluate the prompt
    const scores = this.evaluatePrompt(task.prompt, enrichedContext);
    this.log('debug', `Overall quality score: ${scores.overall.toFixed(2)}`);

    // Detect quality issues
    const issues = this.detectIssues(task.prompt, scores);
    this.log('debug', `Found ${issues.length} quality issues`);

    // Generate improvement suggestions
    const improvedVariant = this.generateImprovedVariant(
      task.prompt,
      issues,
      enrichedContext
    );

    // Create variants with quality annotations
    const variants = this.createEvaluatedVariants(
      task.prompt,
      improvedVariant,
      scores
    );

    // Build result
    const result = this.createResult(
      improvedVariant || task.prompt,
      variants,
      'default',
      this.generateEvaluationReasoning(scores, issues)
    );

    // Add evaluation-specific metrics
    const metrics: ResultMetrics = {
      ...result.metrics,
      estimatedAccuracy: scores.overall,
      latency: this.predictLatency(task.prompt),
      cost: this.calculateCost(task.prompt),
      tokenCount: {
        input: this.estimateTokens(task.prompt),
        output: this.estimateTokens(improvedVariant || task.prompt),
      },
    };

    this.setCustomMetric('qualityScore', scores.overall);
    this.setCustomMetric('issuesFound', issues.length);

    return {
      ...result,
      metrics,
    };
  }

  // ===========================================================================
  // Public Methods
  // ===========================================================================

  /**
   * Evaluate a prompt directly.
   */
  evaluatePromptQuality(prompt: string): EvaluationScores {
    return this.evaluatePrompt(prompt, {
      symbols: [],
      examples: [],
      constraints: [],
      domainHints: [],
    });
  }

  /**
   * Compare two prompts (A/B testing).
   */
  comparePrompts(promptA: string, promptB: string): ComparisonResult {
    const scoresA = this.evaluatePrompt(promptA, {
      symbols: [],
      examples: [],
      constraints: [],
      domainHints: [],
    });

    const scoresB = this.evaluatePrompt(promptB, {
      symbols: [],
      examples: [],
      constraints: [],
      domainHints: [],
    });

    const comparison: ComparisonResult['comparison'] = [];

    for (const dimension of this.evaluatorConfig.evaluationDimensions) {
      const scoreA = scoresA.dimensions[dimension];
      const scoreB = scoresB.dimensions[dimension];

      comparison.push({
        dimension,
        scoreA,
        scoreB,
        winner: scoreA > scoreB ? 'a' : scoreB > scoreA ? 'b' : 'tie',
      });
    }

    const scoreDifference = scoresA.overall - scoresB.overall;
    let winner: 'a' | 'b' | 'tie' = 'tie';

    if (scoreDifference > 0.05) winner = 'a';
    else if (scoreDifference < -0.05) winner = 'b';

    return {
      winner,
      scoreDifference: Math.abs(scoreDifference),
      comparison,
      summary: this.generateComparisonSummary(winner, comparison),
    };
  }

  /**
   * Detect quality issues in a prompt.
   */
  detectQualityIssues(prompt: string): QualityIssue[] {
    const scores = this.evaluatePrompt(prompt, {
      symbols: [],
      examples: [],
      constraints: [],
      domainHints: [],
    });
    return this.detectIssues(prompt, scores);
  }

  // ===========================================================================
  // Private Methods - Evaluation
  // ===========================================================================

  /**
   * Evaluate prompt across all dimensions.
   */
  private evaluatePrompt(
    prompt: string,
    context: OptimizationContext
  ): EvaluationScores {
    const dimensions: Record<QualityDimension, number> = {
      clarity: this.evaluateClarity(prompt),
      specificity: this.evaluateSpecificity(prompt),
      structure: this.evaluateStructure(prompt),
      completeness: this.evaluateCompleteness(prompt, context),
      coherence: this.evaluateCoherence(prompt),
      safety: this.evaluateSafety(prompt),
      efficiency: this.evaluateEfficiency(prompt),
    };

    // Calculate weighted overall score
    const weights: Record<QualityDimension, number> = {
      clarity: 0.2,
      specificity: 0.2,
      structure: 0.15,
      completeness: 0.15,
      coherence: 0.15,
      safety: 0.1,
      efficiency: 0.05,
    };

    let overall = 0;
    for (const dim of this.evaluatorConfig.evaluationDimensions) {
      overall += dimensions[dim] * (weights[dim] || 0.1);
    }

    // Normalize
    const totalWeight = this.evaluatorConfig.evaluationDimensions.reduce(
      (sum, dim) => sum + (weights[dim] || 0.1),
      0
    );
    overall /= totalWeight;

    // Calculate confidence based on analysis depth
    const confidence = this.calculateConfidence(prompt, dimensions);

    return { overall, dimensions, confidence };
  }

  /**
   * Evaluate clarity.
   */
  private evaluateClarity(prompt: string): number {
    let score = 0.7; // Base score

    const lower = prompt.toLowerCase();
    const words = prompt.split(/\s+/);
    const avgWordLength = words.reduce((s, w) => s + w.length, 0) / words.length;

    // Clear, simple language
    if (avgWordLength < 6) score += 0.1;
    if (avgWordLength > 8) score -= 0.1;

    // Check for jargon overload
    const jargonPatterns = [
      /leverage/i,
      /synergy/i,
      /paradigm/i,
      /holistic/i,
      /utilize/i,
    ];
    const jargonCount = jargonPatterns.filter((p) => p.test(prompt)).length;
    score -= jargonCount * 0.05;

    // Check for clear action verbs
    const actionVerbs = [
      'create',
      'write',
      'explain',
      'analyze',
      'list',
      'describe',
      'summarize',
    ];
    if (actionVerbs.some((v) => lower.includes(v))) score += 0.1;

    // Avoid double negatives
    if (/(not|n't).*?(not|n't)/i.test(prompt)) score -= 0.15;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Evaluate specificity.
   */
  private evaluateSpecificity(prompt: string): number {
    let score = 0.6; // Base score

    const lower = prompt.toLowerCase();

    // Check for specific quantities or constraints
    if (/\d+/.test(prompt)) score += 0.1;
    if (lower.includes('exactly') || lower.includes('precisely')) score += 0.1;
    if (lower.includes('at least') || lower.includes('at most')) score += 0.1;

    // Check for vague terms
    const vagueTerms = ['some', 'maybe', 'possibly', 'probably', 'various', 'etc'];
    const vagueCount = vagueTerms.filter((t) => lower.includes(t)).length;
    score -= vagueCount * 0.05;

    // Check for specific format requests
    if (
      lower.includes('json') ||
      lower.includes('markdown') ||
      lower.includes('csv') ||
      lower.includes('bullet')
    ) {
      score += 0.1;
    }

    // Check for context/background
    if (prompt.length > 100 && lower.includes('context:')) score += 0.1;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Evaluate structure.
   */
  private evaluateStructure(prompt: string): number {
    let score = 0.6; // Base score

    // Check for formatting
    const hasHeadings = /^#+\s|^#{1,6}\s/m.test(prompt);
    const hasBullets = /^[-*]\s/m.test(prompt);
    const hasNumbering = /^\d+\.\s/m.test(prompt);
    const hasSections = prompt.includes('\n\n');

    if (hasHeadings) score += 0.15;
    if (hasBullets || hasNumbering) score += 0.1;
    if (hasSections && prompt.length > 200) score += 0.1;

    // Check for clear introduction/task
    const sentences = prompt.split(/[.!?]+/).filter((s) => s.trim());
    if (sentences.length >= 2) score += 0.05;

    // Penalty for wall of text
    if (prompt.length > 500 && !hasSections && !hasBullets) {
      score -= 0.2;
    }

    // Check for clear closing/desired output
    const lower = prompt.toLowerCase();
    if (
      lower.includes('output:') ||
      lower.includes('response:') ||
      lower.includes('answer:')
    ) {
      score += 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Evaluate completeness.
   */
  private evaluateCompleteness(
    prompt: string,
    context: OptimizationContext
  ): number {
    let score = 0.6; // Base score

    const lower = prompt.toLowerCase();

    // Check for key prompt components
    const hasTask = /\b(write|create|explain|analyze|list|describe|summarize|help)\b/i.test(prompt);
    const hasContext = prompt.length > 50;
    const hasConstraints = /\b(must|should|need|require|limit|maximum|minimum)\b/i.test(prompt);
    const hasFormat = /\b(format|structure|style|markdown|json|list)\b/i.test(lower);

    if (hasTask) score += 0.15;
    if (hasContext) score += 0.1;
    if (hasConstraints) score += 0.1;
    if (hasFormat) score += 0.1;

    // Check for examples (good for completeness)
    if (context.examples.length > 0 || lower.includes('example')) {
      score += 0.1;
    }

    // Very short prompts are incomplete
    if (prompt.length < 20) score -= 0.3;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Evaluate coherence.
   */
  private evaluateCoherence(prompt: string): number {
    let score = 0.7; // Base score

    const sentences = prompt.split(/[.!?]+/).filter((s) => s.trim());

    // Check for logical flow
    const transitionWords = [
      'first',
      'then',
      'next',
      'finally',
      'however',
      'therefore',
      'because',
      'additionally',
      'moreover',
    ];
    const hasTransitions = transitionWords.some((t) =>
      prompt.toLowerCase().includes(t)
    );
    if (hasTransitions && sentences.length > 2) score += 0.1;

    // Check for topic consistency
    // Simplified: check if first and last sentences share words
    if (sentences.length >= 2) {
      const firstWords = new Set(sentences[0].toLowerCase().split(/\s+/));
      const lastWords = sentences[sentences.length - 1].toLowerCase().split(/\s+/);
      const overlap = lastWords.filter((w) => firstWords.has(w) && w.length > 3);
      if (overlap.length > 0) score += 0.1;
    }

    // Check for contradictions (basic)
    const lower = prompt.toLowerCase();
    if (
      (lower.includes('always') && lower.includes('never')) ||
      (lower.includes('all') && lower.includes('none'))
    ) {
      score -= 0.2;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Evaluate safety.
   */
  private evaluateSafety(prompt: string): number {
    let score = 1.0; // Start with perfect safety

    const lower = prompt.toLowerCase();

    // Check for potentially problematic content indicators
    const concernPatterns = [
      /hack|exploit|bypass/i,
      /ignore (previous |all )?(instructions|rules)/i,
      /pretend (you'?re|to be|you are)/i,
      /jailbreak|dan mode/i,
    ];

    for (const pattern of concernPatterns) {
      if (pattern.test(prompt)) {
        score -= 0.3;
      }
    }

    // Check for sensitive topics that need careful handling
    if (lower.includes('medical advice') || lower.includes('legal advice')) {
      score -= 0.1; // Not unsafe, but needs care
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Evaluate efficiency.
   */
  private evaluateEfficiency(prompt: string): number {
    let score = 0.7; // Base score

    const tokens = this.estimateTokens(prompt);
    const words = prompt.split(/\s+/);

    // Optimal length range
    if (tokens >= 50 && tokens <= 500) score += 0.2;
    else if (tokens < 20) score -= 0.2;
    else if (tokens > 1000) score -= 0.1;

    // Check for redundancy
    const uniqueWords = new Set(words.map((w) => w.toLowerCase()));
    const redundancyRatio = 1 - uniqueWords.size / words.length;
    if (redundancyRatio > 0.5) score -= 0.2;

    // Check for filler words
    const fillers = ['basically', 'actually', 'just', 'really', 'very', 'so'];
    const fillerCount = fillers.filter((f) =>
      prompt.toLowerCase().includes(f)
    ).length;
    score -= fillerCount * 0.03;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate confidence in evaluation.
   */
  private calculateConfidence(
    prompt: string,
    dimensions: Record<QualityDimension, number>
  ): number {
    // Confidence is higher for longer prompts (more data)
    let confidence = 0.7;

    const tokens = this.estimateTokens(prompt);
    if (tokens > 100) confidence += 0.1;
    if (tokens > 300) confidence += 0.1;

    // Lower confidence if scores are inconsistent
    const scores = Object.values(dimensions);
    const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
    const variance =
      scores.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / scores.length;
    if (variance > 0.1) confidence -= 0.1;

    return Math.max(0.5, Math.min(0.95, confidence));
  }

  // ===========================================================================
  // Private Methods - Issue Detection
  // ===========================================================================

  /**
   * Detect quality issues based on scores.
   */
  private detectIssues(
    prompt: string,
    scores: EvaluationScores
  ): QualityIssue[] {
    const issues: QualityIssue[] = [];

    // Check each dimension
    for (const [dimension, score] of Object.entries(scores.dimensions)) {
      if (score < 0.5) {
        issues.push(
          this.createIssueForDimension(
            dimension as QualityDimension,
            score,
            prompt
          )
        );
      }
    }

    // Additional specific checks
    issues.push(...this.detectSpecificIssues(prompt));

    return issues;
  }

  /**
   * Create an issue for a low-scoring dimension.
   */
  private createIssueForDimension(
    dimension: QualityDimension,
    score: number,
    prompt: string
  ): QualityIssue {
    const severity: QualityIssue['severity'] =
      score < 0.3 ? 'high' : score < 0.4 ? 'medium' : 'low';

    const suggestions: Record<QualityDimension, string> = {
      clarity: 'Use simpler language and avoid jargon. Start with a clear action verb.',
      specificity: 'Add specific constraints, numbers, or format requirements.',
      structure: 'Break the prompt into sections with clear headings or bullet points.',
      completeness: 'Include context, constraints, and desired output format.',
      coherence: 'Ensure logical flow between sentences. Check for contradictions.',
      safety: 'Review content for potentially problematic requests.',
      efficiency: 'Remove redundant phrases and filler words.',
    };

    return {
      type: dimension,
      severity,
      description: `Low ${dimension} score (${(score * 100).toFixed(0)}%)`,
      suggestion: suggestions[dimension],
    };
  }

  /**
   * Detect specific textual issues.
   */
  private detectSpecificIssues(prompt: string): QualityIssue[] {
    const issues: QualityIssue[] = [];
    const lower = prompt.toLowerCase();

    // Check for ambiguous pronouns
    if (/\b(it|this|that|they|them)\b/.test(lower) && prompt.length < 100) {
      issues.push({
        type: 'ambiguity',
        severity: 'medium',
        description: 'Ambiguous pronoun usage without clear referent',
        suggestion: 'Replace pronouns with specific nouns for clarity.',
      });
    }

    // Check for excessive length without structure
    if (prompt.length > 500 && !prompt.includes('\n')) {
      issues.push({
        type: 'structure',
        severity: 'medium',
        description: 'Long prompt without paragraph breaks',
        suggestion: 'Break into paragraphs or use bullet points.',
      });
    }

    // Check for very short prompts
    if (prompt.length < 30) {
      issues.push({
        type: 'length',
        severity: 'high',
        description: 'Prompt is too brief to provide sufficient context',
        suggestion: 'Add more context about your goal and requirements.',
      });
    }

    return issues;
  }

  // ===========================================================================
  // Private Methods - Improvement Generation
  // ===========================================================================

  /**
   * Generate an improved variant based on issues.
   */
  private generateImprovedVariant(
    prompt: string,
    issues: QualityIssue[],
    context: OptimizationContext
  ): string {
    if (issues.length === 0) {
      return prompt; // No improvements needed
    }

    let improved = prompt;

    // Apply improvements based on issue types
    const issueTypes = new Set(issues.map((i) => i.type));

    // Add structure if needed
    if (issueTypes.has('structure') && !improved.includes('\n')) {
      const sentences = improved.split(/(?<=[.!?])\s+/);
      if (sentences.length >= 3) {
        improved = sentences.join('\n\n');
      }
    }

    // Add clarity improvements
    if (issueTypes.has('clarity')) {
      // Ensure clear action verb at start if missing
      const hasActionStart =
        /^(please\s+)?(create|write|explain|analyze|list|describe|help)/i.test(
          improved
        );
      if (!hasActionStart) {
        improved = 'Please help me with the following:\n\n' + improved;
      }
    }

    // Add completeness improvements
    if (issueTypes.has('completeness')) {
      if (!improved.toLowerCase().includes('format')) {
        improved += '\n\nPlease provide a clear, well-structured response.';
      }
    }

    // Strip any internal symbols
    return this.stripSymbols(improved);
  }

  /**
   * Create evaluated variants.
   */
  private createEvaluatedVariants(
    original: string,
    improved: string | null,
    scores: EvaluationScores
  ): PromptVariant[] {
    const variants: PromptVariant[] = [
      {
        content: this.stripSymbols(original),
        technique: 'original',
        score: scores.overall,
        model: 'default',
      },
    ];

    if (improved && improved !== original) {
      // Evaluate the improved version
      const improvedScores = this.evaluatePrompt(improved, {
        symbols: [],
        examples: [],
        constraints: [],
        domainHints: [],
      });

      variants.push({
        content: this.stripSymbols(improved),
        technique: 'evaluated_improvement',
        score: improvedScores.overall,
        model: 'default',
      });
    }

    return variants;
  }

  // ===========================================================================
  // Private Methods - Utilities
  // ===========================================================================

  /**
   * Generate evaluation reasoning.
   */
  private generateEvaluationReasoning(
    scores: EvaluationScores,
    issues: QualityIssue[]
  ): string {
    let reasoning = `Quality evaluation complete. Overall score: ${(scores.overall * 100).toFixed(0)}%. `;

    // Highlight strengths
    const strengths = Object.entries(scores.dimensions)
      .filter(([_, score]) => score >= 0.7)
      .map(([dim, _]) => dim);

    if (strengths.length > 0) {
      reasoning += `Strengths: ${strengths.join(', ')}. `;
    }

    // Note issues
    if (issues.length > 0) {
      const highIssues = issues.filter((i) => i.severity === 'high');
      if (highIssues.length > 0) {
        reasoning += `Critical issues found: ${highIssues.map((i) => i.type).join(', ')}. `;
      } else {
        reasoning += `${issues.length} minor issues detected. `;
      }
    } else {
      reasoning += 'No significant issues found.';
    }

    return this.stripSymbols(reasoning);
  }

  /**
   * Generate comparison summary.
   */
  private generateComparisonSummary(
    winner: 'a' | 'b' | 'tie',
    comparison: ComparisonResult['comparison']
  ): string {
    if (winner === 'tie') {
      return 'Both prompts are comparable in quality.';
    }

    const advantages = comparison
      .filter((c) => c.winner === winner)
      .map((c) => c.dimension);

    return `Prompt ${winner.toUpperCase()} is better overall, with advantages in: ${advantages.join(', ')}.`;
  }

  /**
   * Predict latency for prompt.
   */
  private predictLatency(prompt: string): number {
    const tokens = this.estimateTokens(prompt);
    // Rough estimation: ~50ms per 100 tokens
    return Math.round(tokens * 0.5) + 500; // Base latency
  }

  /**
   * Calculate cost estimate.
   */
  private calculateCost(prompt: string): number {
    const tokens = this.estimateTokens(prompt);
    // Rough estimate based on average model pricing
    const inputCost = (tokens / 1000) * 0.003;
    const outputCost = ((tokens * 2) / 1000) * 0.015;
    return inputCost + outputCost;
  }
}

// =============================================================================
// Exports
// =============================================================================

export default EvaluatorAgent;
