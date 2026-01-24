/**
 * Prompt Score GitHub Action
 *
 * Deterministic prompt quality gate for CI/CD pipelines.
 * Scores prompts using heuristic analysis and fails builds
 * when quality drops below threshold.
 *
 * Key differentiator: 100% reproducible scores, no LLM required.
 */

import * as core from '@actions/core';
import * as glob from '@actions/glob';
import * as github from '@actions/github';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// SCORING ENGINE (Standalone - no external dependencies)
// ============================================================================

interface PromptScores {
  clarity: number;
  specificity: number;
  structure: number;
  completeness: number;
  efficiency: number;
  overall: number;
}

interface ScoringResult {
  file: string;
  content: string;
  scores: PromptScores;
  passed: boolean;
  warnings: string[];
  suggestions: string[];
}

interface ActionOutputs {
  totalPrompts: number;
  passedPrompts: number;
  failedPrompts: number;
  averageScore: number;
  lowestScore: number;
  highestScore: number;
  results: ScoringResult[];
}

/**
 * Estimate token count for a string
 */
function estimateTokenCount(text: string): number {
  const words = text.split(/\s+/).length;
  const chars = text.length;
  return Math.ceil((words * 1.3 + chars / 4) / 2);
}

/**
 * Calculate clarity score (0-100)
 * Penalizes ambiguous language, rewards structure
 */
function calculateClarityScore(prompt: string): number {
  let score = 70; // Base score

  // Penalize ambiguous pronouns and vague references
  const ambiguousPatterns = [
    /\b(it|this|that|these|those|thing|stuff|something)\b/gi,
    /\b(somehow|somewhat|maybe|perhaps|possibly)\b/gi,
    /\b(etc|and so on|and more)\b/gi,
  ];

  for (const pattern of ambiguousPatterns) {
    const matches = prompt.match(pattern);
    if (matches) {
      score -= matches.length * 5;
    }
  }

  // Reward clear structure indicators
  if (/^(you are|act as|your (role|task|job))/im.test(prompt)) score += 5;
  if (/\b(step[s]?|first|second|then|finally)\b/i.test(prompt)) score += 5;
  if (/[.!?]/.test(prompt)) score += 5;
  if (/\d+\.|\-\s|\*\s/.test(prompt)) score += 5; // Lists

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate specificity score (0-100)
 * Rewards precise language and concrete examples
 */
function calculateSpecificityScore(prompt: string): number {
  let score = 50; // Base score

  // Reward specific language
  if (/\b(exactly|precisely|specifically|must|require[ds]?)\b/i.test(prompt)) score += 10;
  if (/\b\d+\b/.test(prompt)) score += 10; // Numbers
  if (/["'].*["']/.test(prompt)) score += 5; // Quoted text
  if (/\b(example|e\.g\.|for instance|such as)\b/i.test(prompt)) score += 10;
  if (/\b(format|output|return|respond)\b/i.test(prompt)) score += 5;

  // Penalize vague language
  const vaguePatterns = [
    /\b(good|nice|better|great|bad)\b/gi,
    /\b(some|any|various|different|many)\b/gi,
    /\b(improve|enhance|optimize)\b/gi, // Without specifics
  ];

  for (const pattern of vaguePatterns) {
    const matches = prompt.match(pattern);
    if (matches) {
      score -= matches.length * 3;
    }
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate structure score (0-100)
 * Rewards organized, well-formatted prompts
 */
function calculateStructureScore(prompt: string): number {
  let score = 40; // Base score

  // Reward structural elements
  if (/^#+\s/m.test(prompt)) score += 15; // Markdown headers
  if (/^\s*[-*]\s/m.test(prompt)) score += 10; // Bullet lists
  if (/^\s*\d+\.\s/m.test(prompt)) score += 10; // Numbered lists
  if (/```[\s\S]*```/.test(prompt)) score += 15; // Code blocks
  if (/\n\n/.test(prompt)) score += 10; // Paragraph breaks

  // Bonus for multiple sections
  const headerCount = (prompt.match(/^#+\s/gm) || []).length;
  if (headerCount >= 2) score += 10;

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate completeness score (0-100)
 * Checks for essential prompt components
 */
function calculateCompletenessScore(prompt: string): number {
  let score = 30; // Base score

  // Check for key components
  const components = [
    { pattern: /\b(task|goal|objective|purpose)\b/i, points: 15, name: 'task definition' },
    { pattern: /\b(context|background|given|situation)\b/i, points: 15, name: 'context' },
    { pattern: /\b(output|format|response|return)\b/i, points: 15, name: 'output specification' },
    { pattern: /\b(constraint|limit|must not|avoid|don't)\b/i, points: 10, name: 'constraints' },
    { pattern: /\b(example|sample|instance)\b/i, points: 15, name: 'examples' },
  ];

  for (const component of components) {
    if (component.pattern.test(prompt)) {
      score += component.points;
    }
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate efficiency score (0-100)
 * Balances brevity with completeness
 */
function calculateEfficiencyScore(prompt: string): number {
  const tokens = estimateTokenCount(prompt);

  // Optimal range: 50-200 tokens
  if (tokens < 10) return 20;
  if (tokens < 30) return 40;
  if (tokens < 50) return 60;
  if (tokens <= 200) return 100;
  if (tokens <= 500) return 80;
  if (tokens <= 1000) return 60;
  return 40; // Very long prompts
}

/**
 * Calculate all prompt scores
 */
function calculatePromptScores(prompt: string): PromptScores {
  const clarity = calculateClarityScore(prompt);
  const specificity = calculateSpecificityScore(prompt);
  const structure = calculateStructureScore(prompt);
  const completeness = calculateCompletenessScore(prompt);
  const efficiency = calculateEfficiencyScore(prompt);

  // Weighted average (documented in /docs/scoring.md)
  const overall = Math.round(
    clarity * 0.25 +
    specificity * 0.25 +
    structure * 0.15 +
    completeness * 0.20 +
    efficiency * 0.15
  );

  return {
    clarity,
    specificity,
    structure,
    completeness,
    efficiency,
    overall,
  };
}

/**
 * Generate improvement suggestions based on scores
 */
function generateSuggestions(scores: PromptScores, prompt: string): string[] {
  const suggestions: string[] = [];

  if (scores.clarity < 60) {
    suggestions.push('Reduce ambiguous pronouns (it, this, that, thing). Be explicit about what you\'re referring to.');
  }

  if (scores.specificity < 60) {
    suggestions.push('Add specific numbers, examples, or quoted text to make requirements concrete.');
  }

  if (scores.structure < 60) {
    suggestions.push('Add structure with headers (##), bullet points (-), or numbered lists (1.).');
  }

  if (scores.completeness < 60) {
    suggestions.push('Include task definition, context, output format, and constraints.');
  }

  if (scores.efficiency < 60) {
    const tokens = estimateTokenCount(prompt);
    if (tokens < 50) {
      suggestions.push('Prompt may be too brief. Add more context or requirements.');
    } else {
      suggestions.push('Prompt may be too verbose. Remove redundant information.');
    }
  }

  return suggestions;
}

/**
 * Generate warnings for borderline scores
 */
function generateWarnings(scores: PromptScores, threshold: number): string[] {
  const warnings: string[] = [];
  const warningThreshold = threshold + 10;

  if (scores.overall >= threshold && scores.overall < warningThreshold) {
    warnings.push(`Overall score (${scores.overall}) is close to threshold (${threshold}). Consider improvements.`);
  }

  // Individual dimension warnings
  if (scores.clarity < 50) warnings.push(`Low clarity score (${scores.clarity}/100)`);
  if (scores.specificity < 50) warnings.push(`Low specificity score (${scores.specificity}/100)`);
  if (scores.structure < 40) warnings.push(`Low structure score (${scores.structure}/100)`);

  return warnings;
}

// ============================================================================
// GITHUB ACTION LOGIC
// ============================================================================

async function findPromptFiles(pattern: string): Promise<string[]> {
  const globber = await glob.create(pattern, {
    followSymbolicLinks: false,
  });

  const files = await globber.glob();

  // Filter to only text files
  return files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ['.md', '.txt', '.prompt', '.template'].includes(ext) || ext === '';
  });
}

async function readPromptFile(filePath: string): Promise<string> {
  return fs.promises.readFile(filePath, 'utf-8');
}

function createAnnotation(result: ScoringResult, threshold: number): void {
  const relativePath = path.relative(process.cwd(), result.file);

  if (!result.passed) {
    core.error(
      `Prompt score ${result.scores.overall}/100 below threshold ${threshold}. ` +
      `Clarity: ${result.scores.clarity}, Specificity: ${result.scores.specificity}, ` +
      `Structure: ${result.scores.structure}, Completeness: ${result.scores.completeness}`,
      {
        file: relativePath,
        startLine: 1,
        title: 'Prompt Quality Below Threshold',
      }
    );
  }

  for (const warning of result.warnings) {
    core.warning(warning, {
      file: relativePath,
      startLine: 1,
      title: 'Prompt Quality Warning',
    });
  }
}

function formatSummary(outputs: ActionOutputs, threshold: number): string {
  const { totalPrompts, passedPrompts, failedPrompts, averageScore, lowestScore, highestScore } = outputs;

  const status = failedPrompts === 0 ? '✅ PASSED' : '❌ FAILED';

  let summary = `## Prompt Quality Report ${status}\n\n`;
  summary += `| Metric | Value |\n`;
  summary += `|--------|-------|\n`;
  summary += `| Total Prompts | ${totalPrompts} |\n`;
  summary += `| Passed | ${passedPrompts} |\n`;
  summary += `| Failed | ${failedPrompts} |\n`;
  summary += `| Threshold | ${threshold} |\n`;
  summary += `| Average Score | ${averageScore.toFixed(1)} |\n`;
  summary += `| Lowest Score | ${lowestScore} |\n`;
  summary += `| Highest Score | ${highestScore} |\n\n`;

  if (failedPrompts > 0) {
    summary += `### Failed Prompts\n\n`;
    for (const result of outputs.results.filter(r => !r.passed)) {
      const relativePath = path.relative(process.cwd(), result.file);
      summary += `#### \`${relativePath}\` - Score: ${result.scores.overall}/100\n\n`;
      summary += `| Dimension | Score |\n`;
      summary += `|-----------|-------|\n`;
      summary += `| Clarity | ${result.scores.clarity} |\n`;
      summary += `| Specificity | ${result.scores.specificity} |\n`;
      summary += `| Structure | ${result.scores.structure} |\n`;
      summary += `| Completeness | ${result.scores.completeness} |\n`;
      summary += `| Efficiency | ${result.scores.efficiency} |\n\n`;

      if (result.suggestions.length > 0) {
        summary += `**Suggestions:**\n`;
        for (const suggestion of result.suggestions) {
          summary += `- ${suggestion}\n`;
        }
        summary += '\n';
      }
    }
  }

  return summary;
}

async function run(): Promise<void> {
  try {
    // Get inputs
    const pattern = core.getInput('path') || '**/*.prompt.md';
    const threshold = parseInt(core.getInput('threshold') || '60', 10);
    const failOnWarning = core.getInput('fail-on-warning') === 'true';
    const outputFormat = core.getInput('output-format') || 'summary';
    const enableAnnotations = core.getInput('annotations') !== 'false';

    core.info(`🔍 Searching for prompts matching: ${pattern}`);
    core.info(`📊 Quality threshold: ${threshold}/100`);

    // Find prompt files
    const files = await findPromptFiles(pattern);

    if (files.length === 0) {
      core.warning(`No prompt files found matching pattern: ${pattern}`);
      core.setOutput('total-prompts', 0);
      core.setOutput('passed-prompts', 0);
      core.setOutput('failed-prompts', 0);
      return;
    }

    core.info(`📁 Found ${files.length} prompt file(s)`);

    // Score each prompt
    const results: ScoringResult[] = [];

    for (const file of files) {
      const content = await readPromptFile(file);
      const scores = calculatePromptScores(content);
      const passed = scores.overall >= threshold;
      const warnings = generateWarnings(scores, threshold);
      const suggestions = passed ? [] : generateSuggestions(scores, content);

      const result: ScoringResult = {
        file,
        content: content.substring(0, 500), // Truncate for output
        scores,
        passed,
        warnings,
        suggestions,
      };

      results.push(result);

      const relativePath = path.relative(process.cwd(), file);
      const status = passed ? '✅' : '❌';
      core.info(`${status} ${relativePath}: ${scores.overall}/100`);

      // Create GitHub annotations
      if (enableAnnotations) {
        createAnnotation(result, threshold);
      }
    }

    // Calculate summary stats
    const passedPrompts = results.filter(r => r.passed).length;
    const failedPrompts = results.filter(r => !r.passed).length;
    const scores = results.map(r => r.scores.overall);
    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const lowestScore = Math.min(...scores);
    const highestScore = Math.max(...scores);

    const outputs: ActionOutputs = {
      totalPrompts: results.length,
      passedPrompts,
      failedPrompts,
      averageScore,
      lowestScore,
      highestScore,
      results,
    };

    // Set outputs
    core.setOutput('total-prompts', outputs.totalPrompts);
    core.setOutput('passed-prompts', outputs.passedPrompts);
    core.setOutput('failed-prompts', outputs.failedPrompts);
    core.setOutput('average-score', outputs.averageScore.toFixed(1));
    core.setOutput('lowest-score', outputs.lowestScore);
    core.setOutput('highest-score', outputs.highestScore);
    core.setOutput('results-json', JSON.stringify(results.map(r => ({
      file: path.relative(process.cwd(), r.file),
      scores: r.scores,
      passed: r.passed,
    }))));

    // Write job summary
    const summary = formatSummary(outputs, threshold);
    await core.summary.addRaw(summary).write();

    // Check for warnings if fail-on-warning is enabled
    const hasWarnings = results.some(r => r.warnings.length > 0);

    if (failedPrompts > 0) {
      core.setFailed(`${failedPrompts} prompt(s) scored below threshold (${threshold})`);
    } else if (failOnWarning && hasWarnings) {
      core.setFailed('Prompts have quality warnings and fail-on-warning is enabled');
    } else {
      core.info(`✅ All ${outputs.totalPrompts} prompt(s) passed quality threshold`);
    }

  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unexpected error occurred');
    }
  }
}

run();
