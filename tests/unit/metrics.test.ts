/**
 * Tests for the metrics utility module
 */

import {
  estimateTokenCount,
  calculateClarityScore,
  calculateSpecificityScore,
  calculateStructureScore,
  calculateCompletenessScore,
  calculateEfficiencyScore,
  calculatePromptScores,
  formatPromptScores
} from '../../src/utils/metrics.js';

describe('Metrics Utilities', () => {
  describe('estimateTokenCount', () => {
    it('should estimate tokens for a simple string', () => {
      const text = 'Hello world';
      const tokens = estimateTokenCount(text);
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(10);
    });

    it('should estimate more tokens for longer text', () => {
      const short = 'Hello';
      const long = 'Hello world, this is a much longer sentence with many more words.';
      expect(estimateTokenCount(long)).toBeGreaterThan(estimateTokenCount(short));
    });

    it('should handle empty string', () => {
      expect(estimateTokenCount('')).toBe(1); // Minimum of 1 due to ceiling
    });
  });

  describe('calculateClarityScore', () => {
    it('should give higher score to clear prompts', () => {
      const clear = 'Write a Python function that sorts an array of integers in ascending order.';
      const unclear = 'Do something with it and stuff, make it better somehow.';
      expect(calculateClarityScore(clear)).toBeGreaterThan(calculateClarityScore(unclear));
    });

    it('should penalize ambiguous pronouns', () => {
      const withPronouns = 'Take it and do this with that thing.';
      const withoutPronouns = 'Take the input array and sort the elements.';
      expect(calculateClarityScore(withoutPronouns)).toBeGreaterThan(calculateClarityScore(withPronouns));
    });

    it('should reward structured prompts', () => {
      const structured = '1. First step\n2. Second step\n3. Third step';
      const unstructured = 'First step second step third step';
      expect(calculateClarityScore(structured)).toBeGreaterThan(calculateClarityScore(unstructured));
    });
  });

  describe('calculateSpecificityScore', () => {
    it('should reward specific language', () => {
      const specific = 'Generate exactly 5 examples with 100 words each.';
      const vague = 'Generate some examples with some words.';
      expect(calculateSpecificityScore(specific)).toBeGreaterThan(calculateSpecificityScore(vague));
    });

    it('should penalize vague language', () => {
      const withVague = 'Make it good and nice, maybe add some various things.';
      const withoutVague = 'Ensure the output is properly formatted with clear sections.';
      expect(calculateSpecificityScore(withoutVague)).toBeGreaterThan(calculateSpecificityScore(withVague));
    });
  });

  describe('calculateStructureScore', () => {
    it('should reward lists', () => {
      const withList = 'Requirements:\n- First item\n- Second item\n- Third item';
      const withoutList = 'Requirements are first item and second item and third item';
      expect(calculateStructureScore(withList)).toBeGreaterThan(calculateStructureScore(withoutList));
    });

    it('should reward multiple paragraphs', () => {
      const multiPara = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
      const singlePara = 'First paragraph. Second paragraph. Third paragraph.';
      expect(calculateStructureScore(multiPara)).toBeGreaterThan(calculateStructureScore(singlePara));
    });

    it('should reward code blocks', () => {
      const withCode = 'Example:\n```python\ndef hello():\n  print("Hello")\n```';
      const withoutCode = 'Example: def hello(): print("Hello")';
      expect(calculateStructureScore(withCode)).toBeGreaterThan(calculateStructureScore(withoutCode));
    });
  });

  describe('calculateCompletenessScore', () => {
    it('should reward prompts with task definition', () => {
      const withTask = 'Your task is to analyze the data and provide insights.';
      const withoutTask = 'Analyze the data and provide insights.';
      expect(calculateCompletenessScore(withTask)).toBeGreaterThanOrEqual(calculateCompletenessScore(withoutTask));
    });

    it('should reward prompts with context', () => {
      const withContext = 'Given the context of a web application, explain the authentication flow.';
      const withoutContext = 'Explain the authentication flow.';
      expect(calculateCompletenessScore(withContext)).toBeGreaterThan(calculateCompletenessScore(withoutContext));
    });
  });

  describe('calculateEfficiencyScore', () => {
    it('should penalize very short prompts', () => {
      const short = 'Hi';
      const appropriate = 'Write a function that takes an array of numbers and returns the sum of all even numbers.';
      expect(calculateEfficiencyScore(appropriate)).toBeGreaterThan(calculateEfficiencyScore(short));
    });

    it('should give reasonable score to appropriately sized prompts', () => {
      const appropriate = 'Write a Python function that:\n1. Takes a list of integers\n2. Filters out negative numbers\n3. Returns the sum of remaining numbers\n\nInclude error handling for invalid inputs.';
      // This prompt is ~50 tokens, which falls in the 50-200 range for optimal efficiency
      expect(calculateEfficiencyScore(appropriate)).toBeGreaterThanOrEqual(50);
    });
  });

  describe('calculatePromptScores', () => {
    it('should return all score components', () => {
      const prompt = 'Write a function to sort an array.';
      const scores = calculatePromptScores(prompt);

      expect(scores).toHaveProperty('clarity');
      expect(scores).toHaveProperty('specificity');
      expect(scores).toHaveProperty('structure');
      expect(scores).toHaveProperty('completeness');
      expect(scores).toHaveProperty('efficiency');
      expect(scores).toHaveProperty('overall');
    });

    it('should return scores between 0 and 100', () => {
      const prompt = 'Write a comprehensive guide.';
      const scores = calculatePromptScores(prompt);

      expect(scores.clarity).toBeGreaterThanOrEqual(0);
      expect(scores.clarity).toBeLessThanOrEqual(100);
      expect(scores.overall).toBeGreaterThanOrEqual(0);
      expect(scores.overall).toBeLessThanOrEqual(100);
    });

    it('should give higher overall score to well-crafted prompts', () => {
      const good = `You are an expert Python developer. Your task is to write a function that:

1. Takes a list of integers as input
2. Filters out all negative numbers
3. Returns the sum of the remaining numbers

Requirements:
- Include proper error handling for invalid inputs
- Add type hints
- Include a docstring with examples

Output format: Provide the function code followed by example usage.`;

      const poor = 'do the thing with the numbers somehow';

      const goodScores = calculatePromptScores(good);
      const poorScores = calculatePromptScores(poor);

      expect(goodScores.overall).toBeGreaterThan(poorScores.overall);
    });
  });

  describe('formatPromptScores', () => {
    it('should format scores as a readable string', () => {
      const scores = {
        clarity: 80,
        specificity: 70,
        structure: 60,
        completeness: 75,
        efficiency: 85,
        overall: 74
      };

      const formatted = formatPromptScores(scores);

      expect(formatted).toContain('Clarity');
      expect(formatted).toContain('80/100');
      expect(formatted).toContain('Overall');
      expect(formatted).toContain('74/100');
    });
  });

  describe('Scoring Determinism & Stability', () => {
    it('should produce identical scores for identical prompts', () => {
      const prompt = 'Write a function to calculate the factorial of a number.';

      const scores1 = calculatePromptScores(prompt);
      const scores2 = calculatePromptScores(prompt);

      expect(scores1).toEqual(scores2);
    });

    it('should be stable across multiple runs', () => {
      const prompt = 'Explain quantum computing in simple terms.';
      const runs = Array(10).fill(null).map(() => calculatePromptScores(prompt));

      // All runs should produce identical results
      const firstRun = runs[0];
      runs.forEach(run => {
        expect(run.overall).toBe(firstRun.overall);
        expect(run.clarity).toBe(firstRun.clarity);
        expect(run.specificity).toBe(firstRun.specificity);
      });
    });

    it('should handle unicode characters', () => {
      const prompt = '请用中文解释这个概念。Explain this concept in Japanese: 日本語で説明してください。';
      const scores = calculatePromptScores(prompt);

      expect(scores.overall).toBeGreaterThanOrEqual(0);
      expect(scores.overall).toBeLessThanOrEqual(100);
    });

    it('should handle very long prompts', () => {
      const longPrompt = 'This is a test prompt. '.repeat(500);
      const scores = calculatePromptScores(longPrompt);

      expect(scores.overall).toBeGreaterThanOrEqual(0);
      expect(scores.overall).toBeLessThanOrEqual(100);
      // Efficiency should penalize very long prompts
      expect(scores.efficiency).toBeLessThan(50);
    });

    it('should handle special characters', () => {
      const prompt = 'Write code: `const x = { a: 1, b: [2, 3] };` and explain @decorators #hashtags $variables';
      const scores = calculatePromptScores(prompt);

      expect(scores.overall).toBeGreaterThanOrEqual(0);
      expect(scores.overall).toBeLessThanOrEqual(100);
    });
  });

  describe('Scoring Edge Cases', () => {
    it('should give low overall scores to empty-like prompts', () => {
      const emptyish = '   ';
      const scores = calculatePromptScores(emptyish);

      // Empty-ish prompts don't have ambiguous words, so clarity stays high
      // But efficiency should be low (too short) and overall should be low
      expect(scores.efficiency).toBeLessThanOrEqual(50);
      expect(scores.overall).toBeLessThan(70);
    });

    it('should not exceed 100 for any score', () => {
      // Craft a prompt that tries to maximize all bonuses
      const maxBonus = `You are an expert. Your task is to analyze this data with exactly 5 steps.

## Context
Given the background situation, here is what we need.

## Requirements
1. First requirement
2. Second requirement
3. Third requirement

- Bullet point one
- Bullet point two

## Output Format
Provide the result in a structured format with specific examples.

## Constraints
Do not include any personal information. Avoid making assumptions.

\`\`\`python
def example():
    return "sample"
\`\`\``;

      const scores = calculatePromptScores(maxBonus);

      expect(scores.clarity).toBeLessThanOrEqual(100);
      expect(scores.specificity).toBeLessThanOrEqual(100);
      expect(scores.structure).toBeLessThanOrEqual(100);
      expect(scores.completeness).toBeLessThanOrEqual(100);
      expect(scores.efficiency).toBeLessThanOrEqual(100);
      expect(scores.overall).toBeLessThanOrEqual(100);
    });

    it('should not go below 0 for any score', () => {
      // Craft a prompt that tries to trigger all penalties
      const minBonus = 'it this that thing stuff something somehow maybe perhaps possibly good nice better etc some any various';

      const scores = calculatePromptScores(minBonus);

      expect(scores.clarity).toBeGreaterThanOrEqual(0);
      expect(scores.specificity).toBeGreaterThanOrEqual(0);
      expect(scores.structure).toBeGreaterThanOrEqual(0);
      expect(scores.completeness).toBeGreaterThanOrEqual(0);
      expect(scores.efficiency).toBeGreaterThanOrEqual(0);
      expect(scores.overall).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Scoring Weight Verification', () => {
    it('should weight overall score according to documented formula', () => {
      // Create a prompt and manually verify weights
      const prompt = 'Write a function with clear requirements and structured output.';
      const scores = calculatePromptScores(prompt);

      // Documented weights: clarity 25%, specificity 25%, structure 15%, completeness 20%, efficiency 15%
      const expectedOverall = Math.round(
        scores.clarity * 0.25 +
        scores.specificity * 0.25 +
        scores.structure * 0.15 +
        scores.completeness * 0.20 +
        scores.efficiency * 0.15
      );

      expect(scores.overall).toBe(expectedOverall);
    });
  });
});
