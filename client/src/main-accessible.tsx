/**
 * 应用入口文件 - 可访问性增强版本
 *
 * 更新内容:
 * - 导入可访问性样式
 * - 添加 SkipLink
 * - 配置焦点管理
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";

// 样式导入
import "./index.css";
import "./styles/accessibility.css";        // 基础可访问性
import "./styles/accessibility-updated.css"; // REMASTER v2.0 高对比度修复

// 导入 SkipLink 组件
import { SkipLink } from "@/components/ui/skip-link";

// 配置 React 严格模式
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      {/* 跳过导航链接 - 首个可聚焦元素 */}
      <SkipLink targetId="main-content" text="跳转到主要内容" />

      {/* 应用主体 */}
      <div id="main-content" role="main" tabIndex={-1}>
        <App />
      </div>
    </BrowserRouter>
  </React.StrictMode>
);
