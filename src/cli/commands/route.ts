/**
 * Route Command
 *
 * Select the best model for a given prompt based on task requirements,
 * budget, and quality preferences.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { config, Provider } from '../../utils/config.js';
import { logger, output, createSpinner } from '../../utils/logger.js';
import { estimateTokenCount } from '../../utils/metrics.js';

// Local model configuration type for CLI
interface ModelConfig {
  modelId: string;
  provider: string;
  maxContextTokens: number;
  maxOutputTokens: number;
  inputCostPer1k: number;
  outputCostPer1k: number;
  capabilities: {
    jsonMode: boolean;
    functionCalling: boolean;
    vision: boolean;
    streaming: boolean;
    systemPrompt: boolean;
    maxToolCalls?: number;
  };
}

// Budget levels
type BudgetLevel = 'low' | 'medium' | 'high';

// Quality levels
type QualityLevel = 'fast' | 'balanced' | 'best';

// Output format
type OutputFormat = 'text' | 'json';

interface RouteOptions {
  budget: BudgetLevel;
  quality: QualityLevel;
  providers?: string;
  output: OutputFormat;
}

// Model configurations with capabilities
const MODELS: ModelConfig[] = [
  // Anthropic
  {
    modelId: 'claude-opus-4-5-20251101',
    provider: 'anthropic',
    maxContextTokens: 200000,
    maxOutputTokens: 4096,
    inputCostPer1k: 0.015,
    outputCostPer1k: 0.075,
    capabilities: {
      jsonMode: true,
      functionCalling: true,
      vision: true,
      streaming: true,
      systemPrompt: true,
      maxToolCalls: 100
    }
  },
  {
    modelId: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    maxContextTokens: 200000,
    maxOutputTokens: 4096,
    inputCostPer1k: 0.003,
    outputCostPer1k: 0.015,
    capabilities: {
      jsonMode: true,
      functionCalling: true,
      vision: true,
      streaming: true,
      systemPrompt: true,
      maxToolCalls: 100
    }
  },
  {
    modelId: 'claude-3-5-haiku-20241022',
    provider: 'anthropic',
    maxContextTokens: 200000,
    maxOutputTokens: 4096,
    inputCostPer1k: 0.0008,
    outputCostPer1k: 0.004,
    capabilities: {
      jsonMode: true,
      functionCalling: true,
      vision: true,
      streaming: true,
      systemPrompt: true,
      maxToolCalls: 100
    }
  },
  // OpenAI
  {
    modelId: 'gpt-4o',
    provider: 'openai',
    maxContextTokens: 128000,
    maxOutputTokens: 4096,
    inputCostPer1k: 0.005,
    outputCostPer1k: 0.015,
    capabilities: {
      jsonMode: true,
      functionCalling: true,
      vision: true,
      streaming: true,
      systemPrompt: true,
      maxToolCalls: 128
    }
  },
  {
    modelId: 'gpt-4o-mini',
    provider: 'openai',
    maxContextTokens: 128000,
    maxOutputTokens: 16384,
    inputCostPer1k: 0.00015,
    outputCostPer1k: 0.0006,
    capabilities: {
      jsonMode: true,
      functionCalling: true,
      vision: true,
      streaming: true,
      systemPrompt: true,
      maxToolCalls: 128
    }
  },
  {
    modelId: 'o1',
    provider: 'openai',
    maxContextTokens: 200000,
    maxOutputTokens: 100000,
    inputCostPer1k: 0.015,
    outputCostPer1k: 0.06,
    capabilities: {
      jsonMode: false,
      functionCalling: false,
      vision: true,
      streaming: true,
      systemPrompt: false,
      maxToolCalls: 0
    }
  },
  // Google
  {
    modelId: 'gemini-2.0-flash',
    provider: 'google',
    maxContextTokens: 1000000,
    maxOutputTokens: 8192,
    inputCostPer1k: 0.00035,
    outputCostPer1k: 0.0015,
    capabilities: {
      jsonMode: true,
      functionCalling: true,
      vision: true,
      streaming: true,
      systemPrompt: true,
      maxToolCalls: 100
    }
  },
  {
    modelId: 'gemini-1.5-pro',
    provider: 'google',
    maxContextTokens: 2000000,
    maxOutputTokens: 8192,
    inputCostPer1k: 0.00125,
    outputCostPer1k: 0.005,
    capabilities: {
      jsonMode: true,
      functionCalling: true,
      vision: true,
      streaming: true,
      systemPrompt: true,
      maxToolCalls: 100
    }
  }
];

// Model quality tiers (subjective rating for general tasks)
const MODEL_QUALITY_TIERS: Record<string, number> = {
  'claude-opus-4-5-20251101': 10,
  'o1': 10,
  'gpt-4o': 9,
  'claude-sonnet-4-20250514': 9,
  'gemini-1.5-pro': 8,
  'gemini-2.0-flash': 7,
  'claude-3-5-haiku-20241022': 7,
  'gpt-4o-mini': 6,
  'o1-mini': 8
};

export const routeCommand = new Command('route')
  .description('Select the best model for a prompt based on requirements')
  .argument('<prompt>', 'The prompt to route')
  .option('-b, --budget <level>', 'Budget level (low, medium, high)', 'medium')
  .option('-q, --quality <level>', 'Quality requirement (fast, balanced, best)', 'balanced')
  .option('-p, --providers <list>', 'Allowed providers (comma-separated: anthropic,openai,google)')
  .option('-o, --output <format>', 'Output format (text, json)', 'text')
  .action(async (prompt: string, options: RouteOptions) => {
    try {
      await runRoute(prompt, options);
    } catch (error) {
      logger.error('Routing failed', { error: String(error) });
      process.exit(1);
    }
  });

async function runRoute(prompt: string, options: RouteOptions): Promise<void> {
  // Parse allowed providers
  const allowedProviders = parseProviders(options.providers);

  // Check configured providers
  const configuredProviders = config.getConfiguredProviders();
  if (configuredProviders.length === 0) {
    console.log(chalk.red('Error: No API providers configured.'));
    console.log(chalk.yellow('Run: prompt-optimizer config set anthropic.apiKey <your-key>'));
    process.exit(1);
  }

  // Filter to only use configured providers
  const availableProviders = allowedProviders.filter(p =>
    configuredProviders.includes(p as Provider)
  );

  if (availableProviders.length === 0) {
    console.log(chalk.red('Error: None of the specified providers are configured.'));
    console.log(chalk.yellow(`Configured providers: ${configuredProviders.join(', ')}`));
    process.exit(1);
  }

  const spinner = createSpinner('Analyzing prompt and selecting model...').start();

  try {
    // Analyze prompt
    const analysis = analyzePrompt(prompt);

    // Filter and score models
    const candidates = MODELS.filter(m =>
      availableProviders.includes(m.provider) &&
      configuredProviders.includes(m.provider as Provider)
    );

    const scored = scoreModels(candidates, analysis, options);
    const sorted = scored.sort((a, b) => b.score - a.score);

    spinner.succeed('Model selection complete');

    // Output results
    if (options.output === 'json') {
      outputJson(prompt, analysis, sorted);
    } else {
      outputText(prompt, analysis, sorted, options);
    }

  } catch (error) {
    spinner.fail('Routing failed');
    throw error;
  }
}

function parseProviders(input?: string): string[] {
  if (!input) {
    return ['anthropic', 'openai', 'google'];
  }

  const validProviders = ['anthropic', 'openai', 'google'];
  const requested = input.split(',').map(p => p.trim().toLowerCase());

  return requested.filter(p => validProviders.includes(p));
}

interface PromptAnalysis {
  tokenCount: number;
  complexity: 'simple' | 'moderate' | 'complex';
  taskType: string;
  requiresReasoning: boolean;
  requiresCreativity: boolean;
  requiresCode: boolean;
  requiresVision: boolean;
  estimatedOutputTokens: number;
}

function analyzePrompt(prompt: string): PromptAnalysis {
  const tokenCount = estimateTokenCount(prompt);
  const words = prompt.toLowerCase().split(/\s+/);

  // Detect task type and requirements
  const codeKeywords = ['code', 'function', 'program', 'implement', 'debug', 'refactor', 'api', 'script'];
  const reasoningKeywords = ['analyze', 'reason', 'explain', 'why', 'because', 'logic', 'proof', 'derive'];
  const creativeKeywords = ['creative', 'story', 'poem', 'write', 'imagine', 'design', 'novel', 'unique'];
  const complexKeywords = ['complex', 'detailed', 'comprehensive', 'thorough', 'in-depth'];

  const requiresCode = words.some(w => codeKeywords.includes(w));
  const requiresReasoning = words.some(w => reasoningKeywords.includes(w));
  const requiresCreativity = words.some(w => creativeKeywords.includes(w));
  const isComplex = words.some(w => complexKeywords.includes(w)) || tokenCount > 500;

  // Determine task type
  let taskType = 'general';
  if (requiresCode) taskType = 'coding';
  else if (requiresReasoning) taskType = 'analysis';
  else if (requiresCreativity) taskType = 'creative';

  // Determine complexity
  let complexity: 'simple' | 'moderate' | 'complex' = 'moderate';
  if (tokenCount < 50 && !isComplex) complexity = 'simple';
  else if (tokenCount > 200 || isComplex) complexity = 'complex';

  // Estimate output tokens
  let estimatedOutputTokens = 500;
  if (complexity === 'simple') estimatedOutputTokens = 200;
  if (complexity === 'complex') estimatedOutputTokens = 1500;
  if (requiresCode) estimatedOutputTokens = Math.max(estimatedOutputTokens, 1000);

  return {
    tokenCount,
    complexity,
    taskType,
    requiresReasoning,
    requiresCreativity,
    requiresCode,
    requiresVision: false, // Would need image detection
    estimatedOutputTokens
  };
}

interface ScoredModel {
  model: ModelConfig;
  score: number;
  estimatedCost: number;
  reasoning: string[];
}

function scoreModels(
  models: ModelConfig[],
  analysis: PromptAnalysis,
  options: RouteOptions
): ScoredModel[] {
  return models.map(model => {
    let score = 50; // Base score
    const reasoning: string[] = [];

    // Quality tier contribution
    const qualityTier = MODEL_QUALITY_TIERS[model.modelId] || 5;

    // Budget scoring
    const costPer1k = model.inputCostPer1k + model.outputCostPer1k;
    const estimatedCost = (analysis.tokenCount / 1000) * model.inputCostPer1k +
                          (analysis.estimatedOutputTokens / 1000) * model.outputCostPer1k;

    switch (options.budget) {
      case 'low':
        if (costPer1k < 0.005) {
          score += 30;
          reasoning.push('Excellent cost efficiency');
        } else if (costPer1k < 0.02) {
          score += 10;
          reasoning.push('Moderate cost');
        } else {
          score -= 20;
          reasoning.push('Higher cost');
        }
        break;
      case 'medium':
        if (costPer1k < 0.02) {
          score += 20;
          reasoning.push('Good cost-quality balance');
        }
        break;
      case 'high':
        // Budget not a concern
        score += 10;
        reasoning.push('Budget unconstrained');
        break;
    }

    // Quality scoring
    switch (options.quality) {
      case 'fast':
        if (costPer1k < 0.002) {
          score += 25;
          reasoning.push('Optimized for speed');
        }
        if (model.modelId.includes('flash') || model.modelId.includes('mini') || model.modelId.includes('haiku')) {
          score += 15;
          reasoning.push('Fast model variant');
        }
        break;
      case 'balanced':
        score += qualityTier * 2;
        reasoning.push(`Quality tier: ${qualityTier}/10`);
        break;
      case 'best':
        score += qualityTier * 4;
        reasoning.push(`Quality tier: ${qualityTier}/10`);
        if (model.modelId.includes('opus') || model.modelId === 'o1' || model.modelId === 'gpt-4o') {
          score += 15;
          reasoning.push('Top-tier model');
        }
        break;
    }

    // Task-specific scoring
    if (analysis.requiresReasoning && (model.modelId.includes('o1') || model.modelId.includes('opus'))) {
      score += 15;
      reasoning.push('Strong reasoning capabilities');
    }

    if (analysis.requiresCode) {
      if (model.modelId.includes('sonnet') || model.modelId.includes('gpt-4o')) {
        score += 10;
        reasoning.push('Excellent for code');
      }
    }

    if (analysis.complexity === 'complex' && model.maxContextTokens >= 100000) {
      score += 10;
      reasoning.push('Large context window');
    }

    return {
      model,
      score,
      estimatedCost,
      reasoning
    };
  });
}

function outputText(
  _prompt: string,
  analysis: PromptAnalysis,
  scored: ScoredModel[],
  options: RouteOptions
): void {
  output.heading('Model Routing Results');

  // Analysis summary
  output.subheading('Prompt Analysis:');
  output.key('Token Count', analysis.tokenCount.toString());
  output.key('Complexity', analysis.complexity);
  output.key('Task Type', analysis.taskType);
  output.key('Estimated Output', `${analysis.estimatedOutputTokens} tokens`);

  output.newline();
  output.subheading('Selection Criteria:');
  output.key('Budget', options.budget);
  output.key('Quality', options.quality);

  output.newline();
  output.divider();

  // Recommended model
  const recommended = scored[0];
  output.newline();
  console.log(chalk.bold.green('Recommended Model:'));
  console.log(`  ${chalk.bold(recommended.model.modelId)} (${recommended.model.provider})`);
  console.log(`  ${chalk.dim('Score:')} ${recommended.score}`);
  console.log(`  ${chalk.dim('Est. Cost:')} $${recommended.estimatedCost.toFixed(6)}`);
  console.log(`  ${chalk.dim('Reasoning:')}`);
  recommended.reasoning.forEach(r => console.log(`    - ${r}`));

  // Alternatives
  if (scored.length > 1) {
    output.newline();
    output.subheading('Alternatives:');

    scored.slice(1, 4).forEach((s, i) => {
      console.log(`  ${i + 2}. ${s.model.modelId} (${s.model.provider})`);
      console.log(`     Score: ${s.score} | Est. Cost: $${s.estimatedCost.toFixed(6)}`);
    });
  }
}

function outputJson(
  prompt: string,
  analysis: PromptAnalysis,
  scored: ScoredModel[]
): void {
  const result = {
    prompt: prompt.slice(0, 200),
    analysis,
    recommended: {
      modelId: scored[0].model.modelId,
      provider: scored[0].model.provider,
      score: scored[0].score,
      estimatedCost: scored[0].estimatedCost,
      reasoning: scored[0].reasoning
    },
    alternatives: scored.slice(1, 4).map(s => ({
      modelId: s.model.modelId,
      provider: s.model.provider,
      score: s.score,
      estimatedCost: s.estimatedCost
    })),
    timestamp: new Date().toISOString()
  };

  console.log(JSON.stringify(result, null, 2));
}
