# Security

This document describes the security posture of prompt-optimizer, including how API keys are handled, what data is sent to providers, and logging behavior.

## API Key Management

### Storage Locations

API keys can be provided via (in order of precedence):

1. **Environment variables** (recommended for CI/CD)
   - `ANTHROPIC_API_KEY`
   - `OPENAI_API_KEY`
   - `GOOGLE_API_KEY`

2. **Keys file** (`~/.prompt-optimizer/keys.json`)
   - Created with restricted permissions (`0600` - owner read/write only)
   - Never committed to version control (`.gitignore` excludes it)
   - Use `prompt-optimizer config set anthropic.apiKey <key>` to store

### Key Security Practices

- **Keys are never logged** - The logger redacts API keys, showing only first 8 and last 4 characters
- **Keys stay in memory** - Not written to disk except to the protected keys file
- **No key transmission** - Keys are sent only to their respective provider APIs, never to other services

## Data Sent to Providers

When you run an optimization, the following data is sent to the LLM provider:

| Data | Sent? | Notes |
|------|-------|-------|
| Your original prompt | ✅ Yes | Required for optimization |
| Meta-prompt (optimization instructions) | ✅ Yes | Built-in template |
| Few-shot examples (if enabled) | ✅ Yes | From built-in example library |
| Your API key | ✅ Yes | For authentication only |
| Your IP address | ✅ Yes | Standard HTTPS |
| File contents | ❌ No | Tool doesn't read arbitrary files |
| System information | ❌ No | Not collected or sent |

### What Providers Receive

The optimization request looks like:

```
You are an expert prompt engineer. Your task is to transform a naive user prompt...

## Original Prompt
"<YOUR PROMPT HERE>"

## Reference Examples (if few_shot enabled)
<BUILT-IN EXAMPLES - NO USER DATA>

## Your Task
Rewrite the original prompt...
```

**Important**: Few-shot examples are from the built-in library, not your data.

## Logging Behavior

### Default Logging

- **Level**: `info` (errors, warnings, basic operation)
- **Output**: Console only (no file by default)
- **Sensitive data**: Redacted automatically

### What Is Logged

| Item | Logged? | Format |
|------|---------|--------|
| API keys | Partial | `sk-ant-api...wxyz` (first 8 + last 4) |
| Prompts | No | Only character count |
| Responses | No | Only token counts |
| Errors | Yes | Error messages (not payloads) |
| Timing | Yes | Latency in milliseconds |
| Costs | Yes | Dollar amounts |

### Configuring Logging

```bash
# Reduce logging
export PROMPT_OPTIMIZER_LOG_LEVEL=error

# Or via config
prompt-optimizer config set logging.level error
```

## Prompt Persistence

**By default, prompts are NOT persisted.** The tool is stateless:

- No database
- No prompt history
- No caching of results
- No telemetry or analytics

If you use `--output` to write results to a file, that's your choice and your responsibility.

## Network Security

- All provider connections use **HTTPS/TLS**
- No custom certificate handling (uses system trust store)
- No proxy configuration currently (planned)

## Threat Model

### In Scope

| Threat | Mitigation |
|--------|------------|
| API key leakage via git | `.gitignore` excludes keys file |
| API key leakage via logs | Automatic redaction |
| Unauthorized key file access | `0600` permissions on creation |
| Prompt injection via examples | Examples are built-in, not user-provided |

### Out of Scope

| Threat | Reason |
|--------|--------|
| Malicious LLM responses | Provider responsibility |
| Provider data retention | Governed by provider ToS |
| Local malware | OS security responsibility |

## Recommendations

1. **Use environment variables** for API keys in CI/CD
2. **Rotate keys regularly** if used in shared environments
3. **Review provider ToS** for data retention policies:
   - [Anthropic Privacy](https://www.anthropic.com/privacy)
   - [OpenAI API Data Usage](https://openai.com/policies/api-data-usage-policies)
   - [Google AI Terms](https://ai.google.dev/terms)

## Reporting Security Issues

If you discover a security vulnerability, please email security concerns privately rather than opening a public issue.
