/**
 * Google Gemini Provider Implementation
 *
 * Provides integration with Google's Gemini models through the official SDK.
 * Supports both streaming and non-streaming completions with full error handling.
 *
 * @module providers/google
 */

import {
  GoogleGenerativeAI,
  GenerativeModel,
  GenerateContentResult,
  Content,
  Part,
  HarmCategory,
  HarmBlockThreshold,
} from '@google/generative-ai';

import {
  BaseLLMProvider,
  ProviderError,
  ProviderCapabilities,
  ProviderConfig,
  ProviderHealth,
} from '../base-provider.js';
import type {
  ModelConfig,
  CompletionRequest,
  CompletionResponse,
  CostEstimate,
  Message as ConversationMessage,
} from '../../types/index.js';
import {
  GOOGLE_MODELS,
  DEFAULT_GOOGLE_MODEL,
  getGoogleModel,
} from './models.js';

/**
 * Google-specific configuration options
 */
export interface GoogleProviderConfig extends ProviderConfig {
  /** Safety settings threshold */
  safetyThreshold?: HarmBlockThreshold;
}

/**
 * Google Gemini provider implementation
 *
 * @example
 * ```typescript
 * const provider = new GoogleProvider({
 *   apiKey: process.env.GOOGLE_API_KEY!,
 * });
 *
 * const response = await provider.complete({
 *   model: 'gemini-2.0-flash',
 *   messages: [{ role: 'user', content: 'Hello!' }],
 * });
 * ```
 */
export class GoogleProvider extends BaseLLMProvider {
  /** Google Generative AI client */
  private readonly client: GoogleGenerativeAI;

  /** Provider-specific configuration */
  private readonly googleConfig: GoogleProviderConfig;

  /** Cached model instances */
  private readonly modelInstances: Map<string, GenerativeModel> = new Map();

  constructor(config: GoogleProviderConfig) {
    super('google', config);
    this.googleConfig = config;

    this.client = new GoogleGenerativeAI(config.apiKey);
  }

  /**
   * Get all available Gemini models
   */
  get models(): ModelConfig[] {
    return GOOGLE_MODELS;
  }

  /**
   * Get Google provider capabilities
   */
  get capabilities(): ProviderCapabilities {
    return {
      streaming: true,
      functionCalling: true,
      vision: true,
      jsonMode: true,
      systemMessages: true,
    };
  }

  /**
   * Get or create a GenerativeModel instance
   */
  private getModelInstance(modelId: string): GenerativeModel {
    if (!this.modelInstances.has(modelId)) {
      const safetySettings = [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: this.googleConfig.safetyThreshold ?? HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: this.googleConfig.safetyThreshold ?? HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: this.googleConfig.safetyThreshold ?? HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: this.googleConfig.safetyThreshold ?? HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ];

      const model = this.client.getGenerativeModel({
        model: modelId,
        safetySettings,
      });

      this.modelInstances.set(modelId, model);
    }

    return this.modelInstances.get(modelId)!;
  }

  /**
   * Execute a completion request using Gemini
   *
   * @param request - The completion request
   * @returns Promise resolving to completion response
   */
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const modelId = request.model ?? this.config.defaultModel ?? DEFAULT_GOOGLE_MODEL.id;
    const modelConfig = getGoogleModel(modelId);

    if (!modelConfig) {
      throw new ProviderError(
        `Model '${modelId}' not found in Google provider`,
        this.name,
        'MODEL_NOT_FOUND'
      );
    }

    try {
      const model = this.getModelInstance(modelId);
      const { contents, systemInstruction } = this.convertMessages(request.messages);

      const startTime = Date.now();

      const generationConfig = {
        maxOutputTokens: request.maxTokens ?? modelConfig.maxOutputTokens,
        temperature: request.temperature,
        topP: request.topP,
        stopSequences: request.stopSequences,
        responseMimeType: request.jsonMode ? 'application/json' : undefined,
      };

      const result = await model.generateContent({
        contents,
        systemInstruction: systemInstruction ? { role: 'system', parts: [{ text: systemInstruction }] } : undefined,
        generationConfig,
      });

      const latencyMs = Date.now() - startTime;

      return this.convertResponse(result, modelId, modelConfig, latencyMs);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Execute a streaming completion request
   *
   * @param request - The completion request
   * @yields Completion response chunks
   */
  async *completeStream(
    request: CompletionRequest
  ): AsyncIterable<CompletionResponse> {
    const modelId = request.model ?? this.config.defaultModel ?? DEFAULT_GOOGLE_MODEL.id;
    const modelConfig = getGoogleModel(modelId);

    if (!modelConfig) {
      throw new ProviderError(
        `Model '${modelId}' not found in Google provider`,
        this.name,
        'MODEL_NOT_FOUND'
      );
    }

    try {
      const model = this.getModelInstance(modelId);
      const { contents, systemInstruction } = this.convertMessages(request.messages);

      const startTime = Date.now();

      const generationConfig = {
        maxOutputTokens: request.maxTokens ?? modelConfig.maxOutputTokens,
        temperature: request.temperature,
        topP: request.topP,
        stopSequences: request.stopSequences,
        responseMimeType: request.jsonMode ? 'application/json' : undefined,
      };

      const result = await model.generateContentStream({
        contents,
        systemInstruction: systemInstruction ? { role: 'system', parts: [{ text: systemInstruction }] } : undefined,
        generationConfig,
      });

      let accumulatedContent = '';
      let inputTokens = 0;
      let outputTokens = 0;

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          accumulatedContent += text;

          yield {
            id: `stream-${Date.now()}`,
            provider: this.name,
            model: modelId,
            content: text,
            finishReason: null,
            usage: {
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
            },
            cost: {
              inputCost: 0,
              outputCost: 0,
              totalCost: 0,
              currency: 'USD',
            },
            latencyMs: Date.now() - startTime,
            streaming: true,
          };
        }

        // Get usage metadata if available
        if (chunk.usageMetadata) {
          inputTokens = chunk.usageMetadata.promptTokenCount ?? 0;
          outputTokens = chunk.usageMetadata.candidatesTokenCount ?? 0;
        }
      }

      // Yield final response with complete usage stats
      const latencyMs = Date.now() - startTime;
      const cost = this.calculateCost(modelConfig, inputTokens, outputTokens);

      yield {
        id: `stream-final-${Date.now()}`,
        provider: this.name,
        model: modelId,
        content: accumulatedContent,
        finishReason: 'stop',
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
        cost,
        latencyMs,
        streaming: false,
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Estimate the cost of a completion request
   *
   * @param request - The request to estimate
   * @returns Cost estimate with breakdown
   */
  estimateCost(request: CompletionRequest): CostEstimate {
    const modelId = request.model ?? DEFAULT_GOOGLE_MODEL.id;
    const modelConfig = getGoogleModel(modelId) ?? DEFAULT_GOOGLE_MODEL;

    // Estimate input tokens from messages
    const inputText = request.messages
      .map(m => (typeof m.content === 'string' ? m.content : ''))
      .join('\n');
    const estimatedInputTokens = this.estimateTokens(inputText);

    // Estimate output tokens (use maxTokens or a reasonable default)
    const estimatedOutputTokens = request.maxTokens ?? Math.min(1000, modelConfig.maxOutputTokens);

    const inputCost = (estimatedInputTokens / 1000) * modelConfig.pricing.inputPer1k;
    const outputCost = (estimatedOutputTokens / 1000) * modelConfig.pricing.outputPer1k;

    return {
      estimatedInputTokens,
      estimatedOutputTokens,
      estimatedTotalTokens: estimatedInputTokens + estimatedOutputTokens,
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      currency: modelConfig.pricing.currency,
      model: modelId,
      provider: this.name,
      confidence: 'medium',
    };
  }

  /**
   * Validate the Google API key
   *
   * @returns Promise resolving to true if valid
   */
  async validateApiKey(): Promise<boolean> {
    try {
      const model = this.getModelInstance('gemini-1.5-flash-8b');
      await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
        generationConfig: { maxOutputTokens: 1 },
      });
      return true;
    } catch (error) {
      // Check for authentication errors
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        if (message.includes('api key') || message.includes('authentication') || message.includes('401')) {
          return false;
        }
      }
      // Other errors might indicate rate limiting or server issues,
      // but the key itself could still be valid
      return true;
    }
  }

  /**
   * Check Google API health status
   *
   * @returns Promise resolving to health status
   */
  async checkHealth(): Promise<ProviderHealth> {
    const startTime = Date.now();

    try {
      const model = this.getModelInstance('gemini-1.5-flash-8b');
      await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
        generationConfig: { maxOutputTokens: 1 },
      });

      return {
        available: true,
        latencyMs: Date.now() - startTime,
        status: 'operational',
        lastChecked: new Date(),
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        if (message.includes('rate') || message.includes('quota')) {
          return {
            available: true,
            latencyMs,
            status: 'degraded',
            lastChecked: new Date(),
            error: 'Rate limited or quota exceeded',
          };
        }
      }

      return {
        available: false,
        latencyMs,
        status: 'outage',
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Estimate tokens using Gemini's tokenization rules
   *
   * @param text - Text to estimate tokens for
   * @returns Estimated token count
   */
  estimateTokens(text: string): number {
    // Gemini tokenization is roughly ~4 characters per token for English
    // For more accurate counting, use the countTokens API
    return Math.ceil(text.length / 4);
  }

  /**
   * Convert our message format to Gemini's format
   */
  private convertMessages(
    messages: ConversationMessage[]
  ): { contents: Content[]; systemInstruction?: string } {
    let systemInstruction: string | undefined;

    // Extract system message
    const systemMsg = messages.find(m => m.role === 'system');
    if (systemMsg) {
      systemInstruction = typeof systemMsg.content === 'string'
        ? systemMsg.content
        : JSON.stringify(systemMsg.content);
    }

    // Convert remaining messages
    const contents: Content[] = messages
      .filter(m => m.role !== 'system')
      .map(m => {
        const parts: Part[] = [];

        if (typeof m.content === 'string') {
          parts.push({ text: m.content });
        } else {
          parts.push({ text: JSON.stringify(m.content) });
        }

        return {
          role: m.role === 'assistant' ? 'model' : 'user',
          parts,
        };
      });

    return { contents, systemInstruction };
  }

  /**
   * Convert Gemini response to our format
   */
  private convertResponse(
    result: GenerateContentResult,
    modelId: string,
    modelConfig: ModelConfig,
    latencyMs: number
  ): CompletionResponse {
    const response = result.response;
    const text = response.text();

    const usageMetadata = response.usageMetadata;
    const inputTokens = usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = usageMetadata?.candidatesTokenCount ?? 0;

    const usage = {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    };

    const cost = this.calculateCost(modelConfig, inputTokens, outputTokens);

    // Determine finish reason
    const candidate = response.candidates?.[0];
    const finishReason = this.convertFinishReason(candidate?.finishReason);

    return {
      id: `gemini-${Date.now()}`,
      provider: this.name,
      model: modelId,
      content: text,
      finishReason,
      usage,
      cost,
      latencyMs,
      streaming: false,
    };
  }

  /**
   * Calculate actual cost from token counts
   */
  private calculateCost(
    modelConfig: ModelConfig,
    inputTokens: number,
    outputTokens: number
  ): CompletionResponse['cost'] {
    const inputCost = (inputTokens / 1000) * modelConfig.pricing.inputPer1k;
    const outputCost = (outputTokens / 1000) * modelConfig.pricing.outputPer1k;

    return {
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      currency: modelConfig.pricing.currency,
    };
  }

  /**
   * Convert Gemini finish reason to our format
   */
  private convertFinishReason(
    reason: string | undefined
  ): CompletionResponse['finishReason'] {
    switch (reason) {
      case 'STOP':
        return 'stop';
      case 'MAX_TOKENS':
        return 'length';
      case 'SAFETY':
        return 'content_filter';
      case 'RECITATION':
        return 'content_filter';
      default:
        return null;
    }
  }

  /**
   * Handle and convert Google API errors
   */
  private handleError(error: unknown): ProviderError {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Authentication errors
      if (message.includes('api key') || message.includes('authentication') || message.includes('401')) {
        return new ProviderError(
          'Invalid API key or authentication failed',
          this.name,
          'AUTHENTICATION_ERROR',
          { statusCode: 401, retryable: false, cause: error }
        );
      }

      // Rate limiting
      if (message.includes('rate') || message.includes('quota') || message.includes('429')) {
        return new ProviderError(
          'Rate limit or quota exceeded. Please retry after a delay.',
          this.name,
          'RATE_LIMIT_ERROR',
          { statusCode: 429, retryable: true, cause: error }
        );
      }

      // Context length
      if (message.includes('token') && (message.includes('limit') || message.includes('exceed'))) {
        return new ProviderError(
          'Input exceeds model context window',
          this.name,
          'CONTEXT_LENGTH_EXCEEDED',
          { statusCode: 400, retryable: false, cause: error }
        );
      }

      // Safety/content filter
      if (message.includes('safety') || message.includes('blocked')) {
        return new ProviderError(
          'Content was blocked by safety filters',
          this.name,
          'CONTENT_FILTER',
          { statusCode: 400, retryable: false, cause: error }
        );
      }

      // Model not found
      if (message.includes('not found') || message.includes('404')) {
        return new ProviderError(
          'Model not found or not accessible',
          this.name,
          'MODEL_NOT_FOUND',
          { statusCode: 404, retryable: false, cause: error }
        );
      }

      // Server errors
      if (message.includes('500') || message.includes('internal')) {
        return new ProviderError(
          'Google server error. Please retry.',
          this.name,
          'SERVER_ERROR',
          { statusCode: 500, retryable: true, cause: error }
        );
      }

      // Network errors
      if (message.includes('network') || message.includes('connection') || message.includes('timeout')) {
        return new ProviderError(
          'Failed to connect to Google API',
          this.name,
          'NETWORK_ERROR',
          { retryable: true, cause: error }
        );
      }

      return new ProviderError(
        error.message,
        this.name,
        'UNKNOWN',
        { retryable: false, cause: error }
      );
    }

    return new ProviderError(
      'An unknown error occurred',
      this.name,
      'UNKNOWN',
      { retryable: false }
    );
  }
}

// Re-export models for convenience
export * from './models.js';
