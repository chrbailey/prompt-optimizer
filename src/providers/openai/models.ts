/**
 * OpenAI GPT Model Configurations
 *
 * Defines model specifications, pricing, and capabilities for OpenAI models.
 * Pricing is per 1K tokens as of January 2025.
 *
 * @module providers/openai/models
 */

import type { ModelConfig } from '../../types/index.js';

/**
 * GPT-4o Mini - Fast and affordable
 *
 * Best for: High-volume tasks, simple conversations,
 * and applications where cost is a primary concern.
 */
export const GPT_4O_MINI: ModelConfig = {
  id: 'gpt-4o-mini',
  name: 'GPT-4o Mini',
  provider: 'openai',
  contextWindow: 128000,
  maxOutputTokens: 16384,
  pricing: {
    inputPer1k: 0.00015,
    outputPer1k: 0.0006,
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
  description: 'Most cost-effective GPT-4 class model. Great for high-volume tasks.',
};

/**
 * GPT-4o - Flagship multimodal model
 *
 * Best for: Complex reasoning, coding, analysis,
 * and tasks requiring vision capabilities.
 */
export const GPT_4O: ModelConfig = {
  id: 'gpt-4o',
  name: 'GPT-4o',
  provider: 'openai',
  contextWindow: 128000,
  maxOutputTokens: 16384,
  pricing: {
    inputPer1k: 0.0025,
    outputPer1k: 0.01,
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
  description: 'Flagship multimodal model. Excellent for complex tasks with text and images.',
};

/**
 * GPT-4o (2024-11-20) - Latest GPT-4o snapshot
 *
 * Best for: When you need the latest improvements
 * in the GPT-4o family.
 */
export const GPT_4O_LATEST: ModelConfig = {
  id: 'gpt-4o-2024-11-20',
  name: 'GPT-4o (Nov 2024)',
  provider: 'openai',
  contextWindow: 128000,
  maxOutputTokens: 16384,
  pricing: {
    inputPer1k: 0.0025,
    outputPer1k: 0.01,
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
  description: 'Latest GPT-4o snapshot with newest improvements.',
};

/**
 * GPT-4 Turbo - High capability model
 *
 * Best for: Complex reasoning tasks requiring
 * the original GPT-4 architecture.
 */
export const GPT_4_TURBO: ModelConfig = {
  id: 'gpt-4-turbo',
  name: 'GPT-4 Turbo',
  provider: 'openai',
  contextWindow: 128000,
  maxOutputTokens: 4096,
  pricing: {
    inputPer1k: 0.01,
    outputPer1k: 0.03,
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
  description: 'High-capability GPT-4 with vision. Use for complex reasoning tasks.',
};

/**
 * o1 - Advanced reasoning model
 *
 * Best for: Complex reasoning, math, science,
 * and tasks requiring deep analytical thinking.
 */
export const O1: ModelConfig = {
  id: 'o1',
  name: 'o1',
  provider: 'openai',
  contextWindow: 200000,
  maxOutputTokens: 100000,
  pricing: {
    inputPer1k: 0.015,
    outputPer1k: 0.06,
    currency: 'USD',
  },
  capabilities: {
    streaming: true,
    functionCalling: true,
    vision: true,
    jsonMode: true,
    systemMessages: false, // o1 doesn't support system messages
  },
  tier: 'quality',
  description: 'Advanced reasoning model. Best for complex analytical tasks.',
};

/**
 * o1-mini - Faster reasoning model
 *
 * Best for: Quick reasoning tasks where speed
 * matters more than maximum capability.
 */
export const O1_MINI: ModelConfig = {
  id: 'o1-mini',
  name: 'o1-mini',
  provider: 'openai',
  contextWindow: 128000,
  maxOutputTokens: 65536,
  pricing: {
    inputPer1k: 0.003,
    outputPer1k: 0.012,
    currency: 'USD',
  },
  capabilities: {
    streaming: true,
    functionCalling: true,
    vision: false,
    jsonMode: true,
    systemMessages: false, // o1-mini doesn't support system messages
  },
  tier: 'balanced',
  description: 'Fast reasoning model. Good balance of speed and capability.',
};

/**
 * o3-mini - Latest fast reasoning model
 *
 * Best for: Quick reasoning with improved capabilities
 * over o1-mini.
 */
export const O3_MINI: ModelConfig = {
  id: 'o3-mini',
  name: 'o3-mini',
  provider: 'openai',
  contextWindow: 200000,
  maxOutputTokens: 100000,
  pricing: {
    inputPer1k: 0.00115,
    outputPer1k: 0.0044,
    currency: 'USD',
  },
  capabilities: {
    streaming: true,
    functionCalling: true,
    vision: false,
    jsonMode: true,
    systemMessages: false, // o3-mini doesn't support system messages
  },
  tier: 'fast',
  description: 'Latest fast reasoning model with excellent cost-efficiency.',
};

/**
 * All available OpenAI models
 */
export const OPENAI_MODELS: ModelConfig[] = [
  GPT_4O_MINI,
  GPT_4O,
  GPT_4O_LATEST,
  GPT_4_TURBO,
  O1,
  O1_MINI,
  O3_MINI,
];

/**
 * Default model for general use
 */
export const DEFAULT_OPENAI_MODEL = GPT_4O;

/**
 * Model recommendations by use case
 */
export const OPENAI_MODEL_RECOMMENDATIONS: Record<string, ModelConfig> = {
  /** For high-volume, latency-sensitive tasks */
  fast: GPT_4O_MINI,

  /** For most production workloads */
  balanced: GPT_4O,

  /** For complex tasks requiring highest quality */
  quality: O1,

  /** For budget-conscious applications */
  budget: GPT_4O_MINI,

  /** For coding and technical tasks */
  coding: GPT_4O,

  /** For creative writing */
  creative: GPT_4O,

  /** For analysis and research */
  analysis: O1,

  /** For math and science */
  reasoning: O1,

  /** For fast reasoning */
  fastReasoning: O3_MINI,
};

/**
 * Get model configuration by ID
 *
 * @param modelId - The model identifier
 * @returns Model configuration or undefined if not found
 */
export function getOpenAIModel(modelId: string): ModelConfig | undefined {
  return OPENAI_MODELS.find(m => m.id === modelId);
}

/**
 * Get recommended model for a specific use case
 *
 * @param useCase - The use case (fast, balanced, quality, budget, coding, creative, analysis, reasoning)
 * @returns Recommended model configuration
 */
export function getRecommendedOpenAIModel(useCase: string): ModelConfig {
  return OPENAI_MODEL_RECOMMENDATIONS[useCase] ?? DEFAULT_OPENAI_MODEL;
}
