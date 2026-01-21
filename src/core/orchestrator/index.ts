/**
 * Orchestrator - Main Coordination System for Prompt Optimization
 *
 * The Orchestrator is the central coordinator for the prompt optimization system.
 * It manages specialist agents, dispatches tasks, aggregates results, and ensures
 * that internal symbols are never exposed in output.
 *
 * Key responsibilities:
 * - Coordinate specialist agents (optimizer, router, evaluator)
 * - Manage task queue and execution flow
 * - Aggregate and rank results from multiple agents
 * - Inject symbol context internally
 * - Strip all symbols from output
 *
 * @module core/orchestrator
 */

import type {
  AgentTask,
  AgentResult,
  PromptVariant,
  OptimizationContext,
  TechniqueName,
  TaskOptions,
  ModelConfig,
  Constraint,
  Example,
  Result,
} from '../../types/index.js';

import { TaskQueue, type QueuedTask, type TaskQueueConfig } from './task-queue.js';
import {
  ResultAggregator,
  type AggregatorConfig,
  type AggregatedResult,
} from './result-aggregator.js';
import { BaseAgent } from '../agents/base-agent.js';
import { SymbolEncoder, type SymbolEncoderConfig } from '../agents/symbol-encoder.js';
import { OptimizerAgent, type OptimizerAgentConfig } from '../agents/optimizer-agent.js';
import { RouterAgent, type RouterAgentConfig } from '../agents/router-agent.js';
import { EvaluatorAgent, type EvaluatorAgentConfig } from '../agents/evaluator-agent.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration for the orchestrator.
 */
export interface OrchestratorConfig {
  /** Task queue configuration */
  taskQueue: Partial<TaskQueueConfig>;
  /** Result aggregator configuration */
  aggregator: Partial<AggregatorConfig>;
  /** Symbol encoder configuration */
  symbolEncoder: Partial<SymbolEncoderConfig>;
  /** Optimizer agent configuration */
  optimizer: Partial<OptimizerAgentConfig>;
  /** Router agent configuration */
  router: Partial<RouterAgentConfig>;
  /** Evaluator agent configuration */
  evaluator: Partial<EvaluatorAgentConfig>;
  /** Whether to run agents in parallel */
  parallelExecution: boolean;
  /** Default timeout for operations */
  defaultTimeoutMs: number;
  /** Enable verbose logging */
  verbose: boolean;
  /** Maximum variants to include in final result */
  maxFinalVariants: number;
}

/**
 * Options for optimize operations.
 */
export interface OptimizeOptions {
  /** Specific techniques to apply */
  techniques?: TechniqueName[];
  /** Target model (skip routing if specified) */
  targetModel?: string;
  /** Domain hint for context */
  domainHint?: string;
  /** Examples to use for few-shot */
  examples?: Example[];
  /** Constraints to apply */
  constraints?: Constraint[];
  /** Task options */
  taskOptions?: TaskOptions;
  /** Skip evaluation phase */
  skipEvaluation?: boolean;
  /** Skip routing phase */
  skipRouting?: boolean;
}

/**
 * Final optimization result returned to users.
 * CRITICAL: This must never contain internal symbols.
 */
export interface OptimizationResult {
  /** The best optimized prompt */
  optimizedPrompt: string;
  /** Original prompt for reference */
  originalPrompt: string;
  /** Ranked prompt variants */
  variants: PromptVariant[];
  /** Selected/recommended model */
  selectedModel: string;
  /** Quality metrics */
  metrics: OptimizationMetrics;
  /** Reasoning explanation */
  reasoning: string;
  /** Whether optimization improved the prompt */
  improved: boolean;
  /** Improvement percentage */
  improvementPercent: number;
}

/**
 * Metrics from optimization process.
 */
export interface OptimizationMetrics {
  /** Overall quality score (0-1) */
  qualityScore: number;
  /** Estimated accuracy */
  estimatedAccuracy: number;
  /** Total execution time in ms */
  totalTimeMs: number;
  /** Cost estimate in USD */
  estimatedCost: number;
  /** Token counts */
  tokenCount: {
    original: number;
    optimized: number;
    delta: number;
  };
  /** Agent execution times */
  agentTimes: {
    optimizer: number;
    router: number;
    evaluator: number;
  };
  /** Number of variants generated */
  variantsGenerated: number;
  /** Techniques applied */
  techniquesApplied: string[];
}

/**
 * Orchestrator event types.
 */
export type OrchestratorEvent =
  | { type: 'optimization_started'; prompt: string }
  | { type: 'agent_started'; agent: string }
  | { type: 'agent_completed'; agent: string; result: AgentResult }
  | { type: 'agent_failed'; agent: string; error: Error }
  | { type: 'aggregation_completed'; result: AggregatedResult }
  | { type: 'optimization_completed'; result: OptimizationResult }
  | { type: 'optimization_failed'; error: Error };

/**
 * Event listener type.
 */
export type OrchestratorEventListener = (event: OrchestratorEvent) => void;

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: OrchestratorConfig = {
  taskQueue: {
    maxConcurrency: 3,
    defaultTimeoutMs: 60000,
  },
  aggregator: {
    strategy: 'weighted_merge',
    maxVariants: 5,
  },
  symbolEncoder: {
    enabled: true,
    cacheSymbols: true,
    strictMode: false,
  },
  optimizer: {},
  router: {},
  evaluator: {},
  parallelExecution: true,
  defaultTimeoutMs: 60000,
  verbose: false,
  maxFinalVariants: 5,
};

// =============================================================================
// Orchestrator Class
// =============================================================================

/**
 * Main orchestrator for the prompt optimization system.
 *
 * The Orchestrator coordinates multiple specialist agents to optimize prompts.
 * It handles task dispatch, result aggregation, and ensures internal symbols
 * are never exposed in output.
 *
 * @example
 * ```typescript
 * const orchestrator = new Orchestrator();
 *
 * const result = await orchestrator.optimize(
 *   "Write code to parse JSON",
 *   { techniques: ['chain_of_thought'] }
 * );
 *
 * console.log(result.optimizedPrompt);
 * ```
 */
export class Orchestrator {
  private config: OrchestratorConfig;
  private taskQueue: TaskQueue;
  private aggregator: ResultAggregator;
  private symbolEncoder: SymbolEncoder;

  // Specialist agents
  private optimizerAgent: OptimizerAgent;
  private routerAgent: RouterAgent;
  private evaluatorAgent: EvaluatorAgent;
  private agents: Map<string, BaseAgent>;

  // Event handling
  private listeners: Set<OrchestratorEventListener> = new Set();

  // Statistics
  private totalOptimizations: number = 0;
  private successfulOptimizations: number = 0;

  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = this.mergeConfig(DEFAULT_CONFIG, config);

    // Initialize core components
    this.symbolEncoder = new SymbolEncoder(this.config.symbolEncoder);
    this.taskQueue = new TaskQueue(this.config.taskQueue);
    this.aggregator = new ResultAggregator(this.config.aggregator);

    // Initialize agents with shared symbol encoder
    const sharedAgentConfig = {
      symbolEncoder: this.symbolEncoder,
      verbose: this.config.verbose,
    };

    this.optimizerAgent = new OptimizerAgent({
      ...sharedAgentConfig,
      ...this.config.optimizer,
    });

    this.routerAgent = new RouterAgent({
      ...sharedAgentConfig,
      ...this.config.router,
    });

    this.evaluatorAgent = new EvaluatorAgent({
      ...sharedAgentConfig,
      ...this.config.evaluator,
    });

    // Register agents (explicitly typed for mixed agent types)
    this.agents = new Map<string, BaseAgent>([
      ['optimizer', this.optimizerAgent],
      ['router', this.routerAgent],
      ['evaluator', this.evaluatorAgent],
    ]);

    // Set up task queue executor
    this.taskQueue.setExecutor((task) => this.executeAgentTask(task));

    this.log('Orchestrator initialized');
  }

  // ===========================================================================
  // Public Methods - Main Entry Point
  // ===========================================================================

  /**
   * Optimize a prompt using the multi-agent system.
   *
   * This is the main entry point for prompt optimization. It coordinates
   * the optimizer, router, and evaluator agents to produce the best
   * possible optimized prompt.
   *
   * @param prompt - The prompt to optimize
   * @param options - Optimization options
   * @returns Optimization result with best prompt and metrics
   */
  async optimize(
    prompt: string,
    options: OptimizeOptions = {}
  ): Promise<OptimizationResult> {
    const startTime = Date.now();
    this.totalOptimizations++;

    this.emit({ type: 'optimization_started', prompt });
    this.log(`Starting optimization for prompt (${prompt.length} chars)`);

    try {
      // Step 1: Inject symbol context (internal only)
      const context = await this.injectSymbolContext(prompt, options);
      this.log('Symbol context injected');

      // Step 2: Dispatch to agents
      const agentResults = await this.dispatchToAgents(
        prompt,
        context,
        options
      );
      this.log(`Received ${agentResults.length} agent results`);

      // Step 3: Aggregate results
      const aggregated = this.aggregateResults(agentResults);
      this.emit({ type: 'aggregation_completed', result: aggregated });
      this.log('Results aggregated');

      // Step 4: Build final result (ensuring no symbols)
      const result = this.buildFinalResult(
        prompt,
        aggregated,
        startTime,
        options
      );

      // Verify no symbols leaked
      this.verifyNoSymbolsInResult(result);

      this.successfulOptimizations++;
      this.emit({ type: 'optimization_completed', result });
      this.log(`Optimization completed in ${result.metrics.totalTimeMs}ms`);

      return result;
    } catch (error) {
      this.emit({ type: 'optimization_failed', error: error as Error });
      this.log(`Optimization failed: ${(error as Error).message}`, 'error');
      throw error;
    }
  }

  /**
   * Optimize a prompt with a specific technique.
   */
  async optimizeWithTechnique(
    prompt: string,
    technique: TechniqueName
  ): Promise<OptimizationResult> {
    return this.optimize(prompt, { techniques: [technique] });
  }

  /**
   * Optimize a prompt for a specific model.
   */
  async optimizeForModel(
    prompt: string,
    model: string
  ): Promise<OptimizationResult> {
    return this.optimize(prompt, { targetModel: model, skipRouting: true });
  }

  // ===========================================================================
  // Public Methods - Direct Agent Access
  // ===========================================================================

  /**
   * Run only the optimization phase.
   */
  async runOptimizer(
    prompt: string,
    techniques?: TechniqueName[]
  ): Promise<AgentResult> {
    const context = await this.injectSymbolContext(prompt, { techniques });
    const task = this.createAgentTask('optimize', prompt, context, { techniques });
    const result = await this.optimizerAgent.run(task);
    return this.sanitizeAgentResult(result);
  }

  /**
   * Run only the routing phase.
   */
  async runRouter(prompt: string): Promise<AgentResult> {
    const context = await this.injectSymbolContext(prompt, {});
    const task = this.createAgentTask('route', prompt, context, {});
    const result = await this.routerAgent.run(task);
    return this.sanitizeAgentResult(result);
  }

  /**
   * Run only the evaluation phase.
   */
  async runEvaluator(prompt: string): Promise<AgentResult> {
    const context = await this.injectSymbolContext(prompt, {});
    const task = this.createAgentTask('evaluate', prompt, context, {});
    const result = await this.evaluatorAgent.run(task);
    return this.sanitizeAgentResult(result);
  }

  /**
   * Compare two prompts.
   */
  comparePrompts(promptA: string, promptB: string): {
    winner: 'a' | 'b' | 'tie';
    scoreA: number;
    scoreB: number;
    recommendation: string;
  } {
    const comparison = this.evaluatorAgent.comparePrompts(promptA, promptB);

    return {
      winner: comparison.winner,
      scoreA:
        comparison.comparison.reduce((s, c) => s + c.scoreA, 0) /
        comparison.comparison.length,
      scoreB:
        comparison.comparison.reduce((s, c) => s + c.scoreB, 0) /
        comparison.comparison.length,
      recommendation: this.symbolEncoder.stripSymbols(comparison.summary),
    };
  }

  // ===========================================================================
  // Public Methods - Configuration
  // ===========================================================================

  /**
   * Update orchestrator configuration.
   */
  configure(config: Partial<OrchestratorConfig>): void {
    this.config = this.mergeConfig(this.config, config);
  }

  /**
   * Get current configuration.
   */
  getConfig(): OrchestratorConfig {
    return { ...this.config };
  }

  /**
   * Get available techniques.
   */
  getAvailableTechniques(): TechniqueName[] {
    return this.optimizerAgent.getAvailableTechniques();
  }

  /**
   * Get available models.
   */
  getAvailableModels(): ModelConfig[] {
    return this.routerAgent.getAvailableModels();
  }

  /**
   * Get orchestrator statistics.
   */
  getStats(): {
    totalOptimizations: number;
    successfulOptimizations: number;
    successRate: number;
    queueStats: ReturnType<TaskQueue['getStats']>;
  } {
    return {
      totalOptimizations: this.totalOptimizations,
      successfulOptimizations: this.successfulOptimizations,
      successRate:
        this.totalOptimizations > 0
          ? this.successfulOptimizations / this.totalOptimizations
          : 0,
      queueStats: this.taskQueue.getStats(),
    };
  }

  // ===========================================================================
  // Public Methods - Events
  // ===========================================================================

  /**
   * Subscribe to orchestrator events.
   */
  on(listener: OrchestratorEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Remove event listener.
   */
  off(listener: OrchestratorEventListener): void {
    this.listeners.delete(listener);
  }

  // ===========================================================================
  // Private Methods - Symbol Injection
  // ===========================================================================

  /**
   * Inject symbol context for internal use.
   * CRITICAL: Symbols are internal only and must never be exposed.
   */
  private async injectSymbolContext(
    prompt: string,
    options: OptimizeOptions
  ): Promise<OptimizationContext> {
    // Build base context from options
    const baseContext: Partial<OptimizationContext> = {
      examples: options.examples || [],
      constraints: options.constraints || [],
      domainHints: options.domainHint ? [options.domainHint] : [],
    };

    // Inject symbols internally
    return this.symbolEncoder.injectSymbolContext(prompt, baseContext);
  }

  // ===========================================================================
  // Private Methods - Agent Dispatch
  // ===========================================================================

  /**
   * Dispatch tasks to agents based on options.
   */
  private async dispatchToAgents(
    prompt: string,
    context: OptimizationContext,
    options: OptimizeOptions
  ): Promise<{ agent: string; result: AgentResult }[]> {
    const results: { agent: string; result: AgentResult }[] = [];

    if (this.config.parallelExecution) {
      // Run agents in parallel
      const promises: Promise<{ agent: string; result: AgentResult }>[] = [];

      // Always run optimizer
      promises.push(
        this.runAgentWithTracking(
          'optimizer',
          prompt,
          context,
          options
        )
      );

      // Run router unless skipped
      if (!options.skipRouting && !options.targetModel) {
        promises.push(
          this.runAgentWithTracking('router', prompt, context, options)
        );
      }

      // Run evaluator unless skipped
      if (!options.skipEvaluation) {
        promises.push(
          this.runAgentWithTracking('evaluator', prompt, context, options)
        );
      }

      const settled = await Promise.allSettled(promises);

      for (const result of settled) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          this.log(`Agent failed: ${result.reason}`, 'error');
        }
      }
    } else {
      // Run agents sequentially
      try {
        results.push(
          await this.runAgentWithTracking('optimizer', prompt, context, options)
        );
      } catch (error) {
        this.log(`Optimizer failed: ${error}`, 'error');
      }

      if (!options.skipRouting && !options.targetModel) {
        try {
          results.push(
            await this.runAgentWithTracking('router', prompt, context, options)
          );
        } catch (error) {
          this.log(`Router failed: ${error}`, 'error');
        }
      }

      if (!options.skipEvaluation) {
        try {
          results.push(
            await this.runAgentWithTracking(
              'evaluator',
              prompt,
              context,
              options
            )
          );
        } catch (error) {
          this.log(`Evaluator failed: ${error}`, 'error');
        }
      }
    }

    return results;
  }

  /**
   * Run an agent with event tracking.
   */
  private async runAgentWithTracking(
    agentName: string,
    prompt: string,
    context: OptimizationContext,
    options: OptimizeOptions
  ): Promise<{ agent: string; result: AgentResult }> {
    const agent = this.agents.get(agentName);
    if (!agent) {
      throw new Error(`Unknown agent: ${agentName}`);
    }

    this.emit({ type: 'agent_started', agent: agentName });

    try {
      const task = this.createAgentTask(
        agentName === 'optimizer'
          ? 'optimize'
          : agentName === 'router'
            ? 'route'
            : 'evaluate',
        prompt,
        context,
        options
      );

      const result = await agent.run(task);
      const sanitized = this.sanitizeAgentResult(result);

      this.emit({ type: 'agent_completed', agent: agentName, result: sanitized });

      return { agent: agentName, result: sanitized };
    } catch (error) {
      this.emit({ type: 'agent_failed', agent: agentName, error: error as Error });
      throw error;
    }
  }

  /**
   * Execute an agent task (used by task queue).
   */
  private async executeAgentTask(task: AgentTask): Promise<AgentResult> {
    const agentName =
      task.type === 'optimize'
        ? 'optimizer'
        : task.type === 'route'
          ? 'router'
          : 'evaluator';

    const agent = this.agents.get(agentName);
    if (!agent) {
      throw new Error(`No agent for task type: ${task.type}`);
    }

    const result = await agent.run(task);
    return this.sanitizeAgentResult(result);
  }

  /**
   * Create an agent task.
   */
  private createAgentTask(
    type: 'optimize' | 'route' | 'evaluate',
    prompt: string,
    context: OptimizationContext,
    options: OptimizeOptions
  ): AgentTask {
    return {
      type,
      prompt,
      context,
      techniques: options.techniques || [],
      options: options.taskOptions || {},
    };
  }

  // ===========================================================================
  // Private Methods - Result Aggregation
  // ===========================================================================

  /**
   * Aggregate results from multiple agents.
   */
  private aggregateResults(
    agentResults: { agent: string; result: AgentResult }[]
  ): AggregatedResult {
    if (agentResults.length === 0) {
      throw new Error('No agent results to aggregate');
    }

    const results = agentResults.map((ar) => ar.result);
    const agentNames = agentResults.map((ar) => ar.agent);

    return this.aggregator.aggregate(results, agentNames);
  }

  // ===========================================================================
  // Private Methods - Result Building
  // ===========================================================================

  /**
   * Build the final optimization result.
   */
  private buildFinalResult(
    originalPrompt: string,
    aggregated: AggregatedResult,
    startTime: number,
    options: OptimizeOptions
  ): OptimizationResult {
    const totalTimeMs = Date.now() - startTime;

    // Calculate improvement
    const originalTokens = this.estimateTokens(originalPrompt);
    const optimizedTokens = this.estimateTokens(aggregated.optimizedPrompt);

    // Determine if there was actual improvement
    const improved =
      aggregated.optimizedPrompt !== originalPrompt &&
      aggregated.metrics.estimatedAccuracy > 0.5;

    const improvementPercent = improved
      ? Math.round(
          (aggregated.metrics.estimatedAccuracy - 0.5) * 200
        )
      : 0;

    // Build metrics
    const metrics: OptimizationMetrics = {
      qualityScore: aggregated.metrics.estimatedAccuracy,
      estimatedAccuracy: aggregated.metrics.estimatedAccuracy,
      totalTimeMs,
      estimatedCost: aggregated.metrics.cost,
      tokenCount: {
        original: originalTokens,
        optimized: optimizedTokens,
        delta: optimizedTokens - originalTokens,
      },
      agentTimes: {
        optimizer:
          aggregated.metrics.agentBreakdown.find((a) => a.agent === 'optimizer')
            ?.executionTimeMs || 0,
        router:
          aggregated.metrics.agentBreakdown.find((a) => a.agent === 'router')
            ?.executionTimeMs || 0,
        evaluator:
          aggregated.metrics.agentBreakdown.find((a) => a.agent === 'evaluator')
            ?.executionTimeMs || 0,
      },
      variantsGenerated: aggregated.metrics.aggregation.totalVariantsReceived,
      techniquesApplied: this.extractTechniques(aggregated.variants),
    };

    // Limit variants
    const finalVariants = aggregated.variants
      .slice(0, this.config.maxFinalVariants)
      .map((v) => ({
        content: this.symbolEncoder.stripSymbols(v.content),
        technique: v.technique,
        score: v.score,
        model: v.model,
      }));

    return {
      optimizedPrompt: this.symbolEncoder.stripSymbols(
        aggregated.optimizedPrompt
      ),
      originalPrompt,
      variants: finalVariants,
      selectedModel: aggregated.selectedModel || options.targetModel || 'default',
      metrics,
      reasoning: this.symbolEncoder.stripSymbols(aggregated.reasoning),
      improved,
      improvementPercent,
    };
  }

  /**
   * Extract unique techniques from variants.
   */
  private extractTechniques(variants: PromptVariant[]): string[] {
    const techniques = new Set<string>();
    for (const variant of variants) {
      if (variant.technique && variant.technique !== 'none') {
        techniques.add(variant.technique);
      }
    }
    return Array.from(techniques);
  }

  // ===========================================================================
  // Private Methods - Symbol Safety
  // ===========================================================================

  /**
   * Sanitize an agent result to remove symbols.
   */
  private sanitizeAgentResult(result: AgentResult): AgentResult {
    return this.symbolEncoder.stripSymbolsFromResult(result);
  }

  /**
   * Verify that no symbols leaked into the final result.
   * CRITICAL: This is a safety check to ensure symbols never escape.
   */
  private verifyNoSymbolsInResult(result: OptimizationResult): void {
    const textsToCheck = [
      result.optimizedPrompt,
      result.reasoning,
      ...result.variants.map((v) => v.content),
    ];

    for (const text of textsToCheck) {
      if (!this.symbolEncoder.verifyNoSymbols(text)) {
        // Log error but don't expose to user
        this.log('CRITICAL: Symbol detected in output - stripping', 'error');

        // Re-strip the result
        result.optimizedPrompt = this.symbolEncoder.stripSymbols(
          result.optimizedPrompt
        );
        result.reasoning = this.symbolEncoder.stripSymbols(result.reasoning);
        result.variants = result.variants.map((v) => ({
          ...v,
          content: this.symbolEncoder.stripSymbols(v.content),
        }));
      }
    }
  }

  // ===========================================================================
  // Private Methods - Utilities
  // ===========================================================================

  /**
   * Merge configuration objects.
   */
  private mergeConfig(
    base: OrchestratorConfig,
    override: Partial<OrchestratorConfig>
  ): OrchestratorConfig {
    return {
      ...base,
      ...override,
      taskQueue: { ...base.taskQueue, ...override.taskQueue },
      aggregator: { ...base.aggregator, ...override.aggregator },
      symbolEncoder: { ...base.symbolEncoder, ...override.symbolEncoder },
      optimizer: { ...base.optimizer, ...override.optimizer },
      router: { ...base.router, ...override.router },
      evaluator: { ...base.evaluator, ...override.evaluator },
    };
  }

  /**
   * Estimate token count.
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Log a message.
   */
  private log(
    message: string,
    level: 'debug' | 'info' | 'warn' | 'error' = 'info'
  ): void {
    if (this.config.verbose || level === 'error') {
      console.log(`[Orchestrator][${level.toUpperCase()}] ${message}`);
    }
  }

  /**
   * Emit an event.
   */
  private emit(event: OrchestratorEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in orchestrator event listener:', error);
      }
    }
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Create an orchestrator with default configuration.
 */
export function createOrchestrator(
  config?: Partial<OrchestratorConfig>
): Orchestrator {
  return new Orchestrator(config);
}

/**
 * Quick optimize function for simple use cases.
 */
export async function optimizePrompt(
  prompt: string,
  options?: OptimizeOptions
): Promise<OptimizationResult> {
  const orchestrator = new Orchestrator();
  return orchestrator.optimize(prompt, options);
}

// =============================================================================
// Exports
// =============================================================================

export { TaskQueue, ResultAggregator };
export default Orchestrator;
