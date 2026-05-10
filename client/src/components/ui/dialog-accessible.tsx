/**
 * 可访问性 Dialog 组件
 * 
 * 功能:
 * - 焦点陷阱
 * - ARIA 属性完整支持
 * - 键盘导航 (Esc 关闭)
 * - 背景滚动锁定
 */

import { Button } from "@/components/ui/button";
import * as React from "react";
import { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useFocusTrap } from "@/lib/accessibility";

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEsc?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement>;
  returnFocusRef?: React.RefObject<HTMLElement>;
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  full: "max-w-full mx-4",
};

export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
  size = "md",
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEsc = true,
  initialFocusRef,
  returnFocusRef,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const focusTrapRef = useFocusTrap(isOpen);

  // 保存之前的焦点
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      
      // 锁定背景滚动
      document.body.style.overflow = "hidden";
      
      // 设置初始焦点
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      }
    } else {
      // 恢复背景滚动
      document.body.style.overflow = "";
      
      // 恢复焦点
      if (returnFocusRef?.current) {
        returnFocusRef.current.focus();
      } else if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, initialFocusRef, returnFocusRef]);

  // ESC 键关闭
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (closeOnEsc && e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [closeOnEsc, onClose]
  );

  // 点击遮罩关闭
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (closeOnOverlayClick && e.target === e.currentTarget) {
        onClose();
      }
    },
    [closeOnOverlayClick, onClose]
  );

  // 生成唯一 ID
  const titleId = React.useId();
  const descId = React.useId();

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={handleOverlayClick}
      role="presentation"
    >
      {/* 遮罩层 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
      />

      {/* Dialog 内容 */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={cn(
          "relative z-10 w-full bg-[#13131f] border border-[#27273a] rounded-xl shadow-2xl",
          "max-h-[90vh] overflow-y-auto",
          sizeClasses[size],
          className
        )}
        onKeyDown={handleKeyDown}
      >
        {/* 标题区域 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#27273a]">
          <div>
            <h2
              id={titleId}
              className="text-lg font-semibold text-[#fafafa]"
            >
              {title}
            </h2>
            {description && (
              <p
                id={descId}
                className="mt-1 text-sm text-[#a1a1aa]"
              >
                {description}
              </p>
            )}
          </div>

          {showCloseButton && (
            <Button variant="outline" onClick={onClose} aria-label="关闭对话框"><svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg></Button>
          )}
        </div>

        {/* 内容区域 */}
        <div className="p-6">{children}</div>
      </div>
    </div>,
    document.body
  );
}

// 简化版 Dialog 触发器
interface DialogTriggerProps {
  children: React.ReactNode;
  onClick?: () => void;
  asChild?: boolean;
}

export function DialogTrigger({ children, onClick, asChild }: DialogTriggerProps) {
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick,
      "aria-haspopup": "dialog",
    } as React.HTMLAttributes<HTMLElement>);
  }

  return (
    <Button variant="outline" onClick={onClick}>{children}</Button>
  );
}

export default Dialog;
