/**
 * Chain of Thought Technique
 *
 * Injects reasoning steps into prompts to improve complex problem solving.
 * Based on "Chain-of-Thought Prompting Elicits Reasoning in Large Language Models"
 * (Wei et al., 2022) and subsequent research.
 *
 * Key concepts:
 * - Explicit reasoning steps improve accuracy on complex tasks
 * - "Let's think step by step" and similar triggers
 * - Domain-specific reasoning patterns for different task types
 * - Structured thought templates for consistent reasoning
 *
 * @see https://arxiv.org/abs/2201.11903 (Chain-of-Thought paper)
 * @module core/techniques/chain-of-thought
 */

import {
  TechniqueName,
  OptimizationContext,
  PromptVariant,
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
 * Configuration specific to chain-of-thought technique
 */
export interface ChainOfThoughtOptions extends TechniqueOptions {
  /** Style of CoT to apply */
  style?: 'simple' | 'detailed' | 'structured' | 'zero-shot';
  /** Domain-specific reasoning patterns */
  domainPatterns?: DomainReasoningPattern[];
  /** Whether to include worked examples */
  includeExamples?: boolean;
  /** Maximum number of reasoning steps */
  maxSteps?: number;
  /** Whether to request explicit step numbering */
  numberSteps?: boolean;
  /** Custom reasoning trigger phrase */
  customTrigger?: string;
}

/**
 * Domain-specific reasoning pattern
 */
export interface DomainReasoningPattern {
  /** Domain identifier (e.g., 'math', 'code', 'erp') */
  domain: string;
  /** Keywords that trigger this pattern */
  keywords: string[];
  /** Reasoning template for this domain */
  template: string;
  /** Example reasoning steps */
  exampleSteps?: string[];
  /** Priority when multiple patterns match */
  priority: number;
}

/**
 * A structured reasoning step
 */
interface ReasoningStep {
  stepNumber: number;
  instruction: string;
  purpose: string;
  example?: string;
}

// =============================================================================
// Default Patterns
// =============================================================================

/**
 * Built-in domain reasoning patterns
 */
const DEFAULT_DOMAIN_PATTERNS: DomainReasoningPattern[] = [
  {
    domain: 'mathematical',
    keywords: ['calculate', 'compute', 'solve', 'math', 'equation', 'formula'],
    template: `Break down the mathematical problem:
1. Identify the given values and what we need to find
2. Determine the relevant formulas or relationships
3. Substitute values and simplify step by step
4. Verify the answer makes sense in context`,
    exampleSteps: [
      'Given: [identify inputs]',
      'Need to find: [identify output]',
      'Formula: [relevant formula]',
      'Calculation: [show work]',
      'Answer: [final result with units]',
    ],
    priority: 10,
  },
  {
    domain: 'code-analysis',
    keywords: ['code', 'debug', 'function', 'algorithm', 'program', 'bug'],
    template: `Analyze the code systematically:
1. Understand the intended purpose
2. Trace through the logic step by step
3. Identify where behavior deviates from intent
4. Propose and validate the fix`,
    exampleSteps: [
      'Purpose: [what the code should do]',
      'Input: [expected inputs]',
      'Trace: [step through execution]',
      'Issue: [where it goes wrong]',
      'Fix: [proposed solution]',
    ],
    priority: 9,
  },
  {
    domain: 'erp-configuration',
    keywords: ['sap', 'erp', 'configuration', 'module', 'transaction', 'customizing'],
    template: `Approach the ERP configuration systematically:
1. Identify the business requirement
2. Map to relevant module/component
3. Determine configuration path (transaction codes, IMG paths)
4. Consider dependencies and impacts
5. Validate against best practices`,
    exampleSteps: [
      'Requirement: [business need]',
      'Module: [SAP module]',
      'Config Path: [IMG or transaction]',
      'Dependencies: [related settings]',
      'Validation: [how to verify]',
    ],
    priority: 8,
  },
  {
    domain: 'logical-reasoning',
    keywords: ['logic', 'deduce', 'infer', 'conclude', 'reasoning', 'proof'],
    template: `Apply logical reasoning:
1. State the premises clearly
2. Identify the logical relationships
3. Apply deductive/inductive reasoning
4. Draw conclusions step by step
5. Check for logical fallacies`,
    priority: 7,
  },
  {
    domain: 'data-analysis',
    keywords: ['data', 'analyze', 'statistics', 'trend', 'pattern', 'insight'],
    template: `Analyze the data methodically:
1. Understand the data structure and meaning
2. Identify relevant metrics and dimensions
3. Look for patterns, trends, and anomalies
4. Consider statistical significance
5. Draw actionable conclusions`,
    priority: 6,
  },
  {
    domain: 'decision-making',
    keywords: ['decide', 'choose', 'compare', 'evaluate', 'pros', 'cons'],
    template: `Structure the decision analysis:
1. Clarify the decision criteria
2. List all viable options
3. Evaluate each option against criteria
4. Consider risks and tradeoffs
5. Make and justify the recommendation`,
    priority: 5,
  },
];

// =============================================================================
// Implementation
// =============================================================================

/**
 * Chain of Thought Technique
 *
 * Enhances prompts with explicit reasoning instructions to improve
 * performance on complex tasks requiring multi-step reasoning.
 *
 * @example
 * ```typescript
 * const technique = new ChainOfThoughtTechnique({
 *   style: 'structured',
 *   maxSteps: 5,
 *   domainPatterns: [customPattern]
 * });
 *
 * const variants = await technique.apply(prompt, context);
 * ```
 */
export class ChainOfThoughtTechnique extends OptimizationTechnique {
  // ===========================================================================
  // Properties
  // ===========================================================================

  readonly name: TechniqueName = 'chain_of_thought';
  readonly priority: number = 9; // High priority - widely applicable
  readonly description: string =
    'Add explicit reasoning steps to improve complex problem solving';

  private cotOptions: ChainOfThoughtOptions;
  private patterns: DomainReasoningPattern[];

  // ===========================================================================
  // Constructor
  // ===========================================================================

  constructor(options: ChainOfThoughtOptions = {}) {
    super(options);
    this.cotOptions = {
      style: 'structured',
      includeExamples: true,
      maxSteps: 5,
      numberSteps: true,
      ...options,
    };

    // Combine default and custom patterns
    this.patterns = [
      ...DEFAULT_DOMAIN_PATTERNS,
      ...(options.domainPatterns || []),
    ].sort((a, b) => b.priority - a.priority);
  }

  // ===========================================================================
  // Public Methods
  // ===========================================================================

  /**
   * Apply chain-of-thought enhancement to a prompt.
   */
  async apply(
    prompt: string,
    context: OptimizationContext
  ): Promise<PromptVariant[]> {
    const variants: PromptVariant[] = [];

    // Detect relevant domain patterns
    const matchedPattern = this.detectDomainPattern(prompt, context);

    // Generate variants for different CoT styles
    const styles: Array<ChainOfThoughtOptions['style']> = [
      'simple',
      'detailed',
      'structured',
      'zero-shot',
    ];

    for (const style of styles) {
      const enhancedPrompt = this.enhanceWithCoT(
        prompt,
        style!,
        matchedPattern,
        context
      );

      // Score based on style appropriateness
      const score = this.estimateStyleScore(style!, prompt, context);

      variants.push(this.createVariant(enhancedPrompt, score));
    }

    // Generate domain-specific variant if pattern matched
    if (matchedPattern) {
      const domainPrompt = this.generateDomainSpecificPrompt(
        prompt,
        matchedPattern,
        context
      );
      variants.push(
        this.createVariant(domainPrompt, 0.85) // Domain-specific often performs well
      );
    }

    return variants.sort((a, b) => b.score - a.score);
  }

  /**
   * Evaluate CoT-enhanced variants.
   */
  async evaluate(variants: PromptVariant[]): Promise<EvaluationResult> {
    const scoredVariants: ScoredVariant[] = [];
    const startTime = Date.now();

    for (const variant of variants) {
      const scores = await this.evaluateCoTEffectiveness(variant);
      scoredVariants.push({
        ...variant,
        scores,
        feedback: this.generateCoTFeedback(scores),
      });
    }

    // Sort by overall score
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
        improvementOverOriginal: (best.scores.overall - 0.5) * 200, // Assume 0.5 baseline
        evaluationTimeMs: Date.now() - startTime,
      },
      recommendations: this.generateRecommendations(scoredVariants),
    };
  }

  /**
   * Register a custom domain reasoning pattern.
   */
  registerPattern(pattern: DomainReasoningPattern): void {
    this.patterns.push(pattern);
    this.patterns.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get all registered patterns.
   */
  getPatterns(): DomainReasoningPattern[] {
    return [...this.patterns];
  }

  // ===========================================================================
  // Private Methods - Core Enhancement
  // ===========================================================================

  /**
   * Enhance a prompt with chain-of-thought based on style.
   */
  private enhanceWithCoT(
    prompt: string,
    style: NonNullable<ChainOfThoughtOptions['style']>,
    pattern: DomainReasoningPattern | null,
    context: OptimizationContext
  ): string {
    switch (style) {
      case 'simple':
        return this.applySimpleCoT(prompt);

      case 'detailed':
        return this.applyDetailedCoT(prompt, pattern, context);

      case 'structured':
        return this.applyStructuredCoT(prompt, pattern, context);

      case 'zero-shot':
        return this.applyZeroShotCoT(prompt);

      default:
        return this.applySimpleCoT(prompt);
    }
  }

  /**
   * Simple CoT: Add basic trigger phrase.
   */
  private applySimpleCoT(prompt: string): string {
    const trigger =
      this.cotOptions.customTrigger || "Let's think step by step.";

    // Check if prompt already has CoT trigger
    if (this.hasCoTTrigger(prompt)) {
      return prompt;
    }

    // Add trigger at appropriate location
    return `${prompt}\n\n${trigger}`;
  }

  /**
   * Detailed CoT: Add comprehensive reasoning guidance.
   */
  private applyDetailedCoT(
    prompt: string,
    pattern: DomainReasoningPattern | null,
    context: OptimizationContext
  ): string {
    const reasoningGuide = pattern
      ? pattern.template
      : this.generateGenericReasoningGuide();

    return `${prompt}

Think through this carefully using the following approach:

${reasoningGuide}

${this.cotOptions.numberSteps ? 'Number each step of your reasoning.' : ''}
After your reasoning, provide a clear final answer.`;
  }

  /**
   * Structured CoT: Use explicit step-by-step format.
   */
  private applyStructuredCoT(
    prompt: string,
    pattern: DomainReasoningPattern | null,
    context: OptimizationContext
  ): string {
    const steps = this.generateReasoningSteps(prompt, pattern, context);

    const stepsText = steps
      .map(
        (step) =>
          `Step ${step.stepNumber}: ${step.instruction}${step.example ? `\n   Example: ${step.example}` : ''}`
      )
      .join('\n');

    return `${prompt}

Please solve this by following these steps:

${stepsText}

After completing all steps, provide your final answer in a clearly marked section.`;
  }

  /**
   * Zero-shot CoT: Minimal trigger for emergent reasoning.
   */
  private applyZeroShotCoT(prompt: string): string {
    return `${prompt}

Let's approach this step by step:`;
  }

  // ===========================================================================
  // Private Methods - Pattern Detection
  // ===========================================================================

  /**
   * Detect the most appropriate domain pattern for a prompt.
   */
  private detectDomainPattern(
    prompt: string,
    context: OptimizationContext
  ): DomainReasoningPattern | null {
    const lowerPrompt = prompt.toLowerCase();

    // Check context domain hints first
    for (const hint of context.domainHints) {
      for (const pattern of this.patterns) {
        if (
          pattern.domain.toLowerCase().includes(hint.toLowerCase()) ||
          hint.toLowerCase().includes(pattern.domain.toLowerCase())
        ) {
          return pattern;
        }
      }
    }

    // Check keyword matches
    for (const pattern of this.patterns) {
      const matchCount = pattern.keywords.filter((kw) =>
        lowerPrompt.includes(kw.toLowerCase())
      ).length;

      if (matchCount >= 2) {
        return pattern;
      }
    }

    // Check for single strong keyword match
    for (const pattern of this.patterns) {
      for (const keyword of pattern.keywords) {
        if (lowerPrompt.includes(keyword.toLowerCase())) {
          return pattern;
        }
      }
    }

    return null;
  }

  /**
   * Check if prompt already contains a CoT trigger.
   */
  private hasCoTTrigger(prompt: string): boolean {
    const triggers = [
      'step by step',
      'think through',
      'reasoning',
      'let me think',
      'break down',
      'analyze',
      'consider each',
    ];

    const lowerPrompt = prompt.toLowerCase();
    return triggers.some((t) => lowerPrompt.includes(t));
  }

  // ===========================================================================
  // Private Methods - Step Generation
  // ===========================================================================

  /**
   * Generate reasoning steps for structured CoT.
   */
  private generateReasoningSteps(
    prompt: string,
    pattern: DomainReasoningPattern | null,
    context: OptimizationContext
  ): ReasoningStep[] {
    const maxSteps = this.cotOptions.maxSteps || 5;

    if (pattern && pattern.exampleSteps) {
      return pattern.exampleSteps.slice(0, maxSteps).map((step, idx) => ({
        stepNumber: idx + 1,
        instruction: step,
        purpose: `Part of ${pattern.domain} reasoning`,
      }));
    }

    // Generic reasoning steps
    return [
      {
        stepNumber: 1,
        instruction: 'Understand the problem - identify what is given and what is asked',
        purpose: 'Clarify the task',
      },
      {
        stepNumber: 2,
        instruction: 'Break down into sub-problems if needed',
        purpose: 'Decompose complexity',
      },
      {
        stepNumber: 3,
        instruction: 'Solve each part systematically',
        purpose: 'Methodical progress',
      },
      {
        stepNumber: 4,
        instruction: 'Combine results and check consistency',
        purpose: 'Integration',
      },
      {
        stepNumber: 5,
        instruction: 'Verify the answer makes sense',
        purpose: 'Validation',
      },
    ].slice(0, maxSteps);
  }

  /**
   * Generate generic reasoning guide when no domain matches.
   */
  private generateGenericReasoningGuide(): string {
    return `1. First, identify the key elements of the problem
2. Consider what information you have and what you need
3. Work through the logic step by step
4. Check your reasoning for errors
5. Formulate your final answer`;
  }

  /**
   * Generate a domain-specific enhanced prompt.
   */
  private generateDomainSpecificPrompt(
    prompt: string,
    pattern: DomainReasoningPattern,
    context: OptimizationContext
  ): string {
    const domainIntro = `[Domain: ${pattern.domain}]`;

    return `${domainIntro}

${prompt}

Apply ${pattern.domain} reasoning methodology:

${pattern.template}

${pattern.exampleSteps ? `Follow this structure:\n${pattern.exampleSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}` : ''}

Provide your complete analysis and final answer.`;
  }

  // ===========================================================================
  // Private Methods - Scoring
  // ===========================================================================

  /**
   * Estimate how well a CoT style fits this prompt.
   */
  private estimateStyleScore(
    style: NonNullable<ChainOfThoughtOptions['style']>,
    prompt: string,
    context: OptimizationContext
  ): number {
    const promptLength = prompt.length;
    const hasExamples = context.examples.length > 0;
    const complexity = this.estimateComplexity(prompt);

    let baseScore = 0.7;

    switch (style) {
      case 'simple':
        // Good for short, medium complexity
        if (promptLength < 500 && complexity < 0.6) baseScore = 0.8;
        else if (promptLength > 1000) baseScore = 0.6;
        break;

      case 'detailed':
        // Good for complex tasks
        if (complexity > 0.6) baseScore = 0.85;
        else if (complexity < 0.4) baseScore = 0.65;
        break;

      case 'structured':
        // Good for multi-step problems
        if (complexity > 0.5 && promptLength > 200) baseScore = 0.9;
        break;

      case 'zero-shot':
        // Good when brevity is key
        if (promptLength < 300) baseScore = 0.75;
        else baseScore = 0.6;
        break;
    }

    // Bonus for matching domain context
    if (context.domainHints.length > 0) {
      baseScore += 0.05;
    }

    return Math.min(1, baseScore);
  }

  /**
   * Estimate prompt complexity (0-1).
   */
  private estimateComplexity(prompt: string): number {
    let complexity = 0;

    // Length factor
    complexity += Math.min(0.3, prompt.length / 3000);

    // Multiple questions/requirements
    const questionMarks = (prompt.match(/\?/g) || []).length;
    complexity += Math.min(0.2, questionMarks * 0.05);

    // Technical terms (simplified heuristic)
    const technicalTerms = prompt.match(
      /\b(algorithm|function|calculate|analyze|implement|configure|process|validate|transform|optimize)\b/gi
    );
    if (technicalTerms) {
      complexity += Math.min(0.3, technicalTerms.length * 0.05);
    }

    // Nested structure indicators
    if (prompt.includes('if') && prompt.includes('then')) complexity += 0.1;
    if (prompt.includes('and') && prompt.includes('or')) complexity += 0.1;

    return Math.min(1, complexity);
  }

  /**
   * Evaluate effectiveness of CoT enhancement.
   */
  private async evaluateCoTEffectiveness(
    variant: PromptVariant
  ): Promise<ScoredVariant['scores']> {
    const content = variant.content;

    // Analyze CoT characteristics
    const hasStepByStep = /step\s*\d|step\s+by\s+step/i.test(content);
    const hasNumberedSteps = /^\s*\d+\./m.test(content);
    const hasReasoningStructure = /think|reason|consider|analyze/i.test(content);
    const promptTokens = this.estimateTokens(content);

    // Calculate dimension scores
    const clarity = hasStepByStep || hasNumberedSteps ? 0.85 : 0.7;
    const specificity = hasReasoningStructure ? 0.8 : 0.65;
    const taskAlignment = 0.75; // CoT generally improves alignment
    const efficiency =
      promptTokens < 500 ? 0.9 : promptTokens < 1000 ? 0.75 : 0.6;

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
   * Generate feedback for a CoT variant.
   */
  private generateCoTFeedback(scores: ScoredVariant['scores']): string {
    const feedback: string[] = [];

    if (scores.clarity >= 0.8) {
      feedback.push('Clear step-by-step structure');
    } else {
      feedback.push('Could benefit from more explicit steps');
    }

    if (scores.specificity >= 0.8) {
      feedback.push('Good reasoning guidance');
    } else {
      feedback.push('Consider adding domain-specific reasoning');
    }

    if (scores.efficiency < 0.7) {
      feedback.push('Prompt may be verbose');
    }

    return feedback.join('. ');
  }

  /**
   * Generate recommendations based on evaluation.
   */
  private generateRecommendations(variants: ScoredVariant[]): string[] {
    const recommendations: string[] = [];
    const best = variants[0];

    if (best.scores.clarity < 0.8) {
      recommendations.push(
        'Consider using structured CoT with numbered steps'
      );
    }

    if (best.scores.efficiency < 0.7) {
      recommendations.push(
        'Try zero-shot or simple CoT for more concise prompts'
      );
    }

    // Check if domain-specific variant performed well
    const hasDomainVariant = variants.some((v) =>
      v.content.includes('[Domain:')
    );
    if (!hasDomainVariant) {
      recommendations.push(
        'Consider adding domain-specific reasoning patterns'
      );
    }

    return recommendations;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a chain-of-thought technique with default or custom options.
 */
export function createChainOfThoughtTechnique(
  options?: ChainOfThoughtOptions
): ChainOfThoughtTechnique {
  return new ChainOfThoughtTechnique(options);
}
