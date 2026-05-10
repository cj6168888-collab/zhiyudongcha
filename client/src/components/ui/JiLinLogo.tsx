import React from 'react';

export function JiLinLogo({ className = "w-12 h-12" }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* 麒麟灵光呼吸效果 */}
      <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />

      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="relative z-10 w-full h-full">
        {/* 麒麟角：科技线条 */}
        <path d="M35 20L45 10M65 20L55 10" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" />

        {/* 麒麟头骨架：六边形蜂群意象 */}
        <path d="M50 25L80 40V65L50 85L20 65V40L50 25Z" stroke="white" strokeOpacity="0.8" strokeWidth="2" />

        {/* 洞察之眼：核心透镜 */}
        <circle cx="50" cy="52" r="12" fill="#6366f1" fillOpacity="0.2" stroke="#6366f1" strokeWidth="1.5" />
        <circle cx="50" cy="52" r="6" fill="#f59e0b">
          <animate attributeName="opacity" values="1;0.4;1" dur="3s" repeatCount="indefinity" />
        </circle>

        {/* 扫描线 */}
        <line x1="25" y1="45" x2="75" y2="45" stroke="#6366f1" strokeWidth="0.5" strokeOpacity="0.5">
          <animate attributeName="y1" values="35;75;35" dur="4s" repeatCount="indefinity" />
          <animate attributeName="y2" values="35;75;35" dur="4s" repeatCount="indefinity" />
        </line>
      </svg>
    </div>
  );
}
