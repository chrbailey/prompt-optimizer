/**
 * Base Agent - Abstract Base Class for All Specialist Agents
 *
 * This module provides the foundational class that all specialist agents extend.
 * It defines the common interface, lifecycle hooks, metrics tracking, and
 * logging infrastructure used throughout the agent system.
 *
 * @module core/agents/base-agent
 */

import type {
  AgentTask,
  AgentResult,
  OptimizationContext,
  ResultMetrics,
  PromptVariant,
  TechniqueName,
} from '../../types/index.js';
import { SymbolEncoder } from './symbol-encoder.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Agent execution status for tracking.
 */
export type AgentStatus = 'idle' | 'executing' | 'completed' | 'failed';

/**
 * Metrics tracked during agent execution.
 */
export interface AgentMetrics {
  /** Name of the agent */
  agentName: string;
  /** Total execution time in milliseconds */
  executionTimeMs: number;
  /** Number of LLM API calls made */
  llmCalls: number;
  /** Total tokens consumed */
  tokensUsed: number;
  /** Whether cache was used */
  cacheHit: boolean;
  /** Number of variants generated (if applicable) */
  variantsGenerated?: number;
  /** Custom metrics specific to this agent */
  custom?: Record<string, number>;
}

/**
 * Configuration options for base agent.
 */
export interface BaseAgentConfig {
  /** Whether to enable detailed logging */
  verbose: boolean;
  /** Default timeout for operations */
  defaultTimeoutMs: number;
  /** Symbol encoder instance (shared) */
  symbolEncoder?: SymbolEncoder;
  /** Whether to track detailed metrics */
  trackMetrics: boolean;
}

/**
 * Log entry structure.
 */
export interface LogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  agent: string;
  message: string;
  data?: unknown;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: BaseAgentConfig = {
  verbose: false,
  defaultTimeoutMs: 30000,
  trackMetrics: true,
};

// =============================================================================
// Abstract Base Agent Class
// =============================================================================

/**
 * Abstract base class for all specialist agents in the optimization system.
 *
 * Subclasses must implement:
 * - name: Unique identifier for the agent
 * - capabilities: List of task types this agent can handle
 * - execute(): Main execution logic for the agent
 *
 * The base class provides:
 * - Lifecycle hooks (beforeExecute, afterExecute, onError)
 * - Metrics tracking and reporting
 * - Logging infrastructure
 * - Symbol encoding/stripping utilities
 * - Common helper methods
 */
export abstract class BaseAgent {
  // ===========================================================================
  // Abstract Properties (must be implemented by subclasses)
  // ===========================================================================

  /** Unique name for this agent */
  abstract readonly name: string;

  /** List of capabilities/task types this agent can handle */
  abstract readonly capabilities: string[];

  // ===========================================================================
  // Protected Properties
  // ===========================================================================

  protected config: BaseAgentConfig;
  protected symbolEncoder: SymbolEncoder;
  protected status: AgentStatus = 'idle';
  protected logs: LogEntry[] = [];
  protected currentMetrics: Partial<AgentMetrics> = {};

  // Private metrics tracking
  private executionStartTime: number = 0;
  private llmCallCount: number = 0;
  private totalTokensUsed: number = 0;

  // ===========================================================================
  // Constructor
  // ===========================================================================

  constructor(config: Partial<BaseAgentConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.symbolEncoder = config.symbolEncoder || new SymbolEncoder();
  }

  // ===========================================================================
  // Abstract Method (must be implemented by subclasses)
  // ===========================================================================

  /**
   * Execute the agent's primary task.
   * This is the main method that subclasses must implement.
   *
   * @param task - The task to execute
   * @returns Promise resolving to the agent result
   */
  abstract execute(task: AgentTask): Promise<AgentResult>;

  // ===========================================================================
  // Public Methods
  // ===========================================================================

  /**
   * Run the agent with full lifecycle management.
   * This wraps execute() with beforeExecute/afterExecute hooks and error handling.
   *
   * @param task - The task to run
   * @returns Promise resolving to the sanitized agent result
   */
  async run(task: AgentTask): Promise<AgentResult> {
    this.resetMetrics();
    this.status = 'executing';
    this.executionStartTime = Date.now();

    try {
      // Lifecycle: before execution
      await this.beforeExecute(task);

      // Execute main logic
      const result = await this.execute(task);

      // Calculate final metrics
      const metrics = this.getMetrics();

      // Ensure no symbols leak in output
      const sanitizedResult = this.sanitizeResult({
        ...result,
        metrics: {
          ...result.metrics,
          // Add agent execution metrics
        },
      });

      // Lifecycle: after execution
      await this.afterExecute(task, sanitizedResult);

      this.status = 'completed';
      this.log('info', `Execution completed in ${metrics.executionTimeMs}ms`);

      return sanitizedResult;
    } catch (error) {
      this.status = 'failed';
      await this.onError(task, error as Error);
      throw error;
    }
  }

  /**
   * Check if this agent can handle a specific task type.
   *
   * @param taskType - The task type to check
   * @returns True if this agent can handle the task
   */
  canHandle(taskType: string): boolean {
    return this.capabilities.includes(taskType);
  }

  /**
   * Get current agent status.
   */
  getStatus(): AgentStatus {
    return this.status;
  }

  /**
   * Get accumulated logs from this agent.
   *
   * @param minLevel - Minimum log level to return
   * @returns Array of log entries
   */
  getLogs(minLevel?: 'debug' | 'info' | 'warn' | 'error'): LogEntry[] {
    if (!minLevel) return [...this.logs];

    const levels = ['debug', 'info', 'warn', 'error'];
    const minIndex = levels.indexOf(minLevel);

    return this.logs.filter((log) => levels.indexOf(log.level) >= minIndex);
  }

  /**
   * Clear accumulated logs.
   */
  clearLogs(): void {
    this.logs = [];
  }

  // ===========================================================================
  // Protected Methods - Lifecycle Hooks
  // ===========================================================================

  /**
   * Hook called before execute(). Override to add pre-execution logic.
   *
   * @param task - The task about to be executed
   */
  protected async beforeExecute(task: AgentTask): Promise<void> {
    this.log('debug', `Starting execution for task type: ${task.type}`);
  }

  /**
   * Hook called after successful execute(). Override to add post-execution logic.
   *
   * @param task - The task that was executed
   * @param result - The result from execution
   */
  protected async afterExecute(
    _task: AgentTask,
    _result: AgentResult
  ): Promise<void> {
    this.log('debug', 'Execution completed successfully');
  }

  /**
   * Hook called when execute() throws an error. Override for custom error handling.
   *
   * @param task - The task that failed
   * @param error - The error that occurred
   */
  protected async onError(task: AgentTask, error: Error): Promise<void> {
    this.log('error', `Execution failed: ${error.message}`, {
      taskType: task.type,
      error: error.stack,
    });
  }

  // ===========================================================================
  // Protected Methods - Logging
  // ===========================================================================

  /**
   * Log a message from this agent.
   *
   * @param level - Log level
   * @param message - Log message
   * @param data - Optional additional data
   */
  protected log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    data?: unknown
  ): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      agent: this.name,
      message,
      data,
    };

    this.logs.push(entry);

    // Console output if verbose
    if (this.config.verbose || level === 'error') {
      const prefix = `[${this.name}][${level.toUpperCase()}]`;
      console.log(`${prefix} ${message}`);
      if (data) {
        console.log(data);
      }
    }
  }

  // ===========================================================================
  // Protected Methods - Metrics
  // ===========================================================================

  /**
   * Get current execution metrics.
   */
  protected getMetrics(): AgentMetrics {
    const executionTimeMs =
      this.executionStartTime > 0 ? Date.now() - this.executionStartTime : 0;

    return {
      agentName: this.name,
      executionTimeMs,
      llmCalls: this.llmCallCount,
      tokensUsed: this.totalTokensUsed,
      cacheHit: false,
      ...this.currentMetrics,
    };
  }

  /**
   * Record an LLM API call.
   *
   * @param tokensUsed - Number of tokens consumed
   */
  protected recordLlmCall(tokensUsed: number): void {
    this.llmCallCount++;
    this.totalTokensUsed += tokensUsed;
  }

  /**
   * Set a custom metric value.
   *
   * @param name - Metric name
   * @param value - Metric value
   */
  protected setCustomMetric(name: string, value: number): void {
    if (!this.currentMetrics.custom) {
      this.currentMetrics.custom = {};
    }
    this.currentMetrics.custom[name] = value;
  }

  /**
   * Reset all metrics for a new execution.
   */
  private resetMetrics(): void {
    this.executionStartTime = 0;
    this.llmCallCount = 0;
    this.totalTokensUsed = 0;
    this.currentMetrics = {};
  }

  // ===========================================================================
  // Protected Methods - Symbol Handling
  // ===========================================================================

  /**
   * Get symbol context for internal use during optimization.
   * This enriches the task context with resolved symbols.
   *
   * @param task - The current task
   * @returns Enhanced context with symbols
   */
  protected async getSymbolContext(
    task: AgentTask
  ): Promise<OptimizationContext> {
    return this.symbolEncoder.injectSymbolContext(task.prompt, task.context);
  }

  /**
   * Encode symbols for internal agent context.
   *
   * @param context - The optimization context
   * @returns Encoded symbol context string
   */
  protected encodeSymbols(context: OptimizationContext): string {
    return this.symbolEncoder.encodeForAgent(context.symbols);
  }

  /**
   * Ensure result contains no symbols before returning.
   *
   * @param result - The result to sanitize
   * @returns Sanitized result
   */
  protected sanitizeResult(result: AgentResult): AgentResult {
    return this.symbolEncoder.stripSymbolsFromResult(result);
  }

  /**
   * Strip symbols from text.
   *
   * @param text - Text to clean
   * @returns Clean text
   */
  protected stripSymbols(text: string): string {
    return this.symbolEncoder.stripSymbols(text);
  }

  // ===========================================================================
  // Protected Methods - Result Building
  // ===========================================================================

  /**
   * Create a default result metrics object.
   */
  protected createDefaultMetrics(): ResultMetrics {
    return {
      estimatedAccuracy: 0.5,
      latency: 0,
      cost: 0,
      tokenCount: { input: 0, output: 0 },
    };
  }

  /**
   * Create a prompt variant object.
   *
   * @param content - The variant content
   * @param technique - Technique used to generate it
   * @param score - Quality score
   * @param model - Target model
   */
  protected createVariant(
    content: string,
    technique: TechniqueName | string,
    score: number,
    model: string = 'default'
  ): PromptVariant {
    return {
      content: this.stripSymbols(content),
      technique,
      score,
      model,
    };
  }

  /**
   * Create a successful agent result.
   *
   * @param optimizedPrompt - The best optimized prompt
   * @param variants - All generated variants
   * @param selectedModel - The selected model
   * @param reasoning - Explanation of decisions
   */
  protected createResult(
    optimizedPrompt: string,
    variants: PromptVariant[],
    selectedModel: string,
    reasoning: string
  ): AgentResult {
    return {
      optimizedPrompt: this.stripSymbols(optimizedPrompt),
      variants: variants.map((v) => ({
        ...v,
        content: this.stripSymbols(v.content),
      })),
      metrics: this.createDefaultMetrics(),
      selectedModel,
      reasoning: this.stripSymbols(reasoning),
    };
  }

  // ===========================================================================
  // Protected Methods - Utility
  // ===========================================================================

  /**
   * Wait for a specified duration (useful for rate limiting).
   *
   * @param ms - Milliseconds to wait
   */
  protected async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Execute with timeout.
   *
   * @param promise - Promise to execute
   * @param timeoutMs - Timeout in milliseconds
   * @param errorMessage - Error message if timeout
   */
  protected async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number = this.config.defaultTimeoutMs,
    errorMessage: string = 'Operation timed out'
  ): Promise<T> {
    let timeoutId: NodeJS.Timeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutId!);
      return result;
    } catch (error) {
      clearTimeout(timeoutId!);
      throw error;
    }
  }

  /**
   * Estimate token count for text (rough approximation).
   *
   * @param text - Text to estimate
   * @returns Estimated token count
   */
  protected estimateTokens(text: string): number {
    // Rough approximation: ~4 characters per token for English
    return Math.ceil(text.length / 4);
  }
}

// =============================================================================
// Exports
// =============================================================================

export default BaseAgent;
