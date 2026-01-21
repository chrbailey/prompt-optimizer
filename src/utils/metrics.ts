/**
 * Metrics collection, calculation, and reporting utilities
 */

import { logger } from './logger.js';

// Local type definitions for metrics module
// These are internal to the CLI and don't need to match the core types exactly

export interface PromptScores {
  clarity: number;
  specificity: number;
  structure: number;
  completeness: number;
  efficiency: number;
  overall: number;
}

export interface OptimizationMetrics {
  tokenCountOriginal: number;
  tokenCountOptimized: number;
  estimatedCostOriginal: number;
  estimatedCostOptimized: number;
  clarityScore: number;
  specificityScore: number;
  structureScore: number;
  overallScore: number;
}

export interface BatchSummary {
  totalPrompts: number;
  successfulOptimizations: number;
  failedOptimizations: number;
  totalProcessingTime: number;
  averageImprovement: number;
  totalCost: number;
}

// Supported model IDs for pricing
type ModelId =
  | 'claude-opus-4-5-20251101'
  | 'claude-sonnet-4-20250514'
  | 'claude-3-5-haiku-20241022'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'o1'
  | 'o1-mini'
  | 'gemini-2.0-flash'
  | 'gemini-1.5-pro'
  | 'gemini-1.5-flash';

// Model pricing data (per 1K tokens)
const MODEL_PRICING: Record<ModelId, { input: number; output: number }> = {
  // Anthropic
  'claude-opus-4-5-20251101': { input: 0.015, output: 0.075 },
  'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 },
  'claude-3-5-haiku-20241022': { input: 0.0008, output: 0.004 },
  // OpenAI
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'o1': { input: 0.015, output: 0.06 },
  'o1-mini': { input: 0.003, output: 0.012 },
  // Google
  'gemini-2.0-flash': { input: 0.00035, output: 0.0015 },
  'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
  'gemini-1.5-flash': { input: 0.000075, output: 0.0003 },
};

/**
 * Estimate token count for a string
 * Uses a simple heuristic: ~4 characters per token on average
 */
export function estimateTokenCount(text: string): number {
  // More accurate estimation considering different token patterns
  const words = text.split(/\s+/).length;
  const chars = text.length;

  // Average of word-based and char-based estimates
  const wordEstimate = words * 1.3;
  const charEstimate = chars / 4;

  return Math.ceil((wordEstimate + charEstimate) / 2);
}

/**
 * Calculate cost for a prompt/response pair
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  model: ModelId
): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) {
    logger.warn(`Unknown model for pricing: ${model}`);
    return 0;
  }

  const inputCost = (inputTokens / 1000) * pricing.input;
  const outputCost = (outputTokens / 1000) * pricing.output;

  return inputCost + outputCost;
}

/**
 * Calculate estimated cost for a prompt
 */
export function estimatePromptCost(
  prompt: string,
  model: ModelId,
  estimatedOutputTokens = 500
): number {
  const inputTokens = estimateTokenCount(prompt);
  return calculateCost(inputTokens, estimatedOutputTokens, model);
}

/**
 * Analyze prompt clarity score (0-100)
 */
export function calculateClarityScore(prompt: string): number {
  let score = 100;

  // Penalize for ambiguous words
  const ambiguousWords = ['it', 'this', 'that', 'thing', 'stuff', 'something', 'somehow'];
  const words = prompt.toLowerCase().split(/\s+/);
  const ambiguousCount = words.filter(w => ambiguousWords.includes(w)).length;
  score -= ambiguousCount * 5;

  // Penalize for very short prompts
  if (prompt.length < 50) score -= 20;
  else if (prompt.length < 100) score -= 10;

  // Penalize for lack of punctuation
  if (!/[.!?]/.test(prompt)) score -= 10;

  // Reward for clear structure
  if (/\n/.test(prompt)) score += 5;
  if (/\d+\.|•|-/.test(prompt)) score += 10; // Lists

  return Math.max(0, Math.min(100, score));
}

/**
 * Analyze prompt specificity score (0-100)
 */
export function calculateSpecificityScore(prompt: string): number {
  let score = 50;

  // Reward for specific keywords
  const specificPatterns = [
    /\b(exactly|specifically|precisely)\b/i,
    /\b\d+\b/, // Numbers
    /\b(format|structure|output)\b/i,
    /\b(must|should|required|ensure)\b/i,
    /\b(example|e\.g\.|for instance)\b/i,
    /"[^"]+"/g, // Quoted text
  ];

  for (const pattern of specificPatterns) {
    if (pattern.test(prompt)) score += 10;
  }

  // Penalize for vague language
  const vaguePatterns = [
    /\b(maybe|perhaps|possibly)\b/i,
    /\b(good|nice|better)\b/i,
    /\b(etc|and so on)\b/i,
    /\b(some|any|various)\b/i,
  ];

  for (const pattern of vaguePatterns) {
    if (pattern.test(prompt)) score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Analyze prompt structure score (0-100)
 */
export function calculateStructureScore(prompt: string): number {
  let score = 50;

  // Check for sections/headers
  if (/^#+\s|^[A-Z][^.]*:$/m.test(prompt)) score += 15;

  // Check for lists
  if (/^\s*[-•*]\s/m.test(prompt) || /^\s*\d+\.\s/m.test(prompt)) score += 15;

  // Check for code blocks
  if (/```[\s\S]*```/.test(prompt)) score += 10;

  // Check for line breaks (paragraphs)
  const paragraphs = prompt.split(/\n\s*\n/).length;
  if (paragraphs >= 2) score += 10;
  if (paragraphs >= 3) score += 5;

  // Penalize for wall of text
  const longestLine = Math.max(...prompt.split('\n').map(l => l.length));
  if (longestLine > 500 && paragraphs < 2) score -= 20;

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate completeness score (0-100)
 */
export function calculateCompletenessScore(prompt: string): number {
  let score = 50;

  // Check for task definition
  if (/\b(task|goal|objective|purpose|want|need)\b/i.test(prompt)) score += 10;

  // Check for context
  if (/\b(context|background|situation|given)\b/i.test(prompt)) score += 10;

  // Check for output specification
  if (/\b(output|result|response|return|format)\b/i.test(prompt)) score += 10;

  // Check for constraints
  if (/\b(constraint|limit|avoid|don't|must not|should not)\b/i.test(prompt)) score += 10;

  // Check for examples
  if (/\b(example|sample|like this|such as)\b/i.test(prompt)) score += 10;

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate efficiency score (0-100) - how concise is the prompt
 */
export function calculateEfficiencyScore(prompt: string): number {
  const tokens = estimateTokenCount(prompt);

  // Sweet spot is around 100-500 tokens
  if (tokens < 20) return 30; // Too short
  if (tokens < 50) return 50;
  if (tokens <= 200) return 100;
  if (tokens <= 500) return 90;
  if (tokens <= 1000) return 70;
  if (tokens <= 2000) return 50;
  return 30; // Very long
}

/**
 * Calculate all prompt scores
 */
export function calculatePromptScores(prompt: string): PromptScores {
  const clarity = calculateClarityScore(prompt);
  const specificity = calculateSpecificityScore(prompt);
  const structure = calculateStructureScore(prompt);
  const completeness = calculateCompletenessScore(prompt);
  const efficiency = calculateEfficiencyScore(prompt);

  // Weighted overall score
  const overall = Math.round(
    clarity * 0.25 +
    specificity * 0.25 +
    structure * 0.15 +
    completeness * 0.20 +
    efficiency * 0.15
  );

  return {
    clarity,
    specificity,
    structure,
    completeness,
    efficiency,
    overall,
  };
}

/**
 * Calculate optimization metrics comparing original and optimized prompts
 */
export function calculateOptimizationMetrics(
  original: string,
  optimized: string,
  model: ModelId
): OptimizationMetrics {
  const tokenCountOriginal = estimateTokenCount(original);
  const tokenCountOptimized = estimateTokenCount(optimized);

  const estimatedOutputTokens = 500;
  const estimatedCostOriginal = calculateCost(tokenCountOriginal, estimatedOutputTokens, model);
  const estimatedCostOptimized = calculateCost(tokenCountOptimized, estimatedOutputTokens, model);

  const optimizedScores = calculatePromptScores(optimized);

  return {
    tokenCountOriginal,
    tokenCountOptimized,
    estimatedCostOriginal,
    estimatedCostOptimized,
    clarityScore: optimizedScores.clarity,
    specificityScore: optimizedScores.specificity,
    structureScore: optimizedScores.structure,
    overallScore: optimizedScores.overall,
  };
}

/**
 * Calculate batch processing summary
 */
export function calculateBatchSummary(
  results: Array<{ success: boolean; metrics?: OptimizationMetrics; processingTime: number }>
): BatchSummary {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  const totalProcessingTime = results.reduce((sum, r) => sum + r.processingTime, 0);

  let totalCost = 0;
  let totalImprovement = 0;

  for (const result of successful) {
    if (result.metrics) {
      totalCost += result.metrics.estimatedCostOptimized;
      const improvement = result.metrics.overallScore -
        ((result.metrics.clarityScore + result.metrics.specificityScore + result.metrics.structureScore) / 3);
      totalImprovement += improvement;
    }
  }

  return {
    totalPrompts: results.length,
    successfulOptimizations: successful.length,
    failedOptimizations: failed.length,
    totalProcessingTime,
    averageImprovement: successful.length > 0 ? totalImprovement / successful.length : 0,
    totalCost,
  };
}

/**
 * Format metrics for display
 */
export function formatMetrics(metrics: OptimizationMetrics): string {
  const lines = [
    `Token Count: ${metrics.tokenCountOriginal} -> ${metrics.tokenCountOptimized} (${metrics.tokenCountOptimized < metrics.tokenCountOriginal ? '-' : '+'}${Math.abs(metrics.tokenCountOptimized - metrics.tokenCountOriginal)})`,
    `Estimated Cost: $${metrics.estimatedCostOriginal.toFixed(4)} -> $${metrics.estimatedCostOptimized.toFixed(4)}`,
    `Clarity Score: ${metrics.clarityScore}/100`,
    `Specificity Score: ${metrics.specificityScore}/100`,
    `Structure Score: ${metrics.structureScore}/100`,
    `Overall Score: ${metrics.overallScore}/100`,
  ];

  return lines.join('\n');
}

/**
 * Format prompt scores for display
 */
export function formatPromptScores(scores: PromptScores): string {
  const bar = (score: number) => {
    const filled = Math.round(score / 5);
    const empty = 20 - filled;
    return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
  };

  const lines = [
    `Clarity:      ${bar(scores.clarity)} ${scores.clarity}/100`,
    `Specificity:  ${bar(scores.specificity)} ${scores.specificity}/100`,
    `Structure:    ${bar(scores.structure)} ${scores.structure}/100`,
    `Completeness: ${bar(scores.completeness)} ${scores.completeness}/100`,
    `Efficiency:   ${bar(scores.efficiency)} ${scores.efficiency}/100`,
    `─────────────────────────────────`,
    `Overall:      ${bar(scores.overall)} ${scores.overall}/100`,
  ];

  return lines.join('\n');
}

/**
 * Metrics collector for tracking usage over time
 */
export class MetricsCollector {
  private metrics: Array<{
    timestamp: Date;
    operation: string;
    model: ModelId;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    duration: number;
  }> = [];

  record(data: {
    operation: string;
    model: ModelId;
    inputTokens: number;
    outputTokens: number;
    duration: number;
  }): void {
    const cost = calculateCost(data.inputTokens, data.outputTokens, data.model);

    this.metrics.push({
      timestamp: new Date(),
      ...data,
      cost,
    });
  }

  getTotalCost(): number {
    return this.metrics.reduce((sum, m) => sum + m.cost, 0);
  }

  getTotalTokens(): { input: number; output: number } {
    return {
      input: this.metrics.reduce((sum, m) => sum + m.inputTokens, 0),
      output: this.metrics.reduce((sum, m) => sum + m.outputTokens, 0),
    };
  }

  getOperationCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const m of this.metrics) {
      counts[m.operation] = (counts[m.operation] || 0) + 1;
    }
    return counts;
  }

  getSummary(): string {
    const totalCost = this.getTotalCost();
    const tokens = this.getTotalTokens();
    const operations = this.getOperationCounts();

    const lines = [
      `Total Operations: ${this.metrics.length}`,
      `Total Input Tokens: ${tokens.input.toLocaleString()}`,
      `Total Output Tokens: ${tokens.output.toLocaleString()}`,
      `Total Cost: $${totalCost.toFixed(4)}`,
      '',
      'Operations:',
      ...Object.entries(operations).map(([op, count]) => `  ${op}: ${count}`),
    ];

    return lines.join('\n');
  }

  clear(): void {
    this.metrics = [];
  }

  export(): typeof this.metrics {
    return [...this.metrics];
  }
}

// Global metrics collector instance
export const metricsCollector = new MetricsCollector();
