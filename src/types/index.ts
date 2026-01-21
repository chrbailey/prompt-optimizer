/**
 * Prompt Optimizer - Core Type Definitions
 *
 * This module defines all foundational types and interfaces for the prompt optimization system.
 * These types support the multi-agent architecture where specialist agents collaborate to
 * optimize prompts for various LLM providers.
 *
 * @module types
 * @version 1.0.0
 *
 * IMPORTANT: Types marked as "INTERNAL ONLY" should never be exposed in API responses
 * or user-facing outputs. PromptSpeak symbols are for internal optimization only.
 */

// =============================================================================
// Symbol Types (INTERNAL - Never Expose)
// =============================================================================

/**
 * Enumeration of PromptSpeak symbol types used for internal knowledge representation.
 * These map to the Ξ.<TYPE>.<IDENTIFIER> format used in PromptSpeak.
 *
 * @internal
 */
export type SymbolType =
  | 'CONCEPT'
  | 'COMPANY'
  | 'PATTERN'
  | 'TECHNIQUE'
  | 'CONSTRAINT'
  | 'DOMAIN'
  | 'METRIC'
  | 'EXAMPLE'
  | 'CONTEXT';

/**
 * Metadata associated with an internal symbol.
 *
 * @internal
 */
export interface SymbolMetadata {
  /** When the symbol was created */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Source of the symbol (e.g., 'knowledge-base', 'session', 'user') */
  source: string;
  /** Confidence score for the symbol's relevance (0-1) */
  confidence: number;
  /** Optional tags for categorization */
  tags?: string[];
  /** Version number for tracking changes */
  version?: number;
}

/**
 * Internal representation of a PromptSpeak symbol.
 *
 * CRITICAL: These symbols are for INTERNAL optimization purposes only.
 * They must NEVER be exposed in API responses, logs accessible to users,
 * or any external output. The visibility field enforces this constraint.
 *
 * @internal
 */
export interface InternalSymbol {
  /** Unique identifier in format Ξ.<TYPE>.<IDENTIFIER> */
  id: string;
  /** The type classification of this symbol */
  type: SymbolType;
  /** The resolved value of the symbol (type depends on symbol type) */
  value: unknown;
  /** Visibility constraint - always 'internal' or 'never_expose' */
  visibility: 'internal' | 'never_expose';
  /** Additional metadata about the symbol */
  metadata: SymbolMetadata;
}

// =============================================================================
// Example Types
// =============================================================================

/**
 * A training or few-shot example used to guide prompt optimization.
 * Examples demonstrate transformations from suboptimal to optimized prompts.
 */
export interface Example {
  /** Unique identifier for the example */
  id: string;
  /** Category or domain this example belongs to (e.g., 'code-generation', 'analysis') */
  category: string;
  /** The original, unoptimized prompt */
  beforePrompt: string;
  /** The optimized version of the prompt */
  afterPrompt: string;
  /** Expected improvement score (0-1) when using the optimized version */
  expectedImprovement: number;
  /**
   * References to internal symbol IDs used in this example.
   * These are for internal correlation only and must never be exposed.
   * @internal
   */
  internalSymbols: string[];
}

// =============================================================================
// Constraint Types
// =============================================================================

/**
 * Types of constraints that can be applied during optimization.
 */
export type ConstraintType =
  | 'token_limit'
  | 'cost_limit'
  | 'latency_limit'
  | 'model_restriction'
  | 'content_policy'
  | 'format_requirement'
  | 'custom';

/**
 * A constraint that limits or guides the optimization process.
 */
export interface Constraint {
  /** Type of constraint */
  type: ConstraintType;
  /** Human-readable description of the constraint */
  description: string;
  /** The constraint value (interpretation depends on type) */
  value: string | number | boolean | string[];
  /** Whether this constraint is mandatory (true) or preferred (false) */
  strict: boolean;
  /** Priority when multiple constraints conflict (higher = more important) */
  priority: number;
}

// =============================================================================
// Context Types
// =============================================================================

/**
 * Internal context used during prompt optimization.
 * Contains symbols, examples, and constraints that guide the optimization.
 *
 * IMPORTANT: The symbols array contains internal data that must never
 * be exposed to users or external systems.
 */
export interface OptimizationContext {
  /**
   * Internal PromptSpeak symbols for knowledge-driven optimization.
   * NEVER expose these in any output.
   * @internal
   */
  symbols: InternalSymbol[];
  /** Examples to guide few-shot optimization */
  examples: Example[];
  /** Constraints to apply during optimization */
  constraints: Constraint[];
  /** Domain-specific hints to improve relevance */
  domainHints: string[];
}

// =============================================================================
// Technique Types
// =============================================================================

/**
 * Names of available prompt optimization techniques.
 * Each technique implements a specific strategy for improving prompts.
 */
export type TechniqueName =
  | 'chain_of_thought'
  | 'few_shot'
  | 'role_prompting'
  | 'structured_output'
  | 'step_by_step'
  | 'tree_of_thought'
  | 'self_consistency'
  | 'prompt_chaining'
  | 'meta_prompting'
  | 'constitutional_ai'
  | 'reflection'
  | 'decomposition';

/**
 * Configuration options for a specific technique.
 */
export interface TechniqueConfig {
  /** The technique to configure */
  name: TechniqueName;
  /** Whether this technique is enabled */
  enabled: boolean;
  /** Technique-specific parameters */
  parameters: Record<string, unknown>;
  /** Priority when multiple techniques are applicable (higher = preferred) */
  priority: number;
  /** Model compatibility restrictions */
  compatibleModels?: string[];
}

/**
 * Result from applying a specific optimization technique.
 */
export interface TechniqueResult {
  /** The technique that was applied */
  technique: TechniqueName;
  /** The resulting optimized prompt */
  optimizedPrompt: string;
  /** Confidence score for this optimization (0-1) */
  confidence: number;
  /** Explanation of what the technique did */
  explanation: string;
  /** Token count change (positive = increase, negative = decrease) */
  tokenDelta: number;
  /** Time taken to apply the technique in milliseconds */
  processingTimeMs: number;
}

// =============================================================================
// Task Types
// =============================================================================

/**
 * Options that modify task execution behavior.
 */
export interface TaskOptions {
  /** Maximum time allowed for task execution in milliseconds */
  timeoutMs?: number;
  /** Maximum number of optimization variants to generate */
  maxVariants?: number;
  /** Minimum confidence threshold for accepting results (0-1) */
  minConfidence?: number;
  /** Whether to include detailed reasoning in results */
  includeReasoning?: boolean;
  /** Whether to run techniques in parallel where possible */
  parallelExecution?: boolean;
  /** Custom metadata to pass through the pipeline */
  metadata?: Record<string, unknown>;
}

/**
 * A task passed to specialist agents for processing.
 * This is the primary input structure for the agent system.
 */
export interface AgentTask {
  /** The type of task to perform */
  type: 'optimize' | 'route' | 'evaluate';
  /** The original prompt to process */
  prompt: string;
  /** Optimization context including symbols and examples */
  context: OptimizationContext;
  /** Techniques to apply (or consider) during optimization */
  techniques: TechniqueName[];
  /** Additional options for task execution */
  options: TaskOptions;
}

// =============================================================================
// Result Types
// =============================================================================

/**
 * Token count breakdown for a completion.
 */
export interface TokenCount {
  /** Number of input/prompt tokens */
  input: number;
  /** Number of output/completion tokens */
  output: number;
}

/**
 * Performance and quality metrics for optimization results.
 */
export interface ResultMetrics {
  /** Estimated accuracy/quality improvement (0-1) */
  estimatedAccuracy: number;
  /** Measured or estimated latency in milliseconds */
  latency: number;
  /** Estimated cost in USD */
  cost: number;
  /** Token usage breakdown */
  tokenCount: TokenCount;
}

/**
 * A candidate optimized prompt variant.
 * Multiple variants may be generated for comparison.
 */
export interface PromptVariant {
  /** The optimized prompt content */
  content: string;
  /** The primary technique used to generate this variant */
  technique: string;
  /** Quality/relevance score (0-1) */
  score: number;
  /** The model this variant is optimized for */
  model: string;
}

/**
 * Result returned from specialist agents after processing a task.
 * This is the primary output structure from the agent system.
 */
export interface AgentResult {
  /** The best optimized prompt selected from variants */
  optimizedPrompt: string;
  /** All generated prompt variants */
  variants: PromptVariant[];
  /** Performance metrics for the optimization */
  metrics: ResultMetrics;
  /** The model recommended/selected for this prompt */
  selectedModel: string;
  /** Explanation of the optimization decisions made */
  reasoning: string;
}

// =============================================================================
// LLM Provider Types
// =============================================================================

/**
 * Supported LLM provider identifiers.
 */
export type ProviderName = 'anthropic' | 'openai' | 'google' | 'local';

/**
 * Pricing information for a model.
 */
export interface ModelPricing {
  /** Cost per 1K input tokens */
  inputPer1k: number;
  /** Cost per 1K output tokens */
  outputPer1k: number;
  /** Currency code (usually USD) */
  currency: string;
}

/**
 * Capabilities and features supported by a model.
 */
export interface ModelCapabilities {
  /** Supports structured JSON output */
  jsonMode: boolean;
  /** Supports function/tool calling */
  functionCalling: boolean;
  /** Supports vision/image inputs */
  vision: boolean;
  /** Supports streaming responses */
  streaming: boolean;
  /** Supports system messages */
  systemMessages: boolean;
  /** Maximum number of parallel tool calls */
  maxToolCalls?: number;
}

/**
 * Configuration for a specific model.
 * This is the unified model configuration used throughout the system.
 */
export interface ModelConfig {
  /** Unique model identifier (e.g., 'claude-3-5-sonnet-20241022') */
  id: string;
  /** Human-readable model name */
  name: string;
  /** Provider that hosts this model */
  provider: ProviderName | string;
  /** Maximum context window size in tokens */
  contextWindow: number;
  /** Maximum output tokens allowed */
  maxOutputTokens: number;
  /** Pricing information */
  pricing: ModelPricing;
  /** Capabilities and features supported by this model */
  capabilities: ModelCapabilities;
  /** Performance tier */
  tier: 'fast' | 'balanced' | 'quality';
  /** Optional description */
  description?: string;
}

/**
 * A message in a conversation.
 */
export interface Message {
  /** Role of the message sender */
  role: 'system' | 'user' | 'assistant' | 'tool';
  /** Content of the message */
  content: string;
  /** Optional name for the sender */
  name?: string;
  /** Tool call ID if this is a tool response */
  toolCallId?: string;
}

/**
 * Request to generate a completion from an LLM.
 */
export interface CompletionRequest {
  /** The model to use for completion */
  model?: string;
  /** Messages forming the conversation/prompt */
  messages: Message[];
  /** Optional system prompt (if supported by model) */
  systemPrompt?: string;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Temperature for sampling (0-2, lower = more deterministic) */
  temperature?: number;
  /** Top-p nucleus sampling parameter */
  topP?: number;
  /** Stop sequences to end generation */
  stopSequences?: string[];
  /** Whether to stream the response */
  stream?: boolean;
  /** Request timeout in milliseconds */
  timeoutMs?: number;
  /** Whether to request JSON mode output */
  jsonMode?: boolean;
  /** Additional provider-specific options */
  providerOptions?: Record<string, unknown>;
}

/**
 * Usage statistics from a completion.
 */
export interface CompletionUsage {
  /** Number of tokens in the prompt (alias: promptTokens) */
  inputTokens: number;
  /** Number of tokens in the completion (alias: completionTokens) */
  outputTokens: number;
  /** Total tokens used */
  totalTokens: number;
  // Aliases for compatibility
  /** @deprecated Use inputTokens instead */
  promptTokens?: number;
  /** @deprecated Use outputTokens instead */
  completionTokens?: number;
}

/**
 * Cost breakdown for a completion.
 */
export interface CompletionCost {
  /** Cost for input tokens */
  inputCost: number;
  /** Cost for output tokens */
  outputCost: number;
  /** Total cost */
  totalCost: number;
  /** Currency code */
  currency: string;
}

/**
 * Response from an LLM completion request.
 */
export interface CompletionResponse {
  /** Unique identifier for this completion */
  id: string;
  /** The model that generated the completion */
  model: string;
  /** The generated content */
  content: string;
  /** Reason the generation stopped (null if still streaming) */
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error' | null;
  /** Token usage statistics */
  usage: CompletionUsage;
  /** Cost information */
  cost: CompletionCost;
  /** Time taken for the request in milliseconds */
  latencyMs: number;
  /** Provider that handled the request */
  provider: ProviderName | string;
  /** Whether this is a streaming response chunk */
  streaming?: boolean;
}

/**
 * Estimated cost for a potential completion.
 */
/**
 * Cost estimate for a potential completion.
 */
export interface CostEstimate {
  /** Estimated input tokens */
  estimatedInputTokens: number;
  /** Estimated output tokens */
  estimatedOutputTokens: number;
  /** Estimated total tokens */
  estimatedTotalTokens: number;
  /** Estimated input cost */
  inputCost: number;
  /** Estimated output cost */
  outputCost: number;
  /** Estimated total cost */
  totalCost: number;
  /** Currency code */
  currency: string;
  /** Model used for estimation */
  model: string;
  /** Provider name */
  provider: string;
  /** Confidence in the estimate */
  confidence: 'low' | 'medium' | 'high';
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error codes for the prompt optimizer system.
 */
export type ErrorCode =
  | 'INVALID_PROMPT'
  | 'OPTIMIZATION_FAILED'
  | 'PROVIDER_ERROR'
  | 'RATE_LIMIT_EXCEEDED'
  | 'CONTEXT_TOO_LARGE'
  | 'TECHNIQUE_ERROR'
  | 'TIMEOUT'
  | 'INVALID_CONFIG'
  | 'SYMBOL_RESOLUTION_FAILED'
  | 'UNKNOWN_ERROR';

/**
 * Structured error from the prompt optimizer system.
 */
export interface OptimizerError {
  /** Error code for programmatic handling */
  code: ErrorCode;
  /** Human-readable error message */
  message: string;
  /** Additional context about the error */
  details?: Record<string, unknown>;
  /** Whether this error is recoverable */
  recoverable: boolean;
  /** Suggested action to resolve the error */
  suggestion?: string;
}

// =============================================================================
// Orchestrator Types
// =============================================================================

/**
 * Status of an optimization job.
 */
export type JobStatus =
  | 'pending'
  | 'routing'
  | 'optimizing'
  | 'evaluating'
  | 'completed'
  | 'failed';

/**
 * An optimization job tracked by the orchestrator.
 */
export interface OptimizationJob {
  /** Unique job identifier */
  id: string;
  /** Current status of the job */
  status: JobStatus;
  /** The original task that created this job */
  task: AgentTask;
  /** Result if the job is completed */
  result?: AgentResult;
  /** Error if the job failed */
  error?: OptimizerError;
  /** When the job was created */
  createdAt: Date;
  /** When the job was last updated */
  updatedAt: Date;
  /** When the job completed (if applicable) */
  completedAt?: Date;
}

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Configuration for the prompt optimizer system.
 */
export interface OptimizerConfig {
  /** Default techniques to apply */
  defaultTechniques: TechniqueName[];
  /** Available model configurations */
  models: ModelConfig[];
  /** Default model to use if not specified */
  defaultModel: string;
  /** Global timeout for operations in milliseconds */
  timeoutMs: number;
  /** Maximum parallel operations */
  maxParallelism: number;
  /** Whether to enable detailed logging */
  debugMode: boolean;
  /** Technique-specific configurations */
  techniqueConfigs: TechniqueConfig[];
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * A type-safe result that can be either a success or failure.
 */
export type Result<T, E = OptimizerError> =
  | { success: true; value: T }
  | { success: false; error: E };

/**
 * Makes specific keys of a type optional.
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Makes specific keys of a type required.
 */
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

/**
 * Deep partial type - makes all nested properties optional.
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// =============================================================================
// Extended Provider Types (for provider abstraction layer)
// =============================================================================

/**
 * Types of tasks that can be optimized.
 * Used by the provider registry for intelligent model selection.
 */
export type TaskType =
  | 'coding'
  | 'analysis'
  | 'creative'
  | 'classification'
  | 'extraction'
  | 'conversation'
  | 'summarization'
  | 'translation'
  | 'qa'
  | 'general';

/**
 * Budget constraints for model selection and optimization.
 */
export interface Budget {
  /** Maximum cost per request in USD */
  maxCostPerRequest?: number;
  /** Maximum total cost for optimization run */
  maxTotalCost?: number;
  /** Maximum tokens per request */
  maxTokensPerRequest?: number;
  /** Preferred price tier */
  preferredTier?: 'fast' | 'balanced' | 'quality';
}

/**
 * Extended cost estimate with confidence levels.
 */
export interface CostEstimateExtended {
  /** Estimated input tokens */
  estimatedInputTokens: number;
  /** Estimated output tokens */
  estimatedOutputTokens: number;
  /** Estimated total tokens */
  estimatedTotalTokens: number;
  /** Estimated input cost */
  inputCost: number;
  /** Estimated output cost */
  outputCost: number;
  /** Estimated total cost */
  totalCost: number;
  /** Currency code */
  currency: string;
  /** Model used for estimation */
  model: string;
  /** Provider name */
  provider: string;
  /** Confidence in the estimate */
  confidence: 'low' | 'medium' | 'high';
}
