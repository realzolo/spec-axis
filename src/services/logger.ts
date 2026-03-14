/**
 * 结构化日志服务
 * 支持不同日志级别和上下文信息
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  requestId?: string;
  userId?: string;
  projectId?: string;
  reportId?: string;
  [key: string]: string | number | boolean | undefined;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  duration?: number;
}

class Logger {
  private context: LogContext = {};

  setContext(ctx: LogContext) {
    this.context = { ...this.context, ...ctx };
  }

  clearContext() {
    this.context = {};
  }

  private formatEntry(level: LogLevel, message: string, error?: Error, duration?: number): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.context,
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      }),
      ...(duration !== undefined && { duration }),
    };
  }

  private log(entry: LogEntry) {
    // 在生产环境中可以发送到日志服务（如 Sentry, DataDog 等）
    const output = JSON.stringify(entry);

    if (entry.level === 'error') {
      console.error(output);
    } else if (entry.level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  debug(message: string, duration?: number) {
    this.log(this.formatEntry('debug', message, undefined, duration));
  }

  info(message: string, duration?: number) {
    this.log(this.formatEntry('info', message, undefined, duration));
  }

  warn(message: string, error?: Error) {
    this.log(this.formatEntry('warn', message, error));
  }

  error(message: string, error?: Error) {
    this.log(this.formatEntry('error', message, error));
  }

  async measure<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const elapsed = Date.now() - start;
      this.info(`${label} completed`, elapsed);
      return result;
    } catch (err) {
      const elapsed = Date.now() - start;
      this.error(`${label} failed`, err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }
}

export const logger = new Logger();
