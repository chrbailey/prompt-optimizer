/**
 * Batch Command
 *
 * Process multiple prompts from a file in parallel.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { config } from '../../utils/config.js';
import { logger, output, createSpinner } from '../../utils/logger.js';
import {
  calculatePromptScores,
  estimateTokenCount,
  calculateBatchSummary
} from '../../utils/metrics.js';

// Output format
type OutputFormat = 'json' | 'jsonl' | 'csv';

interface BatchOptions {
  output?: string;
  format: OutputFormat;
  parallel: number;
  techniques?: string;
  model?: string;
  continueOnError: boolean;
  dryRun: boolean;
}

interface BatchPrompt {
  id: string;
  prompt: string;
  metadata?: Record<string, unknown>;
}

interface BatchResultItem {
  id: string;
  original: string;
  optimized: string;
  originalScore: number;
  optimizedScore: number;
  improvement: number;
  tokenChange: number;
  success: boolean;
  error?: string;
  processingTime: number;
}

export const batchCommand = new Command('batch')
  .description('Batch process multiple prompts from a file')
  .argument('<file>', 'Input file containing prompts (txt, json, or jsonl)')
  .option('-o, --output <file>', 'Output file (default: stdout)')
  .option('-f, --format <format>', 'Output format (json, jsonl, csv)', 'json')
  .option('-p, --parallel <n>', 'Concurrent optimizations', '3')
  .option('-t, --techniques <list>', 'Techniques to use (comma-separated)')
  .option('-m, --model <model>', 'Target model')
  .option('--continue-on-error', 'Continue processing if a prompt fails', false)
  .option('--dry-run', 'Parse input and show plan without processing', false)
  .action(async (file: string, options: BatchOptions) => {
    try {
      await runBatch(file, options);
    } catch (error) {
      logger.error('Batch processing failed', { error: String(error) });
      process.exit(1);
    }
  });

async function runBatch(file: string, options: BatchOptions): Promise<void> {
  // Check if file exists
  if (!existsSync(file)) {
    console.log(chalk.red(`Error: File not found: ${file}`));
    process.exit(1);
  }

  // Check configured providers
  const configuredProviders = config.getConfiguredProviders();
  if (configuredProviders.length === 0 && !options.dryRun) {
    console.log(chalk.red('Error: No API providers configured.'));
    console.log(chalk.yellow('Run: prompt-optimizer config set anthropic.apiKey <your-key>'));
    process.exit(1);
  }

  const spinner = createSpinner('Loading prompts...').start();

  try {
    // Load and parse prompts
    const prompts = await loadPrompts(file);
    spinner.succeed(`Loaded ${prompts.length} prompts`);

    // Dry run - show plan
    if (options.dryRun) {
      outputDryRun(prompts, options);
      return;
    }

    // Process prompts
    const results = await processPrompts(prompts, options);

    // Calculate summary
    const summaryData = results.map(r => ({
      success: r.success,
      metrics: r.success ? {
        tokenCountOriginal: estimateTokenCount(r.original),
        tokenCountOptimized: estimateTokenCount(r.optimized),
        estimatedCostOriginal: 0,
        estimatedCostOptimized: 0,
        clarityScore: r.optimizedScore,
        specificityScore: r.optimizedScore,
        structureScore: r.optimizedScore,
        overallScore: r.optimizedScore
      } : undefined,
      processingTime: r.processingTime
    }));
    const summary = calculateBatchSummary(summaryData);

    // Output results
    await outputResults(results, summary, options);

  } catch (error) {
    spinner.fail('Batch processing failed');
    throw error;
  }
}

async function loadPrompts(file: string): Promise<BatchPrompt[]> {
  const content = await readFile(file, 'utf-8');
  const ext = file.toLowerCase().split('.').pop();

  switch (ext) {
    case 'json':
      return parseJsonFile(content);
    case 'jsonl':
      return parseJsonlFile(content);
    case 'txt':
    default:
      return parseTxtFile(content);
  }
}

function parseJsonFile(content: string): BatchPrompt[] {
  const data = JSON.parse(content);

  // Handle array of strings
  if (Array.isArray(data) && typeof data[0] === 'string') {
    return data.map((prompt, i) => ({
      id: `prompt-${i + 1}`,
      prompt
    }));
  }

  // Handle array of objects
  if (Array.isArray(data)) {
    return data.map((item, i) => ({
      id: item.id || `prompt-${i + 1}`,
      prompt: item.prompt || item.text || item.content,
      metadata: item.metadata
    }));
  }

  // Handle object with prompts array
  if (data.prompts && Array.isArray(data.prompts)) {
    return parseJsonFile(JSON.stringify(data.prompts));
  }

  throw new Error('Invalid JSON format. Expected array of strings or objects with "prompt" field.');
}

function parseJsonlFile(content: string): BatchPrompt[] {
  const lines = content.trim().split('\n').filter(line => line.trim());

  return lines.map((line, i) => {
    try {
      const item = JSON.parse(line);
      return {
        id: item.id || `prompt-${i + 1}`,
        prompt: typeof item === 'string' ? item : (item.prompt || item.text || item.content),
        metadata: item.metadata
      };
    } catch {
      // Treat as plain text if not valid JSON
      return {
        id: `prompt-${i + 1}`,
        prompt: line
      };
    }
  });
}

function parseTxtFile(content: string): BatchPrompt[] {
  // Split by double newlines or use single lines if short
  const lines = content.trim().split('\n');

  // If lines are short, treat each as a prompt
  if (lines.every(l => l.length < 200)) {
    return lines
      .filter(line => line.trim())
      .map((line, i) => ({
        id: `prompt-${i + 1}`,
        prompt: line.trim()
      }));
  }

  // Otherwise split by double newlines
  const prompts = content.trim().split(/\n\s*\n/);
  return prompts
    .filter(p => p.trim())
    .map((prompt, i) => ({
      id: `prompt-${i + 1}`,
      prompt: prompt.trim()
    }));
}

async function processPrompts(
  prompts: BatchPrompt[],
  options: BatchOptions
): Promise<BatchResultItem[]> {
  const parallelism = Math.min(parseInt(String(options.parallel)) || 3, 10);
  const results: BatchResultItem[] = [];
  const techniques = options.techniques?.split(',').map(t => t.trim()) || ['chain_of_thought', 'structured_output'];

  output.heading('Processing Prompts');
  console.log(chalk.dim(`Parallelism: ${parallelism} | Total: ${prompts.length}`));
  output.newline();

  // Process in batches
  for (let i = 0; i < prompts.length; i += parallelism) {
    const batch = prompts.slice(i, i + parallelism);
    const batchNum = Math.floor(i / parallelism) + 1;
    const totalBatches = Math.ceil(prompts.length / parallelism);

    const spinner = createSpinner(`Processing batch ${batchNum}/${totalBatches}...`).start();

    try {
      const batchResults = await Promise.all(
        batch.map(p => processOnePrompt(p, techniques, options))
      );

      results.push(...batchResults);

      const successful = batchResults.filter(r => r.success).length;
      spinner.succeed(`Batch ${batchNum}/${totalBatches}: ${successful}/${batchResults.length} successful`);

    } catch (error) {
      spinner.fail(`Batch ${batchNum}/${totalBatches} failed`);

      if (!options.continueOnError) {
        throw error;
      }

      // Mark remaining as failed
      for (const p of batch) {
        if (!results.find(r => r.id === p.id)) {
          results.push({
            id: p.id,
            original: p.prompt,
            optimized: '',
            originalScore: 0,
            optimizedScore: 0,
            improvement: 0,
            tokenChange: 0,
            success: false,
            error: String(error),
            processingTime: 0
          });
        }
      }
    }
  }

  return results;
}

async function processOnePrompt(
  prompt: BatchPrompt,
  techniques: string[],
  _options: BatchOptions
): Promise<BatchResultItem> {
  const startTime = Date.now();

  try {
    // Calculate original scores
    const originalScores = calculatePromptScores(prompt.prompt);

    // Simulate optimization (placeholder - would call real orchestrator)
    await sleep(100 + Math.random() * 200);

    // Apply simple optimizations (placeholder)
    let optimized = prompt.prompt;

    if (techniques.includes('chain_of_thought') || techniques.includes('chain-of-thought')) {
      if (!optimized.toLowerCase().includes('step by step')) {
        optimized = `${optimized}\n\nPlease think through this step by step.`;
      }
    }

    if (techniques.includes('structured_output') || techniques.includes('structured-output')) {
      if (!optimized.toLowerCase().includes('format')) {
        optimized = `${optimized}\n\nProvide your response in a clear, structured format.`;
      }
    }

    // Calculate optimized scores
    const optimizedScores = calculatePromptScores(optimized);

    return {
      id: prompt.id,
      original: prompt.prompt,
      optimized,
      originalScore: originalScores.overall,
      optimizedScore: optimizedScores.overall,
      improvement: optimizedScores.overall - originalScores.overall,
      tokenChange: estimateTokenCount(optimized) - estimateTokenCount(prompt.prompt),
      success: true,
      processingTime: Date.now() - startTime
    };

  } catch (error) {
    return {
      id: prompt.id,
      original: prompt.prompt,
      optimized: '',
      originalScore: 0,
      optimizedScore: 0,
      improvement: 0,
      tokenChange: 0,
      success: false,
      error: String(error),
      processingTime: Date.now() - startTime
    };
  }
}

function outputDryRun(prompts: BatchPrompt[], options: BatchOptions): void {
  output.heading('Batch Processing - Dry Run');

  output.key('Total Prompts', prompts.length.toString());
  output.key('Parallelism', options.parallel.toString());
  output.key('Techniques', options.techniques || 'chain_of_thought, structured_output');
  output.key('Output Format', options.format);
  output.key('Output File', options.output || 'stdout');

  output.newline();
  output.subheading('Prompts to Process:');

  prompts.slice(0, 5).forEach((p, i) => {
    const preview = p.prompt.slice(0, 60) + (p.prompt.length > 60 ? '...' : '');
    console.log(`  ${i + 1}. [${p.id}] ${preview}`);
  });

  if (prompts.length > 5) {
    console.log(chalk.dim(`  ... and ${prompts.length - 5} more`));
  }

  // Estimate costs and time
  const totalTokens = prompts.reduce((sum, p) => sum + estimateTokenCount(p.prompt), 0);
  const estTime = (prompts.length / parseInt(String(options.parallel))) * 0.5;

  output.newline();
  output.subheading('Estimates:');
  output.key('Total Input Tokens', totalTokens.toLocaleString());
  output.key('Est. Processing Time', `${estTime.toFixed(1)} seconds`);
}

async function outputResults(
  results: BatchResultItem[],
  summary: ReturnType<typeof calculateBatchSummary>,
  options: BatchOptions
): Promise<void> {
  // Format results
  let content: string;

  switch (options.format) {
    case 'jsonl':
      content = results.map(r => JSON.stringify(r)).join('\n');
      break;
    case 'csv':
      content = formatCsv(results);
      break;
    default:
      content = JSON.stringify({ results, summary }, null, 2);
  }

  // Output to file or stdout
  if (options.output) {
    await writeFile(options.output, content);
    console.log(chalk.green(`\nResults written to: ${options.output}`));
  } else {
    console.log('\n' + content);
  }

  // Print summary
  output.newline();
  output.divider();
  output.subheading('Batch Summary:');
  output.key('Total Prompts', summary.totalPrompts.toString());
  output.key('Successful', chalk.green(summary.successfulOptimizations.toString()));
  output.key('Failed', summary.failedOptimizations > 0 ?
    chalk.red(summary.failedOptimizations.toString()) :
    summary.failedOptimizations.toString()
  );
  output.key('Total Time', `${(summary.totalProcessingTime / 1000).toFixed(2)}s`);
  output.key('Avg Improvement', `${summary.averageImprovement.toFixed(1)} points`);
}

function formatCsv(results: BatchResultItem[]): string {
  const headers = ['id', 'original', 'optimized', 'original_score', 'optimized_score', 'improvement', 'token_change', 'success', 'error', 'processing_time_ms'];

  const rows = results.map(r => [
    r.id,
    `"${r.original.replace(/"/g, '""')}"`,
    `"${r.optimized.replace(/"/g, '""')}"`,
    r.originalScore,
    r.optimizedScore,
    r.improvement,
    r.tokenChange,
    r.success,
    r.error ? `"${r.error.replace(/"/g, '""')}"` : '',
    r.processingTime
  ].join(','));

  return [headers.join(','), ...rows].join('\n');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
