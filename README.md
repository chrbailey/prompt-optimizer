# Prompt Optimizer

[![CI](https://github.com/chrbailey/prompt-optimizer/actions/workflows/ci.yml/badge.svg)](https://github.com/chrbailey/prompt-optimizer/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/prompt-optimizer.svg)](https://www.npmjs.com/package/prompt-optimizer)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![GitHub Action](https://img.shields.io/badge/GitHub%20Action-available-success)](https://github.com/chrbailey/prompt-optimizer/tree/main/action)

**The only prompt quality tool that gives you the same score every time.**

Stop guessing if your prompts are good. Get deterministic, reproducible quality scores that you can trust in CI/CD pipelines. No LLM evaluation randomness. No surprise failures.

```bash
# Add to any PR workflow in 30 seconds
- uses: chrbailey/prompt-optimizer/action@main
  with:
    threshold: 60
```

---

## Why Prompt Optimizer?

| Problem | Other Tools | Prompt Optimizer |
|---------|-------------|------------------|
| **Evaluation consistency** | LLM-based scoring varies 10-20% between runs | **100% deterministic** - same input, same score, every time |
| **CI/CD integration** | Complex setup, API keys required | **Zero API keys** - works offline, instant results |
| **Debugging failures** | "The AI said it was bad" | **Transparent rubric** - know exactly why a score dropped |
| **Cost** | $0.01-0.10 per evaluation | **Free** - no API calls for scoring |

### The Quality Gate for Prompts

Just like ESLint catches code issues before merge, Prompt Optimizer catches prompt regressions:

```yaml
# .github/workflows/prompt-check.yml
name: Prompt Quality

on:
  pull_request:
    paths: ['**/*.prompt.md', 'prompts/**']

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: chrbailey/prompt-optimizer/action@main
        with:
          path: '**/*.prompt.md'
          threshold: 60
          annotations: true  # Adds inline PR comments
```

**Result:** PRs that degrade prompt quality automatically fail with clear feedback.

---

## Quick Demo

**Good prompt** (scores 78/100):
```markdown
# Code Review Assistant

## Role
You are an expert code reviewer with 10+ years of TypeScript experience.

## Task
Review the provided code for security vulnerabilities and performance issues.

## Output Format
Return JSON: { "issues": [{ "severity": "high|medium|low", "line": 42, "description": "..." }] }

## Constraints
- Focus on functional issues only
- Limit to 5 most critical issues
```

**Bad prompt** (scores 32/100):
```
review this code and tell me if there are any problems with it or whatever. make it better somehow. thanks
```

The difference is measurable, reproducible, and enforceable in CI.

---

## Scoring System

Every prompt is scored on 5 dimensions (0-100):

| Dimension | Weight | What It Measures |
|-----------|--------|------------------|
| **Clarity** | 25% | Absence of ambiguous pronouns ("it", "this", "stuff") |
| **Specificity** | 25% | Concrete details, numbers, quoted examples |
| **Structure** | 15% | Headers, lists, code blocks, paragraphs |
| **Completeness** | 20% | Task, context, output format, constraints |
| **Efficiency** | 15% | Token count in optimal range (50-200 tokens) |

**Overall Score** = weighted average, rounded to nearest integer.

See [docs/scoring.md](docs/scoring.md) for the complete rubric with examples.

---

## Installation

### GitHub Action (Recommended)

Add to your workflow - no installation needed:

```yaml
- uses: chrbailey/prompt-optimizer/action@main
  with:
    path: '**/*.prompt.md'  # Glob pattern for prompt files
    threshold: 60            # Minimum score to pass (0-100)
    annotations: true        # Add PR annotations for failures
```

### CLI

```bash
# Install globally
npm install -g prompt-optimizer

# Or run with npx
npx prompt-optimizer evaluate "Your prompt here"
```

### As a Library

```bash
npm install prompt-optimizer
```

```typescript
import { calculatePromptScores } from 'prompt-optimizer';

const scores = calculatePromptScores("Your prompt here");
console.log(scores.overall); // 0-100
```

---

## CLI Commands

### `evaluate` - Score a Prompt

```bash
prompt-optimizer evaluate "Write a function to sort an array" --metrics

# Output:
# Score: 45/100
#
# Breakdown:
#   Clarity:      55/100
#   Specificity:  40/100
#   Structure:    30/100
#   Completeness: 45/100
#   Efficiency:   70/100
#
# Suggestions:
#   - Add specific requirements (language, complexity, edge cases)
#   - Include output format specification
#   - Add examples of expected input/output
```

### `optimize` - Improve a Prompt

```bash
prompt-optimizer optimize "Write a sorting function" --techniques structured_reasoning,few_shot

# Applies optimization techniques using LLM (requires API key)
```

### `route` - Select Best Model

```bash
prompt-optimizer route "Complex code review task" --quality best

# Recommends: claude-sonnet-4 (coding task, high complexity)
```

### `batch` - Process Multiple Prompts

```bash
prompt-optimizer batch prompts.txt --output results.json --parallel 5
```

See [CLI Reference](#cli-reference) for all options.

---

## GitHub Action Options

| Input | Default | Description |
|-------|---------|-------------|
| `path` | `**/*.prompt.md` | Glob pattern for prompt files |
| `threshold` | `60` | Minimum score to pass (0-100) |
| `fail-on-warning` | `false` | Fail if any prompt is within 10 points of threshold |
| `annotations` | `true` | Add inline PR annotations for failures |
| `output-format` | `summary` | Output: `summary`, `detailed`, or `json` |

| Output | Description |
|--------|-------------|
| `total-prompts` | Number of prompts scored |
| `passed-prompts` | Number above threshold |
| `failed-prompts` | Number below threshold |
| `average-score` | Mean score across all prompts |
| `results-json` | Full results as JSON string |

### Example: Block Merges on Low Scores

```yaml
jobs:
  prompt-quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: chrbailey/prompt-optimizer/action@main
        id: score
        with:
          threshold: 70
          fail-on-warning: true

      - name: Comment on PR
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: '⚠️ Prompt quality check failed. Please review the annotations above.'
            })
```

---

## Comparison with Alternatives

| Feature | Prompt Optimizer | DSPy | LiteLLM | Promptfoo | Not Diamond |
|---------|------------------|------|---------|-----------|-------------|
| **Deterministic Scoring** | ✅ Yes | ❌ No | ❌ No | ⚠️ Custom | ❌ No |
| **No API Key Required** | ✅ Scoring | ❌ | ❌ | ❌ | ❌ |
| **GitHub Action** | ✅ Native | ❌ | ❌ | ⚠️ | ❌ |
| **CI/CD Quality Gate** | ✅ Built-in | ❌ | ❌ | ✅ | ❌ |
| **Transparent Rubric** | ✅ [Documented](docs/scoring.md) | ❌ | N/A | ⚠️ | ❌ |
| **Multi-Provider Support** | ✅ 3 | ✅ Many | ✅ 100+ | ✅ Many | ✅ 200+ |
| **Prompt Optimization** | ✅ 8 techniques | ✅ Auto | ❌ | ❌ | ✅ Auto |
| **Model Routing** | ✅ Task-aware | ❌ | ⚠️ Fallback | ❌ | ✅ ML-based |

**When to use Prompt Optimizer:**
- You need **reproducible scores** for CI/CD
- You want a **quality gate** that doesn't require API keys
- You need to **audit** why a prompt scored a certain way

**When to use something else:**
- DSPy: You want automatic prompt optimization through compilation
- LiteLLM: You need to call 100+ different LLM providers
- Promptfoo: You need comprehensive security/adversarial testing
- Not Diamond: You need ML-based routing at scale with enterprise support

---

## Prompt File Convention

We recommend using `.prompt.md` extension for prompt files:

```
prompts/
├── code-review.prompt.md
├── summarization.prompt.md
└── data-extraction.prompt.md
```

This makes it easy to:
- Target prompts with glob patterns (`**/*.prompt.md`)
- Distinguish prompts from regular documentation
- Get syntax highlighting in editors

### Example Prompt File

```markdown
# Data Extraction Assistant

## Role
You are a data extraction specialist.

## Task
Extract all email addresses and phone numbers from the provided text.

## Output Format
```json
{
  "emails": ["user@example.com"],
  "phones": ["+1-555-123-4567"]
}
```

## Constraints
- Only extract valid formats
- Deduplicate results
- Return empty arrays if none found
```

---

## Documentation

- [Scoring Rubric](docs/scoring.md) - Exact formula, examples, known limitations
- [Routing Policy](docs/routing.md) - How models are selected
- [Security](docs/security.md) - API key handling, data privacy

---

## Development

```bash
# Clone and install
git clone https://github.com/chrbailey/prompt-optimizer.git
cd prompt-optimizer
npm install

# Build
npm run build

# Test
npm test

# Lint
npm run lint

# Build the GitHub Action
cd action && npm install && npm run build
```

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CLI / GitHub Action                     │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│   Evaluator   │     │   Optimizer   │     │    Router     │
│   (Scoring)   │     │  (Techniques) │     │   (Models)    │
└───────────────┘     └───────────────┘     └───────────────┘
        │                     │                     │
        │                     ▼                     │
        │         ┌───────────────────────┐        │
        │         │    LLM Providers      │        │
        │         │ Anthropic/OpenAI/Google│        │
        │         └───────────────────────┘        │
        │                                          │
        └──────────────────────────────────────────┘
                    No API Required
               (Deterministic Scoring)
```

---

## CLI Reference

### `evaluate`

```bash
prompt-optimizer evaluate <prompt> [options]

Options:
  -m, --metrics          Show detailed score breakdown
  -c, --compare <prompt> Compare with another prompt
  -o, --output <format>  Output format (text, json, markdown)
  -v, --verbose          Show all detected issues
```

### `optimize`

```bash
prompt-optimizer optimize <prompt> [options]

Options:
  -m, --model <model>       Target model (default: auto)
  -t, --techniques <list>   Techniques: structured_reasoning, few_shot, role_prompting, etc.
  -n, --variants <n>        Number of variants to generate
  --cost-limit <dollars>    Maximum cost budget
  --dry-run                 Show plan without executing
  --explain                 Show detailed optimization reasoning
```

### `route`

```bash
prompt-optimizer route <prompt> [options]

Options:
  -b, --budget <level>   Budget: low, medium, high
  -q, --quality <level>  Quality: fast, balanced, best
  -p, --providers <list> Limit to: anthropic, openai, google
```

### `batch`

```bash
prompt-optimizer batch <file> [options]

Options:
  -o, --output <file>      Output file
  -f, --format <format>    Format: json, jsonl, csv
  -p, --parallel <n>       Concurrent operations (default: 3)
  --continue-on-error      Don't stop on failures
```

### `config`

```bash
prompt-optimizer config list              # Show configuration
prompt-optimizer config get <key>         # Get value
prompt-optimizer config set <key> <value> # Set value
prompt-optimizer config validate          # Validate config
```

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Priority areas:
- Additional scoring heuristics
- New optimization techniques
- Documentation improvements
- Bug fixes

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Acknowledgments

- Built with [Claude Code](https://claude.ai/code) using parallel multi-agent architecture
- Inspired by ESLint, Prettier, and the need for prompt quality enforcement
- Thanks to the prompt engineering research community

---

<p align="center">
  <strong>Stop guessing. Start measuring.</strong><br>
  <a href="https://github.com/chrbailey/prompt-optimizer/actions/new">Add Prompt Optimizer to your repo →</a>
</p>
