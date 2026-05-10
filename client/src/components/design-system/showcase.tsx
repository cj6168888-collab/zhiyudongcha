import React from 'react';
import { useHighContrast } from '@/hooks/use-high-contrast';
import { useFadeIn } from '@/hooks/use-animation';

/**
 * 设计系统 v2.0 展示页面
 *
 * 用于展示和测试新的设计系统
 */

export function DesignSystemShowcase() {
  const { isHighContrast } = useHighContrast();
  const { ref: sectionRef, isVisible } = useFadeIn();

  return (
    <div className="min-h-screen p-8 space-y-12">
      {/* 标题 */}
      <header className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-[var(--color-text-primary)]">
          小星AI 设计系统 v2.0
        </h1>
        <p className="text-lg text-[var(--color-text-secondary)]">
          WCAG 2.2 AA 合规 · 高对比度模式 · 动画系统
        </p>
        {isHighContrast && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-black text-white border-2 border-white">
            高对比度模式已启用
          </span>
        )}
      </header>

      {/* 颜色展示 */}
      <section
        ref={sectionRef}
        className={`space-y-6 ${isVisible ? 'motion-slide-up' : 'opacity-0'}`}
      >
        <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">颜色系统</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* 主色调 */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">主色调</h3>
            <div className="space-y-1">
              {['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'].map((shade) => (
                <div
                  key={shade}
                  className="h-8 rounded flex items-center px-3 text-xs font-medium"
                  style={{
                    backgroundColor: `var(--color-primary-${shade})`,
                    color: parseInt(shade) >= 500 ? 'white' : 'black'
                  }}
                >
                  {shade}
                </div>
              ))}
            </div>
          </div>

          {/* 语义色 */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">语义色</h3>
            <div className="space-y-2">
              {[
                { name: 'Success', var: '--color-success-500', text: 'white' },
                { name: 'Warning', var: '--color-warning-500', text: 'black' },
                { name: 'Error', var: '--color-error-500', text: 'white' },
                { name: 'Info', var: '--color-info-500', text: 'white' },
              ].map((color) => (
                <div
                  key={color.name}
                  className="h-16 rounded-lg flex items-center justify-center text-sm font-semibold"
                  style={{
                    backgroundColor: `var(${color.var})`,
                    color: color.text
                  }}
                >
                  {color.name}
                </div>
              ))}
            </div>
          </div>

          {/* 文字色 */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">文字色</h3>
            <div className="space-y-2 p-4 rounded-lg bg-[var(--color-bg-secondary)]">
              {[
                { name: 'Primary', var: '--color-text-primary' },
                { name: 'Secondary', var: '--color-text-secondary' },
                { name: 'Tertiary', var: '--color-text-tertiary' },
              ].map((text) => (
                <p
                  key={text.name}
                  className="text-base"
                  style={{ color: `var(${text.var})` }}
                >
                  {text.name} Text
                </p>
              ))}
            </div>
          </div>

          {/* 边框色 */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">边框色</h3>
            <div className="space-y-2">
              {[
                { name: 'Light', var: '--color-border-light' },
                { name: 'Medium', var: '--color-border-medium' },
                { name: 'Strong', var: '--color-border-strong' },
              ].map((border) => (
                <div
                  key={border.name}
                  className="h-12 rounded border-2 flex items-center justify-center text-sm"
                  style={{ borderColor: `var(${border.var})` }}
                >
                  {border.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 字体展示 */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">字体系统</h2>

        <div className="space-y-4">
          {[
            { size: 'text-5xl', label: '5XL (48px)', text: 'Heading 1' },
            { size: 'text-4xl', label: '4XL (36px)', text: 'Heading 2' },
            { size: 'text-3xl', label: '3XL (30px)', text: 'Heading 3' },
            { size: 'text-2xl', label: '2XL (24px)', text: 'Heading 4' },
            { size: 'text-xl', label: 'XL (20px)', text: 'Heading 5' },
            { size: 'text-lg', label: 'LG (18px)', text: 'Large Text' },
            { size: 'text-base', label: 'Base (16px)', text: 'Body Text' },
            { size: 'text-sm', label: 'SM (14px)', text: 'Small Text' },
            { size: 'text-xs', label: 'XS (12px)', text: 'Extra Small' },
          ].map((item) => (
            <div key={item.size} className="flex items-baseline gap-4">
              <span className="text-sm text-[var(--color-text-tertiary)] w-24">{item.label}</span>
              <span className={`${item.size} text-[var(--color-text-primary)]`}>{item.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 间距展示 */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">间距系统</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { name: 'space-1', value: '4px' },
            { name: 'space-2', value: '8px' },
            { name: 'space-3', value: '12px' },
            { name: 'space-4', value: '16px' },
            { name: 'space-5', value: '20px' },
            { name: 'space-6', value: '24px' },
            { name: 'space-8', value: '32px' },
            { name: 'space-10', value: '40px' },
          ].map((space) => (
            <div key={space.name} className="flex items-center gap-4">
              <div
                className="bg-[var(--color-primary-500)] rounded"
                style={{
                  width: `var(--${space.name})`,
                  height: `var(--${space.name})`,
                  minWidth: '4px',
                  minHeight: '4px'
                }}
              />
              <div className="text-sm">
                <div className="font-medium text-[var(--color-text-primary)]">{space.name}</div>
                <div className="text-[var(--color-text-tertiary)]">{space.value}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 按钮展示 */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">按钮组件</h2>

        <div className="flex flex-wrap gap-4">
          <button aria-label="Primary Button" className="touch-manipulation min-h-[44px] px-6 py-3 rounded-lg bg-[var(--color-primary-500)] text-white font-medium transition-all hover:bg-[var(--color-primary-600)] hover:shadow-lg active:scale-95">
            Primary Button
          </button>

          <button aria-label="Secondary Button" className="touch-manipulation min-h-[44px] px-6 py-3 rounded-lg border-2 border-[var(--color-primary-500)] text-[var(--color-primary-500)] font-medium transition-all hover:bg-[var(--color-primary-50)] active:scale-95">
            Secondary Button
          </button>

          <button aria-label="Success Button" className="touch-manipulation min-h-[44px] px-6 py-3 rounded-lg bg-[var(--color-success-500)] text-white font-medium transition-all hover:bg-[var(--color-success-600)] active:scale-95">
            Success
          </button>

          <button aria-label="Error Button" className="touch-manipulation min-h-[44px] px-6 py-3 rounded-lg bg-[var(--color-error-500)] text-white font-medium transition-all hover:bg-[var(--color-error-600)] active:scale-95">
            Error
          </button>

          <button aria-label="Disabled Button" className="touch-manipulation min-h-[44px] px-6 py-3 rounded-lg text-[var(--color-text-tertiary)] font-medium transition-all hover:text-[var(--color-text-primary)] active:scale-95" disabled>
            Disabled
          </button>
        </div>
      </section>

      {/* 动画展示 */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">动画系统</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { name: 'Fade In', class: 'motion-fade-in' },
            { name: 'Scale In', class: 'motion-scale-in' },
            { name: 'Slide Up', class: 'motion-slide-up' },
            { name: 'Bounce In', class: 'motion-bounce-in' },
          ].map((anim, index) => (
            <div
              key={anim.name}
              className={`p-6 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-light)] text-center ${anim.class}`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--color-primary-500)]" />
              <div className="text-sm font-medium text-[var(--color-text-primary)]">{anim.name}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { name: 'Pulse', class: 'motion-pulse' },
            { name: 'Spin', class: 'motion-spin' },
            { name: 'Bounce', class: 'motion-bounce' },
            { name: 'Breathe', class: 'motion-breathe' },
          ].map((anim) => (
            <div
              key={anim.name}
              className="p-6 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-light)] text-center"
            >
              <div className={`w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--color-secondary-500)] ${anim.class}`} />
              <div className="text-sm font-medium text-[var(--color-text-primary)]">{anim.name}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 可访问性信息 */}
      <section className="p-6 rounded-lg bg-[var(--color-info-50)] border border-[var(--color-info-200)]">
        <h2 className="text-lg font-semibold text-[var(--color-info-700)] mb-3">
          可访问性合规
        </h2>
        <ul className="space-y-2 text-[var(--color-info-700)]">
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--color-success-500)]" />
            WCAG 2.2 AA 合规（对比度 4.5:1）
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--color-success-500)]" />
            支持 prefers-reduced-motion
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--color-success-500)]" />
            支持 Windows 高对比度模式
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--color-success-500)]" />
            键盘导航支持
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--color-success-500)]" />
            屏幕阅读器兼容
          </li>
        </ul>
      </section>
    </div>
  );
}
