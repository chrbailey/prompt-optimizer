# Prompt Scoring

This document describes how prompts are evaluated and scored. The scoring system uses **deterministic heuristics** (not LLM-based evaluation), ensuring reproducibility and transparency.

## Score Overview

Each prompt is evaluated on 5 dimensions, producing a score from 0-100:

| Dimension | Weight | What It Measures |
|-----------|--------|------------------|
| Clarity | 25% | Unambiguous language, proper punctuation |
| Specificity | 25% | Concrete details, quantifiable requirements |
| Structure | 15% | Lists, sections, logical organization |
| Completeness | 20% | Task definition, context, output format, constraints |
| Efficiency | 15% | Appropriate length (not too short or verbose) |

**Overall Score** = weighted sum of all dimensions

## Scoring Rubrics

### Clarity Score (0-100)

Starts at 100, then adjusts:

| Factor | Impact | Examples |
|--------|--------|----------|
| Ambiguous pronouns | -5 each | "it", "this", "that", "thing", "stuff" |
| Very short (<50 chars) | -20 | Single sentence questions |
| Short (<100 chars) | -10 | Brief requests |
| No punctuation | -10 | Missing periods, questions marks |
| Line breaks | +5 | Multi-line formatting |
| Lists (numbered/bullets) | +10 | "1.", "•", "-" |

**Example scores:**
- "Fix it" → 55 (short, ambiguous "it", no structure)
- "Fix the authentication bug in the login form" → 80 (clear, but brief)
- "Fix the authentication bug in `src/auth/login.ts`. The issue is..." → 95 (specific, structured)

### Specificity Score (0-100)

Starts at 50, then adjusts:

| Pattern | Impact | Examples |
|---------|--------|----------|
| Precision words | +10 | "exactly", "specifically", "precisely" |
| Numbers | +10 | "3 items", "within 100ms" |
| Format/structure words | +10 | "format", "structure", "output" |
| Requirement words | +10 | "must", "should", "required", "ensure" |
| Examples mentioned | +10 | "example", "e.g.", "for instance" |
| Quoted text | +10 | "like this" |
| Vague hedging | -10 | "maybe", "perhaps", "possibly" |
| Vague adjectives | -10 | "good", "nice", "better" |
| Open-ended | -10 | "etc", "and so on" |
| Indefinite quantifiers | -10 | "some", "any", "various" |

**Example scores:**
- "Make it better" → 30 (vague adjective, no specifics)
- "Improve performance" → 40 (still vague)
- "Reduce API latency to under 100ms by caching responses" → 80 (numbers, specific goal)

### Structure Score (0-100)

Starts at 50, then adjusts:

| Pattern | Impact | Detection |
|---------|--------|-----------|
| Headers/sections | +15 | `## Header` or `Header:` at line start |
| Bullet lists | +15 | Lines starting with `-`, `•`, `*` |
| Numbered lists | +15 | Lines starting with `1.`, `2.`, etc. |
| Code blocks | +10 | Triple backticks |
| Multiple paragraphs | +10 | 2+ paragraphs separated by blank lines |
| Additional paragraphs | +5 | 3+ paragraphs |
| Wall of text | -20 | 500+ char line with no paragraph breaks |

**Example scores:**
- One long sentence → 30 (wall of text penalty)
- Three paragraphs → 70 (multiple paragraphs)
- Headers + bullet list + code block → 100 (full structure)

### Completeness Score (0-100)

Starts at 50, checks for presence of key elements:

| Element | Impact | Detected By |
|---------|--------|-------------|
| Task definition | +10 | "task", "goal", "objective", "purpose", "want", "need" |
| Context/background | +10 | "context", "background", "situation", "given" |
| Output specification | +10 | "output", "result", "response", "return", "format" |
| Constraints | +10 | "constraint", "limit", "avoid", "don't", "must not" |
| Examples | +10 | "example", "sample", "like this", "such as" |

**Example scores:**
- "Write code" → 50 (minimal, no elements detected)
- "Write code to sort an array. Output should be..." → 70 (task + output)
- Full prompt with task, context, output, constraints, examples → 100

### Efficiency Score (0-100)

Based on estimated token count:

| Token Range | Score | Interpretation |
|-------------|-------|----------------|
| < 20 | 30 | Too short to be useful |
| 20-49 | 50 | Brief but may work |
| 50-200 | 100 | Optimal range |
| 201-500 | 90 | Good, slightly verbose |
| 501-1000 | 70 | Getting long |
| 1001-2000 | 50 | Verbose |
| > 2000 | 30 | Too long |

Token estimation: `(words × 1.3 + chars / 4) / 2`

## Overall Score Calculation

```
Overall = (Clarity × 0.25) + (Specificity × 0.25) + (Structure × 0.15) 
        + (Completeness × 0.20) + (Efficiency × 0.15)
```

## Known Limitations

### False Positives (scores higher than deserved)

| Scenario | Why It Happens |
|----------|----------------|
| Well-formatted nonsense | Structure is rewarded regardless of content meaning |
| Keyword stuffing | Specificity patterns match even if irrelevant |
| Long but empty prompts | Efficiency penalizes short, but long doesn't guarantee quality |

### False Negatives (scores lower than deserved)

| Scenario | Why It Happens |
|----------|----------------|
| Domain jargon | Technical terms may look "vague" to pattern matching |
| Minimalist expert prompts | Short prompts from experts may be penalized |
| Non-English conventions | Patterns are English-focused |

## Reproducibility

The scoring system is **100% deterministic**:

- Same prompt → same score (always)
- No LLM involved in scoring
- No randomness or sampling
- Version-stable (scores won't change between runs)

This differs from LLM-based evaluation which can vary based on:
- Model temperature
- Model version changes
- API response variation

## Comparison with LLM Evaluation

| Aspect | Heuristic Scoring | LLM Evaluation |
|--------|------------------|----------------|
| Reproducibility | ✅ Perfect | ⚠️ Variable |
| Speed | ✅ Instant | ⚠️ API latency |
| Cost | ✅ Free | ⚠️ Per-call cost |
| Semantic understanding | ❌ Pattern-based | ✅ Understands meaning |
| Domain awareness | ❌ Generic | ✅ Context-aware |
| Bias | Transparent, fixable | Opaque, inherited |

## Improvement Calculation

When comparing original vs. optimized prompts:

```
Improvement = OptimizedOverallScore - OriginalOverallScore
```

Displayed as: `Score: 58 -> 83 (+25)`

## Validating Scores

To understand why a prompt received its score:

```bash
# Use evaluate command with metrics
prompt-optimizer evaluate "your prompt here" --metrics
```

This shows individual dimension scores and the overall calculation.
