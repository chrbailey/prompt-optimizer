/**
 * OpenAI Provider Implementation
 *
 * Provides integration with OpenAI's GPT and o-series models through the official SDK.
 * Supports both streaming and non-streaming completions with full error handling.
 *
 * @module providers/openai
 */

import OpenAI from 'openai';
import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionMessageParam,
} from 'openai/resources/chat/completions';

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
  OPENAI_MODELS,
  DEFAULT_OPENAI_MODEL,
  getOpenAIModel,
} from './models.js';

/**
 * OpenAI-specific configuration options
 */
export interface OpenAIProviderConfig extends ProviderConfig {
  /** Organization ID for API requests */
  organization?: string;
  /** Project ID for API requests */
  project?: string;
}

/**
 * OpenAI GPT provider implementation
 *
 * @example
 * ```typescript
 * const provider = new OpenAIProvider({
 *   apiKey: process.env.OPENAI_API_KEY!,
 * });
 *
 * const response = await provider.complete({
 *   model: 'gpt-4o',
 *   messages: [{ role: 'user', content: 'Hello!' }],
 * });
 * ```
 */
export class OpenAIProvider extends BaseLLMProvider {
  /** OpenAI SDK client */
  private readonly client: OpenAI;

  /** Provider-specific configuration */
  private readonly openaiConfig: OpenAIProviderConfig;

  constructor(config: OpenAIProviderConfig) {
    super('openai', config);
    this.openaiConfig = config;

    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: config.timeout ?? 60000,
      maxRetries: config.maxRetries ?? 2,
      organization: config.organization,
      project: config.project,
    });
  }

  /**
   * Get all available OpenAI models
   */
  get models(): ModelConfig[] {
    return OPENAI_MODELS;
  }

  /**
   * Get OpenAI provider capabilities
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
   * Execute a completion request using GPT
   *
   * @param request - The completion request
   * @returns Promise resolving to completion response
   */
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const modelId = request.model ?? this.config.defaultModel ?? DEFAULT_OPENAI_MODEL.id;
    const model = getOpenAIModel(modelId);

    if (!model) {
      throw new ProviderError(
        `Model '${modelId}' not found in OpenAI provider`,
        this.name,
        'MODEL_NOT_FOUND'
      );
    }

    try {
      const openaiMessages = this.convertMessages(request.messages, model);

      const startTime = Date.now();

      const response = await this.client.chat.completions.create({
        model: modelId,
        messages: openaiMessages,
        max_completion_tokens: request.maxTokens ?? model.maxOutputTokens,
        temperature: this.isReasoningModel(modelId) ? undefined : request.temperature,
        top_p: this.isReasoningModel(modelId) ? undefined : request.topP,
        stop: request.stopSequences,
        response_format: request.jsonMode ? { type: 'json_object' } : undefined,
      });

      const latencyMs = Date.now() - startTime;

      return this.convertResponse(response, model, latencyMs);
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
    const modelId = request.model ?? this.config.defaultModel ?? DEFAULT_OPENAI_MODEL.id;
    const model = getOpenAIModel(modelId);

    if (!model) {
      throw new ProviderError(
        `Model '${modelId}' not found in OpenAI provider`,
        this.name,
        'MODEL_NOT_FOUND'
      );
    }

    try {
      const openaiMessages = this.convertMessages(request.messages, model);

      const startTime = Date.now();

      const stream = await this.client.chat.completions.create({
        model: modelId,
        messages: openaiMessages,
        max_completion_tokens: request.maxTokens ?? model.maxOutputTokens,
        temperature: this.isReasoningModel(modelId) ? undefined : request.temperature,
        top_p: this.isReasoningModel(modelId) ? undefined : request.topP,
        stop: request.stopSequences,
        response_format: request.jsonMode ? { type: 'json_object' } : undefined,
        stream: true,
        stream_options: { include_usage: true },
      });

      let accumulatedContent = '';
      let inputTokens = 0;
      let outputTokens = 0;
      let finishReason: CompletionResponse['finishReason'] = null;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        const chunkFinishReason = chunk.choices[0]?.finish_reason;

        if (delta?.content) {
          accumulatedContent += delta.content;

          yield {
            id: chunk.id,
            provider: this.name,
            model: modelId,
            content: delta.content,
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

        if (chunkFinishReason) {
          finishReason = this.convertFinishReason(chunkFinishReason);
        }

        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens;
          outputTokens = chunk.usage.completion_tokens;
        }
      }

      // Yield final response with complete usage stats
      const latencyMs = Date.now() - startTime;
      const cost = this.calculateCost(model, inputTokens, outputTokens);

      yield {
        id: `stream-final-${Date.now()}`,
        provider: this.name,
        model: modelId,
        content: accumulatedContent,
        finishReason,
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
    const modelId = request.model ?? DEFAULT_OPENAI_MODEL.id;
    const model = getOpenAIModel(modelId) ?? DEFAULT_OPENAI_MODEL;

    // Estimate input tokens from messages
    const inputText = request.messages
      .map(m => (typeof m.content === 'string' ? m.content : ''))
      .join('\n');
    const estimatedInputTokens = this.estimateTokens(inputText);

    // Estimate output tokens (use maxTokens or a reasonable default)
    const estimatedOutputTokens = request.maxTokens ?? Math.min(1000, model.maxOutputTokens);

    const inputCost = (estimatedInputTokens / 1000) * model.pricing.inputPer1k;
    const outputCost = (estimatedOutputTokens / 1000) * model.pricing.outputPer1k;

    return {
      estimatedInputTokens,
      estimatedOutputTokens,
      estimatedTotalTokens: estimatedInputTokens + estimatedOutputTokens,
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      currency: model.pricing.currency,
      model: modelId,
      provider: this.name,
      confidence: 'medium',
    };
  }

  /**
   * Validate the OpenAI API key
   *
   * @returns Promise resolving to true if valid
   */
  async validateApiKey(): Promise<boolean> {
    try {
      // List models to validate the key
      await this.client.models.list();
      return true;
    } catch (error) {
      if (error instanceof OpenAI.AuthenticationError) {
        return false;
      }
      // Other errors might indicate rate limiting or server issues,
      // but the key itself could still be valid
      return true;
    }
  }

  /**
   * Check OpenAI API health status
   *
   * @returns Promise resolving to health status
   */
  async checkHealth(): Promise<ProviderHealth> {
    const startTime = Date.now();

    try {
      await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        max_completion_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      });

      return {
        available: true,
        latencyMs: Date.now() - startTime,
        status: 'operational',
        lastChecked: new Date(),
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      if (error instanceof OpenAI.RateLimitError) {
        return {
          available: true,
          latencyMs,
          status: 'degraded',
          lastChecked: new Date(),
          error: 'Rate limited',
        };
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
   * Estimate tokens using OpenAI's tokenization rules
   *
   * @param text - Text to estimate tokens for
   * @returns Estimated token count
   */
  estimateTokens(text: string): number {
    // GPT tokenization is roughly ~4 characters per token for English
    // For more accurate counting, consider using tiktoken
    return Math.ceil(text.length / 4);
  }

  /**
   * Check if a model is a reasoning model (o1, o3 series)
   */
  private isReasoningModel(modelId: string): boolean {
    return modelId.startsWith('o1') || modelId.startsWith('o3');
  }

  /**
   * Convert our message format to OpenAI's format
   */
  private convertMessages(
    messages: ConversationMessage[],
    model: ModelConfig
  ): ChatCompletionMessageParam[] {
    // o1/o3 models don't support system messages, convert to user message
    if (!model.capabilities.systemMessages) {
      return messages.map(m => {
        if (m.role === 'system') {
          return {
            role: 'user' as const,
            content: `[System instruction]: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`,
          };
        }
        return {
          role: m.role as 'user' | 'assistant',
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        };
      });
    }

    return messages.map(m => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    }));
  }

  /**
   * Convert OpenAI response to our format
   */
  private convertResponse(
    response: ChatCompletion,
    model: ModelConfig,
    latencyMs: number
  ): CompletionResponse {
    const choice = response.choices[0];
    const content = choice?.message?.content ?? '';

    const usage = {
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
      totalTokens: response.usage?.total_tokens ?? 0,
    };

    const cost = this.calculateCost(
      model,
      usage.inputTokens,
      usage.outputTokens
    );

    return {
      id: response.id,
      provider: this.name,
      model: response.model,
      content,
      finishReason: this.convertFinishReason(choice?.finish_reason ?? null),
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
    model: ModelConfig,
    inputTokens: number,
    outputTokens: number
  ): CompletionResponse['cost'] {
    const inputCost = (inputTokens / 1000) * model.pricing.inputPer1k;
    const outputCost = (outputTokens / 1000) * model.pricing.outputPer1k;

    return {
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      currency: model.pricing.currency,
    };
  }

  /**
   * Convert OpenAI finish reason to our format
   */
  private convertFinishReason(
    reason: string | null
  ): CompletionResponse['finishReason'] {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'content_filter':
        return 'content_filter';
      case 'tool_calls':
      case 'function_call':
        return 'tool_calls';
      default:
        return null;
    }
  }

  /**
   * Handle and convert OpenAI errors
   */
  private handleError(error: unknown): ProviderError {
    if (error instanceof OpenAI.AuthenticationError) {
      return new ProviderError(
        'Invalid API key or authentication failed',
        this.name,
        'AUTHENTICATION_ERROR',
        { statusCode: 401, retryable: false, cause: error }
      );
    }

    if (error instanceof OpenAI.RateLimitError) {
      return new ProviderError(
        'Rate limit exceeded. Please retry after a delay.',
        this.name,
        'RATE_LIMIT_ERROR',
        { statusCode: 429, retryable: true, cause: error }
      );
    }

    if (error instanceof OpenAI.BadRequestError) {
      const message = error.message;
      if (message.includes('context_length') || message.includes('maximum context length')) {
        return new ProviderError(
          'Input exceeds model context window',
          this.name,
          'CONTEXT_LENGTH_EXCEEDED',
          { statusCode: 400, retryable: false, cause: error }
        );
      }
      if (message.includes('content_policy') || message.includes('content_filter')) {
        return new ProviderError(
          'Content was filtered by safety systems',
          this.name,
          'CONTENT_FILTER',
          { statusCode: 400, retryable: false, cause: error }
        );
      }
      return new ProviderError(
        `Invalid request: ${message}`,
        this.name,
        'INVALID_REQUEST',
        { statusCode: 400, retryable: false, cause: error }
      );
    }

    if (error instanceof OpenAI.NotFoundError) {
      return new ProviderError(
        'Model not found or not accessible',
        this.name,
        'MODEL_NOT_FOUND',
        { statusCode: 404, retryable: false, cause: error }
      );
    }

    if (error instanceof OpenAI.InternalServerError) {
      return new ProviderError(
        'OpenAI server error. Please retry.',
        this.name,
        'SERVER_ERROR',
        { statusCode: 500, retryable: true, cause: error }
      );
    }

    if (error instanceof OpenAI.APIConnectionError) {
      return new ProviderError(
        'Failed to connect to OpenAI API',
        this.name,
        'NETWORK_ERROR',
        { retryable: true, cause: error }
      );
    }

    if (error instanceof OpenAI.APIError) {
      return new ProviderError(
        error.message,
        this.name,
        'UNKNOWN',
        { statusCode: error.status, retryable: false, cause: error }
      );
    }

    if (error instanceof Error) {
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
