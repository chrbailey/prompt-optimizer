/**
 * Synthetic Data Generation Technique
 *
 * Auto-generates test cases from task descriptions for prompt evaluation.
 * Based on Promptomatix research approach for automated prompt testing.
 *
 * Key concepts:
 * - Generate diverse test inputs from task description
 * - Create expected outputs for validation
 * - Domain-aware generation for better relevance
 * - Quality filtering to ensure useful test cases
 *
 * @module core/techniques/synthetic-data
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
 * Configuration specific to synthetic data generation
 */
export interface SyntheticDataOptions extends TechniqueOptions {
  /** Number of test cases to generate */
  numTestCases?: number;
  /** Distribution of difficulty levels */
  difficultyDistribution?: {
    easy: number;
    medium: number;
    hard: number;
  };
  /** Model for generating test cases */
  generatorModel?: string;
  /** Model for validating test cases */
  validatorModel?: string;
  /** Domain focus for generation */
  domainFocus?: string;
  /** Include edge cases */
  includeEdgeCases?: boolean;
  /** Minimum quality threshold for test cases (0-1) */
  qualityThreshold?: number;
}

/**
 * A synthetic test case for evaluating prompts
 */
export interface SyntheticTestCase {
  /** Unique identifier */
  id: string;
  /** Description of what this test case covers */
  description: string;
  /** The input to test with */
  input: string;
  /** Expected output (if determinable) */
  expectedOutput?: string;
  /** Validation criteria for judging outputs */
  validationCriteria: ValidationCriterion[];
  /** Difficulty level */
  difficulty: 'easy' | 'medium' | 'hard';
  /** Domain/category */
  domain?: string;
  /** Tags for categorization */
  tags: string[];
  /** Quality score from validation */
  qualityScore: number;
}

/**
 * Criterion for validating test output
 */
export interface ValidationCriterion {
  /** Type of validation */
  type: 'contains' | 'excludes' | 'format' | 'semantic' | 'length' | 'custom';
  /** What to check for */
  value: string;
  /** Importance weight (0-1) */
  weight: number;
  /** Description of this criterion */
  description: string;
}

/**
 * Result of running a test case against a prompt
 */
export interface TestCaseResult {
  testCase: SyntheticTestCase;
  passed: boolean;
  score: number;
  actualOutput: string;
  criteriaResults: CriterionResult[];
  latencyMs: number;
}

/**
 * Result of evaluating a single criterion
 */
interface CriterionResult {
  criterion: ValidationCriterion;
  passed: boolean;
  score: number;
  feedback?: string;
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Synthetic Data Generation Technique
 *
 * Automatically generates test cases from task descriptions to enable
 * automated prompt evaluation without manual test creation.
 *
 * @example
 * ```typescript
 * const technique = new SyntheticDataTechnique({
 *   numTestCases: 10,
 *   domainFocus: 'SAP configuration',
 *   includeEdgeCases: true
 * });
 *
 * // Generate test cases
 * const testCases = await technique.generateTestCases(prompt, context);
 *
 * // Apply technique to optimize prompt
 * const variants = await technique.apply(prompt, context);
 * ```
 */
export class SyntheticDataTechnique extends OptimizationTechnique {
  // ===========================================================================
  // Properties
  // ===========================================================================

  readonly name: TechniqueName = 'self_consistency'; // Maps to self_consistency for test-based optimization
  readonly priority: number = 7;
  readonly description: string =
    'Generate synthetic test cases to evaluate and improve prompts';

  private syntheticOptions: SyntheticDataOptions;
  private generatedTestCases: SyntheticTestCase[] = [];

  // ===========================================================================
  // Constructor
  // ===========================================================================

  constructor(options: SyntheticDataOptions = {}) {
    super(options);
    this.syntheticOptions = {
      numTestCases: 10,
      difficultyDistribution: { easy: 0.3, medium: 0.5, hard: 0.2 },
      includeEdgeCases: true,
      qualityThreshold: 0.6,
      ...options,
    };
  }

  // ===========================================================================
  // Public Methods
  // ===========================================================================

  /**
   * Apply synthetic data generation to optimize prompts.
   * Generates test cases, evaluates the prompt, and suggests improvements.
   */
  async apply(
    prompt: string,
    context: OptimizationContext
  ): Promise<PromptVariant[]> {
    // Step 1: Generate synthetic test cases
    this.generatedTestCases = await this.generateTestCases(prompt, context);

    // Step 2: Run original prompt against test cases
    const originalResults = await this.runTestCases(prompt, this.generatedTestCases);
    const originalScore = this.aggregateTestResults(originalResults);

    // Step 3: Analyze failures and generate improved variants
    const failedCases = originalResults.filter((r) => !r.passed);
    const variants: PromptVariant[] = [];

    // Generate improvements based on failure analysis
    if (failedCases.length > 0) {
      const improvedPrompt = await this.generateImprovementFromFailures(
        prompt,
        failedCases,
        context
      );

      // Evaluate improved prompt
      const improvedResults = await this.runTestCases(
        improvedPrompt,
        this.generatedTestCases
      );
      const improvedScore = this.aggregateTestResults(improvedResults);

      variants.push(
        this.createVariant(
          improvedPrompt,
          improvedScore,
          this.syntheticOptions.generatorModel || this.defaultModel
        )
      );
    }

    // Step 4: Generate variant optimized for edge cases
    if (this.syntheticOptions.includeEdgeCases) {
      const edgeCasePrompt = await this.generateEdgeCaseOptimizedPrompt(
        prompt,
        this.generatedTestCases.filter((tc) => tc.difficulty === 'hard'),
        context
      );

      const edgeResults = await this.runTestCases(
        edgeCasePrompt,
        this.generatedTestCases
      );
      const edgeScore = this.aggregateTestResults(edgeResults);

      variants.push(this.createVariant(edgeCasePrompt, edgeScore));
    }

    // Add original for comparison
    variants.push(this.createVariant(prompt, originalScore));

    return variants.sort((a, b) => b.score - a.score);
  }

  /**
   * Evaluate variants using the generated test cases.
   */
  async evaluate(variants: PromptVariant[]): Promise<EvaluationResult> {
    const scoredVariants: ScoredVariant[] = [];
    const startTime = Date.now();

    for (const variant of variants) {
      const testResults = await this.runTestCases(
        variant.content,
        this.generatedTestCases
      );
      const aggregateScore = this.aggregateTestResults(testResults);

      const scores = this.calculateDetailedScores(testResults);

      scoredVariants.push({
        ...variant,
        score: aggregateScore,
        scores,
        feedback: this.generateTestFeedback(testResults),
      });
    }

    // Sort by score
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

    // Original is typically last in sorted list (or find it explicitly)
    const originalScore = scoredVariants[scoredVariants.length - 1].scores.overall;
    const improvement = this.calculateImprovement(originalScore, best.scores.overall);

    return {
      variants: scoredVariants,
      best,
      metrics: {
        variantsEvaluated: scoredVariants.length,
        averageScore: avgScore,
        scoreVariance: variance,
        improvementOverOriginal: improvement,
        evaluationTimeMs: Date.now() - startTime,
      },
      recommendations: this.generateRecommendations(scoredVariants),
    };
  }

  /**
   * Generate synthetic test cases for a prompt.
   */
  async generateTestCases(
    prompt: string,
    context: OptimizationContext
  ): Promise<SyntheticTestCase[]> {
    const testCases: SyntheticTestCase[] = [];
    const numCases = this.syntheticOptions.numTestCases!;
    const dist = this.syntheticOptions.difficultyDistribution!;

    // Calculate cases per difficulty
    const easyCases = Math.floor(numCases * dist.easy);
    const mediumCases = Math.floor(numCases * dist.medium);
    const hardCases = numCases - easyCases - mediumCases;

    // Generate cases for each difficulty
    const easyTestCases = await this.generateCasesForDifficulty(
      prompt,
      'easy',
      easyCases,
      context
    );
    const mediumTestCases = await this.generateCasesForDifficulty(
      prompt,
      'medium',
      mediumCases,
      context
    );
    const hardTestCases = await this.generateCasesForDifficulty(
      prompt,
      'hard',
      hardCases,
      context
    );

    testCases.push(...easyTestCases, ...mediumTestCases, ...hardTestCases);

    // Filter by quality
    const qualifiedCases = testCases.filter(
      (tc) => tc.qualityScore >= this.syntheticOptions.qualityThreshold!
    );

    return qualifiedCases;
  }

  /**
   * Get the generated test cases for external use.
   */
  getTestCases(): SyntheticTestCase[] {
    return [...this.generatedTestCases];
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Generate test cases for a specific difficulty level.
   */
  private async generateCasesForDifficulty(
    prompt: string,
    difficulty: 'easy' | 'medium' | 'hard',
    count: number,
    context: OptimizationContext
  ): Promise<SyntheticTestCase[]> {
    if (count === 0) return [];

    const generationPrompt = this.buildTestCaseGenerationPrompt(
      prompt,
      difficulty,
      count,
      context
    );

    const result = await this.complete(generationPrompt, {
      temperature: 0.7,
      maxTokens: 2048,
      model: this.syntheticOptions.generatorModel,
    });

    if (!result.success) {
      return [];
    }

    // Parse generated test cases
    const testCases = this.parseTestCases(result.value.content, difficulty);

    // Validate and score each test case
    const validatedCases: SyntheticTestCase[] = [];
    for (const tc of testCases) {
      const qualityScore = await this.validateTestCase(tc, prompt);
      if (qualityScore > 0) {
        validatedCases.push({ ...tc, qualityScore });
      }
    }

    return validatedCases;
  }

  /**
   * Build the prompt for generating test cases.
   */
  private buildTestCaseGenerationPrompt(
    prompt: string,
    difficulty: 'easy' | 'medium' | 'hard',
    count: number,
    context: OptimizationContext
  ): string {
    const difficultyDescriptions = {
      easy: 'straightforward, typical use cases with clear inputs',
      medium: 'moderately complex cases with some ambiguity or multiple steps',
      hard: 'edge cases, unusual inputs, or complex scenarios that test limits',
    };

    const domainContext = this.syntheticOptions.domainFocus
      ? `Domain focus: ${this.syntheticOptions.domainFocus}`
      : context.domainHints.length > 0
        ? `Domain hints: ${context.domainHints.join(', ')}`
        : '';

    return `Generate ${count} synthetic test cases for evaluating the following prompt.

PROMPT TO TEST:
${prompt}

DIFFICULTY LEVEL: ${difficulty.toUpperCase()}
(${difficultyDescriptions[difficulty]})

${domainContext}

For each test case, provide:
1. A unique ID (format: tc-${difficulty}-N)
2. A brief description of what the test case covers
3. The input that would be given to the prompt
4. Expected output characteristics (what a good response should contain)
5. 2-3 validation criteria (what to check in the output)
6. Relevant tags

Format your response as JSON array:
\`\`\`json
[
  {
    "id": "tc-${difficulty}-1",
    "description": "Brief description",
    "input": "The test input",
    "expectedOutput": "What the output should contain or achieve",
    "validationCriteria": [
      {"type": "contains", "value": "expected element", "weight": 0.5, "description": "Should include X"},
      {"type": "format", "value": "json|markdown|plain", "weight": 0.3, "description": "Output format"}
    ],
    "tags": ["tag1", "tag2"]
  }
]
\`\`\`

Generate diverse test cases that cover different aspects of the task.`;
  }

  /**
   * Parse test cases from LLM response.
   */
  private parseTestCases(
    response: string,
    difficulty: 'easy' | 'medium' | 'hard'
  ): SyntheticTestCase[] {
    const parsed = this.parseJSON<Array<Partial<SyntheticTestCase>>>(response);
    if (!parsed || !Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(
        (tc) => tc.id && tc.description && tc.input && tc.validationCriteria
      )
      .map((tc) => ({
        id: tc.id!,
        description: tc.description!,
        input: tc.input!,
        expectedOutput: tc.expectedOutput,
        validationCriteria: (tc.validationCriteria || []).map((vc) => ({
          type: vc.type || 'contains',
          value: vc.value || '',
          weight: vc.weight || 0.5,
          description: vc.description || '',
        })),
        difficulty,
        domain: this.syntheticOptions.domainFocus,
        tags: tc.tags || [],
        qualityScore: 0, // Will be set after validation
      }));
  }

  /**
   * Validate a test case and return quality score.
   */
  private async validateTestCase(
    testCase: SyntheticTestCase,
    prompt: string
  ): Promise<number> {
    // Basic validation checks
    let score = 1.0;

    // Check input has reasonable length
    if (testCase.input.length < 10) score -= 0.3;
    if (testCase.input.length > 2000) score -= 0.2;

    // Check validation criteria exist
    if (testCase.validationCriteria.length === 0) score -= 0.4;
    if (testCase.validationCriteria.length > 5) score -= 0.1;

    // Check weights sum reasonably
    const weightSum = testCase.validationCriteria.reduce(
      (sum, vc) => sum + vc.weight,
      0
    );
    if (weightSum < 0.5 || weightSum > 2) score -= 0.2;

    // Check relevance to prompt (basic keyword overlap)
    const promptWords = new Set(prompt.toLowerCase().split(/\s+/));
    const inputWords = testCase.input.toLowerCase().split(/\s+/);
    const overlap = inputWords.filter((w) => promptWords.has(w)).length;
    if (overlap < 2) score -= 0.2;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Run test cases against a prompt and collect results.
   */
  private async runTestCases(
    prompt: string,
    testCases: SyntheticTestCase[]
  ): Promise<TestCaseResult[]> {
    const results: TestCaseResult[] = [];

    for (const testCase of testCases) {
      const startTime = Date.now();

      // Build the full prompt with test input
      const fullPrompt = `${prompt}\n\nInput: ${testCase.input}`;

      const result = await this.complete(fullPrompt, {
        temperature: 0.3,
        maxTokens: 1024,
      });

      const latencyMs = Date.now() - startTime;

      if (!result.success) {
        results.push({
          testCase,
          passed: false,
          score: 0,
          actualOutput: 'Error: ' + result.error.message,
          criteriaResults: [],
          latencyMs,
        });
        continue;
      }

      const actualOutput = result.value.content;
      const criteriaResults = this.evaluateCriteria(
        actualOutput,
        testCase.validationCriteria
      );

      const score =
        criteriaResults.reduce((sum, cr) => sum + cr.score * cr.criterion.weight, 0) /
        testCase.validationCriteria.reduce((sum, vc) => sum + vc.weight, 0);

      results.push({
        testCase,
        passed: score >= 0.7,
        score,
        actualOutput,
        criteriaResults,
        latencyMs,
      });
    }

    return results;
  }

  /**
   * Evaluate validation criteria against actual output.
   */
  private evaluateCriteria(
    output: string,
    criteria: ValidationCriterion[]
  ): CriterionResult[] {
    return criteria.map((criterion) => {
      let passed = false;
      let score = 0;
      let feedback: string | undefined;

      const lowerOutput = output.toLowerCase();
      const lowerValue = criterion.value.toLowerCase();

      switch (criterion.type) {
        case 'contains':
          passed = lowerOutput.includes(lowerValue);
          score = passed ? 1 : 0;
          feedback = passed
            ? `Contains "${criterion.value}"`
            : `Missing "${criterion.value}"`;
          break;

        case 'excludes':
          passed = !lowerOutput.includes(lowerValue);
          score = passed ? 1 : 0;
          feedback = passed
            ? `Correctly excludes "${criterion.value}"`
            : `Incorrectly includes "${criterion.value}"`;
          break;

        case 'format':
          if (criterion.value === 'json') {
            try {
              JSON.parse(output);
              passed = true;
              score = 1;
            } catch {
              passed = false;
              score = 0;
            }
          } else if (criterion.value === 'markdown') {
            passed = /[#*`\[\]]/.test(output);
            score = passed ? 1 : 0.5;
          } else {
            passed = true;
            score = 0.8;
          }
          feedback = passed
            ? `Correct format: ${criterion.value}`
            : `Expected format: ${criterion.value}`;
          break;

        case 'length':
          const targetLength = parseInt(criterion.value) || 100;
          const actualLength = output.length;
          const ratio = Math.min(actualLength, targetLength) / Math.max(actualLength, targetLength);
          passed = ratio > 0.5;
          score = ratio;
          feedback = `Length: ${actualLength} chars (target: ~${targetLength})`;
          break;

        case 'semantic':
          // Semantic matching would require LLM call - simplified here
          passed = true;
          score = 0.7;
          feedback = 'Semantic evaluation requires LLM (approximated)';
          break;

        default:
          passed = true;
          score = 0.5;
          feedback = 'Unknown criterion type';
      }

      return { criterion, passed, score, feedback };
    });
  }

  /**
   * Aggregate test results into a single score.
   */
  private aggregateTestResults(results: TestCaseResult[]): number {
    if (results.length === 0) return 0;

    // Weight by difficulty
    const weights = { easy: 1, medium: 1.5, hard: 2 };
    let totalWeight = 0;
    let weightedScore = 0;

    for (const result of results) {
      const weight = weights[result.testCase.difficulty];
      totalWeight += weight;
      weightedScore += result.score * weight;
    }

    return weightedScore / totalWeight;
  }

  /**
   * Generate an improved prompt based on test failures.
   */
  private async generateImprovementFromFailures(
    originalPrompt: string,
    failures: TestCaseResult[],
    context: OptimizationContext
  ): Promise<string> {
    const failureSummary = failures
      .slice(0, 5) // Limit to top 5 failures
      .map(
        (f) =>
          `- ${f.testCase.description}: ${f.criteriaResults.filter((cr) => !cr.passed).map((cr) => cr.feedback).join(', ')}`
      )
      .join('\n');

    const improvementPrompt = `You are improving a prompt based on test case failures.

ORIGINAL PROMPT:
${originalPrompt}

TEST FAILURES:
${failureSummary}

DOMAIN CONTEXT:
${context.domainHints.join(', ') || 'General purpose'}

Analyze the failures and improve the prompt to address these issues:
1. Add clarity where tests showed ambiguity
2. Add specificity where outputs were too vague
3. Add format guidance if formatting was inconsistent
4. Strengthen instructions that were commonly missed

Output ONLY the improved prompt, nothing else.`;

    const result = await this.complete(improvementPrompt, {
      temperature: 0.5,
      maxTokens: 2048,
    });

    if (!result.success) {
      return originalPrompt;
    }

    return result.value.content.trim();
  }

  /**
   * Generate a prompt optimized for edge cases.
   */
  private async generateEdgeCaseOptimizedPrompt(
    originalPrompt: string,
    hardCases: SyntheticTestCase[],
    context: OptimizationContext
  ): Promise<string> {
    if (hardCases.length === 0) {
      return originalPrompt;
    }

    const edgeCaseDescriptions = hardCases
      .map((tc) => `- ${tc.description}: ${tc.input.slice(0, 100)}...`)
      .join('\n');

    const optimizationPrompt = `Optimize this prompt to better handle edge cases and difficult scenarios.

ORIGINAL PROMPT:
${originalPrompt}

DIFFICULT TEST CASES IT STRUGGLES WITH:
${edgeCaseDescriptions}

Create a more robust version that:
1. Handles edge cases gracefully
2. Has clear fallback behaviors
3. Validates inputs when appropriate
4. Provides helpful error guidance

Output ONLY the improved prompt, nothing else.`;

    const result = await this.complete(optimizationPrompt, {
      temperature: 0.6,
      maxTokens: 2048,
    });

    if (!result.success) {
      return originalPrompt;
    }

    return result.value.content.trim();
  }

  /**
   * Calculate detailed scores from test results.
   */
  private calculateDetailedScores(
    results: TestCaseResult[]
  ): ScoredVariant['scores'] {
    const overall = this.aggregateTestResults(results);

    // Calculate per-difficulty scores
    const easyResults = results.filter((r) => r.testCase.difficulty === 'easy');
    const mediumResults = results.filter((r) => r.testCase.difficulty === 'medium');
    const hardResults = results.filter((r) => r.testCase.difficulty === 'hard');

    const easyScore =
      easyResults.length > 0
        ? easyResults.reduce((s, r) => s + r.score, 0) / easyResults.length
        : 1;
    const hardScore =
      hardResults.length > 0
        ? hardResults.reduce((s, r) => s + r.score, 0) / hardResults.length
        : overall;

    // Map test performance to quality dimensions
    return {
      overall,
      clarity: easyScore, // Easy tests measure basic clarity
      specificity: (overall + hardScore) / 2, // Hard tests need specificity
      taskAlignment: overall,
      efficiency:
        1 -
        Math.min(
          1,
          results.reduce((s, r) => s + r.latencyMs, 0) / results.length / 2000
        ),
    };
  }

  /**
   * Generate human-readable feedback from test results.
   */
  private generateTestFeedback(results: TestCaseResult[]): string {
    const passed = results.filter((r) => r.passed).length;
    const total = results.length;

    const feedback: string[] = [`Passed ${passed}/${total} test cases`];

    // Identify common failure patterns
    const failedCriteria = results
      .flatMap((r) => r.criteriaResults)
      .filter((cr) => !cr.passed);

    const criteriaTypes = new Map<string, number>();
    for (const cr of failedCriteria) {
      const count = criteriaTypes.get(cr.criterion.type) || 0;
      criteriaTypes.set(cr.criterion.type, count + 1);
    }

    if (criteriaTypes.size > 0) {
      feedback.push(
        'Common issues: ' +
          [...criteriaTypes.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([type, count]) => `${type} (${count})`)
            .join(', ')
      );
    }

    return feedback.join('. ');
  }

  /**
   * Generate recommendations based on evaluation.
   */
  private generateRecommendations(variants: ScoredVariant[]): string[] {
    const recommendations: string[] = [];
    const best = variants[0];

    if (best.scores.clarity < 0.7) {
      recommendations.push(
        'Consider adding more explicit instructions for basic cases'
      );
    }

    if (best.scores.specificity < 0.7) {
      recommendations.push(
        'Add more specific guidance for complex scenarios'
      );
    }

    if (best.scores.efficiency < 0.6) {
      recommendations.push(
        'Response times are high - consider simplifying the prompt'
      );
    }

    const passRate = best.score;
    if (passRate < 0.8) {
      recommendations.push(
        `Current pass rate is ${(passRate * 100).toFixed(0)}% - more iteration recommended`
      );
    }

    return recommendations;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a synthetic data technique with default or custom options.
 */
export function createSyntheticDataTechnique(
  options?: SyntheticDataOptions
): SyntheticDataTechnique {
  return new SyntheticDataTechnique(options);
}
