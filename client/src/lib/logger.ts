type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogMessage {
  level: LogLevel;
  message: string;
  timestamp: number;
  service?: string;
  data?: unknown;
}

const LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];

const isProduction = process.env.NODE_ENV === 'production';

class Logger {
  private currentLevel: LogLevel = isProduction ? 'warn' : 'info';
  private serviceName: string = 'App';

  constructor(serviceName?: string) {
    if (serviceName) {
      this.serviceName = serviceName;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const currentIndex = LOG_LEVELS.indexOf(this.currentLevel);
    const levelIndex = LOG_LEVELS.indexOf(level);
    return levelIndex >= currentIndex;
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    service?: string,
    data?: unknown
  ): LogMessage {
    return {
      level,
      message,
      timestamp: Date.now(),
      service: service || this.serviceName,
      data,
    };
  }

  private output(logMessage: LogMessage): void {
    const { level, message, service, data } = logMessage;
    const timestamp = new Date(logMessage.timestamp).toISOString();

    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${service}]`;
    const logLine = data
      ? `${prefix} ${message} ${JSON.stringify(data)}`
      : `${prefix} ${message}`;

    switch (level) {
      case 'debug':
        console.debug(logLine);
        break;
      case 'info':
        console.info(logLine);
        break;
      case 'warn':
        console.warn(logLine);
        break;
      case 'error':
        console.error(logLine);
        break;
    }
  }

  setLevel(level: LogLevel): void {
    if (LOG_LEVELS.includes(level)) {
      this.currentLevel = level;
    }
  }

  debug(message: string, data?: unknown): void {
    if (this.shouldLog('debug')) {
      const logMessage = this.formatMessage('debug', message, undefined, data);
      this.output(logMessage);
    }
  }

  info(message: string, data?: unknown): void {
    if (this.shouldLog('info')) {
      const logMessage = this.formatMessage('info', message, undefined, data);
      this.output(logMessage);
    }
  }

  warn(message: string, data?: unknown): void {
    if (this.shouldLog('warn')) {
      const logMessage = this.formatMessage('warn', message, undefined, data);
      this.output(logMessage);
    }
  }

  error(message: string, data?: unknown): void {
    if (this.shouldLog('error')) {
      const logMessage = this.formatMessage('error', message, undefined, data);
      this.output(logMessage);
    }
  }

  createSubLogger(serviceName: string): Logger {
    return new Logger(`${this.serviceName}.${serviceName}`);
  }
}

const rootLogger = new Logger('Root');

export function createServiceLogger(serviceName: string): Logger {
  return rootLogger.createSubLogger(serviceName);
}

export { Logger, rootLogger };
export type { LogLevel, LogMessage };

export default Logger;
