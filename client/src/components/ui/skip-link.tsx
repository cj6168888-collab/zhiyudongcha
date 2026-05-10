/**
 * 跳过导航链接
 * 
 * 功能: 为键盘用户提供快速跳转到主要内容的链接
 * 快捷键: Tab 键首次聚焦时显示
 * 
 * 使用方法:
 * <SkipLink targetId="main-content" />
 * <main id="main-content">...</main>
 */

import * as React from "react";
import { cn } from "@/lib/utils";

interface SkipLinkProps {
  /** 目标元素 ID */
  targetId?: string;
  /** 自定义文本 */
  text?: string;
  /** 自定义类名 */
  className?: string;
}

export function SkipLink({
  targetId = "main-content",
  text = "跳转到主要内容",
  className,
}: SkipLinkProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    
    const target = document.getElementById(targetId);
    if (target) {
      // 设置 tabindex 使元素可聚焦
      target.tabIndex = -1;
      target.focus();
      target.scrollIntoView({ behavior: "smooth" });
      
      // 可选：移除 tabindex 保持语义正确
      setTimeout(() => {
        target.removeAttribute("tabindex");
      }, 1000);
    }
  };

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      className={cn(
        // 基础样式
        "fixed top-0 left-0 z-[9999]",
        "px-4 py-3 mx-4 mt-4",
        // 背景 - 高对比度
        "bg-[#6366f1] text-white",
        // 文字样式
        "font-medium text-sm",
        // 形状
        "rounded-lg shadow-lg",
        // 焦点管理
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6366f1]/50",
        // 动画
        "transition-transform duration-200",
        // 默认隐藏 (-translate-y-full 移出屏幕)
        "-translate-y-[150%]",
        // 聚焦时显示
        "focus:translate-y-0",
        className
      )}
    >
      {text}
      {/* 键盘提示 */}
      <kbd className="ml-2 px-1.5 py-0.5 text-xs bg-white/20 rounded">
        Enter
      </kbd>
    </a>
  );
}

/**
 * 多个跳过链接 (用于复杂页面)
 */
interface SkipLinksProps {
  links: Array<{
    targetId: string;
    text: string;
  }>;
}

export function SkipLinks({ links }: SkipLinksProps) {
  return (
    <div className="fixed top-0 left-0 z-[9999] flex flex-col gap-2 p-4 -translate-y-[150%] focus-within:translate-y-0 transition-transform duration-200">
      {links.map((link) => (
        <SkipLink
          key={link.targetId}
          targetId={link.targetId}
          text={link.text}
          className="relative mx-0 mt-0 translate-y-0"
        />
      ))}
    </div>
  );
}

export default SkipLink;
