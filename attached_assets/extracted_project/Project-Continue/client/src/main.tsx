import { createRoot } from "react-dom/client";
import "./lib/i18n";
import App from "./App";
import "./index.css";

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('[小智] Service Worker 注册成功:', reg.scope);
      })
      .catch((err) => {
        console.log('[小智] Service Worker 注册失败:', err);
      });
  });
}

if ('Notification' in window && Notification.permission === 'default') {
  setTimeout(() => {
    Notification.requestPermission().then((permission) => {
      console.log('[小智] 通知权限:', permission);
    });
  }, 3000);
}

createRoot(document.getElementById("root")!).render(<App />);
