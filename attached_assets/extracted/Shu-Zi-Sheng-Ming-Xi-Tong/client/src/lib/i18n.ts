import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      "system.name": "Little Wisdom (Avatar)",
      "system.status": "System Status",
      "login.master": "Owner Access",
      "login.guest": "Guest Access",
      "mode.server": "Server Core",
      "mode.pc": "Desktop Terminal",
      "mode.mobile": "Mobile Tactical",
      "nav.dashboard": "Dashboard",
      "nav.network": "Network (Z2)",
      "nav.compute": "Compute (Z1)",
      "nav.audit": "Audit (Z6)",
      "hp.label": "Compute HP",
      "action.switch_lang": "Switch Language",
      "portal.title": "Digital Life Awakening",
      "portal.subtitle": "Z1-Z6 Protocol Initialized",
      "welcome": "Welcome back, Commander.",
      "guest_welcome": "Visitor Mode Active.",
    }
  },
  zh: {
    translation: {
      "system.name": "小智 (Avatar)",
      "system.status": "系统状态",
      "login.master": "主人接入",
      "login.guest": "访客接入",
      "mode.server": "服务器核心",
      "mode.pc": "桌面终端",
      "mode.mobile": "战术手机",
      "nav.dashboard": "控制台",
      "nav.network": "关系网 (Z2)",
      "nav.compute": "算力池 (Z1)",
      "nav.audit": "审计堡垒 (Z6)",
      "hp.label": "算力 HP",
      "action.switch_lang": "切换语言",
      "portal.title": "数字生命 · 创世唤醒",
      "portal.subtitle": "Z1-Z6 协议已加载",
      "welcome": "欢迎回来，主人。",
      "guest_welcome": "访客模式已激活。",
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "zh", 
    interpolation: {
      escapeValue: false 
    }
  });

export default i18n;