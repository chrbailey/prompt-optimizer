/**
 * Google Gemini Model Configurations
 *
 * Defines model specifications, pricing, and capabilities for Google's Gemini models.
 * Pricing is per 1K tokens as of January 2025.
 *
 * @module providers/google/models
 */

import type { ModelConfig } from '../../types/index.js';

/**
 * Gemini 2.0 Flash - Fast and capable
 *
 * Best for: High-volume tasks requiring good quality
 * with low latency and cost.
 */
export const GEMINI_2_0_FLASH: ModelConfig = {
  id: 'gemini-2.0-flash',
  name: 'Gemini 2.0 Flash',
  provider: 'google',
  contextWindow: 1048576, // 1M tokens
  maxOutputTokens: 8192,
  pricing: {
    inputPer1k: 0.0001,
    outputPer1k: 0.0004,
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
  description: 'Fast and capable multimodal model with massive context window.',
};

/**
 * Gemini 2.0 Flash Lite - Ultra-fast and cheap
 *
 * Best for: Very high-volume tasks where speed
 * and cost matter most.
 */
export const GEMINI_2_0_FLASH_LITE: ModelConfig = {
  id: 'gemini-2.0-flash-lite',
  name: 'Gemini 2.0 Flash Lite',
  provider: 'google',
  contextWindow: 1048576, // 1M tokens
  maxOutputTokens: 8192,
  pricing: {
    inputPer1k: 0.000075,
    outputPer1k: 0.0003,
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
  description: 'Ultra-fast and cost-effective. Ideal for high-volume workloads.',
};

/**
 * Gemini 1.5 Flash - Balanced performance
 *
 * Best for: Production workloads needing good
 * balance of speed and capability.
 */
export const GEMINI_1_5_FLASH: ModelConfig = {
  id: 'gemini-1.5-flash',
  name: 'Gemini 1.5 Flash',
  provider: 'google',
  contextWindow: 1048576, // 1M tokens
  maxOutputTokens: 8192,
  pricing: {
    inputPer1k: 0.000075,
    outputPer1k: 0.0003,
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
  description: 'Fast multimodal model with excellent cost-performance ratio.',
};

/**
 * Gemini 1.5 Flash-8B - Lightweight variant
 *
 * Best for: Simple tasks, classification,
 * and applications requiring minimal cost.
 */
export const GEMINI_1_5_FLASH_8B: ModelConfig = {
  id: 'gemini-1.5-flash-8b',
  name: 'Gemini 1.5 Flash-8B',
  provider: 'google',
  contextWindow: 1048576, // 1M tokens
  maxOutputTokens: 8192,
  pricing: {
    inputPer1k: 0.0000375,
    outputPer1k: 0.00015,
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
  description: 'Lightweight 8B parameter model. Best for simple, high-volume tasks.',
};

/**
 * Gemini 1.5 Pro - High capability model
 *
 * Best for: Complex reasoning, analysis,
 * and tasks requiring highest quality.
 */
export const GEMINI_1_5_PRO: ModelConfig = {
  id: 'gemini-1.5-pro',
  name: 'Gemini 1.5 Pro',
  provider: 'google',
  contextWindow: 2097152, // 2M tokens
  maxOutputTokens: 8192,
  pricing: {
    inputPer1k: 0.00125,
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
  tier: 'quality',
  description: 'Most capable Gemini model with 2M token context. Best for complex tasks.',
};

/**
 * Gemini 2.0 Flash Thinking - Reasoning model
 *
 * Best for: Complex reasoning, math, coding,
 * and tasks requiring step-by-step thinking.
 */
export const GEMINI_2_0_FLASH_THINKING: ModelConfig = {
  id: 'gemini-2.0-flash-thinking-exp',
  name: 'Gemini 2.0 Flash Thinking',
  provider: 'google',
  contextWindow: 1048576, // 1M tokens
  maxOutputTokens: 8192,
  pricing: {
    inputPer1k: 0.0001,
    outputPer1k: 0.0004,
    currency: 'USD',
  },
  capabilities: {
    streaming: true,
    functionCalling: false,
    vision: true,
    jsonMode: true,
    systemMessages: true,
  },
  tier: 'balanced',
  description: 'Experimental reasoning model with explicit thinking. Best for complex reasoning.',
};

/**
 * All available Google models
 */
export const GOOGLE_MODELS: ModelConfig[] = [
  GEMINI_2_0_FLASH,
  GEMINI_2_0_FLASH_LITE,
  GEMINI_1_5_FLASH,
  GEMINI_1_5_FLASH_8B,
  GEMINI_1_5_PRO,
  GEMINI_2_0_FLASH_THINKING,
];

/**
 * Default model for general use
 */
export const DEFAULT_GOOGLE_MODEL = GEMINI_2_0_FLASH;

/**
 * Model recommendations by use case
 */
export const GOOGLE_MODEL_RECOMMENDATIONS: Record<string, ModelConfig> = {
  /** For high-volume, latency-sensitive tasks */
  fast: GEMINI_2_0_FLASH_LITE,

  /** For most production workloads */
  balanced: GEMINI_2_0_FLASH,

  /** For complex tasks requiring highest quality */
  quality: GEMINI_1_5_PRO,

  /** For budget-conscious applications */
  budget: GEMINI_1_5_FLASH_8B,

  /** For coding and technical tasks */
  coding: GEMINI_2_0_FLASH,

  /** For creative writing */
  creative: GEMINI_1_5_PRO,

  /** For analysis and research */
  analysis: GEMINI_1_5_PRO,

  /** For complex reasoning */
  reasoning: GEMINI_2_0_FLASH_THINKING,

  /** For very long context */
  longContext: GEMINI_1_5_PRO,
};

/**
 * Get model configuration by ID
 *
 * @param modelId - The model identifier
 * @returns Model configuration or undefined if not found
 */
export function getGoogleModel(modelId: string): ModelConfig | undefined {
  return GOOGLE_MODELS.find(m => m.id === modelId);
}

/**
 * Get recommended model for a specific use case
 *
 * @param useCase - The use case (fast, balanced, quality, budget, coding, creative, analysis, reasoning, longContext)
 * @returns Recommended model configuration
 */
export function getRecommendedGoogleModel(useCase: string): ModelConfig {
  return GOOGLE_MODEL_RECOMMENDATIONS[useCase] ?? DEFAULT_GOOGLE_MODEL;
}
