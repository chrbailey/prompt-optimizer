/**
 * Evaluate Command
 *
 * Assess prompt quality and compare prompts.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { logger, output, createSpinner } from '../../utils/logger.js';
import {
  calculatePromptScores,
  formatPromptScores,
  estimateTokenCount,
  PromptScores
} from '../../utils/metrics.js';

// Output format
type OutputFormat = 'text' | 'json' | 'markdown';

interface EvaluateOptions {
  compare?: string;
  metrics: boolean;
  output: OutputFormat;
  verbose: boolean;
}

// Issue types
interface PromptIssue {
  type: 'ambiguity' | 'vagueness' | 'redundancy' | 'missing-context' | 'poor-structure' | 'too-long' | 'too-short';
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestion?: string;
  location?: { start: number; end: number };
}

export const evaluateCommand = new Command('evaluate')
  .description('Evaluate prompt quality and identify issues')
  .argument('<prompt>', 'The prompt to evaluate')
  .option('-c, --compare <prompt2>', 'Compare with another prompt')
  .option('-m, --metrics', 'Show detailed metrics breakdown', false)
  .option('-o, --output <format>', 'Output format (text, json, markdown)', 'text')
  .option('-v, --verbose', 'Show all detected issues', false)
  .action(async (prompt: string, options: EvaluateOptions) => {
    try {
      await runEvaluate(prompt, options);
    } catch (error) {
      logger.error('Evaluation failed', { error: String(error) });
      process.exit(1);
    }
  });

async function runEvaluate(prompt: string, options: EvaluateOptions): Promise<void> {
  const spinner = createSpinner('Evaluating prompt...').start();

  try {
    // Calculate scores
    const scores = calculatePromptScores(prompt);

    // Detect issues
    const issues = detectIssues(prompt);

    // Generate suggestions
    const suggestions = generateSuggestions(scores, issues);

    // Handle comparison if requested
    let comparison: ComparisonResult | undefined;
    if (options.compare) {
      comparison = comparePrompts(prompt, options.compare);
    }

    spinner.succeed('Evaluation complete');

    // Output results
    switch (options.output) {
      case 'json':
        outputJson(prompt, scores, issues, suggestions, comparison, options);
        break;
      case 'markdown':
        outputMarkdown(prompt, scores, issues, suggestions, comparison, options);
        break;
      default:
        outputText(prompt, scores, issues, suggestions, comparison, options);
    }

  } catch (error) {
    spinner.fail('Evaluation failed');
    throw error;
  }
}

function detectIssues(prompt: string): PromptIssue[] {
  const issues: PromptIssue[] = [];
  const words = prompt.toLowerCase().split(/\s+/);
  const tokenCount = estimateTokenCount(prompt);

  // Check for ambiguous pronouns without clear referents
  const pronounMatches = prompt.match(/\b(it|this|that|they|them)\b/gi) || [];
  if (pronounMatches.length > 3) {
    issues.push({
      type: 'ambiguity',
      severity: 'medium',
      description: `Found ${pronounMatches.length} potentially ambiguous pronouns (it, this, that, they, them)`,
      suggestion: 'Replace ambiguous pronouns with specific nouns to improve clarity'
    });
  }

  // Check for vague language
  const vagueWords = ['thing', 'stuff', 'something', 'somehow', 'somewhere', 'good', 'nice', 'bad'];
  const foundVague = words.filter(w => vagueWords.includes(w));
  if (foundVague.length > 0) {
    issues.push({
      type: 'vagueness',
      severity: 'medium',
      description: `Found vague language: ${[...new Set(foundVague)].join(', ')}`,
      suggestion: 'Replace vague terms with specific, descriptive language'
    });
  }

  // Check for redundancy
  const wordFreq: Record<string, number> = {};
  words.forEach(w => {
    if (w.length > 4) {
      wordFreq[w] = (wordFreq[w] || 0) + 1;
    }
  });
  const repeatedWords = Object.entries(wordFreq)
    .filter(([_, count]) => count > 3)
    .map(([word]) => word);

  if (repeatedWords.length > 0) {
    issues.push({
      type: 'redundancy',
      severity: 'low',
      description: `Frequently repeated words: ${repeatedWords.join(', ')}`,
      suggestion: 'Consider varying vocabulary or consolidating repeated concepts'
    });
  }

  // Check for missing context indicators
  const contextIndicators = ['context', 'background', 'given', 'assuming', 'scenario', 'situation'];
  const hasContext = words.some(w => contextIndicators.includes(w));
  if (tokenCount > 50 && !hasContext) {
    issues.push({
      type: 'missing-context',
      severity: 'low',
      description: 'Prompt may lack explicit context or background information',
      suggestion: 'Consider adding context about the situation, audience, or constraints'
    });
  }

  // Check for poor structure
  const hasLineBreaks = prompt.includes('\n');
  const hasSections = /^#+\s|^[A-Z][^.]*:$/m.test(prompt);
  const hasLists = /^\s*[-•*]\s/m.test(prompt) || /^\s*\d+\.\s/m.test(prompt);

  if (tokenCount > 100 && !hasLineBreaks && !hasSections && !hasLists) {
    issues.push({
      type: 'poor-structure',
      severity: 'medium',
      description: 'Long prompt without structural elements (sections, lists, line breaks)',
      suggestion: 'Break down the prompt into sections or use bullet points for complex requirements'
    });
  }

  // Check prompt length
  if (tokenCount < 10) {
    issues.push({
      type: 'too-short',
      severity: 'high',
      description: 'Prompt may be too brief to provide adequate guidance',
      suggestion: 'Add more detail about what you want, expected format, or constraints'
    });
  } else if (tokenCount > 2000) {
    issues.push({
      type: 'too-long',
      severity: 'medium',
      description: 'Very long prompt may reduce focus or increase costs',
      suggestion: 'Consider breaking into multiple prompts or summarizing key points'
    });
  }

  // Check for missing task definition
  const taskWords = ['write', 'create', 'generate', 'explain', 'analyze', 'summarize', 'translate', 'help', 'tell', 'show', 'make', 'find', 'list'];
  const hasTask = words.some(w => taskWords.includes(w));
  if (!hasTask && !prompt.includes('?')) {
    issues.push({
      type: 'ambiguity',
      severity: 'high',
      description: 'No clear task or question detected',
      suggestion: 'Start with an action verb (write, explain, analyze) or pose a clear question'
    });
  }

  return issues;
}

function generateSuggestions(scores: PromptScores, issues: PromptIssue[]): string[] {
  const suggestions: string[] = [];

  // Based on scores
  if (scores.clarity < 60) {
    suggestions.push('Improve clarity by using specific language and clear sentence structure');
  }

  if (scores.specificity < 60) {
    suggestions.push('Add specific details: numbers, formats, examples, or constraints');
  }

  if (scores.structure < 60) {
    suggestions.push('Organize the prompt with sections, bullet points, or numbered steps');
  }

  if (scores.completeness < 60) {
    suggestions.push('Include: task definition, context, output format, and any constraints');
  }

  if (scores.efficiency < 60) {
    suggestions.push('Review prompt length - ensure every sentence adds value');
  }

  // Based on issues (avoiding duplicates)
  const suggestionSet = new Set(suggestions);
  issues.forEach(issue => {
    if (issue.suggestion && !suggestionSet.has(issue.suggestion)) {
      suggestionSet.add(issue.suggestion);
      suggestions.push(issue.suggestion);
    }
  });

  return suggestions.slice(0, 5); // Limit to top 5
}

interface ComparisonResult {
  winner: 'prompt1' | 'prompt2' | 'tie';
  scoreDifference: number;
  prompt1Scores: PromptScores;
  prompt2Scores: PromptScores;
  analysis: string;
}

function comparePrompts(prompt1: string, prompt2: string): ComparisonResult {
  const scores1 = calculatePromptScores(prompt1);
  const scores2 = calculatePromptScores(prompt2);

  const diff = scores1.overall - scores2.overall;

  let winner: 'prompt1' | 'prompt2' | 'tie';
  let analysis: string;

  if (Math.abs(diff) < 5) {
    winner = 'tie';
    analysis = 'Both prompts have similar overall quality scores.';
  } else if (diff > 0) {
    winner = 'prompt1';
    analysis = `Prompt 1 scores higher overall (+${diff} points).`;
  } else {
    winner = 'prompt2';
    analysis = `Prompt 2 scores higher overall (+${Math.abs(diff)} points).`;
  }

  // Add specific comparisons
  const differences: string[] = [];

  if (Math.abs(scores1.clarity - scores2.clarity) > 10) {
    const better = scores1.clarity > scores2.clarity ? 'Prompt 1' : 'Prompt 2';
    differences.push(`${better} has better clarity`);
  }

  if (Math.abs(scores1.specificity - scores2.specificity) > 10) {
    const better = scores1.specificity > scores2.specificity ? 'Prompt 1' : 'Prompt 2';
    differences.push(`${better} is more specific`);
  }

  if (Math.abs(scores1.structure - scores2.structure) > 10) {
    const better = scores1.structure > scores2.structure ? 'Prompt 1' : 'Prompt 2';
    differences.push(`${better} has better structure`);
  }

  if (differences.length > 0) {
    analysis += ' ' + differences.join('. ') + '.';
  }

  return {
    winner,
    scoreDifference: Math.abs(diff),
    prompt1Scores: scores1,
    prompt2Scores: scores2,
    analysis
  };
}

function outputText(
  prompt: string,
  scores: PromptScores,
  issues: PromptIssue[],
  suggestions: string[],
  comparison: ComparisonResult | undefined,
  options: EvaluateOptions
): void {
  output.heading('Prompt Evaluation');

  // Show truncated prompt
  output.subheading('Prompt:');
  const displayPrompt = prompt.length > 200 ? prompt.slice(0, 200) + '...' : prompt;
  console.log(chalk.dim(displayPrompt));

  output.newline();
  output.divider();

  // Overall score with visual
  const overallColor = scores.overall >= 70 ? chalk.green :
                       scores.overall >= 50 ? chalk.yellow : chalk.red;
  console.log(`\nOverall Score: ${overallColor(scores.overall + '/100')}`);

  // Visual bar
  const filled = Math.round(scores.overall / 5);
  const empty = 20 - filled;
  console.log(`[${'█'.repeat(filled)}${'░'.repeat(empty)}]`);

  // Detailed metrics
  if (options.metrics) {
    output.newline();
    output.subheading('Detailed Metrics:');
    console.log(formatPromptScores(scores));
  }

  // Issues
  if (issues.length > 0) {
    output.newline();
    output.subheading('Issues Found:');

    const issuesToShow = options.verbose ? issues : issues.filter(i => i.severity !== 'low').slice(0, 3);

    issuesToShow.forEach(issue => {
      const severityColor = issue.severity === 'high' ? chalk.red :
                           issue.severity === 'medium' ? chalk.yellow : chalk.dim;
      console.log(`  ${severityColor('●')} [${issue.severity.toUpperCase()}] ${issue.description}`);
    });

    if (!options.verbose && issues.length > issuesToShow.length) {
      console.log(chalk.dim(`  ... and ${issues.length - issuesToShow.length} more (use -v to see all)`));
    }
  } else {
    output.newline();
    console.log(chalk.green('No significant issues detected.'));
  }

  // Suggestions
  if (suggestions.length > 0) {
    output.newline();
    output.subheading('Suggestions:');
    suggestions.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s}`);
    });
  }

  // Comparison
  if (comparison) {
    output.newline();
    output.divider();
    output.subheading('Comparison Results:');

    const winnerText = comparison.winner === 'tie' ? 'Tie' :
                      comparison.winner === 'prompt1' ? 'Prompt 1 wins' : 'Prompt 2 wins';
    const winnerColor = comparison.winner === 'tie' ? chalk.yellow :
                       comparison.winner === 'prompt1' ? chalk.green : chalk.blue;

    console.log(`  ${winnerColor(winnerText)} (difference: ${comparison.scoreDifference} points)`);
    console.log(`  ${chalk.dim(comparison.analysis)}`);

    output.newline();
    console.log(`  Prompt 1 Score: ${comparison.prompt1Scores.overall}/100`);
    console.log(`  Prompt 2 Score: ${comparison.prompt2Scores.overall}/100`);
  }
}

function outputJson(
  prompt: string,
  scores: PromptScores,
  issues: PromptIssue[],
  suggestions: string[],
  comparison: ComparisonResult | undefined,
  _options: EvaluateOptions
): void {
  const result = {
    prompt: prompt.slice(0, 500),
    tokenCount: estimateTokenCount(prompt),
    scores,
    issues: issues.map(i => ({
      type: i.type,
      severity: i.severity,
      description: i.description,
      suggestion: i.suggestion
    })),
    suggestions,
    comparison: comparison ? {
      winner: comparison.winner,
      scoreDifference: comparison.scoreDifference,
      prompt1Scores: comparison.prompt1Scores,
      prompt2Scores: comparison.prompt2Scores,
      analysis: comparison.analysis
    } : undefined,
    timestamp: new Date().toISOString()
  };

  console.log(JSON.stringify(result, null, 2));
}

function outputMarkdown(
  prompt: string,
  scores: PromptScores,
  issues: PromptIssue[],
  suggestions: string[],
  comparison: ComparisonResult | undefined,
  _options: EvaluateOptions
): void {
  const severityEmoji: Record<string, string> = {
    high: '!!!',
    medium: '!!',
    low: '!'
  };

  console.log(`# Prompt Evaluation Report

## Prompt
\`\`\`
${prompt}
\`\`\`

## Overall Score: ${scores.overall}/100

## Detailed Metrics

| Metric | Score |
|--------|-------|
| Clarity | ${scores.clarity}/100 |
| Specificity | ${scores.specificity}/100 |
| Structure | ${scores.structure}/100 |
| Completeness | ${scores.completeness}/100 |
| Efficiency | ${scores.efficiency}/100 |
| **Overall** | **${scores.overall}/100** |

## Issues Found

${issues.length === 0 ? 'No significant issues detected.' :
  issues.map(i => `- ${severityEmoji[i.severity]} **[${i.severity.toUpperCase()}]** ${i.description}`).join('\n')}

## Suggestions

${suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}
${comparison ? `
## Comparison

**Winner:** ${comparison.winner === 'tie' ? 'Tie' : comparison.winner === 'prompt1' ? 'Prompt 1' : 'Prompt 2'}

${comparison.analysis}

| Metric | Prompt 1 | Prompt 2 |
|--------|----------|----------|
| Overall | ${comparison.prompt1Scores.overall} | ${comparison.prompt2Scores.overall} |
| Clarity | ${comparison.prompt1Scores.clarity} | ${comparison.prompt2Scores.clarity} |
| Specificity | ${comparison.prompt1Scores.specificity} | ${comparison.prompt2Scores.specificity} |
` : ''}

---
*Generated: ${new Date().toISOString()}*
`);
}
