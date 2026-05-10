/**
 * 可访问性工具函数库
 * 
 * 提供焦点管理、键盘导航、ARIA 属性等工具
 */

import { useEffect, useRef, useCallback } from 'react';

/**
 * 焦点陷阱 Hook
 * 用于 Modal/Dialog 等组件，确保焦点在容器内循环
 */
export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive) return;

    // 保存之前的焦点
    previousFocusRef.current = document.activeElement as HTMLElement;

    const container = containerRef.current;
    if (!container) return;

    // 获取所有可聚焦元素
    const getFocusableElements = () => {
      return Array.from(
        container.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));
    };

    // 聚焦第一个元素
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const elements = getFocusableElements();
      if (elements.length === 0) return;

      const firstElement = elements[0];
      const lastElement = elements[elements.length - 1];

      // Shift+Tab: 如果焦点在第一个元素，跳到最后一个
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: 如果焦点在最后一个元素，跳到第一个
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      // 恢复之前的焦点
      previousFocusRef.current?.focus();
    };
  }, [isActive]);

  return containerRef;
}

/**
 * 键盘快捷键 Hook
 */
interface KeyboardShortcuts {
  [key: string]: (event: KeyboardEvent) => void;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcuts) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 忽略输入框内的快捷键
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const keyCombo = [
        event.metaKey || event.ctrlKey ? 'Cmd' : '',
        event.altKey ? 'Alt' : '',
        event.shiftKey ? 'Shift' : '',
        event.key,
      ]
        .filter(Boolean)
        .join('+');

      if (shortcuts[keyCombo]) {
        event.preventDefault();
        shortcuts[keyCombo](event);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}

/**
 * 生成唯一 ID
 * 用于 ARIA 属性关联
 */
let idCounter = 0;
export function useUniqueId(prefix: string = 'id'): string {
  const idRef = useRef<string>('');
  if (!idRef.current) {
    idRef.current = `${prefix}-${++idCounter}-${Math.random().toString(36).substr(2, 9)}`;
  }
  return idRef.current;
}

/**
 * 跳转到主要内容区域
 * 用于 "跳转到内容" 链接
 */
export function skipToContent(contentId: string = 'main-content') {
  const element = document.getElementById(contentId);
  if (element) {
    element.tabIndex = -1;
    element.focus();
    element.scrollIntoView({ behavior: 'smooth' });
  }
}

/**
 * 获取元素的 ARIA 标签文本
 */
export function getAccessibleName(element: HTMLElement): string {
  // 优先顺序: aria-labelledby > aria-label > 文本内容
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labelElement = document.getElementById(labelledBy);
    if (labelElement) {
      return labelElement.textContent || '';
    }
  }

  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) {
    return ariaLabel;
  }

  // 表单元素: label 关联
  if (element.id) {
    const label = document.querySelector(`label[for="${element.id}"]`);
    if (label) {
      return label.textContent || '';
    }
  }

  // 默认返回文本内容
  return element.textContent || '';
}

/**
 * 检查颜色对比度
 * 返回对比度比率 (1-21)
 */
export function getContrastRatio(foreground: string, background: string): number {
  const getLuminance = (color: string): number => {
    const rgb = color.match(/\d+/g)?.map(Number) || [0, 0, 0];
    const [r, g, b] = rgb.map((val) => {
      const sRGB = val / 255;
      return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const lum1 = getLuminance(foreground);
  const lum2 = getLuminance(background);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);

  return (brightest + 0.05) / (darkest + 0.05);
}

/**
 * 屏幕阅读器通知
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite') {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * 焦点可见性管理
 * 区分鼠标和键盘的焦点样式
 */
export function useFocusVisible() {
  const [isFocusVisible, setIsFocusVisible] = useState(false);

  useEffect(() => {
    const handleKeyDown = () => setIsFocusVisible(true);
    const handlePointerDown = () => setIsFocusVisible(false);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('touchstart', handlePointerDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('touchstart', handlePointerDown);
    };
  }, []);

  return isFocusVisible;
}

import { useState } from 'react';
