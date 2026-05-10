/**
 * 可访问性 Input 组件
 * 
 * 功能:
 * - 标签关联 (htmlFor + id)
 * - 错误状态处理
 * - 帮助文本
 * - ARIA 属性完整支持
 */

import * as React from "react";
import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  success?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helperText,
      error,
      success,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className,
      id: providedId,
      required,
      disabled,
      "aria-label": ariaLabel,
      "aria-describedby": ariaDescribedBy,
      ...props
    },
    ref
  ) => {
    // 生成唯一 ID
    const uniqueId = useId();
    const id = providedId || uniqueId;
    const labelId = `${id}-label`;
    const helpId = `${id}-help`;
    const errorId = `${id}-error`;
    const successId = `${id}-success`;

    // 构建 aria-describedby
    const getAriaDescribedBy = () => {
      const describedBy = [];
      if (helperText) describedBy.push(helpId);
      if (error) describedBy.push(errorId);
      if (success) describedBy.push(successId);
      if (ariaDescribedBy) describedBy.push(ariaDescribedBy);
      return describedBy.length > 0 ? describedBy.join(" ") : undefined;
    };

    return (
      <div className={cn("space-y-1.5", fullWidth && "w-full")}>
        {/* 标签 */}
        {label && (
          <label
            id={labelId}
            htmlFor={id}
            className={cn(
              "block text-sm font-medium",
              error
                ? "text-red-500"
                : success
                ? "text-green-500"
                : "text-[#a1a1aa]"
            )}
          >
            {label}
            {required && (
              <span className="text-red-500 ml-0.5" aria-hidden="true">
                *
              </span>
            )}
            {required && (
              <span className="sr-only">（必填）</span>
            )}
          </label>
        )}

        {/* 输入框容器 */}
        <div className="relative">
          {/* 左侧图标 */}
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717a]">
              {leftIcon}
            </div>
          )}

          {/* 输入框 */}
          <input
            ref={ref}
            id={id}
            className={cn(
              "flex w-full rounded-lg border bg-[#1a1a2e] px-3 py-2 text-sm",
              "text-[#fafafa] placeholder:text-[#71717a]",
              "transition-colors duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1] focus-visible:ring-offset-2",
              "disabled:cursor-not-allowed disabled:opacity-50",
              error && [
                "border-red-500 bg-red-500/10",
                "focus-visible:ring-red-500",
                "pr-10"
              ],
              success && [
                "border-green-500 bg-green-500/10",
                "focus-visible:ring-green-500",
                "pr-10"
              ],
              !error && !success && "border-[#27273a] hover:border-[#3f3f46]",
              leftIcon && "pl-10",
              rightIcon && "pr-10",
              className
            )}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={getAriaDescribedBy()}
            aria-required={required}
            aria-disabled={disabled}
            aria-label={!label ? ariaLabel : undefined}
            aria-labelledby={label ? labelId : undefined}
            disabled={disabled}
            required={required}
            {...props}
          />

          {/* 右侧图标或状态指示器 */}
          {(rightIcon || error || success) && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {error ? (
                <svg
                  className="w-5 h-5 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" strokeWidth="2" />
                  <line x1="12" y1="8" x2="12" y2="12" strokeWidth="2" />
                  <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2" />
                </svg>
              ) : success ? (
                <svg
                  className="w-5 h-5 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" strokeWidth="2" />
                </svg>
              ) : (
                rightIcon
              )}
            </div>
          )}
        </div>

        {/* 帮助文本 */}
        {helperText && !error && (
          <p id={helpId} className="text-xs text-[#71717a]">
            {helperText}
          </p>
        )}

        {/* 错误信息 */}
        {error && (
          <p
            id={errorId}
            className="text-xs text-red-500 flex items-center gap-1"
            role="alert"
          >
            <span aria-hidden="true">✕</span>
            {error}
          </p>
        )}

        {/* 成功信息 */}
        {success && (
          <p id={successId} className="text-xs text-green-500 flex items-center gap-1">
            <span aria-hidden="true">✓</span>
            {success}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
export default Input;
