import React from 'react';

export function XiaoJiMascot({ className = "w-12 h-12" }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* 小吉：未来感光晕 */}
      <div className="absolute inset-0 bg-primary/30 rounded-full blur-2xl animate-pulse" />

      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="relative z-10 w-full h-full">
        {/* 背景：圆形战甲舱口 */}
        <circle cx="50" cy="50" r="45" stroke="#6366f1" strokeWidth="1" strokeDasharray="4 2" className="opacity-40" />

        {/* 银色短发剪影 */}
        <path d="M30 45C30 30 40 20 50 20C60 20 70 30 70 45V55L65 50L55 55L50 50L45 55L35 50L30 55V45Z" fill="#CBD5E1" />
        <path d="M30 45C30 35 35 25 50 25C65 25 70 35 70 45" stroke="white" strokeWidth="0.5" />

        {/* 战甲耳麦/护目镜结构 */}
        <path d="M25 45H32V60H25V45Z" fill="#1E293B" stroke="#6366f1" strokeWidth="1" />
        <path d="M68 45H75V60H68V45Z" fill="#1E293B" stroke="#6366f1" strokeWidth="1" />

        {/* 脸部简化廓形 */}
        <path d="M35 45C35 45 35 70 50 70C65 70 65 45 65 45" fill="#FFF1F2" fillOpacity="0.9" />

        {/* 麒麟之眼：金色瞳孔 */}
        <circle cx="43" cy="48" r="2" fill="#030712" />
        <circle cx="57" cy="48" r="2" fill="#030712" />
        <path d="M48 58C48 58 50 60 52 58" stroke="#F43F5E" strokeWidth="1" strokeLinecap="round" />

        {/* 未来战甲领口 */}
        <path d="M35 70L50 85L65 70" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M45 78L50 82L55 78" stroke="#f59e0b" strokeWidth="1.5" />
      </svg>
    </div>
  );
}
