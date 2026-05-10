import pino from 'pino';

const isDevelopment = process.env['NODE_ENV'] === 'development';

const baseLogger = pino({
  level: process.env['LOG_LEVEL'] || (isDevelopment ? 'debug' : 'info'),
  base: {
    service: 'xiaozhi-avatar',
    version: '1.0.0',
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
});

export const logger = {
  ...baseLogger,
  info: (obj: string | Record<string, unknown>, dataOrMsg?: Record<string, unknown> | string): void => {
    if (typeof obj === 'string') {
      if (dataOrMsg && typeof dataOrMsg === 'object') {
        baseLogger.info(dataOrMsg as Record<string, unknown>, obj);
      } else {
        baseLogger.info(obj);
      }
    } else if (typeof dataOrMsg === 'string') {
      baseLogger.info(obj, dataOrMsg);
    } else {
      baseLogger.info(obj);
    }
  },
  warn: (obj: string | Record<string, unknown>, dataOrMsg?: Record<string, unknown> | string): void => {
    if (typeof obj === 'string') {
      if (dataOrMsg && typeof dataOrMsg === 'object') {
        baseLogger.warn(dataOrMsg as Record<string, unknown>, obj);
      } else {
        baseLogger.warn(obj);
      }
    } else if (typeof dataOrMsg === 'string') {
      baseLogger.warn(obj, dataOrMsg);
    } else {
      baseLogger.warn(obj);
    }
  },
  error: (obj: string | Record<string, unknown>, dataOrMsg?: Record<string, unknown> | string): void => {
    if (typeof obj === 'string') {
      if (dataOrMsg && typeof dataOrMsg === 'object') {
        baseLogger.error(dataOrMsg as Record<string, unknown>, obj);
      } else {
        baseLogger.error(obj);
      }
    } else if (typeof dataOrMsg === 'string') {
      baseLogger.error(obj, dataOrMsg);
    } else {
      baseLogger.error(obj);
    }
  },
  debug: (obj: string | Record<string, unknown>, dataOrMsg?: Record<string, unknown> | string): void => {
    if (typeof obj === 'string') {
      if (dataOrMsg && typeof dataOrMsg === 'object') {
        baseLogger.debug(dataOrMsg as Record<string, unknown>, obj);
      } else {
        baseLogger.debug(obj);
      }
    } else if (typeof dataOrMsg === 'string') {
      baseLogger.debug(obj, dataOrMsg);
    } else {
      baseLogger.debug(obj);
    }
  },
  child: (bindings: Record<string, unknown>) => {
    const childLogger = baseLogger.child(bindings);
    return {
      ...childLogger,
      info: logger.info,
      warn: logger.warn,
      error: logger.error,
      debug: logger.debug,
      child: logger.child,
    };
  },
};

export function createServiceLogger(serviceName: string) {
  return logger.child({ module: serviceName });
}

export type ServiceLogger = ReturnType<typeof createServiceLogger>;
