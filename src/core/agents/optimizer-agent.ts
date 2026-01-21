/**
 * Optimizer Agent - Specialist Agent for Prompt Optimization
 *
 * This agent is responsible for applying optimization techniques to prompts
 * to improve their quality, clarity, and effectiveness. It:
 * - Applies multiple optimization techniques
 * - Generates prompt variants
 * - Scores candidate prompts
 * - Uses internal symbols for context enrichment (never exposed)
 *
 * @module core/agents/optimizer-agent
 */

import { BaseAgent, type BaseAgentConfig } from './base-agent.js';
import type {
  AgentTask,
  AgentResult,
  PromptVariant,
  TechniqueName,
  OptimizationContext,
  TechniqueResult,
  ResultMetrics,
} from '../../types/index.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration specific to the optimizer agent.
 */
export interface OptimizerAgentConfig extends BaseAgentConfig {
  /** Maximum variants to generate per technique */
  maxVariantsPerTechnique: number;
  /** Minimum score to keep a variant */
  minVariantScore: number;
  /** Whether to run techniques in parallel */
  parallelTechniques: boolean;
  /** Techniques to always apply */
  defaultTechniques: TechniqueName[];
  /** Techniques to never apply */
  disabledTechniques: TechniqueName[];
}

/**
 * Internal technique implementation.
 */
interface TechniqueImplementation {
  name: TechniqueName;
  apply: (prompt: string, context: OptimizationContext) => TechniqueResult;
  isApplicable: (prompt: string, context: OptimizationContext) => boolean;
  priority: number;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_OPTIMIZER_CONFIG: Partial<OptimizerAgentConfig> = {
  maxVariantsPerTechnique: 2,
  minVariantScore: 0.4,
  parallelTechniques: true,
  defaultTechniques: [],
  disabledTechniques: [],
};

// =============================================================================
// Optimizer Agent Class
// =============================================================================

/**
 * Specialist agent for prompt optimization.
 *
 * The OptimizerAgent applies various optimization techniques to improve
 * prompt quality. It uses internal symbol context for enrichment but
 * ensures symbols are never exposed in output.
 */
export class OptimizerAgent extends BaseAgent {
  readonly name = 'optimizer';
  readonly capabilities = ['optimize', 'generate'];

  private optimizerConfig: OptimizerAgentConfig;
  private techniques: Map<TechniqueName, TechniqueImplementation>;

  constructor(config: Partial<OptimizerAgentConfig> = {}) {
    super(config);
    this.optimizerConfig = {
      ...DEFAULT_OPTIMIZER_CONFIG,
      ...config,
    } as OptimizerAgentConfig;

    this.techniques = this.initializeTechniques();
  }

  // ===========================================================================
  // Abstract Method Implementation
  // ===========================================================================

  /**
   * Execute prompt optimization.
   *
   * @param task - The optimization task
   * @returns Optimization result with variants
   */
  async execute(task: AgentTask): Promise<AgentResult> {
    this.log('info', `Starting optimization for prompt (${task.prompt.length} chars)`);

    // Get enriched context with symbols (internal only)
    const enrichedContext = await this.getSymbolContext(task);
    const symbolContext = this.encodeSymbols(enrichedContext);

    this.log('debug', `Symbol context loaded: ${symbolContext.length > 0 ? 'yes' : 'no'}`);

    // Select techniques to apply
    const techniquesToApply = this.selectTechniques(task, enrichedContext);
    this.log('info', `Applying ${techniquesToApply.length} techniques`);

    // Apply techniques
    let results: TechniqueResult[];

    if (this.optimizerConfig.parallelTechniques) {
      results = await this.applyTechniquesParallel(
        task.prompt,
        enrichedContext,
        techniquesToApply
      );
    } else {
      results = await this.applyTechniquesSequential(
        task.prompt,
        enrichedContext,
        techniquesToApply
      );
    }

    // Convert to variants and score
    const variants = this.convertToVariants(results, task);

    // Filter by minimum score
    const filteredVariants = variants.filter(
      (v) => v.score >= this.optimizerConfig.minVariantScore
    );

    // Sort by score
    const rankedVariants = filteredVariants.sort((a, b) => b.score - a.score);

    // Select best
    const bestVariant = rankedVariants[0] || this.createFallbackVariant(task.prompt);

    // Build result (symbols stripped by base class)
    const result = this.createResult(
      bestVariant.content,
      rankedVariants,
      task.context.constraints.length > 0 ? 'constrained' : 'default',
      this.generateReasoning(results, bestVariant)
    );

    // Add technique-specific metrics
    const metrics: ResultMetrics = {
      ...result.metrics,
      estimatedAccuracy: this.estimateAccuracy(rankedVariants),
      latency: results.reduce((sum, r) => sum + r.processingTimeMs, 0),
      tokenCount: {
        input: this.estimateTokens(task.prompt),
        output: this.estimateTokens(bestVariant.content),
      },
    };

    this.setCustomMetric('techniquesApplied', results.length);
    this.setCustomMetric('variantsGenerated', rankedVariants.length);

    return {
      ...result,
      metrics,
    };
  }

  // ===========================================================================
  // Public Methods
  // ===========================================================================

  /**
   * Get list of available techniques.
   */
  getAvailableTechniques(): TechniqueName[] {
    return Array.from(this.techniques.keys());
  }

  /**
   * Check if a technique is enabled.
   */
  isTechniqueEnabled(technique: TechniqueName): boolean {
    return (
      this.techniques.has(technique) &&
      !this.optimizerConfig.disabledTechniques.includes(technique)
    );
  }

  /**
   * Apply a specific technique to a prompt.
   */
  applyTechnique(
    technique: TechniqueName,
    prompt: string,
    context: OptimizationContext
  ): TechniqueResult | null {
    const impl = this.techniques.get(technique);
    if (!impl) {
      this.log('warn', `Unknown technique: ${technique}`);
      return null;
    }

    if (!impl.isApplicable(prompt, context)) {
      this.log('debug', `Technique ${technique} not applicable`);
      return null;
    }

    return impl.apply(prompt, context);
  }

  // ===========================================================================
  // Private Methods - Technique Selection
  // ===========================================================================

  /**
   * Select which techniques to apply based on task and context.
   */
  private selectTechniques(
    task: AgentTask,
    context: OptimizationContext
  ): TechniqueName[] {
    const selected: TechniqueName[] = [];

    // Start with explicitly requested techniques
    if (task.techniques && task.techniques.length > 0) {
      for (const technique of task.techniques) {
        if (this.isTechniqueEnabled(technique)) {
          selected.push(technique);
        }
      }
    }

    // Add default techniques
    for (const technique of this.optimizerConfig.defaultTechniques) {
      if (!selected.includes(technique) && this.isTechniqueEnabled(technique)) {
        selected.push(technique);
      }
    }

    // If no techniques selected, auto-select based on context
    if (selected.length === 0) {
      selected.push(...this.autoSelectTechniques(task.prompt, context));
    }

    return selected;
  }

  /**
   * Automatically select appropriate techniques based on prompt analysis.
   */
  private autoSelectTechniques(
    prompt: string,
    context: OptimizationContext
  ): TechniqueName[] {
    const selected: TechniqueName[] = [];
    const promptLower = prompt.toLowerCase();

    // Check for applicable techniques
    for (const [name, impl] of this.techniques) {
      if (
        !this.optimizerConfig.disabledTechniques.includes(name) &&
        impl.isApplicable(prompt, context)
      ) {
        selected.push(name);
      }
    }

    // Sort by priority and take top ones
    selected.sort((a, b) => {
      const prioA = this.techniques.get(a)?.priority || 0;
      const prioB = this.techniques.get(b)?.priority || 0;
      return prioB - prioA;
    });

    // Limit to reasonable number
    return selected.slice(0, 4);
  }

  // ===========================================================================
  // Private Methods - Technique Application
  // ===========================================================================

  /**
   * Apply techniques in parallel.
   */
  private async applyTechniquesParallel(
    prompt: string,
    context: OptimizationContext,
    techniques: TechniqueName[]
  ): Promise<TechniqueResult[]> {
    const promises = techniques.map((technique) =>
      Promise.resolve(this.applyTechnique(technique, prompt, context))
    );

    const results = await Promise.all(promises);
    return results.filter((r): r is TechniqueResult => r !== null);
  }

  /**
   * Apply techniques sequentially.
   */
  private async applyTechniquesSequential(
    prompt: string,
    context: OptimizationContext,
    techniques: TechniqueName[]
  ): Promise<TechniqueResult[]> {
    const results: TechniqueResult[] = [];

    for (const technique of techniques) {
      const result = this.applyTechnique(technique, prompt, context);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  // ===========================================================================
  // Private Methods - Result Processing
  // ===========================================================================

  /**
   * Convert technique results to prompt variants.
   */
  private convertToVariants(
    results: TechniqueResult[],
    task: AgentTask
  ): PromptVariant[] {
    return results.map((result) => ({
      content: this.stripSymbols(result.optimizedPrompt),
      technique: result.technique,
      score: result.confidence,
      model: 'default',
    }));
  }

  /**
   * Create a fallback variant when no techniques succeed.
   */
  private createFallbackVariant(prompt: string): PromptVariant {
    return {
      content: this.stripSymbols(prompt),
      technique: 'none',
      score: 0.5,
      model: 'default',
    };
  }

  /**
   * Estimate accuracy based on variant scores.
   */
  private estimateAccuracy(variants: PromptVariant[]): number {
    if (variants.length === 0) return 0.5;

    const topScore = Math.max(...variants.map((v) => v.score));
    const avgScore =
      variants.reduce((sum, v) => sum + v.score, 0) / variants.length;

    return topScore * 0.7 + avgScore * 0.3;
  }

  /**
   * Generate reasoning explanation.
   */
  private generateReasoning(
    results: TechniqueResult[],
    bestVariant: PromptVariant
  ): string {
    if (results.length === 0) {
      return 'No optimization techniques were applicable to this prompt.';
    }

    const techniqueNames = results.map((r) => r.technique).join(', ');
    const explanations = results
      .filter((r) => r.explanation)
      .map((r) => r.explanation);

    let reasoning = `Applied techniques: ${techniqueNames}. `;
    reasoning += `Best variant scored ${(bestVariant.score * 100).toFixed(0)}% `;
    reasoning += `using ${bestVariant.technique}. `;

    if (explanations.length > 0) {
      reasoning += explanations[0];
    }

    return this.stripSymbols(reasoning);
  }

  // ===========================================================================
  // Private Methods - Technique Initialization
  // ===========================================================================

  /**
   * Initialize all optimization techniques.
   */
  private initializeTechniques(): Map<TechniqueName, TechniqueImplementation> {
    const techniques = new Map<TechniqueName, TechniqueImplementation>();

    // Chain of Thought
    techniques.set('chain_of_thought', {
      name: 'chain_of_thought',
      priority: 10,
      isApplicable: (prompt) => {
        const lower = prompt.toLowerCase();
        return (
          lower.includes('how') ||
          lower.includes('why') ||
          lower.includes('explain') ||
          lower.includes('analyze') ||
          lower.includes('solve') ||
          prompt.length > 100
        );
      },
      apply: (prompt, context) => {
        const start = Date.now();

        const enhanced = this.addChainOfThought(prompt, context);

        return {
          technique: 'chain_of_thought',
          optimizedPrompt: enhanced,
          confidence: 0.85,
          explanation: 'Added step-by-step reasoning guidance to improve logical flow.',
          tokenDelta: enhanced.length - prompt.length,
          processingTimeMs: Date.now() - start,
        };
      },
    });

    // Few-Shot Learning
    techniques.set('few_shot', {
      name: 'few_shot',
      priority: 9,
      isApplicable: (prompt, context) => {
        return context.examples.length > 0 || prompt.includes('example');
      },
      apply: (prompt, context) => {
        const start = Date.now();

        const enhanced = this.addFewShotExamples(prompt, context);

        return {
          technique: 'few_shot',
          optimizedPrompt: enhanced,
          confidence: 0.8,
          explanation: 'Added relevant examples to guide response format and style.',
          tokenDelta: enhanced.length - prompt.length,
          processingTimeMs: Date.now() - start,
        };
      },
    });

    // Role Prompting
    techniques.set('role_prompting', {
      name: 'role_prompting',
      priority: 8,
      isApplicable: (prompt) => {
        const hasRole = /act as|you are|assume the role|as an? (expert|specialist)/i.test(prompt);
        return !hasRole; // Apply if no role defined
      },
      apply: (prompt, context) => {
        const start = Date.now();

        const enhanced = this.addRoleContext(prompt, context);

        return {
          technique: 'role_prompting',
          optimizedPrompt: enhanced,
          confidence: 0.75,
          explanation: 'Added expert persona to improve domain-specific responses.',
          tokenDelta: enhanced.length - prompt.length,
          processingTimeMs: Date.now() - start,
        };
      },
    });

    // Structured Output
    techniques.set('structured_output', {
      name: 'structured_output',
      priority: 7,
      isApplicable: (prompt) => {
        const lower = prompt.toLowerCase();
        return (
          lower.includes('list') ||
          lower.includes('format') ||
          lower.includes('json') ||
          lower.includes('table') ||
          lower.includes('structured')
        );
      },
      apply: (prompt, context) => {
        const start = Date.now();

        const enhanced = this.addStructuredOutputGuidance(prompt, context);

        return {
          technique: 'structured_output',
          optimizedPrompt: enhanced,
          confidence: 0.82,
          explanation: 'Added explicit output format specification.',
          tokenDelta: enhanced.length - prompt.length,
          processingTimeMs: Date.now() - start,
        };
      },
    });

    // Step by Step
    techniques.set('step_by_step', {
      name: 'step_by_step',
      priority: 6,
      isApplicable: (prompt) => {
        const lower = prompt.toLowerCase();
        return (
          lower.includes('create') ||
          lower.includes('build') ||
          lower.includes('develop') ||
          lower.includes('implement') ||
          lower.includes('design')
        );
      },
      apply: (prompt, context) => {
        const start = Date.now();

        const enhanced = this.addStepByStepGuidance(prompt, context);

        return {
          technique: 'step_by_step',
          optimizedPrompt: enhanced,
          confidence: 0.78,
          explanation: 'Added step-by-step breakdown structure.',
          tokenDelta: enhanced.length - prompt.length,
          processingTimeMs: Date.now() - start,
        };
      },
    });

    // Decomposition
    techniques.set('decomposition', {
      name: 'decomposition',
      priority: 5,
      isApplicable: (prompt) => {
        return prompt.length > 200 || prompt.includes(' and ');
      },
      apply: (prompt, context) => {
        const start = Date.now();

        const enhanced = this.applyDecomposition(prompt, context);

        return {
          technique: 'decomposition',
          optimizedPrompt: enhanced,
          confidence: 0.72,
          explanation: 'Decomposed complex request into clear subtasks.',
          tokenDelta: enhanced.length - prompt.length,
          processingTimeMs: Date.now() - start,
        };
      },
    });

    // Reflection
    techniques.set('reflection', {
      name: 'reflection',
      priority: 4,
      isApplicable: (prompt) => {
        const lower = prompt.toLowerCase();
        return (
          lower.includes('review') ||
          lower.includes('check') ||
          lower.includes('verify') ||
          lower.includes('validate')
        );
      },
      apply: (prompt, context) => {
        const start = Date.now();

        const enhanced = this.addReflectionGuidance(prompt, context);

        return {
          technique: 'reflection',
          optimizedPrompt: enhanced,
          confidence: 0.7,
          explanation: 'Added self-review and verification steps.',
          tokenDelta: enhanced.length - prompt.length,
          processingTimeMs: Date.now() - start,
        };
      },
    });

    return techniques;
  }

  // ===========================================================================
  // Private Methods - Technique Implementations
  // ===========================================================================

  /**
   * Add chain of thought prompting.
   */
  private addChainOfThought(
    prompt: string,
    context: OptimizationContext
  ): string {
    const cot = "\n\nPlease think through this step by step:\n" +
      "1. First, understand what is being asked\n" +
      "2. Identify the key components and requirements\n" +
      "3. Consider the approach and methodology\n" +
      "4. Work through the solution systematically\n" +
      "5. Verify your reasoning before providing the final answer";

    return prompt + cot;
  }

  /**
   * Add few-shot examples.
   */
  private addFewShotExamples(
    prompt: string,
    context: OptimizationContext
  ): string {
    if (context.examples.length === 0) {
      return prompt + "\n\nPlease provide a clear, well-structured response.";
    }

    let enhanced = "Here are some examples of the expected format:\n\n";

    // Use up to 2 examples
    const examples = context.examples.slice(0, 2);
    for (const example of examples) {
      enhanced += `Example:\nInput: ${example.beforePrompt}\n`;
      enhanced += `Output: ${example.afterPrompt}\n\n`;
    }

    enhanced += `Now, please apply the same approach to:\n${prompt}`;

    return enhanced;
  }

  /**
   * Add role/persona context.
   */
  private addRoleContext(
    prompt: string,
    context: OptimizationContext
  ): string {
    // Determine appropriate role from domain hints
    const domain = context.domainHints[0] || 'general';
    const roleMap: Record<string, string> = {
      sap: 'SAP technical consultant with deep expertise in ABAP and ERP systems',
      code: 'senior software engineer with expertise in clean code and best practices',
      analysis: 'data analyst skilled in extracting insights and patterns',
      creative: 'creative writer with a talent for engaging content',
      technical: 'technical documentation specialist',
      default: 'knowledgeable assistant with expertise in the relevant domain',
    };

    const role = roleMap[domain.toLowerCase()] || roleMap.default;

    return `You are a ${role}.\n\n${prompt}`;
  }

  /**
   * Add structured output guidance.
   */
  private addStructuredOutputGuidance(
    prompt: string,
    context: OptimizationContext
  ): string {
    const lower = prompt.toLowerCase();

    let formatGuidance = "\n\nPlease structure your response clearly with:";

    if (lower.includes('json')) {
      formatGuidance += "\n- Valid JSON format\n- Properly escaped strings\n- Appropriate data types";
    } else if (lower.includes('list')) {
      formatGuidance += "\n- Numbered or bulleted list format\n- One item per line\n- Clear, concise entries";
    } else if (lower.includes('table')) {
      formatGuidance += "\n- Markdown table format\n- Clear column headers\n- Aligned data";
    } else {
      formatGuidance += "\n- Clear headings and sections\n- Logical organization\n- Consistent formatting";
    }

    return prompt + formatGuidance;
  }

  /**
   * Add step-by-step guidance.
   */
  private addStepByStepGuidance(
    prompt: string,
    context: OptimizationContext
  ): string {
    return prompt +
      "\n\nPlease approach this methodically:\n" +
      "- Start with the high-level requirements\n" +
      "- Break down into smaller, manageable steps\n" +
      "- Address each step with clear explanations\n" +
      "- Provide concrete examples where helpful\n" +
      "- Summarize the complete solution at the end";
  }

  /**
   * Apply decomposition to complex prompts.
   */
  private applyDecomposition(
    prompt: string,
    context: OptimizationContext
  ): string {
    // Identify "and" conjunctions that might indicate multiple tasks
    const parts = prompt.split(/\s+and\s+/i).filter((p) => p.trim().length > 20);

    if (parts.length > 1) {
      let enhanced = "I need help with multiple related tasks:\n\n";

      parts.forEach((part, i) => {
        enhanced += `Task ${i + 1}: ${part.trim()}\n`;
      });

      enhanced += "\nPlease address each task separately but cohesively.";
      return enhanced;
    }

    // For long prompts without clear "and" separation
    return "Let me break down this request:\n\n" +
      prompt +
      "\n\nPlease address the core requirements first, then elaborate on details.";
  }

  /**
   * Add reflection and self-verification guidance.
   */
  private addReflectionGuidance(
    prompt: string,
    context: OptimizationContext
  ): string {
    return prompt +
      "\n\nAfter completing your response, please:\n" +
      "- Review your work for accuracy\n" +
      "- Check for any logical errors or inconsistencies\n" +
      "- Verify all requirements have been addressed\n" +
      "- Consider potential edge cases or issues";
  }
}

// =============================================================================
// Exports
// =============================================================================

export default OptimizerAgent;
