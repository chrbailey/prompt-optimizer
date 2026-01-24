# Contributing to Prompt Optimizer

Thank you for your interest in contributing! This guide will help you get started.

## Quick Start

```bash
# Fork and clone
git clone https://github.com/YOUR-USERNAME/prompt-optimizer.git
cd prompt-optimizer

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run linter
npm run lint
```

## Development Workflow

1. **Create a branch** for your feature or fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** and ensure:
   - Tests pass (`npm test`)
   - Linter passes (`npm run lint`)
   - TypeScript compiles (`npm run build`)

3. **Commit with a clear message**:
   ```bash
   git commit -m "Add: description of your change"
   ```

4. **Push and create a PR**:
   ```bash
   git push origin feature/your-feature-name
   ```

## Project Structure

```
prompt-optimizer/
├── src/
│   ├── cli/              # Command-line interface
│   ├── core/
│   │   ├── agents/       # Multi-agent framework
│   │   ├── orchestrator/ # Agent coordination
│   │   └── techniques/   # Optimization techniques
│   ├── providers/        # LLM provider abstraction
│   ├── knowledge/        # Example library
│   ├── types/            # TypeScript definitions
│   └── utils/            # Logging, config, metrics
├── action/               # GitHub Action
├── tests/                # Test files
└── docs/                 # Documentation
```

## Priority Areas

We especially welcome contributions in these areas:

### 1. Scoring Heuristics

The scoring system in `src/utils/metrics.ts` uses heuristic analysis. Ideas for improvement:

- Better handling of non-English prompts
- Domain-specific scoring adjustments
- New clarity/specificity indicators

### 2. Optimization Techniques

Add new techniques in `src/core/techniques/`:

```typescript
// Example: new-technique.ts
import { BaseTechnique } from './base-technique.js';

export class NewTechnique extends BaseTechnique {
  name = 'new_technique';
  description = 'What this technique does';

  async execute(prompt: string, context: TechniqueContext): Promise<TechniqueResult> {
    // Your implementation
  }
}
```

### 3. GitHub Action Enhancements

The action code is in `action/src/index.ts`. Ideas:

- Support for more file formats
- Custom scoring config files
- Integration with other CI systems

### 4. Documentation

- Tutorial articles
- Example prompt libraries
- Video walkthroughs

## Code Style

- Use TypeScript strict mode
- Follow existing patterns in the codebase
- Add JSDoc comments for public APIs
- Write tests for new functionality

## Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/unit/metrics.test.ts

# Run tests in watch mode
npm test -- --watch
```

## Commit Message Format

Use a clear prefix:

- `Add:` New feature
- `Fix:` Bug fix
- `Update:` Enhancement to existing feature
- `Docs:` Documentation only
- `Test:` Test additions/changes
- `Refactor:` Code restructuring

Examples:
```
Add: support for YAML prompt files
Fix: scoring crash on empty prompts
Docs: add tutorial for GitHub Action setup
```

## Pull Request Guidelines

1. **Keep PRs focused** - one feature or fix per PR
2. **Update tests** - add/modify tests as needed
3. **Update docs** - if your change affects user-facing behavior
4. **Fill out the PR template** - helps reviewers understand your change

## Questions?

- Open an [issue](https://github.com/chrbailey/prompt-optimizer/issues) for bugs or feature requests
- Start a [discussion](https://github.com/chrbailey/prompt-optimizer/discussions) for questions

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
