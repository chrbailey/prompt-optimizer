/**
 * Result Aggregator - Combine and Rank Results from Multiple Agents
 *
 * This module provides functionality to aggregate, score, deduplicate, and
 * rank optimization results from multiple specialist agents. It supports:
 * - Weighted scoring based on agent confidence and priority
 * - Deduplication of similar variants
 * - Best variant selection
 * - Ensemble combination strategies
 *
 * @module core/orchestrator/result-aggregator
 */

import type {
  AgentResult,
  PromptVariant,
  ResultMetrics,
} from '../../types/index.js';
import { SymbolEncoder } from '../agents/symbol-encoder.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration for result aggregation.
 */
export interface AggregatorConfig {
  /** Strategy for combining results */
  strategy: AggregationStrategy;
  /** Weights for different agents (by name) */
  agentWeights: Record<string, number>;
  /** Minimum similarity threshold for deduplication (0-1) */
  deduplicationThreshold: number;
  /** Maximum variants to keep after aggregation */
  maxVariants: number;
  /** Minimum score to include a variant */
  minScore: number;
  /** Weight factors for scoring */
  scoreWeights: ScoreWeights;
}

/**
 * Aggregation strategy options.
 */
export type AggregationStrategy =
  | 'best_of_all'      // Select single best variant across all agents
  | 'weighted_merge'   // Merge with weighted scoring
  | 'ensemble'         // Combine multiple top variants
  | 'voting'           // Use voting among agents
  | 'confidence_weighted'; // Weight by agent confidence

/**
 * Weight factors for variant scoring.
 */
export interface ScoreWeights {
  /** Weight for base quality score */
  quality: number;
  /** Weight for agent confidence */
  confidence: number;
  /** Weight for token efficiency */
  tokenEfficiency: number;
  /** Weight for technique diversity */
  techniqueDiversity: number;
}

/**
 * Scored variant with aggregation metadata.
 */
export interface ScoredVariant extends PromptVariant {
  /** Original quality score from agent */
  originalScore: number;
  /** Aggregated weighted score */
  aggregatedScore: number;
  /** Source agent name */
  sourceAgent: string;
  /** Ranking position */
  rank: number;
  /** Confidence from source agent */
  sourceConfidence: number;
  /** Whether this is part of an ensemble */
  inEnsemble: boolean;
}

/**
 * Aggregated result with metadata.
 */
export interface AggregatedResult {
  /** Best optimized prompt */
  optimizedPrompt: string;
  /** Ranked variants */
  variants: ScoredVariant[];
  /** Combined metrics */
  metrics: AggregatedMetrics;
  /** Selected model */
  selectedModel: string;
  /** Aggregated reasoning */
  reasoning: string;
  /** Source agent results count */
  sourceCount: number;
  /** Strategy used */
  strategy: AggregationStrategy;
}

/**
 * Aggregated metrics from multiple agents.
 */
export interface AggregatedMetrics extends ResultMetrics {
  /** Individual agent metrics */
  agentBreakdown: Array<{
    agent: string;
    executionTimeMs: number;
    variantCount: number;
    topScore: number;
  }>;
  /** Aggregation-specific metrics */
  aggregation: {
    totalVariantsReceived: number;
    variantsAfterDedup: number;
    variantsInFinalResult: number;
    averageConfidence: number;
    scoreSpread: number;
  };
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: AggregatorConfig = {
  strategy: 'weighted_merge',
  agentWeights: {
    optimizer: 1.0,
    router: 0.8,
    evaluator: 0.9,
  },
  deduplicationThreshold: 0.85,
  maxVariants: 5,
  minScore: 0.3,
  scoreWeights: {
    quality: 0.4,
    confidence: 0.3,
    tokenEfficiency: 0.15,
    techniqueDiversity: 0.15,
  },
};

// =============================================================================
// Result Aggregator Class
// =============================================================================

/**
 * Aggregates and ranks results from multiple specialist agents.
 *
 * The aggregator applies various strategies to combine results,
 * deduplicate similar variants, and produce a single cohesive result.
 */
export class ResultAggregator {
  private config: AggregatorConfig;
  private symbolEncoder: SymbolEncoder;

  constructor(config: Partial<AggregatorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.symbolEncoder = new SymbolEncoder();
  }

  // ===========================================================================
  // Public Methods - Main Aggregation
  // ===========================================================================

  /**
   * Aggregate results from multiple agents into a single result.
   *
   * @param results - Array of agent results
   * @param agentNames - Corresponding agent names
   * @returns Aggregated result
   */
  aggregate(
    results: AgentResult[],
    agentNames: string[]
  ): AggregatedResult {
    if (results.length === 0) {
      throw new Error('No results to aggregate');
    }

    if (results.length !== agentNames.length) {
      throw new Error('Results and agent names must match');
    }

    // Collect all variants with source metadata
    const allVariants = this.collectVariants(results, agentNames);

    // Apply scoring
    const scoredVariants = this.scoreVariants(allVariants);

    // Deduplicate
    const dedupedVariants = this.deduplicateVariants(scoredVariants);

    // Apply strategy
    const finalVariants = this.applyStrategy(dedupedVariants);

    // Build aggregated result
    return this.buildAggregatedResult(finalVariants, results, agentNames);
  }

  /**
   * Aggregate results using a specific strategy.
   *
   * @param results - Array of agent results
   * @param agentNames - Corresponding agent names
   * @param strategy - Strategy to use
   * @returns Aggregated result
   */
  aggregateWithStrategy(
    results: AgentResult[],
    agentNames: string[],
    strategy: AggregationStrategy
  ): AggregatedResult {
    const originalStrategy = this.config.strategy;
    this.config.strategy = strategy;

    try {
      return this.aggregate(results, agentNames);
    } finally {
      this.config.strategy = originalStrategy;
    }
  }

  // ===========================================================================
  // Public Methods - Individual Operations
  // ===========================================================================

  /**
   * Score a single variant.
   *
   * @param variant - The variant to score
   * @param agentName - Source agent name
   * @param confidence - Agent confidence
   * @returns Scored variant
   */
  scoreVariant(
    variant: PromptVariant,
    agentName: string,
    confidence: number = 0.8
  ): ScoredVariant {
    const agentWeight = this.config.agentWeights[agentName] ?? 1.0;
    const weights = this.config.scoreWeights;

    // Calculate component scores
    const qualityComponent = variant.score * weights.quality;
    const confidenceComponent = confidence * weights.confidence;
    const tokenComponent = this.calculateTokenEfficiency(variant) * weights.tokenEfficiency;
    const diversityComponent = 0.5 * weights.techniqueDiversity; // Base diversity score

    // Calculate aggregated score
    const aggregatedScore =
      (qualityComponent + confidenceComponent + tokenComponent + diversityComponent) *
      agentWeight;

    return {
      ...variant,
      originalScore: variant.score,
      aggregatedScore,
      sourceAgent: agentName,
      rank: 0, // Will be set during ranking
      sourceConfidence: confidence,
      inEnsemble: false,
    };
  }

  /**
   * Deduplicate a list of variants.
   *
   * @param variants - Variants to deduplicate
   * @returns Deduplicated variants
   */
  deduplicate(variants: ScoredVariant[]): ScoredVariant[] {
    return this.deduplicateVariants(variants);
  }

  /**
   * Rank variants by score.
   *
   * @param variants - Variants to rank
   * @returns Ranked variants with position set
   */
  rank(variants: ScoredVariant[]): ScoredVariant[] {
    const sorted = [...variants].sort(
      (a, b) => b.aggregatedScore - a.aggregatedScore
    );

    return sorted.map((v, index) => ({
      ...v,
      rank: index + 1,
    }));
  }

  /**
   * Select the best variant from a list.
   *
   * @param variants - Variants to choose from
   * @returns The best variant
   */
  selectBest(variants: ScoredVariant[]): ScoredVariant {
    if (variants.length === 0) {
      throw new Error('No variants to select from');
    }

    return variants.reduce((best, current) =>
      current.aggregatedScore > best.aggregatedScore ? current : best
    );
  }

  /**
   * Create an ensemble from top variants.
   *
   * @param variants - Variants to create ensemble from
   * @param count - Number of variants in ensemble
   * @returns Ensemble variants
   */
  createEnsemble(variants: ScoredVariant[], count: number = 3): ScoredVariant[] {
    const ranked = this.rank(variants);
    const ensemble = ranked.slice(0, count);

    return ensemble.map((v) => ({
      ...v,
      inEnsemble: true,
    }));
  }

  // ===========================================================================
  // Public Methods - Configuration
  // ===========================================================================

  /**
   * Update aggregator configuration.
   *
   * @param config - Partial configuration to update
   */
  configure(config: Partial<AggregatorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set weight for a specific agent.
   *
   * @param agentName - Agent name
   * @param weight - Weight value (0-2, where 1 is neutral)
   */
  setAgentWeight(agentName: string, weight: number): void {
    this.config.agentWeights[agentName] = Math.max(0, Math.min(2, weight));
  }

  /**
   * Get current configuration.
   */
  getConfig(): AggregatorConfig {
    return { ...this.config };
  }

  // ===========================================================================
  // Private Methods - Variant Collection
  // ===========================================================================

  /**
   * Collect all variants from agent results.
   */
  private collectVariants(
    results: AgentResult[],
    agentNames: string[]
  ): Array<{ variant: PromptVariant; agentName: string; confidence: number }> {
    const collected: Array<{
      variant: PromptVariant;
      agentName: string;
      confidence: number;
    }> = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const agentName = agentNames[i];

      // Estimate confidence from metrics
      const confidence = this.estimateConfidence(result);

      // Add all variants
      for (const variant of result.variants) {
        collected.push({
          variant,
          agentName,
          confidence,
        });
      }

      // Add the main optimized prompt as a variant if not already included
      const mainAsVariant = result.variants.find(
        (v) => v.content === result.optimizedPrompt
      );

      if (!mainAsVariant) {
        collected.push({
          variant: {
            content: result.optimizedPrompt,
            technique: 'primary',
            score: 1.0, // Highest confidence for primary
            model: result.selectedModel,
          },
          agentName,
          confidence,
        });
      }
    }

    return collected;
  }

  /**
   * Estimate agent confidence from result metrics.
   */
  private estimateConfidence(result: AgentResult): number {
    // Use accuracy estimate if available
    if (result.metrics.estimatedAccuracy > 0) {
      return result.metrics.estimatedAccuracy;
    }

    // Fallback: estimate from variant scores
    if (result.variants.length > 0) {
      const avgScore =
        result.variants.reduce((sum, v) => sum + v.score, 0) /
        result.variants.length;
      return avgScore;
    }

    return 0.7; // Default confidence
  }

  // ===========================================================================
  // Private Methods - Scoring
  // ===========================================================================

  /**
   * Score all collected variants.
   */
  private scoreVariants(
    collected: Array<{
      variant: PromptVariant;
      agentName: string;
      confidence: number;
    }>
  ): ScoredVariant[] {
    return collected.map(({ variant, agentName, confidence }) =>
      this.scoreVariant(variant, agentName, confidence)
    );
  }

  /**
   * Calculate token efficiency score.
   */
  private calculateTokenEfficiency(variant: PromptVariant): number {
    // Estimate tokens (rough approximation)
    const tokens = Math.ceil(variant.content.length / 4);

    // Optimal range: 50-500 tokens
    if (tokens < 50) {
      return 0.5; // Too short
    }
    if (tokens > 500) {
      return Math.max(0.3, 1 - (tokens - 500) / 1000); // Penalty for length
    }

    return 1.0; // Optimal range
  }

  // ===========================================================================
  // Private Methods - Deduplication
  // ===========================================================================

  /**
   * Deduplicate similar variants.
   */
  private deduplicateVariants(variants: ScoredVariant[]): ScoredVariant[] {
    if (variants.length <= 1) {
      return variants;
    }

    const unique: ScoredVariant[] = [];

    for (const variant of variants) {
      const isDuplicate = unique.some(
        (existing) =>
          this.calculateSimilarity(existing.content, variant.content) >=
          this.config.deduplicationThreshold
      );

      if (!isDuplicate) {
        unique.push(variant);
      } else {
        // Keep the higher-scoring duplicate
        const existingIndex = unique.findIndex(
          (existing) =>
            this.calculateSimilarity(existing.content, variant.content) >=
            this.config.deduplicationThreshold
        );

        if (
          existingIndex >= 0 &&
          variant.aggregatedScore > unique[existingIndex].aggregatedScore
        ) {
          unique[existingIndex] = variant;
        }
      }
    }

    return unique;
  }

  /**
   * Calculate similarity between two strings (Jaccard-like).
   */
  private calculateSimilarity(a: string, b: string): number {
    if (a === b) return 1.0;
    if (!a || !b) return 0.0;

    // Normalize
    const normalizedA = a.toLowerCase().trim();
    const normalizedB = b.toLowerCase().trim();

    // Quick length check
    const lenRatio = Math.min(normalizedA.length, normalizedB.length) /
                     Math.max(normalizedA.length, normalizedB.length);
    if (lenRatio < 0.5) {
      return lenRatio * 0.5; // Very different lengths
    }

    // Word-level Jaccard similarity
    const wordsA = new Set(normalizedA.split(/\s+/));
    const wordsB = new Set(normalizedB.split(/\s+/));

    const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
    const union = new Set([...wordsA, ...wordsB]);

    return intersection.size / union.size;
  }

  // ===========================================================================
  // Private Methods - Strategy Application
  // ===========================================================================

  /**
   * Apply the configured aggregation strategy.
   */
  private applyStrategy(variants: ScoredVariant[]): ScoredVariant[] {
    // Filter by minimum score
    const filtered = variants.filter(
      (v) => v.aggregatedScore >= this.config.minScore
    );

    switch (this.config.strategy) {
      case 'best_of_all':
        return this.applyBestOfAll(filtered);

      case 'weighted_merge':
        return this.applyWeightedMerge(filtered);

      case 'ensemble':
        return this.applyEnsemble(filtered);

      case 'voting':
        return this.applyVoting(filtered);

      case 'confidence_weighted':
        return this.applyConfidenceWeighted(filtered);

      default:
        return this.applyWeightedMerge(filtered);
    }
  }

  /**
   * Best of all strategy: select single best variant.
   */
  private applyBestOfAll(variants: ScoredVariant[]): ScoredVariant[] {
    if (variants.length === 0) return [];

    const best = this.selectBest(variants);
    return [{ ...best, rank: 1 }];
  }

  /**
   * Weighted merge strategy: rank all variants.
   */
  private applyWeightedMerge(variants: ScoredVariant[]): ScoredVariant[] {
    const ranked = this.rank(variants);
    return ranked.slice(0, this.config.maxVariants);
  }

  /**
   * Ensemble strategy: create ensemble from top variants.
   */
  private applyEnsemble(variants: ScoredVariant[]): ScoredVariant[] {
    return this.createEnsemble(variants, this.config.maxVariants);
  }

  /**
   * Voting strategy: prefer variants with support from multiple agents.
   */
  private applyVoting(variants: ScoredVariant[]): ScoredVariant[] {
    // Group by content similarity
    const groups = this.groupBySimilarity(variants);

    // Score groups by number of "votes" (similar variants from different agents)
    const scoredGroups = groups.map((group) => {
      const uniqueAgents = new Set(group.map((v) => v.sourceAgent));
      const voteScore = uniqueAgents.size / 3; // Normalize by expected agent count
      const avgScore =
        group.reduce((sum, v) => sum + v.aggregatedScore, 0) / group.length;

      // Best variant in group, with vote bonus
      const best = this.selectBest(group);
      return {
        ...best,
        aggregatedScore: best.aggregatedScore + voteScore * 0.3,
      };
    });

    return this.rank(scoredGroups).slice(0, this.config.maxVariants);
  }

  /**
   * Confidence weighted strategy: weight heavily by source confidence.
   */
  private applyConfidenceWeighted(variants: ScoredVariant[]): ScoredVariant[] {
    const reweighted = variants.map((v) => ({
      ...v,
      aggregatedScore: v.aggregatedScore * v.sourceConfidence,
    }));

    return this.rank(reweighted).slice(0, this.config.maxVariants);
  }

  /**
   * Group variants by content similarity.
   */
  private groupBySimilarity(variants: ScoredVariant[]): ScoredVariant[][] {
    const groups: ScoredVariant[][] = [];

    for (const variant of variants) {
      let foundGroup = false;

      for (const group of groups) {
        if (
          this.calculateSimilarity(group[0].content, variant.content) >=
          this.config.deduplicationThreshold
        ) {
          group.push(variant);
          foundGroup = true;
          break;
        }
      }

      if (!foundGroup) {
        groups.push([variant]);
      }
    }

    return groups;
  }

  // ===========================================================================
  // Private Methods - Result Building
  // ===========================================================================

  /**
   * Build the final aggregated result.
   */
  private buildAggregatedResult(
    variants: ScoredVariant[],
    originalResults: AgentResult[],
    agentNames: string[]
  ): AggregatedResult {
    // Select best for primary result
    const best = variants.length > 0 ? variants[0] : null;

    // Aggregate model selection (majority vote or highest confidence)
    const selectedModel = this.selectModel(originalResults);

    // Combine reasoning
    const reasoning = this.combineReasoning(originalResults);

    // Build metrics
    const metrics = this.buildAggregatedMetrics(
      variants,
      originalResults,
      agentNames
    );

    // Ensure no symbols leak
    const sanitizedVariants = variants.map((v) => ({
      ...v,
      content: this.symbolEncoder.stripSymbols(v.content),
    }));

    return {
      optimizedPrompt: best
        ? this.symbolEncoder.stripSymbols(best.content)
        : '',
      variants: sanitizedVariants,
      metrics,
      selectedModel,
      reasoning: this.symbolEncoder.stripSymbols(reasoning),
      sourceCount: originalResults.length,
      strategy: this.config.strategy,
    };
  }

  /**
   * Select model from multiple results.
   */
  private selectModel(results: AgentResult[]): string {
    // Count model votes
    const modelCounts = new Map<string, number>();

    for (const result of results) {
      const count = modelCounts.get(result.selectedModel) ?? 0;
      modelCounts.set(result.selectedModel, count + 1);
    }

    // Return most common
    let bestModel = '';
    let bestCount = 0;

    for (const [model, count] of modelCounts) {
      if (count > bestCount) {
        bestModel = model;
        bestCount = count;
      }
    }

    return bestModel || 'default';
  }

  /**
   * Combine reasoning from multiple agents.
   */
  private combineReasoning(results: AgentResult[]): string {
    const reasonings = results
      .map((r) => r.reasoning)
      .filter((r) => r && r.trim());

    if (reasonings.length === 0) {
      return 'Optimization completed using multiple specialist agents.';
    }

    if (reasonings.length === 1) {
      return reasonings[0];
    }

    // Combine key points
    return reasonings.join(' Additionally, ');
  }

  /**
   * Build aggregated metrics.
   */
  private buildAggregatedMetrics(
    variants: ScoredVariant[],
    originalResults: AgentResult[],
    agentNames: string[]
  ): AggregatedMetrics {
    // Agent breakdown
    const agentBreakdown = originalResults.map((result, i) => ({
      agent: agentNames[i],
      executionTimeMs: result.metrics.latency,
      variantCount: result.variants.length,
      topScore:
        result.variants.length > 0
          ? Math.max(...result.variants.map((v) => v.score))
          : 0,
    }));

    // Total variants
    const totalVariantsReceived = originalResults.reduce(
      (sum, r) => sum + r.variants.length,
      0
    );

    // Score statistics
    const scores = variants.map((v) => v.aggregatedScore);
    const scoreSpread =
      scores.length > 0 ? Math.max(...scores) - Math.min(...scores) : 0;

    // Average confidence
    const avgConfidence =
      variants.length > 0
        ? variants.reduce((sum, v) => sum + v.sourceConfidence, 0) /
          variants.length
        : 0;

    // Combined base metrics
    const combinedLatency = Math.max(
      ...originalResults.map((r) => r.metrics.latency)
    );
    const totalCost = originalResults.reduce(
      (sum, r) => sum + r.metrics.cost,
      0
    );
    const totalTokens = originalResults.reduce(
      (sum, r) => sum + r.metrics.tokenCount.input + r.metrics.tokenCount.output,
      0
    );

    return {
      estimatedAccuracy: avgConfidence,
      latency: combinedLatency,
      cost: totalCost,
      tokenCount: {
        input: Math.round(totalTokens * 0.6),
        output: Math.round(totalTokens * 0.4),
      },
      agentBreakdown,
      aggregation: {
        totalVariantsReceived,
        variantsAfterDedup: variants.length,
        variantsInFinalResult: Math.min(variants.length, this.config.maxVariants),
        averageConfidence: avgConfidence,
        scoreSpread,
      },
    };
  }
}

// =============================================================================
// Exports
// =============================================================================

export default ResultAggregator;
