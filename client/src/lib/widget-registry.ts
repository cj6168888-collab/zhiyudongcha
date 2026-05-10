import { lazy, ComponentType } from 'react';

export interface WidgetConfig {
  id: string;
  type: string;
  title: string;
  icon: string;
  defaultW: number;
  defaultH: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

export const WIDGET_TYPES: Record<string, WidgetConfig> = {
  hp_monitor: {
    id: 'hp_monitor',
    type: 'hp_monitor',
    title: '算力监控',
    icon: 'Cpu',
    defaultW: 2,
    defaultH: 3,
    minW: 2,
    minH: 2,
  },
  collaboration: {
    id: 'collaboration',
    type: 'collaboration',
    title: '协作面板',
    icon: 'Users',
    defaultW: 2,
    defaultH: 2,
    minW: 2,
    minH: 2,
  },
  voiceprint: {
    id: 'voiceprint',
    type: 'voiceprint',
    title: '声纹锁',
    icon: 'Fingerprint',
    defaultW: 2,
    defaultH: 3,
    minW: 2,
    minH: 2,
  },
  quick_actions: {
    id: 'quick_actions',
    type: 'quick_actions',
    title: '快捷操作',
    icon: 'Zap',
    defaultW: 4,
    defaultH: 2,
    minW: 2,
    minH: 2,
  },
  modules: {
    id: 'modules',
    type: 'modules',
    title: '核心模块',
    icon: 'Grid3x3',
    defaultW: 6,
    defaultH: 3,
    minW: 3,
    minH: 2,
  },
  ai_config: {
    id: 'ai_config',
    type: 'ai_config',
    title: 'AI配置',
    icon: 'Brain',
    defaultW: 2,
    defaultH: 2,
    minW: 2,
    minH: 2,
  },
  compute_pool: {
    id: 'compute_pool',
    type: 'compute_pool',
    title: '算力池',
    icon: 'Activity',
    defaultW: 2,
    defaultH: 2,
    minW: 2,
    minH: 2,
  },
};

export interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  static?: boolean;
}

export interface DashboardLayout {
  id: string;
  name: string;
  layout: LayoutItem[];
  widgets: string[];
}

export const DEFAULT_LAYOUT: LayoutItem[] = [
  { i: 'hp_monitor', x: 0, y: 0, w: 2, h: 3, minW: 2, minH: 2 },
  { i: 'compute_pool', x: 0, y: 3, w: 2, h: 2, minW: 2, minH: 2 },
  { i: 'collaboration', x: 0, y: 5, w: 2, h: 2, minW: 2, minH: 2 },
  { i: 'voiceprint', x: 0, y: 7, w: 2, h: 3, minW: 2, minH: 2 },
  { i: 'modules', x: 2, y: 0, w: 10, h: 4, minW: 3, minH: 2 },
];

export const DEFAULT_WIDGETS = ['hp_monitor', 'compute_pool', 'collaboration', 'voiceprint', 'modules'];
