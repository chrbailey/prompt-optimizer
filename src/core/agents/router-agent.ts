/**
 * Router Agent - Specialist Agent for Model Selection
 *
 * This agent is responsible for analyzing prompts and selecting the optimal
 * model for execution. It considers:
 * - Prompt characteristics (complexity, domain, task type)
 * - Model capabilities and strengths
 * - Cost/quality tradeoffs
 * - Provider availability and routing
 *
 * @module core/agents/router-agent
 */

import { BaseAgent, type BaseAgentConfig } from './base-agent.js';
import type {
  AgentTask,
  AgentResult,
  PromptVariant,
  ModelConfig,
  ModelCapabilities,
  ProviderName,
  ResultMetrics,
  OptimizationContext,
} from '../../types/index.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration specific to the router agent.
 */
export interface RouterAgentConfig extends BaseAgentConfig {
  /** Available model configurations */
  models: ModelConfig[];
  /** Default model to use as fallback */
  defaultModel: string;
  /** Whether to consider cost in routing */
  costSensitive: boolean;
  /** Maximum acceptable cost per 1K tokens */
  maxCostPer1K: number;
  /** Preferred providers in order */
  preferredProviders: ProviderName[];
  /** Minimum capability requirements */
  requiredCapabilities: Partial<ModelCapabilities>;
}

/**
 * Characteristics extracted from a prompt.
 */
export interface PromptCharacteristics {
  /** Detected task type */
  taskType: TaskType;
  /** Complexity level (0-1) */
  complexity: number;
  /** Domain/category */
  domain: string;
  /** Whether reasoning is required */
  requiresReasoning: boolean;
  /** Whether code generation is needed */
  requiresCoding: boolean;
  /** Whether creative output is expected */
  requiresCreativity: boolean;
  /** Estimated context length needed */
  contextLength: 'short' | 'medium' | 'long' | 'very_long';
  /** Detected language */
  language: string;
  /** Safety sensitivity level */
  safetySensitivity: 'low' | 'medium' | 'high';
}

/**
 * Task types for routing decisions.
 */
export type TaskType =
  | 'coding'
  | 'analysis'
  | 'creative'
  | 'reasoning'
  | 'conversation'
  | 'extraction'
  | 'translation'
  | 'summarization'
  | 'general';

/**
 * Model score for routing.
 */
export interface ModelScore {
  /** Model configuration */
  model: ModelConfig;
  /** Overall routing score (0-1) */
  score: number;
  /** Score breakdown */
  breakdown: {
    capability: number;
    cost: number;
    performance: number;
    availability: number;
  };
  /** Reason for this score */
  reason: string;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_ROUTER_CONFIG: Partial<RouterAgentConfig> = {
  models: [],
  defaultModel: 'claude-sonnet-4-20250514',
  costSensitive: true,
  maxCostPer1K: 0.1,
  preferredProviders: ['anthropic', 'openai', 'google'],
  requiredCapabilities: {},
};

/**
 * Default model configurations when none provided.
 */
const DEFAULT_MODELS: ModelConfig[] = [
  {
    id: 'claude-opus-4-5-20251101',
    name: 'Claude Opus 4.5',
    provider: 'anthropic',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    pricing: { inputPer1k: 0.015, outputPer1k: 0.075, currency: 'USD' },
    capabilities: {
      jsonMode: true,
      functionCalling: true,
      vision: true,
      streaming: true,
      systemMessages: true,
    },
    tier: 'quality',
  },
  {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    pricing: { inputPer1k: 0.003, outputPer1k: 0.015, currency: 'USD' },
    capabilities: {
      jsonMode: true,
      functionCalling: true,
      vision: true,
      streaming: true,
      systemMessages: true,
    },
    tier: 'balanced',
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    pricing: { inputPer1k: 0.005, outputPer1k: 0.015, currency: 'USD' },
    capabilities: {
      jsonMode: true,
      functionCalling: true,
      vision: true,
      streaming: true,
      systemMessages: true,
    },
    tier: 'quality',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    pricing: { inputPer1k: 0.00015, outputPer1k: 0.0006, currency: 'USD' },
    capabilities: {
      jsonMode: true,
      functionCalling: true,
      vision: true,
      streaming: true,
      systemMessages: true,
    },
    tier: 'fast',
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    pricing: { inputPer1k: 0.00035, outputPer1k: 0.0015, currency: 'USD' },
    capabilities: {
      jsonMode: true,
      functionCalling: true,
      vision: true,
      streaming: true,
      systemMessages: true,
    },
    tier: 'fast',
  },
];

// =============================================================================
// Router Agent Class
// =============================================================================

/**
 * Specialist agent for model selection and routing.
 *
 * The RouterAgent analyzes prompt characteristics and selects the
 * optimal model based on task requirements, cost constraints, and
 * provider preferences.
 */
export class RouterAgent extends BaseAgent {
  readonly name = 'router';
  readonly capabilities = ['route', 'analyze'];

  private routerConfig: RouterAgentConfig;
  private models: ModelConfig[];

  constructor(config: Partial<RouterAgentConfig> = {}) {
    super(config);
    this.routerConfig = {
      ...DEFAULT_ROUTER_CONFIG,
      ...config,
    } as RouterAgentConfig;

    // Use provided models or defaults
    this.models =
      this.routerConfig.models.length > 0
        ? this.routerConfig.models
        : DEFAULT_MODELS;
  }

  // ===========================================================================
  // Abstract Method Implementation
  // ===========================================================================

  /**
   * Execute model routing analysis.
   *
   * @param task - The routing task
   * @returns Routing result with model recommendation
   */
  async execute(task: AgentTask): Promise<AgentResult> {
    this.log('info', `Analyzing prompt for routing (${task.prompt.length} chars)`);

    // Analyze prompt characteristics
    const characteristics = this.analyzePrompt(task.prompt, task.context);
    this.log('debug', `Task type: ${characteristics.taskType}, complexity: ${characteristics.complexity.toFixed(2)}`);

    // Score all available models
    const modelScores = this.scoreModels(characteristics);

    // Sort by score
    const rankedModels = modelScores.sort((a, b) => b.score - a.score);

    // Get best model
    const bestModel = rankedModels[0] || this.getDefaultModelScore();

    this.log('info', `Selected model: ${bestModel.model.id} (score: ${bestModel.score.toFixed(2)})`);

    // Generate routing variants
    const variants = this.generateRoutingVariants(
      task.prompt,
      rankedModels.slice(0, 3)
    );

    // Build result
    const result = this.createResult(
      task.prompt, // Router doesn't modify the prompt
      variants,
      bestModel.model.id,
      this.generateRoutingReasoning(characteristics, bestModel, rankedModels)
    );

    // Add routing-specific metrics
    const metrics: ResultMetrics = {
      ...result.metrics,
      estimatedAccuracy: bestModel.score,
      cost: this.estimateCost(task.prompt, bestModel.model),
      latency: this.estimateLatency(characteristics, bestModel.model),
      tokenCount: {
        input: this.estimateTokens(task.prompt),
        output: this.estimateOutputTokens(characteristics),
      },
    };

    this.setCustomMetric('modelsEvaluated', rankedModels.length);
    this.setCustomMetric('complexityScore', characteristics.complexity);

    return {
      ...result,
      metrics,
    };
  }

  // ===========================================================================
  // Public Methods
  // ===========================================================================

  /**
   * Analyze a prompt without full execution.
   */
  analyzePromptCharacteristics(prompt: string): PromptCharacteristics {
    return this.analyzePrompt(prompt, {
      symbols: [],
      examples: [],
      constraints: [],
      domainHints: [],
    });
  }

  /**
   * Get available models.
   */
  getAvailableModels(): ModelConfig[] {
    return [...this.models];
  }

  /**
   * Add a model configuration.
   */
  addModel(model: ModelConfig): void {
    this.models.push(model);
  }

  /**
   * Get model by ID.
   */
  getModel(modelId: string): ModelConfig | undefined {
    return this.models.find((m) => m.id === modelId);
  }

  // ===========================================================================
  // Private Methods - Prompt Analysis
  // ===========================================================================

  /**
   * Analyze prompt to extract characteristics.
   */
  private analyzePrompt(
    prompt: string,
    context: OptimizationContext
  ): PromptCharacteristics {
    const lower = prompt.toLowerCase();
    const words = prompt.split(/\s+/);
    const tokenEstimate = this.estimateTokens(prompt);

    return {
      taskType: this.detectTaskType(lower),
      complexity: this.calculateComplexity(prompt, context),
      domain: this.detectDomain(prompt, context),
      requiresReasoning: this.detectReasoning(lower),
      requiresCoding: this.detectCoding(lower),
      requiresCreativity: this.detectCreativity(lower),
      contextLength: this.categorizeContextLength(tokenEstimate),
      language: this.detectLanguage(prompt),
      safetySensitivity: this.detectSafetySensitivity(lower),
    };
  }

  /**
   * Detect the primary task type.
   */
  private detectTaskType(lower: string): TaskType {
    // Coding indicators
    if (
      lower.includes('code') ||
      lower.includes('function') ||
      lower.includes('implement') ||
      lower.includes('debug') ||
      lower.includes('program') ||
      /```|def |function |class |const |let |var /.test(lower)
    ) {
      return 'coding';
    }

    // Analysis indicators
    if (
      lower.includes('analyze') ||
      lower.includes('analysis') ||
      lower.includes('evaluate') ||
      lower.includes('compare')
    ) {
      return 'analysis';
    }

    // Creative indicators
    if (
      lower.includes('write') ||
      lower.includes('story') ||
      lower.includes('creative') ||
      lower.includes('poem') ||
      lower.includes('imagine')
    ) {
      return 'creative';
    }

    // Reasoning indicators
    if (
      lower.includes('why') ||
      lower.includes('explain') ||
      lower.includes('reason') ||
      lower.includes('logic') ||
      lower.includes('prove')
    ) {
      return 'reasoning';
    }

    // Summarization
    if (
      lower.includes('summarize') ||
      lower.includes('summary') ||
      lower.includes('brief') ||
      lower.includes('tldr')
    ) {
      return 'summarization';
    }

    // Translation
    if (
      lower.includes('translate') ||
      lower.includes('translation') ||
      lower.includes('in english') ||
      lower.includes('in spanish')
    ) {
      return 'translation';
    }

    // Extraction
    if (
      lower.includes('extract') ||
      lower.includes('find all') ||
      lower.includes('list all') ||
      lower.includes('identify')
    ) {
      return 'extraction';
    }

    // Conversation
    if (
      lower.includes('chat') ||
      lower.includes('discuss') ||
      lower.includes('conversation')
    ) {
      return 'conversation';
    }

    return 'general';
  }

  /**
   * Calculate prompt complexity (0-1).
   */
  private calculateComplexity(
    prompt: string,
    context: OptimizationContext
  ): number {
    let score = 0;
    const tokenEstimate = this.estimateTokens(prompt);

    // Length factor
    if (tokenEstimate > 1000) score += 0.3;
    else if (tokenEstimate > 500) score += 0.2;
    else if (tokenEstimate > 200) score += 0.1;

    // Complexity indicators
    const lower = prompt.toLowerCase();

    if (lower.includes('complex') || lower.includes('complicated')) score += 0.1;
    if (lower.includes('multiple') || lower.includes('several')) score += 0.1;
    if (lower.includes('nested') || lower.includes('recursive')) score += 0.15;
    if (lower.includes('optimize') || lower.includes('efficient')) score += 0.1;
    if (lower.includes('edge case') || lower.includes('corner case')) score += 0.1;

    // Technical depth indicators
    if (/[A-Z]{2,}/.test(prompt)) score += 0.05; // Acronyms
    if (/\d+\.\d+/.test(prompt)) score += 0.05; // Version numbers
    if (prompt.includes('```')) score += 0.1; // Code blocks

    // Constraint count
    score += Math.min(context.constraints.length * 0.05, 0.2);

    return Math.min(score, 1.0);
  }

  /**
   * Detect domain from prompt and context.
   */
  private detectDomain(prompt: string, context: OptimizationContext): string {
    // Use domain hints if available
    if (context.domainHints.length > 0) {
      return context.domainHints[0];
    }

    const lower = prompt.toLowerCase();

    // Domain detection
    if (lower.includes('sap') || lower.includes('erp') || lower.includes('abap')) {
      return 'sap';
    }
    if (lower.includes('code') || lower.includes('program') || lower.includes('software')) {
      return 'programming';
    }
    if (lower.includes('data') || lower.includes('analytics') || lower.includes('metrics')) {
      return 'data-science';
    }
    if (lower.includes('medical') || lower.includes('health') || lower.includes('patient')) {
      return 'healthcare';
    }
    if (lower.includes('legal') || lower.includes('law') || lower.includes('contract')) {
      return 'legal';
    }
    if (lower.includes('finance') || lower.includes('money') || lower.includes('invest')) {
      return 'finance';
    }

    return 'general';
  }

  /**
   * Detect if reasoning is required.
   */
  private detectReasoning(lower: string): boolean {
    return (
      lower.includes('why') ||
      lower.includes('how') ||
      lower.includes('explain') ||
      lower.includes('reason') ||
      lower.includes('logic') ||
      lower.includes('deduce') ||
      lower.includes('infer') ||
      lower.includes('conclude')
    );
  }

  /**
   * Detect if coding is required.
   */
  private detectCoding(lower: string): boolean {
    return (
      lower.includes('code') ||
      lower.includes('function') ||
      lower.includes('class') ||
      lower.includes('script') ||
      lower.includes('program') ||
      lower.includes('implement') ||
      lower.includes('debug') ||
      /```[a-z]*\n/.test(lower)
    );
  }

  /**
   * Detect if creativity is required.
   */
  private detectCreativity(lower: string): boolean {
    return (
      lower.includes('creative') ||
      lower.includes('imagine') ||
      lower.includes('story') ||
      lower.includes('poem') ||
      lower.includes('novel') ||
      lower.includes('invent') ||
      lower.includes('design')
    );
  }

  /**
   * Categorize context length.
   */
  private categorizeContextLength(
    tokens: number
  ): 'short' | 'medium' | 'long' | 'very_long' {
    if (tokens < 500) return 'short';
    if (tokens < 2000) return 'medium';
    if (tokens < 10000) return 'long';
    return 'very_long';
  }

  /**
   * Detect primary language.
   */
  private detectLanguage(prompt: string): string {
    // Simple heuristic - could be enhanced
    const nonAscii = prompt.replace(/[\x00-\x7F]/g, '');
    if (nonAscii.length > prompt.length * 0.3) {
      // Likely non-English
      return 'multilingual';
    }
    return 'english';
  }

  /**
   * Detect safety sensitivity.
   */
  private detectSafetySensitivity(lower: string): 'low' | 'medium' | 'high' {
    const highSensitivity = [
      'medical',
      'legal',
      'financial advice',
      'diagnosis',
      'treatment',
      'lawsuit',
    ];

    const mediumSensitivity = [
      'personal',
      'private',
      'confidential',
      'sensitive',
      'security',
    ];

    for (const term of highSensitivity) {
      if (lower.includes(term)) return 'high';
    }

    for (const term of mediumSensitivity) {
      if (lower.includes(term)) return 'medium';
    }

    return 'low';
  }

  // ===========================================================================
  // Private Methods - Model Scoring
  // ===========================================================================

  /**
   * Score all available models for this task.
   */
  private scoreModels(characteristics: PromptCharacteristics): ModelScore[] {
    return this.models.map((model) =>
      this.scoreModel(model, characteristics)
    );
  }

  /**
   * Score a single model for the task.
   */
  private scoreModel(
    model: ModelConfig,
    characteristics: PromptCharacteristics
  ): ModelScore {
    const breakdown = {
      capability: this.scoreCapability(model, characteristics),
      cost: this.scoreCost(model),
      performance: this.scorePerformance(model, characteristics),
      availability: this.scoreAvailability(model),
    };

    // Weighted combination
    const weights = {
      capability: 0.4,
      cost: this.routerConfig.costSensitive ? 0.25 : 0.1,
      performance: 0.25,
      availability: 0.1,
    };

    const score =
      breakdown.capability * weights.capability +
      breakdown.cost * weights.cost +
      breakdown.performance * weights.performance +
      breakdown.availability * weights.availability;

    return {
      model,
      score,
      breakdown,
      reason: this.generateScoreReason(model, characteristics, breakdown),
    };
  }

  /**
   * Score model capability for task.
   */
  private scoreCapability(
    model: ModelConfig,
    characteristics: PromptCharacteristics
  ): number {
    let score = 0.5; // Base score

    // Check required capabilities
    const caps = model.capabilities;
    const required = this.routerConfig.requiredCapabilities;

    if (required.jsonMode && !caps.jsonMode) return 0;
    if (required.functionCalling && !caps.functionCalling) return 0;
    if (required.vision && !caps.vision) return 0;

    // Task-specific scoring
    switch (characteristics.taskType) {
      case 'coding':
        // Prefer larger context for coding
        if (model.contextWindow >= 100000) score += 0.3;
        else if (model.contextWindow >= 32000) score += 0.2;
        break;

      case 'creative':
        // Higher output for creative tasks
        if (model.maxOutputTokens >= 4000) score += 0.2;
        break;

      case 'reasoning':
        // Prefer flagship models for complex reasoning
        if (model.id.includes('opus') || model.id.includes('gpt-4o')) {
          score += 0.3;
        }
        break;

      case 'analysis':
        // Large context helps for analysis
        if (model.contextWindow >= 100000) score += 0.2;
        break;
    }

    // Complexity adjustment
    if (characteristics.complexity > 0.7) {
      // Prefer flagship models for high complexity
      if (model.id.includes('opus') || model.id === 'gpt-4o') {
        score += 0.2;
      }
    }

    // Context length requirements
    if (
      characteristics.contextLength === 'very_long' &&
      model.contextWindow < 100000
    ) {
      score -= 0.3;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Score model cost efficiency.
   */
  private scoreCost(model: ModelConfig): number {
    const avgCost = (model.pricing.inputPer1k + model.pricing.outputPer1k) / 2;

    // Check against max cost
    if (avgCost > this.routerConfig.maxCostPer1K) {
      return 0.2; // Heavily penalize
    }

    // Lower cost = higher score
    if (avgCost < 0.001) return 1.0;
    if (avgCost < 0.005) return 0.8;
    if (avgCost < 0.01) return 0.6;
    if (avgCost < 0.05) return 0.4;

    return 0.2;
  }

  /**
   * Score expected performance.
   */
  private scorePerformance(
    model: ModelConfig,
    characteristics: PromptCharacteristics
  ): number {
    // Heuristic: flagship models perform better on complex tasks
    const isFlagship =
      model.id.includes('opus') ||
      model.id === 'gpt-4o' ||
      model.id.includes('gemini-2');

    const base = isFlagship ? 0.9 : 0.7;

    // Adjust for complexity
    if (characteristics.complexity > 0.7 && !isFlagship) {
      return base - 0.2;
    }

    return base;
  }

  /**
   * Score model availability/reliability.
   */
  private scoreAvailability(model: ModelConfig): number {
    // Provider preference
    const providerIndex = this.routerConfig.preferredProviders.indexOf(
      model.provider as ProviderName
    );

    if (providerIndex === 0) return 1.0;
    if (providerIndex === 1) return 0.9;
    if (providerIndex === 2) return 0.8;

    return 0.7;
  }

  /**
   * Generate reason for model score.
   */
  private generateScoreReason(
    model: ModelConfig,
    characteristics: PromptCharacteristics,
    breakdown: ModelScore['breakdown']
  ): string {
    const reasons: string[] = [];

    if (breakdown.capability > 0.7) {
      reasons.push('strong capabilities for this task type');
    }
    if (breakdown.cost > 0.7) {
      reasons.push('cost-effective');
    }
    if (breakdown.performance > 0.8) {
      reasons.push('high expected performance');
    }

    if (reasons.length === 0) {
      reasons.push('adequate for general tasks');
    }

    return `${model.id}: ${reasons.join(', ')}`;
  }

  /**
   * Get default model score.
   */
  private getDefaultModelScore(): ModelScore {
    const defaultModel = this.models.find(
      (m) => m.id === this.routerConfig.defaultModel
    ) || this.models[0];

    return {
      model: defaultModel,
      score: 0.5,
      breakdown: {
        capability: 0.5,
        cost: 0.5,
        performance: 0.5,
        availability: 0.5,
      },
      reason: 'Default model selection',
    };
  }

  // ===========================================================================
  // Private Methods - Result Generation
  // ===========================================================================

  /**
   * Generate routing variants for top models.
   */
  private generateRoutingVariants(
    prompt: string,
    topModels: ModelScore[]
  ): PromptVariant[] {
    return topModels.map((modelScore, index) => ({
      content: prompt, // Router doesn't modify content
      technique: `route_${modelScore.model.provider}`,
      score: modelScore.score,
      model: modelScore.model.id,
    }));
  }

  /**
   * Generate routing reasoning.
   */
  private generateRoutingReasoning(
    characteristics: PromptCharacteristics,
    selected: ModelScore,
    alternatives: ModelScore[]
  ): string {
    let reasoning = `Analyzed prompt characteristics: `;
    reasoning += `task type = ${characteristics.taskType}, `;
    reasoning += `complexity = ${(characteristics.complexity * 100).toFixed(0)}%, `;
    reasoning += `domain = ${characteristics.domain}. `;

    reasoning += `Selected ${selected.model.id} (${selected.model.provider}) `;
    reasoning += `with score ${(selected.score * 100).toFixed(0)}%. `;

    if (alternatives.length > 1) {
      const alt = alternatives[1];
      reasoning += `Alternative: ${alt.model.id} (${(alt.score * 100).toFixed(0)}%).`;
    }

    return this.stripSymbols(reasoning);
  }

  /**
   * Estimate cost for execution.
   */
  private estimateCost(prompt: string, model: ModelConfig): number {
    const inputTokens = this.estimateTokens(prompt);
    const outputTokens = inputTokens * 2; // Rough estimate

    return (
      (inputTokens / 1000) * model.pricing.inputPer1k +
      (outputTokens / 1000) * model.pricing.outputPer1k
    );
  }

  /**
   * Estimate latency.
   */
  private estimateLatency(
    characteristics: PromptCharacteristics,
    model: ModelConfig
  ): number {
    // Base latency by model tier
    let base = 1000;

    if (model.id.includes('opus')) base = 3000;
    else if (model.id.includes('gpt-4o') && !model.id.includes('mini')) base = 2000;
    else if (model.id.includes('sonnet')) base = 1500;

    // Adjust for complexity
    base *= 1 + characteristics.complexity;

    return Math.round(base);
  }

  /**
   * Estimate output tokens.
   */
  private estimateOutputTokens(characteristics: PromptCharacteristics): number {
    switch (characteristics.taskType) {
      case 'coding':
        return 500;
      case 'creative':
        return 800;
      case 'analysis':
        return 600;
      case 'summarization':
        return 200;
      default:
        return 400;
    }
  }
}

// =============================================================================
// Exports
// =============================================================================

export default RouterAgent;
