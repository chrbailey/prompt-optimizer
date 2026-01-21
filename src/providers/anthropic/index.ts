/**
 * Anthropic Provider Implementation
 *
 * Provides integration with Anthropic's Claude models through the official SDK.
 * Supports both streaming and non-streaming completions with full error handling.
 *
 * @module providers/anthropic
 */

import Anthropic from '@anthropic-ai/sdk';
import type { Message, MessageStream } from '@anthropic-ai/sdk/resources/messages';

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
  ANTHROPIC_MODELS,
  DEFAULT_ANTHROPIC_MODEL,
  getAnthropicModel,
} from './models.js';

/**
 * Anthropic-specific configuration options
 */
export interface AnthropicProviderConfig extends ProviderConfig {
  /** API version to use (default: latest) */
  apiVersion?: string;
  /** Enable beta features */
  enableBeta?: boolean;
}

/**
 * Anthropic Claude provider implementation
 *
 * @example
 * ```typescript
 * const provider = new AnthropicProvider({
 *   apiKey: process.env.ANTHROPIC_API_KEY!,
 * });
 *
 * const response = await provider.complete({
 *   model: 'claude-3-5-sonnet-20241022',
 *   messages: [{ role: 'user', content: 'Hello!' }],
 * });
 * ```
 */
export class AnthropicProvider extends BaseLLMProvider {
  /** Anthropic SDK client */
  private readonly client: Anthropic;

  /** Provider-specific configuration */
  private readonly anthropicConfig: AnthropicProviderConfig;

  constructor(config: AnthropicProviderConfig) {
    super('anthropic', config);
    this.anthropicConfig = config;

    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: config.timeout ?? 60000,
      maxRetries: config.maxRetries ?? 2,
    });
  }

  /**
   * Get all available Claude models
   */
  get models(): ModelConfig[] {
    return ANTHROPIC_MODELS;
  }

  /**
   * Get Anthropic provider capabilities
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
   * Execute a completion request using Claude
   *
   * @param request - The completion request
   * @returns Promise resolving to completion response
   */
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const modelId = request.model ?? this.config.defaultModel ?? DEFAULT_ANTHROPIC_MODEL.id;
    const model = getAnthropicModel(modelId);

    if (!model) {
      throw new ProviderError(
        `Model '${modelId}' not found in Anthropic provider`,
        this.name,
        'MODEL_NOT_FOUND'
      );
    }

    try {
      const anthropicMessages = this.convertMessages(request.messages);
      const systemMessage = this.extractSystemMessage(request.messages);

      const startTime = Date.now();

      const response = await this.client.messages.create({
        model: modelId,
        max_tokens: request.maxTokens ?? model.maxOutputTokens,
        messages: anthropicMessages,
        system: systemMessage,
        temperature: request.temperature,
        top_p: request.topP,
        stop_sequences: request.stopSequences,
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
    const modelId = request.model ?? this.config.defaultModel ?? DEFAULT_ANTHROPIC_MODEL.id;
    const model = getAnthropicModel(modelId);

    if (!model) {
      throw new ProviderError(
        `Model '${modelId}' not found in Anthropic provider`,
        this.name,
        'MODEL_NOT_FOUND'
      );
    }

    try {
      const anthropicMessages = this.convertMessages(request.messages);
      const systemMessage = this.extractSystemMessage(request.messages);

      const startTime = Date.now();

      const stream = await this.client.messages.stream({
        model: modelId,
        max_tokens: request.maxTokens ?? model.maxOutputTokens,
        messages: anthropicMessages,
        system: systemMessage,
        temperature: request.temperature,
        top_p: request.topP,
        stop_sequences: request.stopSequences,
      });

      let accumulatedContent = '';
      let inputTokens = 0;
      let outputTokens = 0;

      for await (const event of stream) {
        if (event.type === 'message_start') {
          inputTokens = event.message.usage?.input_tokens ?? 0;
        } else if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            accumulatedContent += event.delta.text;

            yield {
              id: `stream-${Date.now()}`,
              provider: this.name,
              model: modelId,
              content: event.delta.text,
              finishReason: null,
              usage: {
                inputTokens,
                outputTokens: 0,
                totalTokens: inputTokens,
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
        } else if (event.type === 'message_delta') {
          outputTokens = event.usage?.output_tokens ?? 0;
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
    const modelId = request.model ?? DEFAULT_ANTHROPIC_MODEL.id;
    const model = getAnthropicModel(modelId) ?? DEFAULT_ANTHROPIC_MODEL;

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
   * Validate the Anthropic API key
   *
   * @returns Promise resolving to true if valid
   */
  async validateApiKey(): Promise<boolean> {
    try {
      // Make a minimal API call to validate the key
      await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Hi' }],
      });
      return true;
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError) {
        return false;
      }
      // Other errors might indicate rate limiting or server issues,
      // but the key itself could still be valid
      return true;
    }
  }

  /**
   * Check Anthropic API health status
   *
   * @returns Promise resolving to health status
   */
  async checkHealth(): Promise<ProviderHealth> {
    const startTime = Date.now();

    try {
      await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
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

      if (error instanceof Anthropic.RateLimitError) {
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
   * Estimate tokens using Claude's tokenization rules
   * Claude uses a similar tokenization to GPT models
   *
   * @param text - Text to estimate tokens for
   * @returns Estimated token count
   */
  estimateTokens(text: string): number {
    // Claude tokenization is roughly ~4 characters per token for English
    // This is a rough estimate; for precise counting, use the API
    return Math.ceil(text.length / 4);
  }

  /**
   * Convert our message format to Anthropic's format
   */
  private convertMessages(
    messages: ConversationMessage[]
  ): Anthropic.MessageParam[] {
    return messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      }));
  }

  /**
   * Extract system message from conversation
   */
  private extractSystemMessage(messages: ConversationMessage[]): string | undefined {
    const systemMsg = messages.find(m => m.role === 'system');
    if (!systemMsg) return undefined;
    return typeof systemMsg.content === 'string'
      ? systemMsg.content
      : JSON.stringify(systemMsg.content);
  }

  /**
   * Convert Anthropic response to our format
   */
  private convertResponse(
    response: Message,
    model: ModelConfig,
    latencyMs: number
  ): CompletionResponse {
    const content = response.content
      .filter(block => block.type === 'text')
      .map(block => (block as { type: 'text'; text: string }).text)
      .join('');

    const usage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      totalTokens: response.usage.input_tokens + response.usage.output_tokens,
    };

    const cost = this.calculateCost(
      model,
      response.usage.input_tokens,
      response.usage.output_tokens
    );

    return {
      id: response.id,
      provider: this.name,
      model: response.model,
      content,
      finishReason: this.convertStopReason(response.stop_reason),
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
   * Convert Anthropic stop reason to our format
   */
  private convertStopReason(
    reason: string | null
  ): CompletionResponse['finishReason'] {
    switch (reason) {
      case 'end_turn':
        return 'stop';
      case 'max_tokens':
        return 'length';
      case 'stop_sequence':
        return 'stop';
      default:
        return null;
    }
  }

  /**
   * Handle and convert Anthropic errors
   */
  private handleError(error: unknown): ProviderError {
    if (error instanceof Anthropic.AuthenticationError) {
      return new ProviderError(
        'Invalid API key or authentication failed',
        this.name,
        'AUTHENTICATION_ERROR',
        { statusCode: 401, retryable: false, cause: error }
      );
    }

    if (error instanceof Anthropic.RateLimitError) {
      return new ProviderError(
        'Rate limit exceeded. Please retry after a delay.',
        this.name,
        'RATE_LIMIT_ERROR',
        { statusCode: 429, retryable: true, cause: error }
      );
    }

    if (error instanceof Anthropic.BadRequestError) {
      const message = error.message;
      if (message.includes('context_length') || message.includes('too long')) {
        return new ProviderError(
          'Input exceeds model context window',
          this.name,
          'CONTEXT_LENGTH_EXCEEDED',
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

    if (error instanceof Anthropic.InternalServerError) {
      return new ProviderError(
        'Anthropic server error. Please retry.',
        this.name,
        'SERVER_ERROR',
        { statusCode: 500, retryable: true, cause: error }
      );
    }

    if (error instanceof Anthropic.APIConnectionError) {
      return new ProviderError(
        'Failed to connect to Anthropic API',
        this.name,
        'NETWORK_ERROR',
        { retryable: true, cause: error }
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
