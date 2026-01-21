/**
 * Tests for Router Logic
 *
 * These tests verify routing decision logic including:
 * - Task type detection
 * - Complexity scoring
 * - Context length classification
 * - Safety sensitivity detection
 *
 * Tests are designed to be deterministic and stable.
 */

// Helper functions extracted for testing (mirroring router-agent.ts logic)

type TaskType =
  | 'coding'
  | 'analysis'
  | 'creative'
  | 'reasoning'
  | 'conversation'
  | 'extraction'
  | 'translation'
  | 'summarization'
  | 'general';

/**
 * Detect the primary task type from prompt text.
 * Mirrors the logic in router-agent.ts
 */
function detectTaskType(prompt: string): TaskType {
  const lower = prompt.toLowerCase();

  // Coding indicators
  if (
    lower.includes('code') ||
    lower.includes('function') ||
    lower.includes('implement') ||
    lower.includes('debug') ||
    lower.includes('program') ||
    /```|def |function |class |const |let |var /.test(lower)
  ) {
    return 'coding';
  }

  // Analysis indicators
  if (
    lower.includes('analyze') ||
    lower.includes('analysis') ||
    lower.includes('evaluate') ||
    lower.includes('compare')
  ) {
    return 'analysis';
  }

  // Creative indicators
  if (
    lower.includes('write') ||
    lower.includes('story') ||
    lower.includes('creative') ||
    lower.includes('poem') ||
    lower.includes('imagine')
  ) {
    return 'creative';
  }

  // Reasoning indicators
  if (
    lower.includes('why') ||
    lower.includes('explain') ||
    lower.includes('reason') ||
    lower.includes('logic') ||
    lower.includes('prove')
  ) {
    return 'reasoning';
  }

  // Summarization
  if (
    lower.includes('summarize') ||
    lower.includes('summary') ||
    lower.includes('brief') ||
    lower.includes('tldr')
  ) {
    return 'summarization';
  }

  // Translation
  if (
    lower.includes('translate') ||
    lower.includes('translation') ||
    lower.includes('in english') ||
    lower.includes('in spanish')
  ) {
    return 'translation';
  }

  // Extraction
  if (
    lower.includes('extract') ||
    lower.includes('find all') ||
    lower.includes('list all') ||
    lower.includes('identify')
  ) {
    return 'extraction';
  }

  // Conversation
  if (
    lower.includes('chat') ||
    lower.includes('discuss') ||
    lower.includes('conversation')
  ) {
    return 'conversation';
  }

  return 'general';
}

/**
 * Detect safety sensitivity level.
 */
function detectSafetySensitivity(prompt: string): 'low' | 'medium' | 'high' {
  const lower = prompt.toLowerCase();

  const highSensitivity = [
    'medical',
    'legal',
    'financial advice',
    'diagnosis',
    'treatment',
    'lawsuit',
  ];

  const mediumSensitivity = [
    'personal',
    'private',
    'confidential',
    'sensitive',
    'security',
  ];

  for (const term of highSensitivity) {
    if (lower.includes(term)) return 'high';
  }

  for (const term of mediumSensitivity) {
    if (lower.includes(term)) return 'medium';
  }

  return 'low';
}

/**
 * Estimate token count (simplified).
 */
function estimateTokens(text: string): number {
  const words = text.split(/\s+/).length;
  const chars = text.length;
  return Math.ceil((words * 1.3 + chars / 4) / 2);
}

/**
 * Categorize context length based on token estimate.
 */
function categorizeContextLength(tokens: number): 'short' | 'medium' | 'long' | 'very_long' {
  if (tokens < 1000) return 'short';
  if (tokens < 10000) return 'medium';
  if (tokens < 50000) return 'long';
  return 'very_long';
}

/**
 * Calculate complexity score (0-1).
 */
function calculateComplexity(prompt: string): number {
  let score = 0;
  const tokens = estimateTokens(prompt);
  const lower = prompt.toLowerCase();

  // Length factor
  if (tokens > 1000) score += 0.3;
  else if (tokens > 500) score += 0.2;
  else if (tokens > 200) score += 0.1;

  // Complexity indicators
  if (lower.includes('complex') || lower.includes('complicated')) score += 0.1;
  if (lower.includes('multiple') || lower.includes('several')) score += 0.1;
  if (lower.includes('nested') || lower.includes('recursive')) score += 0.15;
  if (lower.includes('optimize') || lower.includes('efficient')) score += 0.1;
  if (lower.includes('edge case') || lower.includes('corner case')) score += 0.1;

  // Technical depth indicators
  if (/[A-Z]{2,}/.test(prompt)) score += 0.05; // Acronyms
  if (/\d+\.\d+/.test(prompt)) score += 0.05; // Version numbers
  if (prompt.includes('```')) score += 0.1; // Code blocks

  return Math.min(score, 1.0);
}

describe('Router Logic - Task Type Detection', () => {
  it('should detect coding task type', () => {
    expect(detectTaskType('Write a Python function to sort an array')).toBe('coding');
    expect(detectTaskType('Implement a binary search algorithm')).toBe('coding');
    expect(detectTaskType('Debug this code: def foo(): pass')).toBe('coding');
    expect(detectTaskType('Fix this program')).toBe('coding');
  });

  it('should detect analysis task type', () => {
    expect(detectTaskType('Analyze the quarterly sales data and compare trends')).toBe('analysis');
    expect(detectTaskType('Evaluate the performance of this algorithm')).toBe('analysis');
    expect(detectTaskType('Compare these two approaches')).toBe('analysis');
  });

  it('should detect creative task type', () => {
    expect(detectTaskType('Write a short story about a robot learning to paint')).toBe('creative');
    expect(detectTaskType('Create a poem about nature')).toBe('creative');
    expect(detectTaskType('Imagine a world where cats rule')).toBe('creative');
  });

  it('should detect reasoning task type', () => {
    expect(detectTaskType('Explain why the sky is blue using physics principles')).toBe('reasoning');
    expect(detectTaskType('Prove that this theorem is correct')).toBe('reasoning');
    expect(detectTaskType('What is the logic behind this decision?')).toBe('reasoning');
  });

  it('should detect summarization task type', () => {
    expect(detectTaskType('Summarize the main points of this article')).toBe('summarization');
    expect(detectTaskType('Give me a brief overview')).toBe('summarization');
    expect(detectTaskType('TLDR of this document')).toBe('summarization');
  });

  it('should detect translation task type', () => {
    expect(detectTaskType('Translate this to French')).toBe('translation');
    expect(detectTaskType('Convert this text in English')).toBe('translation');
    expect(detectTaskType('Say this in Spanish')).toBe('translation');
  });

  it('should detect extraction task type', () => {
    expect(detectTaskType('Extract all email addresses from this text')).toBe('extraction');
    expect(detectTaskType('Find all mentions of dates')).toBe('extraction');
    expect(detectTaskType('List all the names in the document')).toBe('extraction');
    expect(detectTaskType('Identify the key themes')).toBe('extraction');
  });

  it('should default to general for ambiguous prompts', () => {
    expect(detectTaskType('Hello, how are you today?')).toBe('general');
    expect(detectTaskType('Thank you')).toBe('general');
    expect(detectTaskType('What time is it?')).toBe('general');
  });
});

describe('Router Logic - Complexity Scoring', () => {
  it('should score simple prompts with low complexity', () => {
    const complexity = calculateComplexity('What is 2 + 2?');
    expect(complexity).toBeLessThan(0.3);
  });

  it('should score complex prompts with higher complexity', () => {
    const complexity = calculateComplexity(
      'Implement a complex recursive algorithm with multiple edge cases ' +
      'that handles nested data structures efficiently, including optimization ' +
      'for memory usage and time complexity considerations.'
    );
    expect(complexity).toBeGreaterThan(0.3);
  });

  it('should increase complexity for prompts with code blocks', () => {
    const withCode = calculateComplexity('Fix this:\n```python\ndef broken():\n  pass\n```');
    const withoutCode = calculateComplexity('Fix this: def broken(): pass');
    expect(withCode).toBeGreaterThanOrEqual(withoutCode);
  });

  it('should increase complexity for technical acronyms', () => {
    const withAcronyms = calculateComplexity('Configure the AWS EC2 instance with IAM roles');
    const withoutAcronyms = calculateComplexity('Configure the cloud server with access roles');
    expect(withAcronyms).toBeGreaterThan(withoutAcronyms);
  });

  it('should cap complexity at 1.0', () => {
    const maxComplex = calculateComplexity(
      'Implement a complex recursive nested algorithm with multiple edge cases ' +
      'and optimize it efficiently. Version 2.0.1 of the API requires handling ' +
      '```code blocks``` and AWS EC2 IAM configurations.'
    );
    expect(maxComplex).toBeLessThanOrEqual(1.0);
  });
});

describe('Router Logic - Context Length Classification', () => {
  it('should classify short prompts correctly', () => {
    expect(categorizeContextLength(100)).toBe('short');
    expect(categorizeContextLength(500)).toBe('short');
    expect(categorizeContextLength(999)).toBe('short');
  });

  it('should classify medium prompts correctly', () => {
    expect(categorizeContextLength(1000)).toBe('medium');
    expect(categorizeContextLength(5000)).toBe('medium');
    expect(categorizeContextLength(9999)).toBe('medium');
  });

  it('should classify long prompts correctly', () => {
    expect(categorizeContextLength(10000)).toBe('long');
    expect(categorizeContextLength(30000)).toBe('long');
    expect(categorizeContextLength(49999)).toBe('long');
  });

  it('should classify very long prompts correctly', () => {
    expect(categorizeContextLength(50000)).toBe('very_long');
    expect(categorizeContextLength(100000)).toBe('very_long');
  });
});

describe('Router Logic - Safety Sensitivity Detection', () => {
  it('should detect high sensitivity for medical content', () => {
    expect(detectSafetySensitivity('Provide a medical diagnosis for these symptoms')).toBe('high');
    expect(detectSafetySensitivity('What treatment should I take?')).toBe('high');
  });

  it('should detect high sensitivity for legal content', () => {
    expect(detectSafetySensitivity('Give legal advice about this lawsuit')).toBe('high');
  });

  it('should detect high sensitivity for financial advice', () => {
    expect(detectSafetySensitivity('Give me financial advice on investments')).toBe('high');
  });

  it('should detect medium sensitivity for personal content', () => {
    expect(detectSafetySensitivity('Help me write a personal letter about confidential matters')).toBe('medium');
    expect(detectSafetySensitivity('This is a private matter')).toBe('medium');
    expect(detectSafetySensitivity('Keep this sensitive information secure')).toBe('medium');
  });

  it('should detect low sensitivity for general content', () => {
    expect(detectSafetySensitivity('Explain how to bake a chocolate cake')).toBe('low');
    expect(detectSafetySensitivity('What is the capital of France?')).toBe('low');
    expect(detectSafetySensitivity('Write a poem about trees')).toBe('low');
  });
});

describe('Router Logic - Determinism', () => {
  it('should produce identical results for identical prompts', () => {
    const prompt = 'Write a function to calculate fibonacci numbers';

    const result1 = detectTaskType(prompt);
    const result2 = detectTaskType(prompt);

    expect(result1).toBe(result2);
  });

  it('should be case-insensitive for task detection', () => {
    const lower = 'write code to sort an array';
    const upper = 'WRITE CODE TO SORT AN ARRAY';
    const mixed = 'Write Code To Sort An Array';

    expect(detectTaskType(lower)).toBe(detectTaskType(upper));
    expect(detectTaskType(lower)).toBe(detectTaskType(mixed));
  });

  it('should produce consistent complexity scores', () => {
    const prompt = 'Implement a complex algorithm with edge cases';

    const scores = Array(10).fill(null).map(() => calculateComplexity(prompt));

    // All scores should be identical
    scores.forEach(score => {
      expect(score).toBe(scores[0]);
    });
  });
});

describe('Token Estimation', () => {
  it('should estimate tokens for simple text', () => {
    const tokens = estimateTokens('Hello world');
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(10);
  });

  it('should estimate more tokens for longer text', () => {
    const short = estimateTokens('Hello');
    const long = estimateTokens('Hello world, this is a much longer sentence with many more words.');
    expect(long).toBeGreaterThan(short);
  });

  it('should handle empty string', () => {
    const tokens = estimateTokens('');
    expect(tokens).toBeGreaterThanOrEqual(0);
  });
});
