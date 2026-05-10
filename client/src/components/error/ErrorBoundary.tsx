/**
 * Error Boundary Component
 *
 * Catches JavaScript errors anywhere in the child component tree
 * and displays a fallback UI.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createServiceLogger } from '@/lib/logger';

const logger = createServiceLogger('ErrorBoundary');

interface Props {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, resetError: () => void) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  isolate?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    logger.error('捕获到错误', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    logger.error('组件堆栈', { componentStack: errorInfo.componentStack });

    if (typeof window !== 'undefined') {
      (window as any).Sentry?.captureException?.(error, {
        extra: { componentStack: errorInfo.componentStack },
      });
    }

    this.props.onError?.(error, errorInfo);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleReload = (): void => {
    window.location.reload();
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.state.error!, this.handleReset);
      }

      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.handleReset}
          onReload={this.handleReload}
        />
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onReset: () => void;
  onReload: () => void;
}

function ErrorFallback({ error, errorInfo, onReset, onReload }: ErrorFallbackProps): React.ReactElement {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '24px',
        backgroundColor: '#FAFAFA',
      }}
    >
      <Card style={{ maxWidth: '500px', width: '100%' }}>
        <CardHeader>
          <CardTitle style={{ color: '#D32F2F' }}>
            ⚠️ 出现错误
          </CardTitle>
          <CardDescription>
            抱歉，发生了意外错误。请尝试刷新页面或重置状态。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div
              style={{
                padding: '12px',
                backgroundColor: '#FFEBEE',
                borderRadius: '8px',
                fontSize: '13px',
                fontFamily: 'monospace',
                overflow: 'auto',
                maxHeight: '150px',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '8px', color: '#C62828' }}>
                {error.name}: {error.message}
              </div>
              {isDevelopment && error.stack && (
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                  {error.stack}
                </pre>
              )}
            </div>
          )}

          {isDevelopment && errorInfo?.componentStack && (
            <details
              style={{
                padding: '12px',
                backgroundColor: '#E3F2FD',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            >
              <summary style={{ cursor: 'pointer', fontWeight: 500 }}>
                组件堆栈信息
              </summary>
              <pre
                style={{
                  marginTop: '8px',
                  whiteSpace: 'pre-wrap',
                  overflow: 'auto',
                }}
              >
                {errorInfo.componentStack}
              </pre>
            </details>
          )}

          <div
            style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end',
            }}
          >
            <Button variant="outline" onClick={onReset}>
              重试
            </Button>
            <Button variant="default" onClick={onReload}>
              刷新页面
            </Button>
          </div>

          <p
            style={{
              fontSize: '12px',
              color: '#757575',
              textAlign: 'center',
            }}
          >
            如果问题持续存在，请联系技术支持或报告此问题。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default ErrorBoundary;
