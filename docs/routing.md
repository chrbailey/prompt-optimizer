# Model Routing

This document describes how the router selects models for prompts, including the decision policy, scoring breakdown, and constraint handling.

## Routing Overview

The router analyzes each prompt and scores available models based on four factors:

| Factor | Weight (cost-sensitive) | Weight (quality-focused) | What It Measures |
|--------|------------------------|--------------------------|------------------|
| Capability | 40% | 40% | Can model handle this task type? |
| Cost | 25% | 10% | Price efficiency |
| Performance | 25% | 25% | Expected quality of output |
| Availability | 10% | 10% | Provider preference order |

## Prompt Analysis

Before scoring models, the router analyzes the prompt to extract characteristics:

### Task Type Detection

| Task Type | Detected By | Implications |
|-----------|-------------|--------------|
| `coding` | "code", "function", "implement", "debug", code blocks | Prefers large context models |
| `analysis` | "analyze", "evaluate", "compare" | Prefers large context for data |
| `creative` | "write", "story", "poem", "imagine" | Prefers high output limit |
| `reasoning` | "why", "explain", "reason", "prove" | Prefers flagship models |
| `summarization` | "summarize", "summary", "tldr" | Any capable model |
| `translation` | "translate", "in english" | Language support matters |
| `extraction` | "extract", "find all", "list all" | Structured output helps |
| `conversation` | "chat", "discuss" | Streaming support preferred |
| `general` | (default) | Balanced selection |

### Complexity Scoring (0.0-1.0)

Complexity increases with:

| Factor | Score Increase | Example |
|--------|---------------|---------|
| Long prompt (>1000 tokens) | +0.3 | Multi-page requirements |
| Medium prompt (>500 tokens) | +0.2 | Detailed instructions |
| Short prompt (>200 tokens) | +0.1 | Standard request |
| Complexity keywords | +0.1 | "complex", "complicated" |
| Multiple items | +0.1 | "multiple", "several" |
| Technical depth | +0.15 | "nested", "recursive" |
| Optimization request | +0.1 | "optimize", "efficient" |
| Edge cases | +0.1 | "edge case", "corner case" |
| Code blocks | +0.1 | Triple backticks |
| Acronyms | +0.05 | All-caps terms |
| Constraints | +0.05 each | Up to +0.2 max |

### Context Length Classification

| Classification | Token Estimate | Router Behavior |
|---------------|----------------|-----------------|
| `short` | < 1,000 | Any model works |
| `medium` | 1,000 - 10,000 | Standard selection |
| `long` | 10,000 - 50,000 | Prefer 100K+ context |
| `very_long` | > 50,000 | Penalize small-context models |

### Safety Sensitivity

| Level | Triggers | Routing Effect |
|-------|----------|----------------|
| `high` | "medical", "legal", "financial advice", "diagnosis" | May add safety constraints |
| `medium` | "personal", "private", "confidential" | Standard handling |
| `low` | (default) | No special handling |

## Model Scoring

### Capability Score (0.0-1.0)

Base score: 0.5

**Hard requirements** (score = 0 if missing):
- If task requires JSON mode and model lacks it → 0
- If task requires function calling and model lacks it → 0
- If task requires vision and model lacks it → 0

**Task bonuses**:

| Task Type | Bonus | Condition |
|-----------|-------|-----------|
| Coding | +0.3 | Context ≥ 100K tokens |
| Coding | +0.2 | Context ≥ 32K tokens |
| Creative | +0.2 | Max output ≥ 4K tokens |
| Reasoning | +0.3 | Flagship model (Opus, GPT-4o) |
| Analysis | +0.2 | Context ≥ 100K tokens |

**Complexity bonus**: High complexity (>0.7) → +0.2 for flagship models

**Context penalty**: Very long context needed + model < 100K → -0.3

### Cost Score (0.0-1.0)

Based on average cost per 1K tokens: `(inputPer1K + outputPer1K) / 2`

| Average Cost | Score | Examples |
|--------------|-------|----------|
| < $0.001 | 1.0 | Gemini Flash, GPT-4o-mini |
| < $0.005 | 0.8 | Claude Sonnet |
| < $0.01 | 0.6 | GPT-4o |
| < $0.05 | 0.4 | Claude Opus |
| > max limit | 0.2 | Over budget |

**Cost limit**: If model exceeds `maxCostPer1K` config, score = 0.2

### Performance Score (0.0-1.0)

Heuristic based on model tier:

| Model Class | Base Score | High Complexity Adjustment |
|-------------|------------|---------------------------|
| Flagship (Opus, GPT-4o, Gemini 2) | 0.9 | No penalty |
| Standard (Sonnet, Haiku, etc.) | 0.7 | -0.2 for complexity > 0.7 |

### Availability Score (0.0-1.0)

Based on configured provider preference order:

| Provider Position | Score |
|------------------|-------|
| 1st preferred | 1.0 |
| 2nd preferred | 0.9 |
| 3rd preferred | 0.8 |
| Not in list | 0.7 |

Default preference: `[anthropic, openai, google]`

## Final Selection

1. Score all available models
2. Sort by total score (descending)
3. Select highest-scoring model
4. If tied, prefer first in provider preference order

### Score Calculation

```
total = (capability × 0.40) + (cost × weight) + (performance × 0.25) + (availability × 0.10)

where:
  weight = 0.25 if cost_sensitive else 0.10
```

## Configuration Options

| Config | Default | Effect |
|--------|---------|--------|
| `costSensitive` | true | Cost weight: 25% vs 10% |
| `maxCostPer1K` | 0.10 | Models above this get score 0.2 |
| `preferredProviders` | [anthropic, openai, google] | Availability scoring order |
| `requiredCapabilities` | {} | Hard requirements (vision, JSON, etc.) |
| `defaultModel` | claude-sonnet-4-20250514 | Fallback if scoring fails |

## Routing Examples

### Example 1: Simple Question

**Prompt**: "What is the capital of France?"

| Characteristic | Value |
|----------------|-------|
| Task type | general |
| Complexity | 0.0 |
| Context length | short |

**Selected**: GPT-4o-mini or Gemini Flash (lowest cost for simple task)

### Example 2: Complex Code Review

**Prompt**: "Review this 5000-line codebase for security vulnerabilities, optimize the database queries, and suggest architectural improvements..."

| Characteristic | Value |
|----------------|-------|
| Task type | coding |
| Complexity | 0.85 |
| Context length | very_long |

**Selected**: Claude Opus or GPT-4o (flagship for complexity, large context)

### Example 3: Creative Writing

**Prompt**: "Write a short story about a robot learning to paint"

| Characteristic | Value |
|----------------|-------|
| Task type | creative |
| Complexity | 0.1 |
| Context length | short |

**Selected**: Claude Sonnet (balanced cost/quality for creative)

## Fallback Behavior

If routing fails (no valid model scores):

1. Use `defaultModel` from configuration
2. Default: `claude-sonnet-4-20250514`
3. Log warning with failure reason

## Extending Routing

To add a new model, provide `ModelConfig`:

```typescript
{
  id: 'new-model-id',
  name: 'Display Name',
  provider: 'anthropic' | 'openai' | 'google',
  contextWindow: 100000,
  maxOutputTokens: 4096,
  pricing: { inputPer1k: 0.01, outputPer1k: 0.03, currency: 'USD' },
  capabilities: {
    jsonMode: true,
    functionCalling: true,
    vision: true,
    streaming: true,
    systemMessages: true,
  },
  tier: 'fast' | 'balanced' | 'quality',
}
```

## Known Limitations

1. **No runtime performance tracking**: Scores are based on heuristics, not actual latency measurements
2. **No rate limit awareness**: Doesn't track quota usage per provider
3. **Static capability assessment**: Assumes capabilities don't change
4. **English-centric task detection**: Keyword matching is English-focused
