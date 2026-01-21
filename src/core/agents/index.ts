/**
 * Agents Module - Specialist Agents for Prompt Optimization
 *
 * This module exports all specialist agents and related types.
 *
 * @module core/agents
 */

// Base agent
export { BaseAgent, type BaseAgentConfig, type AgentMetrics, type LogEntry } from './base-agent.js';

// Symbol encoder (internal use only)
export {
  SymbolEncoder,
  type SymbolEncoderConfig,
  type SymbolRegistry,
} from './symbol-encoder.js';

// Specialist agents
export { OptimizerAgent, type OptimizerAgentConfig } from './optimizer-agent.js';
export { RouterAgent, type RouterAgentConfig, type PromptCharacteristics, type TaskType, type ModelScore } from './router-agent.js';
export { EvaluatorAgent, type EvaluatorAgentConfig, type QualityDimension, type QualityIssue, type EvaluationScores, type ComparisonResult } from './evaluator-agent.js';
