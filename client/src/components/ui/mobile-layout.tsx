import React from 'react';
import { useIsMobile } from '@/hooks/use-device-info';
import { cn } from '@/lib/utils';

// --- 基础布局组件 ---
interface MobileLayoutProps {
  children: React.ReactNode;
  className?: string;
  showHeader?: boolean;
  headerTitle?: string;
  headerAction?: React.ReactNode;
  onBack?: () => void;
  hidePadding?: boolean;
}

export function MobileLayout({
  children,
  className,
  showHeader = false,
  headerTitle,
  headerAction,
  onBack,
  hidePadding = false
}: MobileLayoutProps) {
  const isMobile = useIsMobile();

  if (!isMobile) {
    return <div className={cn("min-h-screen bg-background", className)}>{children}</div>;
  }

  return (
    <div className={cn("flex flex-col h-full bg-background overflow-hidden", className)}>
      {showHeader && (
        <header className="flex-shrink-0 flex items-center justify-between px-4 h-14 border-b border-border/50 bg-background/95 backdrop-blur-lg z-40">
          <div className="flex items-center gap-2">
            {onBack && (
              <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-full active:bg-accent/50">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h1 className="text-base font-bold truncate">{headerTitle}</h1>
          </div>
          {headerAction && <div className="flex items-center">{headerAction}</div>}
        </header>
      )}
      <main className={cn("flex-1 overflow-y-auto overscroll-contain pb-24", !hidePadding && "px-4 pt-4")}>
        {children}
      </main>
    </div>
  );
}

// --- 移动端专用 UI 组件 (由 static-dashboard.tsx 等引用) ---

export function MobileCard({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cn("p-4 rounded-xl bg-card border border-border/50 active:scale-[0.98] transition-transform shadow-sm", className)}
    >
      {children}
    </div>
  );
}

export function MobileGrid({ children, cols = 2, gap = 4, className }: any) {
  const colClass = cols === 3 ? "grid-cols-3" : "grid-cols-2";
  const gapClass = `gap-${gap}`;
  return (
    <div className={cn("grid", colClass, gapClass, className)}>
      {children}
    </div>
  );
}

export function MobileButton({ children, className, variant = 'default', ...props }: any) {
  const variants: any = {
    default: "bg-secondary text-secondary-foreground",
    primary: "bg-primary text-primary-foreground",
    outline: "border border-border bg-transparent"
  };
  return (
    <button
      className={cn("h-12 px-4 rounded-xl font-medium flex items-center justify-center gap-2 active:opacity-80 transition-opacity", variants[variant], className)}
      {...props}
    >
      {children}
    </button>
  );
}
