import { useState, useEffect, useCallback } from 'react';

/**
 * 高对比度模式 Hook
 * 
 * 功能：
 * 1. 检测系统高对比度设置
 * 2. 手动切换高对比度模式
 * 3. 持久化用户偏好
 * 
 * @example
 * const { isHighContrast, toggleHighContrast, enableHighContrast, disableHighContrast } = useHighContrast();
 */

const STORAGE_KEY = 'xiaozhi-high-contrast';

export function useHighContrast() {
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [isSystemPreference, setIsSystemPreference] = useState(true);

  // 检测系统高对比度设置
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-contrast: high)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      if (isSystemPreference) {
        setIsHighContrast(e.matches);
        updateDocumentClass(e.matches);
      }
    };

    // 初始检测
    if (isSystemPreference) {
      setIsHighContrast(mediaQuery.matches);
      updateDocumentClass(mediaQuery.matches);
    }

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [isSystemPreference]);

  // 加载用户偏好
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      const parsed = JSON.parse(stored);
      setIsHighContrast(parsed.enabled);
      setIsSystemPreference(false);
      updateDocumentClass(parsed.enabled);
    }
  }, []);

  // 更新文档类名
  const updateDocumentClass = (enabled: boolean) => {
    if (enabled) {
      document.documentElement.classList.add('high-contrast');
      document.documentElement.setAttribute('data-high-contrast', 'true');
    } else {
      document.documentElement.classList.remove('high-contrast');
      document.documentElement.removeAttribute('data-high-contrast');
    }
  };

  // 保存偏好
  const savePreference = useCallback((enabled: boolean, system: boolean) => {
    if (system) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled }));
    }
  }, []);

  // 切换高对比度
  const toggleHighContrast = useCallback(() => {
    const newValue = !isHighContrast;
    setIsHighContrast(newValue);
    setIsSystemPreference(false);
    updateDocumentClass(newValue);
    savePreference(newValue, false);
  }, [isHighContrast, savePreference]);

  // 启用高对比度
  const enableHighContrast = useCallback(() => {
    setIsHighContrast(true);
    setIsSystemPreference(false);
    updateDocumentClass(true);
    savePreference(true, false);
  }, [savePreference]);

  // 禁用高对比度
  const disableHighContrast = useCallback(() => {
    setIsHighContrast(false);
    setIsSystemPreference(false);
    updateDocumentClass(false);
    savePreference(false, false);
  }, [savePreference]);

  // 重置为系统偏好
  const resetToSystemPreference = useCallback(() => {
    setIsSystemPreference(true);
    savePreference(false, true);
    
    const mediaQuery = window.matchMedia('(prefers-contrast: high)');
    setIsHighContrast(mediaQuery.matches);
    updateDocumentClass(mediaQuery.matches);
  }, [savePreference]);

  return {
    isHighContrast,
    isSystemPreference,
    toggleHighContrast,
    enableHighContrast,
    disableHighContrast,
    resetToSystemPreference,
  };
}

/**
 * 检测是否支持高对比度模式
 */
export function supportsHighContrast(): boolean {
  return window.matchMedia('(prefers-contrast: high)').matches !== undefined;
}

/**
 * 获取当前高对比度状态（同步）
 */
export function getHighContrastState(): boolean {
  if (typeof window === 'undefined') return false;
  
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    return JSON.parse(stored).enabled;
  }
  
  return window.matchMedia('(prefers-contrast: high)').matches;
}
