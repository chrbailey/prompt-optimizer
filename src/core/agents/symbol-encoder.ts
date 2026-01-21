/**
 * Symbol Encoder - Internal Symbol Processing
 *
 * This module handles PromptSpeak symbol encoding and decoding for internal
 * optimization context enrichment. CRITICAL: Symbols are INTERNAL ONLY and
 * must NEVER be exposed in any output, API responses, or user-facing content.
 *
 * The symbol format follows PromptSpeak conventions: Ξ.<TYPE>.<IDENTIFIER>
 * Examples: Ξ.COMPANY.SAP, Ξ.CONCEPT.ERP, Ξ.PATTERN.CHAIN_OF_THOUGHT
 *
 * @module core/agents/symbol-encoder
 * @internal
 */

import type {
  InternalSymbol,
  SymbolType,
  SymbolMetadata,
  OptimizationContext,
  AgentResult,
  PromptVariant,
} from '../../types/index.js';

// =============================================================================
// Constants
// =============================================================================

/** The PromptSpeak symbol prefix */
const SYMBOL_PREFIX = 'Ξ';

/** Regex pattern to match PromptSpeak symbols */
const SYMBOL_PATTERN = /Ξ\.[A-Z]+\.[A-Z0-9_]+/g;

/** Valid symbol types */
const VALID_SYMBOL_TYPES: Set<SymbolType> = new Set([
  'CONCEPT',
  'COMPANY',
  'PATTERN',
  'TECHNIQUE',
  'CONSTRAINT',
  'DOMAIN',
  'METRIC',
  'EXAMPLE',
  'CONTEXT',
]);

// =============================================================================
// Symbol Encoder Configuration
// =============================================================================

/**
 * Configuration for the symbol encoder.
 */
export interface SymbolEncoderConfig {
  /** Whether symbol encoding is enabled */
  enabled: boolean;
  /** Cache resolved symbols for performance */
  cacheSymbols: boolean;
  /** Strict mode: fail on unresolved symbols */
  strictMode: boolean;
  /** Custom symbol registry (optional) */
  registry?: SymbolRegistry;
}

/**
 * Symbol registry interface for custom symbol resolution.
 */
export interface SymbolRegistry {
  /** Resolve a symbol to its value */
  resolve(symbolId: string): Promise<InternalSymbol | null>;
  /** Get related symbols */
  getRelated(symbolId: string): Promise<InternalSymbol[]>;
}

/**
 * Default configuration for symbol encoder.
 */
const DEFAULT_CONFIG: SymbolEncoderConfig = {
  enabled: true,
  cacheSymbols: true,
  strictMode: false,
};

// =============================================================================
// Symbol Encoder Class
// =============================================================================

/**
 * SymbolEncoder handles all internal symbol processing for the optimization system.
 *
 * CRITICAL SECURITY REQUIREMENT:
 * - All symbols must be stripped from output before returning to users
 * - Symbol resolution happens internally and is never exposed
 * - The stripSymbols method MUST be called on all output
 */
export class SymbolEncoder {
  private config: SymbolEncoderConfig;
  private cache: Map<string, InternalSymbol>;
  private builtInSymbols: Map<string, InternalSymbol>;

  constructor(config: Partial<SymbolEncoderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new Map();
    this.builtInSymbols = this.initializeBuiltInSymbols();
  }

  // ===========================================================================
  // Public Methods - Symbol Injection
  // ===========================================================================

  /**
   * Inject symbol context into the optimization context.
   * This enriches the prompt with internal knowledge for better optimization.
   *
   * @param prompt - The original prompt text
   * @param existingContext - Existing optimization context
   * @returns Enhanced context with resolved symbols
   */
  async injectSymbolContext(
    prompt: string,
    existingContext: Partial<OptimizationContext> = {}
  ): Promise<OptimizationContext> {
    if (!this.config.enabled) {
      return this.createBaseContext(prompt, existingContext);
    }

    // Detect symbols in prompt
    const detectedSymbols = this.detectSymbols(prompt);

    // Resolve detected symbols
    const resolvedSymbols = await this.resolveSymbols(detectedSymbols);

    // Extract domain hints from symbols
    const domainHints = this.extractDomainHints(resolvedSymbols);

    // Infer additional symbols from context
    const inferredSymbols = await this.inferSymbols(prompt, resolvedSymbols);

    // Combine all symbols
    const allSymbols = [...resolvedSymbols, ...inferredSymbols];

    return {
      symbols: allSymbols,
      examples: existingContext.examples || [],
      constraints: existingContext.constraints || [],
      domainHints: [...(existingContext.domainHints || []), ...domainHints],
    };
  }

  /**
   * Encode symbols into agent context for processing.
   * Returns a context string that can be used internally by agents.
   *
   * @param symbols - Array of resolved symbols
   * @returns Encoded context string for internal use
   */
  encodeForAgent(symbols: InternalSymbol[]): string {
    if (symbols.length === 0) {
      return '';
    }

    const contextParts: string[] = [];

    // Group symbols by type
    const symbolsByType = this.groupSymbolsByType(symbols);

    for (const [type, typeSymbols] of symbolsByType) {
      const values = typeSymbols
        .map((s) => this.formatSymbolValue(s))
        .filter(Boolean);

      if (values.length > 0) {
        contextParts.push(`[${type}]: ${values.join('; ')}`);
      }
    }

    return contextParts.join('\n');
  }

  // ===========================================================================
  // Public Methods - Symbol Stripping (CRITICAL)
  // ===========================================================================

  /**
   * Strip ALL symbols from output text.
   * CRITICAL: This MUST be called on any text before returning to users.
   *
   * @param text - Text potentially containing symbols
   * @returns Clean text with all symbols removed
   */
  stripSymbols(text: string): string {
    if (!text) return text;

    // Remove all symbol references
    let cleaned = text.replace(SYMBOL_PATTERN, '');

    // Remove any remaining symbol-like patterns
    cleaned = cleaned.replace(/Ξ\.[A-Za-z0-9_.]+/g, '');

    // Clean up double spaces and awkward formatting
    cleaned = cleaned.replace(/\s{2,}/g, ' ');
    cleaned = cleaned.replace(/\s+([.,;:!?])/g, '$1');
    cleaned = cleaned.replace(/^\s+|\s+$/gm, '');

    return cleaned;
  }

  /**
   * Strip symbols from an entire AgentResult.
   * CRITICAL: Always use this before returning results to users.
   *
   * @param result - The agent result to sanitize
   * @returns Sanitized result with all symbols removed
   */
  stripSymbolsFromResult(result: AgentResult): AgentResult {
    return {
      ...result,
      optimizedPrompt: this.stripSymbols(result.optimizedPrompt),
      variants: result.variants.map((v) => this.stripSymbolsFromVariant(v)),
      reasoning: this.stripSymbols(result.reasoning),
    };
  }

  /**
   * Strip symbols from a prompt variant.
   *
   * @param variant - The variant to sanitize
   * @returns Sanitized variant
   */
  stripSymbolsFromVariant(variant: PromptVariant): PromptVariant {
    return {
      ...variant,
      content: this.stripSymbols(variant.content),
    };
  }

  /**
   * Verify that text contains no symbols.
   * Use this as a safety check before output.
   *
   * @param text - Text to verify
   * @returns True if text is clean, false if symbols found
   */
  verifyNoSymbols(text: string): boolean {
    if (!text) return true;

    // Check for main symbol pattern
    if (SYMBOL_PATTERN.test(text)) {
      return false;
    }

    // Check for partial symbol patterns
    if (text.includes(SYMBOL_PREFIX + '.')) {
      return false;
    }

    return true;
  }

  // ===========================================================================
  // Public Methods - Symbol Resolution
  // ===========================================================================

  /**
   * Detect symbols in text.
   *
   * @param text - Text to scan for symbols
   * @returns Array of detected symbol IDs
   */
  detectSymbols(text: string): string[] {
    const matches = text.match(SYMBOL_PATTERN);
    return matches ? [...new Set(matches)] : [];
  }

  /**
   * Resolve a single symbol to its internal representation.
   *
   * @param symbolId - The symbol ID (e.g., "Ξ.COMPANY.SAP")
   * @returns Resolved symbol or null if not found
   */
  async resolveSymbol(symbolId: string): Promise<InternalSymbol | null> {
    // Check cache first
    if (this.config.cacheSymbols && this.cache.has(symbolId)) {
      return this.cache.get(symbolId)!;
    }

    // Check built-in symbols
    if (this.builtInSymbols.has(symbolId)) {
      const symbol = this.builtInSymbols.get(symbolId)!;
      if (this.config.cacheSymbols) {
        this.cache.set(symbolId, symbol);
      }
      return symbol;
    }

    // Try custom registry
    if (this.config.registry) {
      const symbol = await this.config.registry.resolve(symbolId);
      if (symbol && this.config.cacheSymbols) {
        this.cache.set(symbolId, symbol);
      }
      return symbol;
    }

    // Symbol not found
    if (this.config.strictMode) {
      throw new Error(`Symbol not found: ${symbolId}`);
    }

    return null;
  }

  /**
   * Resolve multiple symbols.
   *
   * @param symbolIds - Array of symbol IDs to resolve
   * @returns Array of resolved symbols (nulls filtered out)
   */
  async resolveSymbols(symbolIds: string[]): Promise<InternalSymbol[]> {
    const resolved = await Promise.all(
      symbolIds.map((id) => this.resolveSymbol(id))
    );
    return resolved.filter((s): s is InternalSymbol => s !== null);
  }

  // ===========================================================================
  // Private Methods - Initialization
  // ===========================================================================

  /**
   * Initialize built-in symbols for common optimization patterns.
   */
  private initializeBuiltInSymbols(): Map<string, InternalSymbol> {
    const symbols = new Map<string, InternalSymbol>();
    const now = new Date();

    const baseMetadata: SymbolMetadata = {
      createdAt: now,
      updatedAt: now,
      source: 'built-in',
      confidence: 1.0,
      version: 1,
    };

    // Technique symbols
    const techniques: Array<[string, unknown]> = [
      ['Ξ.TECHNIQUE.CHAIN_OF_THOUGHT', { name: 'Chain of Thought', description: 'Step-by-step reasoning for complex problems' }],
      ['Ξ.TECHNIQUE.FEW_SHOT', { name: 'Few-Shot Learning', description: 'Provide examples to guide response format' }],
      ['Ξ.TECHNIQUE.ROLE_PROMPTING', { name: 'Role Prompting', description: 'Assign expert persona for specialized knowledge' }],
      ['Ξ.TECHNIQUE.STRUCTURED_OUTPUT', { name: 'Structured Output', description: 'Request specific format like JSON or markdown' }],
      ['Ξ.TECHNIQUE.STEP_BY_STEP', { name: 'Step by Step', description: 'Break down into explicit steps' }],
      ['Ξ.TECHNIQUE.TREE_OF_THOUGHT', { name: 'Tree of Thought', description: 'Explore multiple reasoning paths' }],
    ];

    for (const [id, value] of techniques) {
      symbols.set(id, {
        id,
        type: 'TECHNIQUE',
        value,
        visibility: 'internal',
        metadata: { ...baseMetadata, tags: ['technique', 'optimization'] },
      });
    }

    // Domain symbols
    const domains: Array<[string, unknown]> = [
      ['Ξ.DOMAIN.SAP', { name: 'SAP', description: 'Enterprise resource planning and business software' }],
      ['Ξ.DOMAIN.CODE', { name: 'Programming', description: 'Software development and coding' }],
      ['Ξ.DOMAIN.ANALYSIS', { name: 'Analysis', description: 'Data analysis and interpretation' }],
      ['Ξ.DOMAIN.CREATIVE', { name: 'Creative', description: 'Creative writing and content creation' }],
      ['Ξ.DOMAIN.TECHNICAL', { name: 'Technical', description: 'Technical documentation and explanation' }],
    ];

    for (const [id, value] of domains) {
      symbols.set(id, {
        id,
        type: 'DOMAIN',
        value,
        visibility: 'internal',
        metadata: { ...baseMetadata, tags: ['domain'] },
      });
    }

    // Pattern symbols
    const patterns: Array<[string, unknown]> = [
      ['Ξ.PATTERN.EXPERT_PERSONA', { name: 'Expert Persona', description: 'Act as domain expert' }],
      ['Ξ.PATTERN.CONSTRAINTS_FIRST', { name: 'Constraints First', description: 'State constraints before task' }],
      ['Ξ.PATTERN.OUTPUT_FORMAT', { name: 'Output Format', description: 'Specify exact output format' }],
      ['Ξ.PATTERN.EXAMPLES', { name: 'Examples', description: 'Include relevant examples' }],
    ];

    for (const [id, value] of patterns) {
      symbols.set(id, {
        id,
        type: 'PATTERN',
        value,
        visibility: 'internal',
        metadata: { ...baseMetadata, tags: ['pattern'] },
      });
    }

    return symbols;
  }

  // ===========================================================================
  // Private Methods - Context Building
  // ===========================================================================

  /**
   * Create base optimization context without symbols.
   */
  private createBaseContext(
    _prompt: string,
    existingContext: Partial<OptimizationContext>
  ): OptimizationContext {
    return {
      symbols: [],
      examples: existingContext.examples || [],
      constraints: existingContext.constraints || [],
      domainHints: existingContext.domainHints || [],
    };
  }

  /**
   * Extract domain hints from resolved symbols.
   */
  private extractDomainHints(symbols: InternalSymbol[]): string[] {
    const hints: string[] = [];

    for (const symbol of symbols) {
      if (symbol.type === 'DOMAIN' && typeof symbol.value === 'object') {
        const domain = symbol.value as { name?: string; description?: string };
        if (domain.name) {
          hints.push(domain.name);
        }
      }
    }

    return hints;
  }

  /**
   * Infer additional symbols from prompt content and context.
   */
  private async inferSymbols(
    prompt: string,
    existingSymbols: InternalSymbol[]
  ): Promise<InternalSymbol[]> {
    const inferred: InternalSymbol[] = [];
    const promptLower = prompt.toLowerCase();

    // Check for domain indicators
    const domainIndicators: Array<[string, string]> = [
      ['sap', 'Ξ.DOMAIN.SAP'],
      ['abap', 'Ξ.DOMAIN.SAP'],
      ['erp', 'Ξ.DOMAIN.SAP'],
      ['code', 'Ξ.DOMAIN.CODE'],
      ['function', 'Ξ.DOMAIN.CODE'],
      ['analyze', 'Ξ.DOMAIN.ANALYSIS'],
      ['data', 'Ξ.DOMAIN.ANALYSIS'],
      ['write', 'Ξ.DOMAIN.CREATIVE'],
      ['story', 'Ξ.DOMAIN.CREATIVE'],
    ];

    const existingIds = new Set(existingSymbols.map((s) => s.id));

    for (const [indicator, symbolId] of domainIndicators) {
      if (promptLower.includes(indicator) && !existingIds.has(symbolId)) {
        const symbol = await this.resolveSymbol(symbolId);
        if (symbol) {
          inferred.push(symbol);
          existingIds.add(symbolId);
        }
      }
    }

    // Check for technique indicators
    const techniqueIndicators: Array<[string, string]> = [
      ['step by step', 'Ξ.TECHNIQUE.STEP_BY_STEP'],
      ['think through', 'Ξ.TECHNIQUE.CHAIN_OF_THOUGHT'],
      ['example', 'Ξ.TECHNIQUE.FEW_SHOT'],
      ['json', 'Ξ.TECHNIQUE.STRUCTURED_OUTPUT'],
      ['format', 'Ξ.TECHNIQUE.STRUCTURED_OUTPUT'],
    ];

    for (const [indicator, symbolId] of techniqueIndicators) {
      if (promptLower.includes(indicator) && !existingIds.has(symbolId)) {
        const symbol = await this.resolveSymbol(symbolId);
        if (symbol) {
          inferred.push(symbol);
          existingIds.add(symbolId);
        }
      }
    }

    return inferred;
  }

  // ===========================================================================
  // Private Methods - Formatting
  // ===========================================================================

  /**
   * Group symbols by their type.
   */
  private groupSymbolsByType(
    symbols: InternalSymbol[]
  ): Map<SymbolType, InternalSymbol[]> {
    const groups = new Map<SymbolType, InternalSymbol[]>();

    for (const symbol of symbols) {
      const existing = groups.get(symbol.type) || [];
      existing.push(symbol);
      groups.set(symbol.type, existing);
    }

    return groups;
  }

  /**
   * Format a symbol value for internal context.
   */
  private formatSymbolValue(symbol: InternalSymbol): string {
    if (typeof symbol.value === 'string') {
      return symbol.value;
    }

    if (typeof symbol.value === 'object' && symbol.value !== null) {
      const obj = symbol.value as Record<string, unknown>;
      if ('name' in obj) {
        return String(obj.name);
      }
      if ('description' in obj) {
        return String(obj.description);
      }
    }

    return symbol.id.split('.').pop() || '';
  }

  // ===========================================================================
  // Static Methods
  // ===========================================================================

  /**
   * Parse a symbol ID into its components.
   *
   * @param symbolId - The full symbol ID (e.g., "Ξ.COMPANY.SAP")
   * @returns Parsed components or null if invalid
   */
  static parseSymbolId(
    symbolId: string
  ): { prefix: string; type: SymbolType; identifier: string } | null {
    const parts = symbolId.split('.');

    if (parts.length !== 3 || parts[0] !== SYMBOL_PREFIX) {
      return null;
    }

    const type = parts[1] as SymbolType;
    if (!VALID_SYMBOL_TYPES.has(type)) {
      return null;
    }

    return {
      prefix: parts[0],
      type,
      identifier: parts[2],
    };
  }

  /**
   * Create a symbol ID from components.
   *
   * @param type - The symbol type
   * @param identifier - The symbol identifier
   * @returns Full symbol ID
   */
  static createSymbolId(type: SymbolType, identifier: string): string {
    return `${SYMBOL_PREFIX}.${type}.${identifier.toUpperCase()}`;
  }

  /**
   * Check if a string is a valid symbol ID.
   *
   * @param str - String to check
   * @returns True if valid symbol ID
   */
  static isValidSymbolId(str: string): boolean {
    return SymbolEncoder.parseSymbolId(str) !== null;
  }
}

// =============================================================================
// Exports
// =============================================================================

export default SymbolEncoder;
