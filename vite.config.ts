// @ts-nocheck
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // 已经包含了 v4 的核心处理逻辑
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  css: {
    // 关键修复：禁用默认的 postcss 插件链，防止双重处理冲突
    postcss: {
      plugins: []
    }
  },
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    target: "esnext",
  },
  server: {
    host: "0.0.0.0",
    port: 5001,
    allowedHosts: true,
  },
});
