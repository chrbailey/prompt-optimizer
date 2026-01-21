# Prompt Optimizer

[![CI](https://github.com/chrbailey/prompt-optimizer/actions/workflows/ci.yml/badge.svg)](https://github.com/chrbailey/prompt-optimizer/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

AI-powered prompt optimization with multi-agent architecture. Improve your prompts for better results with LLMs.

## Features

- **Multi-Provider Support**: Works with Anthropic (Claude), OpenAI (GPT-4), and Google (Gemini)
- **Intelligent Routing**: Automatically selects the best model based on task requirements and budget
- **Multiple Optimization Techniques**: Structured reasoning, few-shot learning, role prompting, and more
- **Quality Evaluation**: Score your prompts and get actionable suggestions
- **Batch Processing**: Optimize multiple prompts in parallel
- **Flexible Output**: Text, JSON, or Markdown output formats

## Documentation

- [Security](docs/security.md) - API key handling, data sent to providers, logging
- [Scoring](docs/scoring.md) - How prompts are evaluated (deterministic, transparent rubric)
- [Routing](docs/routing.md) - How models are selected (decision policy, constraints)

## Installation

```bash
# Clone the repository
git clone https://github.com/christopherbailey/prompt-optimizer.git
cd prompt-optimizer

# Install dependencies
npm install

# Build the project
npm run build

# Link globally (optional)
npm link
```

## Quick Start

### 1. Configure API Keys

```bash
# Set up your API keys
prompt-optimizer config set anthropic.apiKey sk-ant-api03-...
prompt-optimizer config set openai.apiKey sk-...
prompt-optimizer config set google.apiKey AIza...

# Or use environment variables
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...
export GOOGLE_API_KEY=AIza...
```

### 2. Optimize a Prompt

```bash
prompt-optimizer optimize "Write a function to sort an array"
```

**Output:**
```
Prompt Optimization
═══════════════════

Model: claude-sonnet-4-20250514
Techniques: chain_of_thought, structured_output

✓ Optimization complete

Original Prompt:
Write a function to sort an array

Optimized Prompt:
You are an expert assistant. Write a function to sort an array

Please think through this step by step.

Provide your response in a clear, structured format.

──────────────────────────────────────────────────
Score: 45 -> 72 (+27)
```

## Commands

### `optimize` - Optimize a Prompt

```bash
prompt-optimizer optimize <prompt> [options]

Options:
  -m, --model <model>       Target model (default: auto)
  -t, --techniques <list>   Techniques to use (comma-separated)
  -o, --output <format>     Output format (text, json, markdown)
  -n, --variants <n>        Number of variants to generate
  --cost-limit <dollars>    Maximum cost budget
  --metrics                 Show detailed metrics
  --dry-run                 Show plan without executing
```

**Examples:**

```bash
# Basic optimization
prompt-optimizer optimize "Explain quantum computing"

# With specific techniques
prompt-optimizer optimize "Write a poem" -t role_prompting,few_shot

# JSON output for scripting
prompt-optimizer optimize "Analyze this data" -o json

# Preview what would happen
prompt-optimizer optimize "Complex task" --dry-run
```

### `route` - Select Best Model

```bash
prompt-optimizer route <prompt> [options]

Options:
  -b, --budget <level>      Budget level (low, medium, high)
  -q, --quality <level>     Quality requirement (fast, balanced, best)
  -p, --providers <list>    Allowed providers (anthropic,openai,google)
  -o, --output <format>     Output format (text, json)
```

**Examples:**

```bash
# Find best model for a task
prompt-optimizer route "Complex code review task" -q best

# Budget-conscious routing
prompt-optimizer route "Simple question" -b low

# Limit to specific providers
prompt-optimizer route "Analysis task" -p anthropic,openai
```

### `evaluate` - Assess Prompt Quality

```bash
prompt-optimizer evaluate <prompt> [options]

Options:
  -c, --compare <prompt2>   Compare two prompts
  -m, --metrics             Show detailed metrics breakdown
  -o, --output <format>     Output format (text, json, markdown)
  -v, --verbose             Show all detected issues
```

**Examples:**

```bash
# Evaluate a prompt
prompt-optimizer evaluate "Your prompt here" -m

# Compare two prompts
prompt-optimizer evaluate "Prompt A" -c "Prompt B"

# Get markdown report
prompt-optimizer evaluate "Your prompt" -o markdown > report.md
```

### `batch` - Process Multiple Prompts

```bash
prompt-optimizer batch <file> [options]

Options:
  -o, --output <file>       Output file (default: stdout)
  -f, --format <format>     Output format (json, jsonl, csv)
  -p, --parallel <n>        Concurrent optimizations (default: 3)
  -t, --techniques <list>   Techniques to use
  --continue-on-error       Continue if a prompt fails
  --dry-run                 Show plan without processing
```

**Input file formats:**

```txt
# prompts.txt - one per line
Write a function to sort an array
Explain machine learning
Create a poem about nature
```

```json
// prompts.json
[
  "Write a function to sort an array",
  "Explain machine learning",
  {"id": "custom-id", "prompt": "Create a poem"}
]
```

**Examples:**

```bash
# Process prompts from file
prompt-optimizer batch prompts.txt -o results.json

# With parallelism
prompt-optimizer batch prompts.json -p 5 --continue-on-error

# Preview batch job
prompt-optimizer batch prompts.txt --dry-run
```

### `config` - Manage Configuration

```bash
# List current configuration
prompt-optimizer config list

# Get a specific value
prompt-optimizer config get defaults.model

# Set a value
prompt-optimizer config set defaults.model claude-sonnet-4-20250514
prompt-optimizer config set anthropic.apiKey sk-ant-...

# Show config file paths
prompt-optimizer config path

# Validate configuration
prompt-optimizer config validate

# List configured providers
prompt-optimizer config providers list
```

## Optimization Techniques

| Technique | Description |
|-----------|-------------|
| `structured_reasoning` | Adds explicit step-by-step reasoning guidance (recommended) |
| `few_shot` | Includes examples to guide the model |
| `role_prompting` | Assigns an expert role to the model |
| `structured_output` | Requests clear, organized responses |
| `step_by_step` | Breaks down complex tasks |
| `decomposition` | Splits problems into components |
| `tree_of_thought` | Explores multiple reasoning paths |
| `meta_prompting` | Self-reflective prompt improvement |

> **Note**: `chain_of_thought` is accepted as an alias for `structured_reasoning` for backward compatibility.

## Evaluation Metrics

Prompts are scored on five dimensions (0-100):

- **Clarity**: How clear and unambiguous is the prompt?
- **Specificity**: Does it include specific details and requirements?
- **Structure**: Is the prompt well-organized?
- **Completeness**: Does it include context, constraints, and output format?
- **Efficiency**: Is the prompt concise without being too brief?

## Configuration

Configuration is stored in `~/.prompt-optimizer/`:

```
~/.prompt-optimizer/
├── config.json    # General settings
└── keys.json      # API keys (restricted permissions)
```

### Default Configuration

```json
{
  "defaults": {
    "model": "claude-sonnet-4-20250514",
    "outputFormat": "text",
    "maxCost": 1.0,
    "techniques": ["chain_of_thought", "structured_output"]
  },
  "logging": {
    "level": "info",
    "console": true
  }
}
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `GOOGLE_API_KEY` | Google AI API key |
| `PROMPT_OPTIMIZER_MODEL` | Default model |
| `PROMPT_OPTIMIZER_LOG_LEVEL` | Log level (debug, info, warn, error) |

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev -- optimize "test prompt"

# Build
npm run build

# Run tests
npm test

# Lint
npm run lint

# Format
npm run format
```

## Architecture

The prompt optimizer uses a multi-agent architecture:

```
┌─────────────────────────────────────────────────────────┐
│                     Orchestrator                         │
│  Coordinates agents and manages optimization pipeline    │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   Analyzer    │   │   Optimizer   │   │   Validator   │
│   Agent       │   │   Agent       │   │   Agent       │
└───────────────┘   └───────────────┘   └───────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
                ┌───────────────────────┐
                │    LLM Providers      │
                │ Anthropic/OpenAI/Google│
                └───────────────────────┘
```

## How It Was Built

This project was created using a **parallel multi-agent development strategy** - a novel approach where 6 specialized AI agents built different components simultaneously.

### Build Strategy

| Agent | Responsibility | Output |
|-------|---------------|--------|
| **Agent A** | Core types and interfaces | TypeScript type definitions |
| **Agent B** | Provider abstraction layer | Anthropic, OpenAI, Google integrations |
| **Agent C** | Orchestrator and agent framework | Multi-agent coordination system |
| **Agent D** | Optimization techniques | 8 prompt optimization techniques |
| **Agent E** | Enterprise examples | 25 domain-specific example prompts |
| **Agent F** | CLI and integration | Commander.js CLI with full UX |

### Why Parallel Agents?

1. **Parallelism**: Different components built simultaneously for faster development
2. **Specialization**: Each agent focused deeply on one domain
3. **Contract-Based Development**: Agents built to interfaces, not implementations
4. **Type Reconciliation Phase**: Final phase unified type definitions across all agents

### Key Design Decisions

- **Provider Abstraction**: All LLM providers implement a common interface (`BaseLLMProvider`), enabling seamless switching between Claude, GPT-4, and Gemini
- **Technique Modularity**: Each optimization technique extends `BaseTechnique`, making it easy to add new techniques
- **Few-Shot Retrieval**: Keyword-based scoring finds relevant examples from the built-in library
- **Graceful Degradation**: Falls back to heuristic optimization if no API key is available

### Build Statistics

- **Total TypeScript Files**: 39
- **Total Lines of Code**: ~21,000
- **TypeScript Compilation**: 0 errors
- **Build Time**: Single session with parallel agents

### Built With

- [Claude Code](https://claude.ai/code) - AI-powered development environment
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
- [Commander.js](https://github.com/tj/commander.js/) - CLI framework
- [Zod](https://github.com/colinhacks/zod) - Runtime type validation

## Project Structure

```
prompt-optimizer/
├── src/
│   ├── cli/                    # Command-line interface
│   │   ├── commands/           # optimize, evaluate, route, batch, config
│   │   └── index.ts            # CLI entry point
│   ├── core/
│   │   ├── agents/             # Multi-agent framework
│   │   │   ├── base-agent.ts   # Abstract base class
│   │   │   ├── optimizer-agent.ts
│   │   │   ├── router-agent.ts
│   │   │   ├── evaluator-agent.ts
│   │   │   └── symbol-encoder.ts
│   │   ├── orchestrator/       # Agent coordination
│   │   │   ├── index.ts        # Main orchestrator
│   │   │   ├── task-queue.ts   # Task management
│   │   │   └── result-aggregator.ts
│   │   └── techniques/         # Optimization techniques
│   │       ├── base-technique.ts
│   │       ├── chain-of-thought.ts
│   │       ├── few-shot-selection.ts
│   │       ├── feedback-iteration.ts
│   │       └── ...
│   ├── providers/              # LLM provider abstraction
│   │   ├── base-provider.ts    # Abstract provider class
│   │   ├── anthropic/          # Claude models
│   │   ├── openai/             # GPT models
│   │   └── google/             # Gemini models
│   ├── knowledge/              # Example library
│   │   └── examples/           # Domain-specific examples
│   ├── types/                  # TypeScript definitions
│   └── utils/                  # Logging, config, metrics
├── tests/
├── package.json
└── tsconfig.json
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Acknowledgments

- Built with [Claude Code](https://claude.ai/code) using parallel agent architecture
- Inspired by prompt engineering research and enterprise use cases
- Uses the Anthropic, OpenAI, and Google Generative AI SDKs
