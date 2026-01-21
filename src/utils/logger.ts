/**
 * Logging utility with levels, colors, and file output support
 */

import chalk from 'chalk';
import { createWriteStream, WriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

interface LoggerOptions {
  level?: LogLevel;
  console?: boolean;
  file?: string;
  prefix?: string;
  timestamps?: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_COLORS: Record<LogLevel, (text: string) => string> = {
  debug: chalk.gray,
  info: chalk.blue,
  warn: chalk.yellow,
  error: chalk.red,
};

const LEVEL_ICONS: Record<LogLevel, string> = {
  debug: '.',
  info: '*',
  warn: '!',
  error: 'X',
};

export class Logger {
  private level: LogLevel;
  private enableConsole: boolean;
  private fileStream?: WriteStream;
  private prefix: string;
  private timestamps: boolean;
  private buffer: LogEntry[] = [];
  private initialized = false;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? 'info';
    this.enableConsole = options.console ?? true;
    this.prefix = options.prefix ?? 'prompt-optimizer';
    this.timestamps = options.timestamps ?? true;

    if (options.file) {
      void this.initFileStream(options.file);
    }
  }

  private async initFileStream(filePath: string): Promise<void> {
    try {
      await mkdir(dirname(filePath), { recursive: true });
      this.fileStream = createWriteStream(filePath, { flags: 'a' });
      this.initialized = true;

      // Flush buffer
      for (const entry of this.buffer) {
        this.writeToFile(entry);
      }
      this.buffer = [];
    } catch (error) {
      console.error(`Failed to initialize log file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private formatTimestamp(): string {
    const now = new Date();
    return now.toISOString();
  }

  private formatConsoleMessage(level: LogLevel, message: string, context?: Record<string, unknown>): string {
    const colorFn = LEVEL_COLORS[level];
    const icon = LEVEL_ICONS[level];

    let output = '';

    if (this.timestamps) {
      output += chalk.dim(`[${this.formatTimestamp()}] `);
    }

    output += colorFn(`[${icon}] `);
    output += chalk.dim(`[${this.prefix}] `);
    output += message;

    if (context && Object.keys(context).length > 0) {
      output += '\n' + chalk.dim(JSON.stringify(context, null, 2));
    }

    return output;
  }

  private formatFileMessage(entry: LogEntry): string {
    const base = {
      timestamp: entry.timestamp.toISOString(),
      level: entry.level,
      prefix: this.prefix,
      message: entry.message,
    };

    if (entry.context) {
      return JSON.stringify({ ...base, context: entry.context });
    }

    return JSON.stringify(base);
  }

  private writeToFile(entry: LogEntry): void {
    if (this.fileStream) {
      this.fileStream.write(this.formatFileMessage(entry) + '\n');
    } else {
      this.buffer.push(entry);
    }
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
    };

    if (this.enableConsole) {
      const output = this.formatConsoleMessage(level, message, context);
      if (level === 'error') {
        console.error(output);
      } else if (level === 'warn') {
        console.warn(output);
      } else {
        console.log(output);
      }
    }

    this.writeToFile(entry);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log('error', message, context);
  }

  // Utility methods for common patterns
  success(message: string): void {
    if (this.enableConsole) {
      console.log(chalk.green('✓ ') + message);
    }
    this.log('info', `SUCCESS: ${message}`);
  }

  failure(message: string): void {
    if (this.enableConsole) {
      console.log(chalk.red('✗ ') + message);
    }
    this.log('error', `FAILURE: ${message}`);
  }

  progress(message: string): void {
    if (this.enableConsole) {
      console.log(chalk.cyan('→ ') + message);
    }
    this.log('info', `PROGRESS: ${message}`);
  }

  section(title: string): void {
    if (this.enableConsole) {
      console.log('\n' + chalk.bold.underline(title));
    }
    this.log('info', `SECTION: ${title}`);
  }

  table(data: Record<string, unknown>[]): void {
    if (this.enableConsole) {
      console.table(data);
    }
    this.log('debug', 'TABLE', { data });
  }

  // Create a child logger with additional prefix
  child(prefix: string): Logger {
    return new Logger({
      level: this.level,
      console: this.enableConsole,
      prefix: `${this.prefix}:${prefix}`,
      timestamps: this.timestamps,
    });
  }

  // Set log level dynamically
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  // Cleanup
  async close(): Promise<void> {
    if (this.fileStream) {
      return new Promise((resolve) => {
        this.fileStream!.end(() => resolve());
      });
    }
  }
}

// Default logger instance
export const logger = new Logger();

// Convenience exports for direct usage
export const debug = (message: string, context?: Record<string, unknown>) => logger.debug(message, context);
export const info = (message: string, context?: Record<string, unknown>) => logger.info(message, context);
export const warn = (message: string, context?: Record<string, unknown>) => logger.warn(message, context);
export const error = (message: string, context?: Record<string, unknown>) => logger.error(message, context);

// Spinner utilities for CLI
import ora, { Ora } from 'ora';

export function createSpinner(text: string): Ora {
  return ora({
    text,
    color: 'cyan',
    spinner: 'dots',
  });
}

export async function withSpinner<T>(
  text: string,
  fn: () => Promise<T>,
  successText?: string,
  failText?: string
): Promise<T> {
  const spinner = createSpinner(text).start();

  try {
    const result = await fn();
    spinner.succeed(successText ?? text);
    return result;
  } catch (error) {
    spinner.fail(failText ?? `Failed: ${text}`);
    throw error;
  }
}

// Pretty output helpers
export const output = {
  heading: (text: string) => console.log('\n' + chalk.bold.blue(text) + '\n'),
  subheading: (text: string) => console.log(chalk.bold(text)),

  key: (key: string, value: string | number) =>
    console.log(`  ${chalk.dim(key + ':')} ${value}`),

  list: (items: string[]) =>
    items.forEach(item => console.log(`  ${chalk.dim('•')} ${item}`)),

  box: (title: string, content: string) => {
    const width = Math.max(title.length, ...content.split('\n').map(l => l.length)) + 4;
    const border = '─'.repeat(width);
    console.log(chalk.dim(`┌${border}┐`));
    console.log(chalk.dim('│ ') + chalk.bold(title.padEnd(width - 2)) + chalk.dim(' │'));
    console.log(chalk.dim(`├${border}┤`));
    content.split('\n').forEach(line => {
      console.log(chalk.dim('│ ') + line.padEnd(width - 2) + chalk.dim(' │'));
    });
    console.log(chalk.dim(`└${border}┘`));
  },

  json: (data: unknown, pretty = true) => {
    console.log(pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data));
  },

  divider: () => console.log(chalk.dim('─'.repeat(50))),

  newline: () => console.log(),
};
