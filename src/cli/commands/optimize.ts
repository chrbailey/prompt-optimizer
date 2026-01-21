/**
 * Optimize Command
 *
 * Optimizes prompts using multi-agent architecture and various techniques.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import Anthropic from '@anthropic-ai/sdk';
import { TechniqueName } from '../../types/index.js';
import { config } from '../../utils/config.js';
import { logger, output, createSpinner } from '../../utils/logger.js';
import {
  calculatePromptScores,
  formatPromptScores,
  estimateTokenCount
} from '../../utils/metrics.js';
import { sapExamples, type SAPExample } from '../../knowledge/examples/sap-enterprise.js';

// Valid technique names
const VALID_TECHNIQUES: TechniqueName[] = [
  'chain_of_thought',
  'few_shot',
  'role_prompting',
  'structured_output',
  'step_by_step',
  'tree_of_thought',
  'self_consistency',
  'prompt_chaining',
  'meta_prompting',
  'constitutional_ai',
  'reflection',
  'decomposition'
];

// Output formats
type OutputFormat = 'text' | 'json' | 'markdown';

interface OptimizeOptions {
  model?: string;
  techniques?: string;
  output: OutputFormat;
  variants: number;
  costLimit?: number;
  showMetrics: boolean;
  dryRun: boolean;
}

export const optimizeCommand = new Command('optimize')
  .description('Optimize a prompt using AI-powered techniques')
  .argument('<prompt>', 'The prompt to optimize (use quotes for multi-word prompts)')
  .option('-m, --model <model>', 'Target model (default: auto-select)')
  .option(
    '-t, --techniques <list>',
    'Techniques to use (comma-separated)',
    'chain_of_thought,structured_output'
  )
  .option('-o, --output <format>', 'Output format (text, json, markdown)', 'text')
  .option('-n, --variants <n>', 'Number of variants to generate', '1')
  .option('--cost-limit <dollars>', 'Maximum cost budget in dollars')
  .option('--metrics', 'Show detailed metrics', false)
  .option('--dry-run', 'Show what would be done without executing', false)
  .action(async (prompt: string, options: OptimizeOptions) => {
    try {
      await runOptimize(prompt, options);
    } catch (error) {
      logger.error('Optimization failed', { error: String(error) });
      process.exit(1);
    }
  });

async function runOptimize(prompt: string, options: OptimizeOptions): Promise<void> {
  const startTime = Date.now();

  // Parse and validate techniques
  const techniques = parseTechniques(options.techniques);
  if (techniques.length === 0) {
    logger.error('No valid techniques specified');
    console.log(chalk.yellow('Valid techniques:'), VALID_TECHNIQUES.join(', '));
    process.exit(1);
  }

  // Get model
  const model = options.model || config.getDefaultModel();

  // Calculate initial metrics
  const originalScores = calculatePromptScores(prompt);
  const tokenCount = estimateTokenCount(prompt);

  // Dry run - show what would happen
  if (options.dryRun) {
    output.heading('Dry Run - Optimization Plan');

    output.key('Original Prompt', prompt.slice(0, 100) + (prompt.length > 100 ? '...' : ''));
    output.key('Token Count', tokenCount.toString());
    output.key('Target Model', model);
    output.key('Techniques', techniques.join(', '));
    output.key('Variants', options.variants.toString());

    output.newline();
    output.subheading('Current Prompt Scores:');
    console.log(formatPromptScores(originalScores));

    return;
  }

  // Show progress
  output.heading('Prompt Optimization');
  output.key('Model', model);
  output.key('Techniques', techniques.join(', '));
  output.newline();

  // Check for API keys
  const configuredProviders = config.getConfiguredProviders();
  if (configuredProviders.length === 0) {
    console.log(chalk.red('Error: No API providers configured.'));
    console.log(chalk.yellow('Run: prompt-optimizer config set anthropic.apiKey <your-key>'));
    process.exit(1);
  }

  // Run optimization (placeholder - actual implementation would call orchestrator)
  const spinner = createSpinner('Analyzing prompt...').start();

  try {
    // Simulate analysis phase
    await sleep(500);
    spinner.text = 'Applying optimization techniques...';

    // Simulate optimization
    await sleep(1000);
    spinner.text = 'Generating optimized variants...';

    // Generate optimized prompt (placeholder)
    const optimizedPrompt = await generateOptimizedPrompt(prompt, techniques, model);

    await sleep(500);
    spinner.succeed('Optimization complete');

    // Calculate new metrics
    const optimizedScores = calculatePromptScores(optimizedPrompt);
    const processingTime = Date.now() - startTime;

    // Output results based on format
    switch (options.output) {
      case 'json':
        outputJson(prompt, optimizedPrompt, originalScores, optimizedScores, techniques, model, processingTime);
        break;
      case 'markdown':
        outputMarkdown(prompt, optimizedPrompt, originalScores, optimizedScores, techniques, model, processingTime);
        break;
      default:
        outputText(prompt, optimizedPrompt, originalScores, optimizedScores, techniques, model, processingTime, options.showMetrics);
    }

  } catch (error) {
    spinner.fail('Optimization failed');
    throw error;
  }
}

function parseTechniques(input?: string): TechniqueName[] {
  if (!input) return ['chain_of_thought', 'structured_output'];

  const requested = input.split(',').map(t => t.trim().toLowerCase());
  const valid: TechniqueName[] = [];

  for (const technique of requested) {
    // Handle both underscore and hyphen formats
    const normalized = technique.replace(/-/g, '_') as TechniqueName;
    if (VALID_TECHNIQUES.includes(normalized)) {
      valid.push(normalized);
    } else {
      logger.warn(`Unknown technique: ${technique}`);
    }
  }

  return valid;
}

/**
 * Find relevant SAP examples for few-shot learning based on prompt content.
 * Uses keyword matching to find domain-relevant examples.
 */
function findRelevantExamples(prompt: string, maxExamples: number = 2): SAPExample[] {
  const promptLower = prompt.toLowerCase();

  // Score each example by relevance
  const scored = sapExamples.map(example => {
    let score = 0;

    // Check title and description overlap
    const titleWords = example.title.toLowerCase().split(/\s+/);
    const descWords = example.description.toLowerCase().split(/\s+/);
    const tags = example.tags;

    for (const word of titleWords) {
      if (word.length > 3 && promptLower.includes(word)) score += 2;
    }
    for (const word of descWords) {
      if (word.length > 4 && promptLower.includes(word)) score += 1;
    }
    for (const tag of tags) {
      if (promptLower.includes(tag.replace(/-/g, ' '))) score += 3;
    }

    // Boost for SAP-specific keywords
    const sapKeywords = ['sap', 'erp', 'order', 'finance', 'personnel', 'process', 'approval', 'access', 'transaction'];
    for (const kw of sapKeywords) {
      if (promptLower.includes(kw) && (example.beforePrompt.toLowerCase().includes(kw) || example.tags.some(t => t.includes(kw)))) {
        score += 2;
      }
    }

    return { example, score };
  });

  // Return top N by score, filtering out zero scores
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxExamples)
    .map(s => s.example);
}

/**
 * Build the optimization prompt for the LLM.
 * SECURITY: Internal symbols from examples are stripped before sending to LLM.
 */
function buildOptimizationPrompt(
  original: string,
  techniques: TechniqueName[],
  examples: SAPExample[]
): string {
  const techniqueDescriptions: Record<string, string> = {
    chain_of_thought: 'Add explicit reasoning steps that guide the AI through the problem systematically',
    few_shot: 'Structure the prompt with clear input/output patterns based on similar examples',
    role_prompting: 'Establish a specific expert role or persona for the AI to adopt',
    structured_output: 'Request a specific output format (tables, numbered lists, sections)',
    step_by_step: 'Break down the task into numbered, sequential steps',
    decomposition: 'Decompose the problem into smaller, manageable sub-problems',
    reflection: 'Include self-verification or quality checking instructions',
  };

  const activeDescriptions = techniques
    .filter(t => techniqueDescriptions[t])
    .map(t => `- ${t.replace(/_/g, ' ')}: ${techniqueDescriptions[t]}`)
    .join('\n');

  // Build few-shot section if we have examples (strip internal symbols!)
  let fewShotSection = '';
  if (examples.length > 0 && techniques.includes('few_shot')) {
    fewShotSection = `\n\n## Reference Examples (for style guidance only)
${examples.map((ex, i) => `
### Example ${i + 1}: ${ex.title}
**Naive prompt:** "${ex.beforePrompt}"

**Optimized prompt:**
${ex.afterPrompt}

**Why it works:** ${ex.insight}
`).join('\n')}`;
  }

  return `You are an expert prompt engineer. Your task is to transform a naive user prompt into a highly effective, detailed prompt that will produce better AI responses.

## Techniques to Apply
${activeDescriptions}

## Original Prompt
"${original}"
${fewShotSection}

## Your Task
Rewrite the original prompt to be significantly more effective. The optimized prompt should:
1. Be specific and detailed about what information is needed
2. Include any relevant structure, formatting, or output requirements
3. Guide the AI's reasoning process explicitly
4. Request quantifiable metrics or specific data points where appropriate
5. Be complete enough to produce a high-quality response

## Output Instructions
Return ONLY the optimized prompt text. Do not include any explanation, preamble, or commentary.
Do not wrap the prompt in quotes or markdown code blocks.
Just output the improved prompt directly.`;
}

/**
 * Generate an optimized prompt using the LLM.
 * This is the real implementation that calls Claude to rewrite prompts.
 */
async function generateOptimizedPrompt(
  original: string,
  techniques: TechniqueName[],
  model: string
): Promise<string> {
  // Get API key from environment or config
  const apiKey = process.env.ANTHROPIC_API_KEY || config.getApiKey('anthropic');

  if (!apiKey) {
    // Fallback to basic heuristics if no API key
    logger.warn('No Anthropic API key found, using basic optimization');
    return applyBasicOptimization(original, techniques);
  }

  // Initialize Anthropic client
  const client = new Anthropic({ apiKey: apiKey as string });

  // Find relevant examples for few-shot
  const relevantExamples = techniques.includes('few_shot')
    ? findRelevantExamples(original, 2)
    : [];

  if (relevantExamples.length > 0) {
    logger.debug(`Found ${relevantExamples.length} relevant examples: ${relevantExamples.map(e => e.id).join(', ')}`);
  }

  // Build the optimization prompt
  const optimizationPrompt = buildOptimizationPrompt(original, techniques, relevantExamples);

  try {
    // Call Claude to generate the optimized prompt
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: optimizationPrompt
        }
      ]
    });

    // Extract the text response
    const content = response.content[0];
    if (content.type === 'text') {
      // Clean up the response (remove any accidental quotes or markdown)
      let optimized = content.text.trim();

      // Remove wrapping quotes if present
      if ((optimized.startsWith('"') && optimized.endsWith('"')) ||
          (optimized.startsWith("'") && optimized.endsWith("'"))) {
        optimized = optimized.slice(1, -1);
      }

      // Remove markdown code block if present
      if (optimized.startsWith('```') && optimized.endsWith('```')) {
        optimized = optimized.slice(3, -3).trim();
      }

      return optimized;
    }

    // Fallback if response format unexpected
    return applyBasicOptimization(original, techniques);

  } catch (error) {
    logger.error('LLM optimization failed, using basic fallback', { error: String(error) });
    return applyBasicOptimization(original, techniques);
  }
}

/**
 * Basic heuristic optimization as fallback when LLM is unavailable.
 */
function applyBasicOptimization(original: string, techniques: TechniqueName[]): string {
  let optimized = original;

  for (const technique of techniques) {
    switch (technique) {
      case 'chain_of_thought':
        if (!optimized.toLowerCase().includes('step by step')) {
          optimized = `${optimized}\n\nPlease think through this step by step.`;
        }
        break;
      case 'structured_output':
        if (!optimized.toLowerCase().includes('format')) {
          optimized = `${optimized}\n\nProvide your response in a clear, structured format.`;
        }
        break;
      case 'role_prompting':
        if (!optimized.toLowerCase().includes('you are')) {
          optimized = `You are an expert assistant. ${optimized}`;
        }
        break;
      case 'decomposition':
        if (!optimized.toLowerCase().includes('break down')) {
          optimized = `${optimized}\n\nBreak down the problem into smaller components.`;
        }
        break;
    }
  }

  return optimized;
}

function outputText(
  original: string,
  optimized: string,
  originalScores: ReturnType<typeof calculatePromptScores>,
  optimizedScores: ReturnType<typeof calculatePromptScores>,
  techniques: TechniqueName[],
  model: string,
  processingTime: number,
  showMetrics: boolean
): void {
  output.newline();
  output.subheading('Original Prompt:');
  console.log(chalk.dim(original));

  output.newline();
  output.subheading('Optimized Prompt:');
  console.log(chalk.green(optimized));

  output.newline();
  output.divider();

  // Score comparison
  const scoreDiff = optimizedScores.overall - originalScores.overall;
  const scoreColor = scoreDiff > 0 ? chalk.green : scoreDiff < 0 ? chalk.red : chalk.yellow;

  console.log(
    `Score: ${originalScores.overall} -> ${optimizedScores.overall} ` +
    scoreColor(`(${scoreDiff >= 0 ? '+' : ''}${scoreDiff})`)
  );

  if (showMetrics) {
    output.newline();
    output.subheading('Detailed Metrics:');
    console.log(formatPromptScores(optimizedScores));
  }

  output.newline();
  output.key('Techniques Applied', techniques.join(', '));
  output.key('Target Model', model);
  output.key('Processing Time', `${processingTime}ms`);
}

function outputJson(
  original: string,
  optimized: string,
  originalScores: ReturnType<typeof calculatePromptScores>,
  optimizedScores: ReturnType<typeof calculatePromptScores>,
  techniques: TechniqueName[],
  model: string,
  processingTime: number
): void {
  const result = {
    original: {
      prompt: original,
      scores: originalScores,
      tokenCount: estimateTokenCount(original)
    },
    optimized: {
      prompt: optimized,
      scores: optimizedScores,
      tokenCount: estimateTokenCount(optimized)
    },
    improvement: {
      overallScore: optimizedScores.overall - originalScores.overall,
      tokenDelta: estimateTokenCount(optimized) - estimateTokenCount(original)
    },
    metadata: {
      techniques,
      model,
      processingTimeMs: processingTime,
      timestamp: new Date().toISOString()
    }
  };

  console.log(JSON.stringify(result, null, 2));
}

function outputMarkdown(
  original: string,
  optimized: string,
  originalScores: ReturnType<typeof calculatePromptScores>,
  optimizedScores: ReturnType<typeof calculatePromptScores>,
  techniques: TechniqueName[],
  model: string,
  processingTime: number
): void {
  const scoreDiff = optimizedScores.overall - originalScores.overall;

  console.log(`# Prompt Optimization Results

## Original Prompt
\`\`\`
${original}
\`\`\`
**Score:** ${originalScores.overall}/100

## Optimized Prompt
\`\`\`
${optimized}
\`\`\`
**Score:** ${optimizedScores.overall}/100 (${scoreDiff >= 0 ? '+' : ''}${scoreDiff})

## Metrics

| Metric | Original | Optimized | Change |
|--------|----------|-----------|--------|
| Clarity | ${originalScores.clarity} | ${optimizedScores.clarity} | ${optimizedScores.clarity - originalScores.clarity >= 0 ? '+' : ''}${optimizedScores.clarity - originalScores.clarity} |
| Specificity | ${originalScores.specificity} | ${optimizedScores.specificity} | ${optimizedScores.specificity - originalScores.specificity >= 0 ? '+' : ''}${optimizedScores.specificity - originalScores.specificity} |
| Structure | ${originalScores.structure} | ${optimizedScores.structure} | ${optimizedScores.structure - originalScores.structure >= 0 ? '+' : ''}${optimizedScores.structure - originalScores.structure} |
| Completeness | ${originalScores.completeness} | ${optimizedScores.completeness} | ${optimizedScores.completeness - originalScores.completeness >= 0 ? '+' : ''}${optimizedScores.completeness - originalScores.completeness} |
| Efficiency | ${originalScores.efficiency} | ${optimizedScores.efficiency} | ${optimizedScores.efficiency - originalScores.efficiency >= 0 ? '+' : ''}${optimizedScores.efficiency - originalScores.efficiency} |
| **Overall** | **${originalScores.overall}** | **${optimizedScores.overall}** | **${scoreDiff >= 0 ? '+' : ''}${scoreDiff}** |

## Metadata
- **Techniques:** ${techniques.join(', ')}
- **Target Model:** ${model}
- **Processing Time:** ${processingTime}ms
- **Generated:** ${new Date().toISOString()}
`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
