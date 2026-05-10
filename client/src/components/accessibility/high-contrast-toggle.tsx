import React from 'react';
import { useHighContrast } from '@/hooks/use-high-contrast';
import { Eye, Monitor } from 'lucide-react';

/**
 * 高对比度切换按钮
 * 
 * 提供手动切换高对比度模式的界面控件
 */

export function HighContrastToggle() {
  const { isHighContrast, isSystemPreference, toggleHighContrast, resetToSystemPreference } = useHighContrast();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <button
        onClick={toggleHighContrast}
        className="high-contrast-toggle touch-manipulation min-h-[44px] min-w-[44px] flex items-center gap-2 px-4 py-2 rounded-lg"
        aria-pressed={isHighContrast}
        aria-label={isHighContrast ? '关闭高对比度模式' : '开启高对比度模式'}
        title={isHighContrast ? '关闭高对比度' : '开启高对比度'}
      >
        {isHighContrast ? (
          <>
            <Eye className="w-5 h-5" />
            <span>标准模式</span>
          </>
        ) : (
          <>
            <Eye className="w-5 h-5" />
            <span>高对比度</span>
          </>
        )}
      </button>
      
      {!isSystemPreference && (
        <button
          onClick={resetToSystemPreference}
          className="high-contrast-toggle touch-manipulation min-h-[44px] min-w-[44px] flex items-center gap-2 px-4 py-2 rounded-lg text-xs"
          aria-label="使用系统设置"
          title="使用系统设置"
        >
          <Monitor className="w-4 h-4" />
          <span>跟随系统</span>
        </button>
      )}
    </div>
  );
}

/**
 * 设置面板中的高对比度选项
 */
export function HighContrastSetting() {
  const { isHighContrast, isSystemPreference, toggleHighContrast, resetToSystemPreference } = useHighContrast();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">高对比度模式</h3>
          <p className="text-sm text-gray-500">
            增强文字和背景对比度，提高可读性
          </p>
        </div>
        
        <button
          onClick={toggleHighContrast}
          className={`
            touch-manipulation min-h-[44px] min-w-[44px]
            relative inline-flex h-6 w-11 items-center rounded-full transition-colors
            ${isHighContrast ? 'bg-indigo-600' : 'bg-gray-200'}
          `}
          aria-pressed={isHighContrast}
          role="switch"
          aria-label={isHighContrast ? '关闭高对比度' : '开启高对比度'}
        >
          <span
            className={`
              inline-block h-4 w-4 transform rounded-full bg-white transition-transform
              ${isHighContrast ? 'translate-x-6' : 'translate-x-1'}
            `}
          />
        </button>
      </div>
      
      {!isSystemPreference && (
        <button
          onClick={resetToSystemPreference}
          className="touch-manipulation min-h-[44px] text-sm text-indigo-600 hover:text-indigo-700 underline px-2 py-1"
        >
          恢复使用系统设置
        </button>
      )}
      
      <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
        <p className="font-medium mb-2">快捷键：</p>
        <p>Ctrl + Shift + H - 切换高对比度模式</p>
      </div>
    </div>
  );
}
