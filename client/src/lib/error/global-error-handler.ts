/**
 * Global Error Handler
 *
 * Sets up global error handling for uncaught exceptions
 * and unhandled promise rejections.
 */

import { createServiceLogger } from '../logger';

const logger = createServiceLogger('GlobalErrorHandler');

interface ErrorHandlerConfig {
  showErrorDialog?: boolean;
  reportToSentry?: boolean;
  logToConsole?: boolean;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  fallbackError?: string;
}

interface ErrorInfo {
  componentStack?: string;
  additionalInfo?: Record<string, unknown>;
}

const DEFAULT_CONFIG: ErrorHandlerConfig = {
  showErrorDialog: false,
  reportToSentry: true,
  logToConsole: true,
  fallbackError: '发生了意外错误，请刷新页面重试。',
};

let isHandlerSetup = false;

export function setupGlobalErrorHandler(config: ErrorHandlerConfig = {}): void {
  if (isHandlerSetup) {
    logger.warn('[GlobalErrorHandler] Handler already set up');
    return;
  }

  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  const formatError = (error: unknown): { message: string; stack?: string } => {
    if (error instanceof Error) {
      return {
        message: error.message,
        stack: error.stack,
      };
    }
    if (typeof error === 'string') {
      return { message: error };
    }
    if (error && typeof error === 'object' && 'message' in error) {
      return {
        message: String((error as any).message),
        stack: (error as any).stack,
      };
    }
    return { message: String(error) };
  };

  const handleError = (error: unknown, errorInfo?: ErrorInfo): void => {
    const formatted = formatError(error);

    if (mergedConfig.logToConsole) {
      logger.error(`[GlobalErrorHandler] Error: ${formatted.message}`, {
        stack: formatted.stack,
        ...errorInfo,
      });
    }

    if (mergedConfig.reportToSentry && typeof window !== 'undefined') {
      try {
        (window as any).Sentry?.captureException?.(error, {
          extra: errorInfo,
        });
      } catch (e) {
        logger.warn('[GlobalErrorHandler] Failed to report to Sentry:', e);
      }
    }

    if (mergedConfig.showErrorDialog && typeof window !== 'undefined') {
      showErrorDialog(formatted.message, errorInfo?.componentStack);
    }

    mergedConfig.onError?.(
      new Error(formatted.message),
      errorInfo || {}
    );
  };

  const showErrorDialog = (message: string, componentStack?: string): void => {
    if (typeof window === 'undefined') return;

    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      font-family: system-ui, -apple-system, sans-serif;
    `;

    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white;
      padding: 24px;
      border-radius: 12px;
      max-width: 500px;
      width: 90%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    `;

    const title = document.createElement('h2');
    title.style.cssText = 'margin: 0 0 16px; color: #D32F2F; font-size: 18px;';
    title.textContent = '⚠️ 发生错误';

    const messagePara = document.createElement('p');
    messagePara.style.cssText = 'margin: 0 0 16px; color: #333; font-size: 14px; line-height: 1.5;';
    messagePara.textContent = message;

    if (componentStack) {
      const stackDiv = document.createElement('div');
      stackDiv.style.cssText = 'margin-bottom: 16px; padding: 12px; background: #f5f5f5; border-radius: 6px; overflow: auto; max-height: 200px;';
      stackDiv.style.fontFamily = 'monospace';
      stackDiv.style.fontSize = '12px';
      stackDiv.style.color = '#666';
      stackDiv.textContent = componentStack;
      dialog.appendChild(stackDiv);
    }

    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'display: flex; gap: 12px; justify-content: flex-end;';

    const button = document.createElement('button');
    button.id = 'reload-btn';
    button.style.cssText = `
      padding: 8px 16px;
      background: #1976D2;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
    `;
    button.textContent = '刷新页面';

    button.addEventListener('click', () => {
      container.remove();
      window.location.reload();
    });

    buttonContainer.appendChild(button);
    dialog.appendChild(title);
    dialog.appendChild(messagePara);
    dialog.appendChild(buttonContainer);
    container.appendChild(dialog);
    document.body.appendChild(container);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
      logger.error('[GlobalErrorHandler] Uncaught error:', event.error);

      if (event.error) {
        handleError(event.error);
      } else {
        handleError(new Error(event.message), {
          additionalInfo: { filename: event.filename, lineno: event.lineno },
        });
      }

      event.preventDefault();
    });

    window.addEventListener('unhandledrejection', (event) => {
      logger.error('[GlobalErrorHandler] Unhandled promise rejection:', event.reason);

      handleError(event.reason, {
        additionalInfo: { promise: String(event.promise) },
      });

      event.preventDefault();
    });

    logger.info('[GlobalErrorHandler] Global error handler set up');
    isHandlerSetup = true;
  }
}

export function reportToSentry(error: unknown, context?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;

  try {
    (window as any).Sentry?.captureException?.(error, {
      extra: context,
    });
  } catch (e) {
    logger.warn('[GlobalErrorHandler] Failed to report to Sentry:', e);
  }
}

export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>
): void {
  if (typeof window === 'undefined') return;

  try {
    (window as any).Sentry?.addBreadcrumb?.({
      type: 'default',
      category,
      message,
      data,
      level: 'info',
    });
  } catch (e) {
    logger.warn('[GlobalErrorHandler] Failed to add breadcrumb:', e);
  }
}

export function setUserContext(userId: string, email?: string): void {
  if (typeof window === 'undefined') return;

  try {
    (window as any).Sentry?.setUser?.({
      id: userId,
      email,
    });
  } catch (e) {
    logger.warn('[GlobalErrorHandler] Failed to set user context:', e);
  }
}

export function clearUserContext(): void {
  if (typeof window === 'undefined') return;

  try {
    (window as any).Sentry?.setUser?.(null);
  } catch (e) {
    logger.warn('[GlobalErrorHandler] Failed to clear user context:', e);
  }
}

export function setTag(key: string, value: string): void {
  if (typeof window === 'undefined') return;

  try {
    (window as any).Sentry?.setTag?.(key, value);
  } catch (e) {
    logger.warn('[GlobalErrorHandler] Failed to set tag:', e);
  }
}

export function setContext(
  name: string,
  context: Record<string, unknown>
): void {
  if (typeof window === 'undefined') return;

  try {
    (window as any).Sentry?.setContext?.(name, context);
  } catch (e) {
    logger.warn('[GlobalErrorHandler] Failed to set context:', e);
  }
}

export function isHandlerSetupCheck(): boolean {
  return isHandlerSetup;
}

export default {
  setupGlobalErrorHandler,
  reportToSentry,
  addBreadcrumb,
  setUserContext,
  clearUserContext,
  setTag,
  setContext,
  isHandlerSetupCheck,
};
