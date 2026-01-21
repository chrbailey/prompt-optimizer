/**
 * Model Adaptation Technique
 *
 * Adapts prompts for specific LLM models based on their unique characteristics,
 * capabilities, and quirks. Inspired by Not Diamond's model routing approach.
 *
 * Key concepts:
 * - Model-specific formatting and style preferences
 * - Token optimization for different context windows
 * - Capability-aware prompt structuring
 * - Provider-specific quirk handling
 *
 * @module core/techniques/model-adaptation
 */

import {
  TechniqueName,
  OptimizationContext,
  PromptVariant,
  ProviderName,
} from '../../types/index.js';

import {
  OptimizationTechnique,
  TechniqueOptions,
  EvaluationResult,
  ScoredVariant,
} from './base-technique.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration specific to model adaptation
 */
export interface ModelAdaptationOptions extends TechniqueOptions {
  /** Target models to adapt for */
  targetModels?: ModelProfile[];
  /** Adaptation strategies to apply */
  adaptationStrategies?: AdaptationStrategy[];
  /** Optimize for cost */
  optimizeForCost?: boolean;
  /** Optimize for latency */
  optimizeForLatency?: boolean;
  /** Optimize for quality */
  optimizeForQuality?: boolean;
}

/**
 * Adaptation strategies
 */
export type AdaptationStrategy =
  | 'format'      // Adjust formatting for model preferences
  | 'tokens'      // Optimize token usage
  | 'style'       // Adapt writing style
  | 'constraints' // Add model-specific constraints
  | 'structure'   // Restructure for model capabilities
  | 'system';     // Optimize system prompt usage

/**
 * Profile of a model's characteristics
 */
export interface ModelProfile {
  /** Model identifier */
  modelId: string;
  /** Provider */
  provider: ProviderName;
  /** Display name */
  displayName: string;
  /** Maximum context window */
  maxContextTokens: number;
  /** Maximum output tokens */
  maxOutputTokens: number;
  /** Supports system prompts */
  supportsSystemPrompt: boolean;
  /** Supports JSON mode */
  supportsJsonMode: boolean;
  /** Preferred prompt style */
  preferredStyle: 'formal' | 'conversational' | 'technical' | 'neutral';
  /** Strengths */
  strengths: string[];
  /** Weaknesses */
  weaknesses: string[];
  /** Cost per 1K input tokens */
  inputCostPer1k: number;
  /** Cost per 1K output tokens */
  outputCostPer1k: number;
  /** Average latency in ms */
  avgLatencyMs: number;
  /** Special formatting requirements */
  formattingNotes?: string[];
  /** Known quirks to work around */
  quirks?: ModelQuirk[];
}

/**
 * A known model quirk to handle
 */
export interface ModelQuirk {
  /** Quirk identifier */
  id: string;
  /** Description of the quirk */
  description: string;
  /** How to work around it */
  workaround: string;
  /** Keywords that trigger this quirk */
  triggers?: string[];
}

/**
 * Adaptation result for a specific model
 */
export interface ModelAdaptation {
  /** Target model */
  model: ModelProfile;
  /** Adapted prompt */
  adaptedPrompt: string;
  /** System prompt (if applicable) */
  systemPrompt?: string;
  /** Estimated tokens */
  estimatedTokens: number;
  /** Estimated cost */
  estimatedCost: number;
  /** Adaptations applied */
  adaptations: string[];
  /** Compatibility score */
  compatibilityScore: number;
}

// =============================================================================
// Model Profiles Database
// =============================================================================

/**
 * Pre-defined model profiles
 */
const MODEL_PROFILES: ModelProfile[] = [
  // Anthropic Models
  {
    modelId: 'claude-opus-4-5-20251101',
    provider: 'anthropic',
    displayName: 'Claude Opus 4.5',
    maxContextTokens: 200000,
    maxOutputTokens: 8192,
    supportsSystemPrompt: true,
    supportsJsonMode: true,
    preferredStyle: 'technical',
    strengths: ['complex reasoning', 'long context', 'code generation', 'nuanced analysis'],
    weaknesses: ['cost', 'latency'],
    inputCostPer1k: 0.015,
    outputCostPer1k: 0.075,
    avgLatencyMs: 3000,
    formattingNotes: [
      'Responds well to structured prompts with clear sections',
      'Excellent at following complex multi-step instructions',
      'Prefers explicit task framing',
    ],
    quirks: [
      {
        id: 'verbose_responses',
        description: 'Can be verbose without explicit length constraints',
        workaround: 'Add "Be concise" or specify word/paragraph limits',
      },
    ],
  },
  {
    modelId: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    displayName: 'Claude Sonnet 4',
    maxContextTokens: 200000,
    maxOutputTokens: 8192,
    supportsSystemPrompt: true,
    supportsJsonMode: true,
    preferredStyle: 'neutral',
    strengths: ['balanced performance', 'good reasoning', 'fast', 'cost-effective'],
    weaknesses: ['very complex tasks'],
    inputCostPer1k: 0.003,
    outputCostPer1k: 0.015,
    avgLatencyMs: 1500,
    formattingNotes: [
      'Good balance of capability and speed',
      'Works well with standard prompt formats',
    ],
  },
  {
    modelId: 'claude-3-5-haiku-20241022',
    provider: 'anthropic',
    displayName: 'Claude 3.5 Haiku',
    maxContextTokens: 200000,
    maxOutputTokens: 4096,
    supportsSystemPrompt: true,
    supportsJsonMode: true,
    preferredStyle: 'conversational',
    strengths: ['speed', 'cost', 'simple tasks'],
    weaknesses: ['complex reasoning', 'nuanced analysis'],
    inputCostPer1k: 0.001,
    outputCostPer1k: 0.005,
    avgLatencyMs: 500,
    formattingNotes: [
      'Keep prompts simple and direct',
      'Best for straightforward tasks',
    ],
  },

  // OpenAI Models
  {
    modelId: 'gpt-4o',
    provider: 'openai',
    displayName: 'GPT-4o',
    maxContextTokens: 128000,
    maxOutputTokens: 4096,
    supportsSystemPrompt: true,
    supportsJsonMode: true,
    preferredStyle: 'neutral',
    strengths: ['multimodal', 'broad knowledge', 'fast', 'coding'],
    weaknesses: ['very long outputs', 'strict formatting'],
    inputCostPer1k: 0.005,
    outputCostPer1k: 0.015,
    avgLatencyMs: 1000,
    formattingNotes: [
      'Works well with role-based prompts',
      'Effective with system message + user message pattern',
      'Good at following JSON schema specifications',
    ],
    quirks: [
      {
        id: 'system_emphasis',
        description: 'System prompt has strong influence on behavior',
        workaround: 'Place critical instructions in system prompt',
      },
    ],
  },
  {
    modelId: 'gpt-4o-mini',
    provider: 'openai',
    displayName: 'GPT-4o Mini',
    maxContextTokens: 128000,
    maxOutputTokens: 4096,
    supportsSystemPrompt: true,
    supportsJsonMode: true,
    preferredStyle: 'conversational',
    strengths: ['speed', 'cost', 'general tasks'],
    weaknesses: ['complex reasoning', 'specialized knowledge'],
    inputCostPer1k: 0.00015,
    outputCostPer1k: 0.0006,
    avgLatencyMs: 400,
    formattingNotes: [
      'Keep instructions clear and simple',
      'Good for high-volume tasks',
    ],
  },
  {
    modelId: 'o1',
    provider: 'openai',
    displayName: 'o1',
    maxContextTokens: 200000,
    maxOutputTokens: 100000,
    supportsSystemPrompt: false,
    supportsJsonMode: false,
    preferredStyle: 'technical',
    strengths: ['reasoning', 'math', 'science', 'complex problems'],
    weaknesses: ['simple tasks', 'cost', 'no system prompt'],
    inputCostPer1k: 0.015,
    outputCostPer1k: 0.06,
    avgLatencyMs: 10000,
    formattingNotes: [
      'Does not support system prompts - include all instructions in user message',
      'Best for problems requiring deep reasoning',
      'Let it think - avoid rushing or constraining its reasoning',
    ],
    quirks: [
      {
        id: 'no_system_prompt',
        description: 'Does not support system prompts',
        workaround: 'Include all context and instructions in the user message',
      },
    ],
  },

  // Google Models
  {
    modelId: 'gemini-2.0-flash',
    provider: 'google',
    displayName: 'Gemini 2.0 Flash',
    maxContextTokens: 1000000,
    maxOutputTokens: 8192,
    supportsSystemPrompt: true,
    supportsJsonMode: true,
    preferredStyle: 'neutral',
    strengths: ['speed', 'long context', 'multimodal', 'grounding'],
    weaknesses: ['some formatting inconsistencies'],
    inputCostPer1k: 0.0001,
    outputCostPer1k: 0.0004,
    avgLatencyMs: 800,
    formattingNotes: [
      'Very large context window',
      'Good for document processing',
      'Can handle multiple modalities',
    ],
  },
  {
    modelId: 'gemini-1.5-pro',
    provider: 'google',
    displayName: 'Gemini 1.5 Pro',
    maxContextTokens: 2000000,
    maxOutputTokens: 8192,
    supportsSystemPrompt: true,
    supportsJsonMode: true,
    preferredStyle: 'formal',
    strengths: ['huge context', 'multimodal', 'analysis'],
    weaknesses: ['cost for large contexts', 'latency'],
    inputCostPer1k: 0.00125,
    outputCostPer1k: 0.005,
    avgLatencyMs: 2000,
    formattingNotes: [
      'Best for very long document analysis',
      'Excellent at maintaining context',
    ],
  },
];

// =============================================================================
// Implementation
// =============================================================================

/**
 * Model Adaptation Technique
 *
 * Adapts prompts to work optimally with specific LLM models,
 * accounting for their unique characteristics and capabilities.
 *
 * @example
 * ```typescript
 * const technique = new ModelAdaptationTechnique({
 *   targetModels: [{ modelId: 'gpt-4o', ... }],
 *   adaptationStrategies: ['format', 'style', 'tokens'],
 *   optimizeForCost: true
 * });
 *
 * const variants = await technique.apply(prompt, context);
 * ```
 */
export class ModelAdaptationTechnique extends OptimizationTechnique {
  // ===========================================================================
  // Properties
  // ===========================================================================

  readonly name: TechniqueName = 'decomposition'; // Maps to decomposition for model-specific breakdown
  readonly priority: number = 7;
  readonly description: string =
    'Adapt prompts for specific model characteristics and capabilities';

  private adaptOptions: ModelAdaptationOptions;
  private modelProfiles: Map<string, ModelProfile>;

  // ===========================================================================
  // Constructor
  // ===========================================================================

  constructor(options: ModelAdaptationOptions = {}) {
    super(options);
    this.adaptOptions = {
      adaptationStrategies: ['format', 'style', 'tokens', 'constraints'],
      optimizeForCost: false,
      optimizeForLatency: false,
      optimizeForQuality: true,
      ...options,
    };

    // Initialize model profiles
    this.modelProfiles = new Map();
    for (const profile of MODEL_PROFILES) {
      this.modelProfiles.set(profile.modelId, profile);
    }

    // Add custom profiles if provided
    if (options.targetModels) {
      for (const profile of options.targetModels) {
        this.modelProfiles.set(profile.modelId, profile);
      }
    }
  }

  // ===========================================================================
  // Public Methods
  // ===========================================================================

  /**
   * Apply model adaptation to generate model-specific variants.
   */
  async apply(
    prompt: string,
    context: OptimizationContext
  ): Promise<PromptVariant[]> {
    const variants: PromptVariant[] = [];

    // Determine target models
    const targetModels = this.determineTargetModels(prompt, context);

    // Generate adaptation for each target model
    for (const model of targetModels) {
      const adaptation = await this.adaptForModel(prompt, model, context);

      variants.push(
        this.createVariant(
          adaptation.adaptedPrompt,
          adaptation.compatibilityScore,
          adaptation.model.modelId
        )
      );
    }

    // Generate a "universal" variant that works reasonably across models
    const universalVariant = await this.generateUniversalVariant(
      prompt,
      targetModels,
      context
    );
    variants.push(this.createVariant(universalVariant.prompt, universalVariant.score));

    return variants.sort((a, b) => b.score - a.score);
  }

  /**
   * Evaluate model-adapted variants.
   */
  async evaluate(variants: PromptVariant[]): Promise<EvaluationResult> {
    const scoredVariants: ScoredVariant[] = [];
    const startTime = Date.now();

    for (const variant of variants) {
      const profile = this.modelProfiles.get(variant.model);
      const scores = this.scoreAdaptation(variant, profile);

      scoredVariants.push({
        ...variant,
        scores,
        feedback: this.generateAdaptationFeedback(variant, profile, scores),
      });
    }

    scoredVariants.sort((a, b) => b.scores.overall - a.scores.overall);

    const best = scoredVariants[0];
    const avgScore =
      scoredVariants.reduce((sum, v) => sum + v.scores.overall, 0) /
      scoredVariants.length;

    const variance =
      scoredVariants.reduce(
        (sum, v) => sum + Math.pow(v.scores.overall - avgScore, 2),
        0
      ) / scoredVariants.length;

    return {
      variants: scoredVariants,
      best,
      metrics: {
        variantsEvaluated: scoredVariants.length,
        averageScore: avgScore,
        scoreVariance: variance,
        improvementOverOriginal: 15, // Estimated improvement from adaptation
        evaluationTimeMs: Date.now() - startTime,
      },
      recommendations: this.generateRecommendations(scoredVariants),
    };
  }

  /**
   * Get profile for a specific model.
   */
  getModelProfile(modelId: string): ModelProfile | undefined {
    return this.modelProfiles.get(modelId);
  }

  /**
   * Get all available model profiles.
   */
  getAllProfiles(): ModelProfile[] {
    return Array.from(this.modelProfiles.values());
  }

  /**
   * Register a custom model profile.
   */
  registerProfile(profile: ModelProfile): void {
    this.modelProfiles.set(profile.modelId, profile);
  }

  // ===========================================================================
  // Private Methods - Model Selection
  // ===========================================================================

  /**
   * Determine which models to target based on context and optimization goals.
   */
  private determineTargetModels(
    prompt: string,
    context: OptimizationContext
  ): ModelProfile[] {
    if (this.adaptOptions.targetModels) {
      return this.adaptOptions.targetModels;
    }

    const allProfiles = Array.from(this.modelProfiles.values());
    let candidates = [...allProfiles];

    // Filter by optimization preferences
    if (this.adaptOptions.optimizeForCost) {
      candidates.sort((a, b) => a.inputCostPer1k - b.inputCostPer1k);
      candidates = candidates.slice(0, 4);
    }

    if (this.adaptOptions.optimizeForLatency) {
      candidates.sort((a, b) => a.avgLatencyMs - b.avgLatencyMs);
      candidates = candidates.slice(0, 4);
    }

    if (this.adaptOptions.optimizeForQuality) {
      // Prefer larger, more capable models
      candidates.sort((a, b) => b.maxContextTokens - a.maxContextTokens);
    }

    // Select diverse set (one from each provider)
    const selected: ModelProfile[] = [];
    const seenProviders = new Set<ProviderName>();

    for (const candidate of candidates) {
      if (!seenProviders.has(candidate.provider)) {
        selected.push(candidate);
        seenProviders.add(candidate.provider);
      }
      if (selected.length >= 3) break;
    }

    return selected.length > 0 ? selected : candidates.slice(0, 3);
  }

  // ===========================================================================
  // Private Methods - Adaptation
  // ===========================================================================

  /**
   * Adapt a prompt for a specific model.
   */
  private async adaptForModel(
    prompt: string,
    model: ModelProfile,
    context: OptimizationContext
  ): Promise<ModelAdaptation> {
    let adaptedPrompt = prompt;
    const adaptations: string[] = [];

    // Apply each adaptation strategy
    for (const strategy of this.adaptOptions.adaptationStrategies!) {
      const result = this.applyAdaptationStrategy(
        adaptedPrompt,
        strategy,
        model,
        context
      );
      adaptedPrompt = result.prompt;
      if (result.applied) {
        adaptations.push(result.description);
      }
    }

    // Handle model quirks
    const quirkAdaptations = this.handleModelQuirks(adaptedPrompt, model);
    adaptedPrompt = quirkAdaptations.prompt;
    adaptations.push(...quirkAdaptations.adaptations);

    // Calculate metrics
    const estimatedTokens = this.estimateTokens(adaptedPrompt);
    const estimatedCost =
      (estimatedTokens / 1000) * model.inputCostPer1k +
      (estimatedTokens / 1000) * model.outputCostPer1k; // Rough estimate

    const compatibilityScore = this.calculateCompatibilityScore(
      adaptedPrompt,
      model
    );

    // Generate system prompt if supported
    let systemPrompt: string | undefined;
    if (model.supportsSystemPrompt) {
      systemPrompt = this.generateSystemPrompt(prompt, model, context);
    }

    return {
      model,
      adaptedPrompt,
      systemPrompt,
      estimatedTokens,
      estimatedCost,
      adaptations,
      compatibilityScore,
    };
  }

  /**
   * Apply a specific adaptation strategy.
   */
  private applyAdaptationStrategy(
    prompt: string,
    strategy: AdaptationStrategy,
    model: ModelProfile,
    context: OptimizationContext
  ): { prompt: string; applied: boolean; description: string } {
    switch (strategy) {
      case 'format':
        return this.applyFormatAdaptation(prompt, model);

      case 'tokens':
        return this.applyTokenAdaptation(prompt, model);

      case 'style':
        return this.applyStyleAdaptation(prompt, model);

      case 'constraints':
        return this.applyConstraintAdaptation(prompt, model, context);

      case 'structure':
        return this.applyStructureAdaptation(prompt, model);

      case 'system':
        return this.applySystemAdaptation(prompt, model);

      default:
        return { prompt, applied: false, description: '' };
    }
  }

  /**
   * Apply formatting adaptations.
   */
  private applyFormatAdaptation(
    prompt: string,
    model: ModelProfile
  ): { prompt: string; applied: boolean; description: string } {
    let adaptedPrompt = prompt;
    let applied = false;

    // Add JSON mode hint if supported and prompt seems to want structured output
    if (
      model.supportsJsonMode &&
      /json|structured|format|schema/i.test(prompt) &&
      !prompt.includes('JSON')
    ) {
      adaptedPrompt = adaptedPrompt.replace(
        /(output|respond|return)/i,
        '$1 in valid JSON format'
      );
      applied = true;
    }

    // Add formatting notes specific to model
    if (model.formattingNotes && model.formattingNotes.length > 0) {
      // Don't add to prompt directly, but track for system prompt
      applied = true;
    }

    return {
      prompt: adaptedPrompt,
      applied,
      description: applied ? `Format adapted for ${model.displayName}` : '',
    };
  }

  /**
   * Apply token optimization.
   */
  private applyTokenAdaptation(
    prompt: string,
    model: ModelProfile
  ): { prompt: string; applied: boolean; description: string } {
    const currentTokens = this.estimateTokens(prompt);
    let adaptedPrompt = prompt;
    let applied = false;

    // Truncate if needed
    if (currentTokens > model.maxContextTokens * 0.8) {
      adaptedPrompt = this.truncateToTokenLimit(
        prompt,
        Math.floor(model.maxContextTokens * 0.7)
      );
      applied = true;
    }

    // For cost-optimized, try to reduce tokens
    if (this.adaptOptions.optimizeForCost && currentTokens > 500) {
      // Simple reduction: remove extra whitespace
      adaptedPrompt = adaptedPrompt.replace(/\n{3,}/g, '\n\n').replace(/  +/g, ' ');
      if (adaptedPrompt.length < prompt.length) {
        applied = true;
      }
    }

    return {
      prompt: adaptedPrompt,
      applied,
      description: applied ? 'Token usage optimized' : '',
    };
  }

  /**
   * Apply style adaptation.
   */
  private applyStyleAdaptation(
    prompt: string,
    model: ModelProfile
  ): { prompt: string; applied: boolean; description: string } {
    let adaptedPrompt = prompt;

    switch (model.preferredStyle) {
      case 'formal':
        // Make more formal
        adaptedPrompt = adaptedPrompt
          .replace(/\bdon't\b/gi, 'do not')
          .replace(/\bcan't\b/gi, 'cannot')
          .replace(/\bwon't\b/gi, 'will not');
        break;

      case 'conversational':
        // Add a friendly touch if very terse
        if (prompt.length < 100 && !prompt.includes('please')) {
          adaptedPrompt = 'Please ' + adaptedPrompt.charAt(0).toLowerCase() + adaptedPrompt.slice(1);
        }
        break;

      case 'technical':
        // Ensure technical precision
        if (!prompt.includes('precise') && !prompt.includes('exact')) {
          adaptedPrompt = adaptedPrompt + '\n\nBe precise and technically accurate.';
        }
        break;
    }

    const applied = adaptedPrompt !== prompt;
    return {
      prompt: adaptedPrompt,
      applied,
      description: applied ? `Style adapted to ${model.preferredStyle}` : '',
    };
  }

  /**
   * Apply constraint adaptations.
   */
  private applyConstraintAdaptation(
    prompt: string,
    model: ModelProfile,
    context: OptimizationContext
  ): { prompt: string; applied: boolean; description: string } {
    let adaptedPrompt = prompt;
    const constraints: string[] = [];

    // Add output length constraint based on model
    if (model.maxOutputTokens < 8192 && !prompt.includes('limit')) {
      constraints.push(`Keep response under ${Math.floor(model.maxOutputTokens * 0.8)} tokens`);
    }

    // Handle model weaknesses
    for (const weakness of model.weaknesses) {
      if (weakness === 'verbose' || weakness === 'cost') {
        constraints.push('Be concise');
      }
      if (weakness === 'strict formatting') {
        constraints.push('Formatting can be flexible');
      }
    }

    // Add context constraints
    for (const constraint of context.constraints) {
      if (constraint.strict) {
        constraints.push(constraint.description);
      }
    }

    if (constraints.length > 0) {
      adaptedPrompt =
        adaptedPrompt + '\n\nConstraints:\n' + constraints.map((c) => `- ${c}`).join('\n');
    }

    return {
      prompt: adaptedPrompt,
      applied: constraints.length > 0,
      description:
        constraints.length > 0 ? `Added ${constraints.length} constraints` : '',
    };
  }

  /**
   * Apply structure adaptations.
   */
  private applyStructureAdaptation(
    prompt: string,
    model: ModelProfile
  ): { prompt: string; applied: boolean; description: string } {
    let adaptedPrompt = prompt;
    let applied = false;

    // For models good with long context, structure less needed
    if (model.maxContextTokens > 100000 && prompt.length < 500) {
      return { prompt, applied: false, description: '' };
    }

    // For smaller context models, add structure if not present
    if (model.maxContextTokens < 32000 && !prompt.includes('\n\n')) {
      // Add section breaks for clarity
      const sections = prompt.split(/(?<=[.!?])\s+(?=[A-Z])/);
      if (sections.length > 2) {
        adaptedPrompt = sections.join('\n\n');
        applied = true;
      }
    }

    return {
      prompt: adaptedPrompt,
      applied,
      description: applied ? 'Structure adapted for context window' : '',
    };
  }

  /**
   * Apply system prompt adaptations.
   */
  private applySystemAdaptation(
    prompt: string,
    model: ModelProfile
  ): { prompt: string; applied: boolean; description: string } {
    // For models without system prompt support, merge any system-like instructions
    if (!model.supportsSystemPrompt) {
      // Check for role/persona instructions that should be in system prompt
      const roleMatch = prompt.match(
        /^(You are|Act as|Assume the role of)[^.]+\./i
      );
      if (roleMatch) {
        // Keep it but emphasize it
        return {
          prompt: `IMPORTANT: ${roleMatch[0]}\n\n${prompt.replace(roleMatch[0], '').trim()}`,
          applied: true,
          description: 'Adapted role instruction for no-system-prompt model',
        };
      }
    }

    return { prompt, applied: false, description: '' };
  }

  /**
   * Handle model-specific quirks.
   */
  private handleModelQuirks(
    prompt: string,
    model: ModelProfile
  ): { prompt: string; adaptations: string[] } {
    let adaptedPrompt = prompt;
    const adaptations: string[] = [];

    if (!model.quirks) {
      return { prompt: adaptedPrompt, adaptations };
    }

    for (const quirk of model.quirks) {
      // Check if quirk is triggered
      const triggered =
        !quirk.triggers ||
        quirk.triggers.some((t) => prompt.toLowerCase().includes(t.toLowerCase()));

      if (triggered) {
        // Apply workaround
        switch (quirk.id) {
          case 'verbose_responses':
            if (!prompt.includes('concise') && !prompt.includes('brief')) {
              adaptedPrompt += '\n\nBe concise in your response.';
              adaptations.push('Added conciseness instruction');
            }
            break;

          case 'no_system_prompt':
            // Already handled in system adaptation
            break;

          case 'system_emphasis':
            // Mark critical instructions
            const criticalPatterns = /(must|always|never|important)/gi;
            if (criticalPatterns.test(prompt)) {
              adaptedPrompt = adaptedPrompt.replace(
                criticalPatterns,
                (match) => match.toUpperCase()
              );
              adaptations.push('Emphasized critical instructions');
            }
            break;
        }
      }
    }

    return { prompt: adaptedPrompt, adaptations };
  }

  // ===========================================================================
  // Private Methods - System Prompt & Universal
  // ===========================================================================

  /**
   * Generate an optimized system prompt for the model.
   */
  private generateSystemPrompt(
    prompt: string,
    model: ModelProfile,
    context: OptimizationContext
  ): string {
    const parts: string[] = [];

    // Add model-specific guidance
    if (model.formattingNotes) {
      parts.push(
        'Follow these guidelines: ' + model.formattingNotes.slice(0, 2).join('. ')
      );
    }

    // Add domain context
    if (context.domainHints.length > 0) {
      parts.push(`Domain expertise: ${context.domainHints.join(', ')}`);
    }

    // Add style guidance
    if (model.preferredStyle === 'formal') {
      parts.push('Use formal, professional language.');
    } else if (model.preferredStyle === 'technical') {
      parts.push('Be technically precise and detailed.');
    }

    return parts.join('\n');
  }

  /**
   * Generate a universal variant that works across models.
   */
  private async generateUniversalVariant(
    prompt: string,
    models: ModelProfile[],
    context: OptimizationContext
  ): Promise<{ prompt: string; score: number }> {
    // Find common denominator of capabilities
    const minContext = Math.min(...models.map((m) => m.maxContextTokens));
    const allSupportSystem = models.every((m) => m.supportsSystemPrompt);

    let universalPrompt = prompt;

    // Ensure fits in smallest context
    if (this.estimateTokens(prompt) > minContext * 0.6) {
      universalPrompt = this.truncateToTokenLimit(
        prompt,
        Math.floor(minContext * 0.5)
      );
    }

    // If not all support system prompt, include role in main prompt
    if (!allSupportSystem) {
      const roleMatch = prompt.match(/^(You are|Act as)[^.]+\./i);
      if (!roleMatch) {
        // Add a generic helpful assistant framing
        universalPrompt =
          'You are a helpful assistant. ' + universalPrompt;
      }
    }

    // Add universal best practices
    if (!prompt.includes('step')) {
      universalPrompt += '\n\nThink through this step by step.';
    }

    return {
      prompt: universalPrompt,
      score: 0.75, // Universal variants are good but not optimal for any specific model
    };
  }

  // ===========================================================================
  // Private Methods - Scoring
  // ===========================================================================

  /**
   * Calculate compatibility score for a prompt with a model.
   */
  private calculateCompatibilityScore(
    prompt: string,
    model: ModelProfile
  ): number {
    let score = 0.7; // Base score

    // Token fit
    const tokens = this.estimateTokens(prompt);
    if (tokens < model.maxContextTokens * 0.5) score += 0.1;
    else if (tokens > model.maxContextTokens * 0.9) score -= 0.2;

    // Style match
    if (
      (model.preferredStyle === 'formal' && /\bdo not\b|\bcannot\b/i.test(prompt)) ||
      (model.preferredStyle === 'conversational' && /please/i.test(prompt)) ||
      (model.preferredStyle === 'technical' && /precise|exact|specific/i.test(prompt))
    ) {
      score += 0.1;
    }

    // Has structure for models that prefer it
    if (model.formattingNotes && /\n[-*\d]/.test(prompt)) {
      score += 0.05;
    }

    return Math.min(1, Math.max(0, score));
  }

  /**
   * Score an adaptation on multiple dimensions.
   */
  private scoreAdaptation(
    variant: PromptVariant,
    profile: ModelProfile | undefined
  ): ScoredVariant['scores'] {
    const content = variant.content;
    const tokens = this.estimateTokens(content);

    // Base scores
    let clarity = 0.7;
    let specificity = 0.7;
    let taskAlignment = 0.75;
    let efficiency = 0.7;

    if (profile) {
      // Clarity: good structure for the model
      if (profile.formattingNotes && profile.formattingNotes.length > 0) {
        clarity = 0.8;
      }

      // Efficiency: token usage relative to model context
      const tokenRatio = tokens / profile.maxContextTokens;
      efficiency = tokenRatio < 0.3 ? 0.9 : tokenRatio < 0.6 ? 0.75 : 0.5;

      // Specificity: constraints and precision
      if (/precise|exact|specific|constraint/i.test(content)) {
        specificity = 0.85;
      }

      // Task alignment: matches model strengths
      const matchesStrength = profile.strengths.some((s) =>
        content.toLowerCase().includes(s.toLowerCase())
      );
      if (matchesStrength) {
        taskAlignment = 0.85;
      }
    }

    const overall = (clarity + specificity + taskAlignment + efficiency) / 4;

    return {
      overall,
      clarity,
      specificity,
      taskAlignment,
      efficiency,
    };
  }

  /**
   * Generate feedback for an adaptation.
   */
  private generateAdaptationFeedback(
    variant: PromptVariant,
    profile: ModelProfile | undefined,
    scores: ScoredVariant['scores']
  ): string {
    const feedback: string[] = [];

    if (profile) {
      feedback.push(`Adapted for ${profile.displayName}`);

      if (scores.efficiency >= 0.8) {
        feedback.push('Good token efficiency');
      }

      if (profile.strengths.length > 0) {
        feedback.push(`Optimized for: ${profile.strengths.slice(0, 2).join(', ')}`);
      }
    } else {
      feedback.push('Universal variant');
    }

    return feedback.join('. ');
  }

  /**
   * Generate recommendations.
   */
  private generateRecommendations(variants: ScoredVariant[]): string[] {
    const recommendations: string[] = [];

    // Find best performing model type
    const byProvider = new Map<string, number>();
    for (const v of variants) {
      const profile = this.modelProfiles.get(v.model);
      if (profile) {
        const current = byProvider.get(profile.provider) || 0;
        byProvider.set(profile.provider, Math.max(current, v.scores.overall));
      }
    }

    const bestProvider = [...byProvider.entries()].sort((a, b) => b[1] - a[1])[0];
    if (bestProvider) {
      recommendations.push(
        `Best results with ${bestProvider[0]} models (score: ${(bestProvider[1] * 100).toFixed(0)}%)`
      );
    }

    // Cost optimization suggestion
    if (this.adaptOptions.optimizeForCost) {
      const cheapModels = Array.from(this.modelProfiles.values())
        .filter((m) => m.inputCostPer1k < 0.002)
        .map((m) => m.displayName);
      if (cheapModels.length > 0) {
        recommendations.push(
          `For cost optimization, consider: ${cheapModels.slice(0, 2).join(', ')}`
        );
      }
    }

    return recommendations;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a model adaptation technique with default or custom options.
 */
export function createModelAdaptationTechnique(
  options?: ModelAdaptationOptions
): ModelAdaptationTechnique {
  return new ModelAdaptationTechnique(options);
}
