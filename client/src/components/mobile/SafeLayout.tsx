import React, { useState } from 'react';
import { cn } from "@/lib/utils";
import { ArrowLeft, Sparkles, Brain, CloudLightning } from "lucide-react";
import { useLocation } from "wouter";

interface SafeLayoutProps {
  children: React.ReactNode;
  headerTitle?: string;
  headerRight?: React.ReactNode;
  noPadding?: boolean;
  showBack?: boolean;
}

export function SafeLayout({ children, headerTitle, headerRight, noPadding = false, showBack = true }: SafeLayoutProps) {
  const [location] = useLocation();
  const isHome = location === "/";
  const shouldShowBack = showBack && !isHome;
  const [imgError, setImgError] = useState(false);

  // 1. 核心激活：大脑计算模式感知逻辑
  // 实际开发中应从后端 /api/model/status 或 context 获取
  const brainMode: 'LOCAL' | 'CLOUD' = 'LOCAL';
  const isCloudMode = brainMode === 'CLOUD' as typeof brainMode;
  const isLocalMode = brainMode === 'LOCAL' as typeof brainMode;

  return (
    <div className="flex flex-col h-full bg-[#030712] overflow-hidden text-white relative">
      <div className="flex-shrink-0 h-[env(safe-area-inset-top,24px)] w-full bg-[#030712]" />

      <header className="flex-shrink-0 flex items-center px-4 h-14 border-b border-white/5 bg-black/50 backdrop-blur-md gap-3 z-50">
        {shouldShowBack ? (
          <button onClick={() => window.history.back()} className="p-2 -ml-2 rounded-lg text-gray-400 active:text-primary active:bg-white/10"><ArrowLeft className="w-5 h-5" /></button>
        ) : (
          <div className="w-9 h-9 rounded-lg overflow-hidden border border-primary/30 shadow-[0_0_15px_rgba(99,102,241,0.25)] bg-gray-900 flex items-center justify-center">
            {!imgError ? (
              <img src="/xiaoji-avatar.png" alt="小吉" className="w-full h-full object-cover" onError={() => setImgError(true)} />
            ) : (
              <Sparkles className="w-5 h-5 text-primary animate-pulse" />
            )}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold tracking-tight text-white/90 truncate">{headerTitle || "吉麟洞察"}</h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            {/* 大脑状态指示灯：解决硬伤 4 */}
            <div className={cn(
              "inline-flex max-w-full items-center gap-1 px-1.5 py-0.5 rounded-md border text-[8px] font-black uppercase transition-all",
              isCloudMode ? "border-primary/30 text-primary" : "border-purple-500/30 text-purple-400"
            )}>
              {isCloudMode ? <CloudLightning className="w-2 h-2" /> : <Brain className="w-2 h-2" />}
              <span className="truncate">{brainMode} CORE ACTIVE</span>
            </div>
          </div>
        </div>

        {/* 右侧自定义内容 */}
        {headerRight && <div className="flex-shrink-0">{headerRight}</div>}
      </header>

      <main className={cn("flex-1 overflow-y-auto overscroll-contain z-10", !noPadding && "px-4 pt-3", "pb-28")}>
        {children}
      </main>
    </div>
  );
}
