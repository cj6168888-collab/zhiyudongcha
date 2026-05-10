import { createRoot } from "react-dom/client";
import "./lib/i18n";
import App from "./App";

/* 设计系统 v2.0 */
import "./styles/design-system.css";
import "./styles/motion.css";
import "./styles/high-contrast.css";
import "./styles/accessibility.css";
import "./styles/accessibility-updated.css"; // REMASTER v2.0 高对比度修复
import "./index.css";

// 导入 SkipLink 组件
import { SkipLink } from "@/components/ui/skip-link";

// 初始化监控和错误追踪
import { initMonitoring, defaultMonitoringConfig } from './lib/monitoring';

// 在生产环境启用监控
if (process.env.NODE_ENV === 'production') {
  initMonitoring({
    ...defaultMonitoringConfig,
    enableErrorTracking: true,
    enablePerformanceMonitoring: true,
    enableUserTracking: true,
  });
} else {
  // 开发环境也启用部分监控用于调试
  initMonitoring({
    enableErrorTracking: true,
    enablePerformanceMonitoring: false,
    enableUserTracking: false,
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .catch((err) => {
        console.error('[小星] Service Worker 注册失败:', err);
      });
  });
}

if ('Notification' in window && Notification.permission === 'default') {
  setTimeout(() => {
    Notification.requestPermission();
  }, 3000);
}

createRoot(document.getElementById("root")!).render(
  <>
    <SkipLink targetId="main-content" text="跳转到主要内容" />
    <div id="main-content" role="main" tabIndex={-1}>
      <App />
    </div>
  </>
);
