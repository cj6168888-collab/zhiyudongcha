/**
 * Loading States Components
 *
 * Provides consistent loading UI components with skeleton loaders
 * and progress indicators.
 */

import React from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  animation?: 'pulse' | 'wave' | 'none';
}

export function Skeleton({
  width = '100%',
  height = '1rem',
  borderRadius = 4,
  className,
  animation = 'pulse',
}: SkeletonProps): React.ReactElement {
  const style: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    borderRadius: typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius,
    backgroundColor: '#E0E0E0',
  };

  if (animation === 'pulse') {
    style.animation = 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite';
  } else if (animation === 'wave') {
    style.position = 'relative';
    style.overflow = 'hidden';

    const waveStyle = document.createElement('style');
    waveStyle.textContent = `
      @keyframes wave {
        0%, 100% { transform: translateX(-100%); }
        50% { transform: translateX(100%); }
      }
    `;

    if (typeof document !== 'undefined') {
      const existing = document.getElementById('skeleton-wave-style');
      if (!existing) {
        waveStyle.id = 'skeleton-wave-style';
        document.head.appendChild(waveStyle);
      }
    }

    style.background = 'linear-gradient(90deg, #E0E0E0 25%, #F5F5F5 50%, #E0E0E0 75%)';
    style.backgroundSize = '200% 100%';
    style.animation = 'wave 1.5s ease-in-out infinite';
  }

  return <div className={className} style={style} />;
}

interface SkeletonCardProps {
  avatar?: boolean;
  title?: boolean;
  lines?: number;
}

export function SkeletonCard({ avatar = true, title = true, lines = 3 }: SkeletonCardProps): React.ReactElement {
  return (
    <div
      style={{
        padding: '16px',
        borderRadius: '8px',
        backgroundColor: '#FFFFFF',
        border: '1px solid #E0E0E0',
      }}
    >
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        {avatar && (
          <Skeleton width={48} height={48} borderRadius={24} />
        )}
        <div style={{ flex: 1 }}>
          {title && (
            <div style={{ marginBottom: '8px' }}>
              <Skeleton width="60%" height={16} />
            </div>
          )}
          {Array.from({ length: lines }).map((_, i) => (
            <Skeleton
              key={i}
              width={i === lines - 1 ? '80%' : '100%'}
              height={12}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  label?: string;
}

export function LoadingSpinner({
  size = 'md',
  color = '#1976D2',
  label = '加载中...',
}: LoadingSpinnerProps): React.ReactElement {
  const sizeMap = { sm: 16, md: 24, lg: 40 };
  const spinnerSize = sizeMap[size];

  const style: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const spinnerStyle: React.CSSProperties = {
    width: spinnerSize,
    height: spinnerSize,
    border: '2px solid #E0E0E0',
    borderTopColor: color,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  };

  return (
    <div style={style} role="status" aria-live="polite">
      <div style={spinnerStyle} aria-hidden="true" />
      {label && (
        <span style={{ marginLeft: '8px', fontSize: size === 'sm' ? '12px' : '14px', color: '#757575' }}>
          {label}
        </span>
      )}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

interface ProgressBarProps {
  value: number;
  max?: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

export function ProgressBar({
  value,
  max = 100,
  showLabel = false,
  size = 'md',
  color = '#1976D2',
}: ProgressBarProps): React.ReactElement {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const heightMap = { sm: 4, md: 8, lg: 16 };

  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          height: heightMap[size],
          backgroundColor: '#E0E0E0',
          borderRadius: '4px',
          overflow: 'hidden',
        }}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={showLabel ? `${percentage.toFixed(0)}%` : undefined}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: '100%',
            backgroundColor: color,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      {showLabel && (
        <div
          style={{
            marginTop: '4px',
            fontSize: '12px',
            color: '#757575',
            textAlign: 'right',
          }}
        >
          {percentage.toFixed(0)}%
        </div>
      )}
    </div>
  );
}

interface LoadingOverlayProps {
  isLoading: boolean;
  children: React.ReactNode;
  spinner?: React.ReactNode;
  text?: string;
}

export function LoadingOverlay({
  isLoading,
  children,
  spinner,
  text = '加载中...',
}: LoadingOverlayProps): React.ReactElement {
  if (!isLoading) {
    return <>{children}</>;
  }

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
        }}
        aria-hidden="true"
      >
        {spinner || <LoadingSpinner size="lg" label={text} />}
      </div>
      <div style={{ opacity: 0.3 }}>{children}</div>
    </div>
  );
}

interface SkeletonListProps {
  count?: number;
  itemHeight?: number;
  gap?: number;
}

export function SkeletonList({ count = 5, itemHeight = 60, gap = 12 }: SkeletonListProps): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: `${gap}px` }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} avatar={true} title={true} lines={2} />
      ))}
    </div>
  );
}

interface InlineLoadingProps {
  text?: string;
  size?: 'sm' | 'md';
}

export function InlineLoading({ text, size = 'md' }: InlineLoadingProps): React.ReactElement {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: size === 'sm' ? '12px' : '14px',
        color: '#757575',
      }}
    >
      <LoadingSpinner size={size} label={undefined} />
      {text && <span>{text}</span>}
    </span>
  );
}

export default {
  Skeleton,
  SkeletonCard,
  LoadingSpinner,
  ProgressBar,
  LoadingOverlay,
  SkeletonList,
  InlineLoading,
};
