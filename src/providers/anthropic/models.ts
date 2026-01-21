/**
 * Anthropic Claude Model Configurations
 *
 * Defines model specifications, pricing, and capabilities for Claude models.
 * Pricing is per 1K tokens as of January 2025.
 *
 * @module providers/anthropic/models
 */

import type { ModelConfig } from '../../types/index.js';

/**
 * Claude 3 Haiku - Fast and cost-effective
 *
 * Best for: High-volume, low-latency tasks like classification,
 * simple Q&A, and quick content generation.
 */
export const CLAUDE_3_HAIKU: ModelConfig = {
  id: 'claude-3-haiku-20240307',
  name: 'Claude 3 Haiku',
  provider: 'anthropic',
  contextWindow: 200000,
  maxOutputTokens: 4096,
  pricing: {
    inputPer1k: 0.00025,
    outputPer1k: 0.00125,
    currency: 'USD',
  },
  capabilities: {
    streaming: true,
    functionCalling: true,
    vision: true,
    jsonMode: true,
    systemMessages: true,
  },
  tier: 'fast',
  description: 'Fastest Claude model, ideal for high-volume tasks requiring quick responses.',
};

/**
 * Claude 3.5 Haiku - Upgraded fast model
 *
 * Best for: Same use cases as Haiku with improved quality
 */
export const CLAUDE_3_5_HAIKU: ModelConfig = {
  id: 'claude-3-5-haiku-20241022',
  name: 'Claude 3.5 Haiku',
  provider: 'anthropic',
  contextWindow: 200000,
  maxOutputTokens: 8192,
  pricing: {
    inputPer1k: 0.001,
    outputPer1k: 0.005,
    currency: 'USD',
  },
  capabilities: {
    streaming: true,
    functionCalling: true,
    vision: true,
    jsonMode: true,
    systemMessages: true,
  },
  tier: 'fast',
  description: 'Enhanced Haiku with better reasoning while maintaining speed.',
};

/**
 * Claude 3.5 Sonnet - Balanced performance
 *
 * Best for: Complex reasoning, coding, analysis tasks that need
 * a balance of quality and cost.
 */
export const CLAUDE_3_5_SONNET: ModelConfig = {
  id: 'claude-3-5-sonnet-20241022',
  name: 'Claude 3.5 Sonnet',
  provider: 'anthropic',
  contextWindow: 200000,
  maxOutputTokens: 8192,
  pricing: {
    inputPer1k: 0.003,
    outputPer1k: 0.015,
    currency: 'USD',
  },
  capabilities: {
    streaming: true,
    functionCalling: true,
    vision: true,
    jsonMode: true,
    systemMessages: true,
  },
  tier: 'balanced',
  description: 'Best balance of intelligence and speed. Excellent for most production workloads.',
};

/**
 * Claude Sonnet 4 - Latest balanced model
 *
 * Best for: Production workloads requiring strong reasoning
 * with good cost efficiency.
 */
export const CLAUDE_SONNET_4: ModelConfig = {
  id: 'claude-sonnet-4-20250514',
  name: 'Claude Sonnet 4',
  provider: 'anthropic',
  contextWindow: 200000,
  maxOutputTokens: 16384,
  pricing: {
    inputPer1k: 0.003,
    outputPer1k: 0.015,
    currency: 'USD',
  },
  capabilities: {
    streaming: true,
    functionCalling: true,
    vision: true,
    jsonMode: true,
    systemMessages: true,
  },
  tier: 'balanced',
  description: 'Latest Sonnet generation with improved reasoning and coding capabilities.',
};

/**
 * Claude Opus 4 - Highest capability model
 *
 * Best for: Complex analysis, nuanced writing, advanced coding,
 * and tasks requiring the highest quality output.
 */
export const CLAUDE_OPUS_4: ModelConfig = {
  id: 'claude-opus-4-20250514',
  name: 'Claude Opus 4',
  provider: 'anthropic',
  contextWindow: 200000,
  maxOutputTokens: 32768,
  pricing: {
    inputPer1k: 0.015,
    outputPer1k: 0.075,
    currency: 'USD',
  },
  capabilities: {
    streaming: true,
    functionCalling: true,
    vision: true,
    jsonMode: true,
    systemMessages: true,
  },
  tier: 'quality',
  description: 'Most capable Claude model. Best for complex reasoning, coding, and nuanced tasks.',
};

/**
 * All available Anthropic models
 */
export const ANTHROPIC_MODELS: ModelConfig[] = [
  CLAUDE_3_HAIKU,
  CLAUDE_3_5_HAIKU,
  CLAUDE_3_5_SONNET,
  CLAUDE_SONNET_4,
  CLAUDE_OPUS_4,
];

/**
 * Default model for general use
 */
export const DEFAULT_ANTHROPIC_MODEL = CLAUDE_3_5_SONNET;

/**
 * Model recommendations by use case
 */
export const ANTHROPIC_MODEL_RECOMMENDATIONS: Record<string, ModelConfig> = {
  /** For high-volume, latency-sensitive tasks */
  fast: CLAUDE_3_5_HAIKU,

  /** For most production workloads */
  balanced: CLAUDE_3_5_SONNET,

  /** For complex tasks requiring highest quality */
  quality: CLAUDE_OPUS_4,

  /** For budget-conscious applications */
  budget: CLAUDE_3_HAIKU,

  /** For coding and technical tasks */
  coding: CLAUDE_SONNET_4,

  /** For creative writing */
  creative: CLAUDE_OPUS_4,

  /** For analysis and research */
  analysis: CLAUDE_OPUS_4,
};

/**
 * Get model configuration by ID
 *
 * @param modelId - The model identifier
 * @returns Model configuration or undefined if not found
 */
export function getAnthropicModel(modelId: string): ModelConfig | undefined {
  return ANTHROPIC_MODELS.find(m => m.id === modelId);
}

/**
 * Get recommended model for a specific use case
 *
 * @param useCase - The use case (fast, balanced, quality, budget, coding, creative, analysis)
 * @returns Recommended model configuration
 */
export function getRecommendedAnthropicModel(useCase: string): ModelConfig {
  return ANTHROPIC_MODEL_RECOMMENDATIONS[useCase] ?? DEFAULT_ANTHROPIC_MODEL;
}
