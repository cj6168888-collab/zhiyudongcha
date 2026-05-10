import React from 'react';
import { cn } from '@/lib/utils';

export function MobileCard({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cn("p-4 rounded-xl bg-card border border-border/50 active:scale-[0.98] transition-transform", className)}
    >
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

export function MobileListItem({ children, leading, trailing, onClick, className }: any) {
  return (
    <div
      onClick={onClick}
      className={cn("flex items-center justify-between p-4 bg-card/50 border-b border-border/30 active:bg-accent/20", className)}
    >
      <div className="flex items-center gap-3">
        {leading && <div className="text-muted-foreground">{leading}</div>}
        <div className="flex-1">{children}</div>
      </div>
      {trailing && <div>{trailing}</div>}
    </div>
  );
}
