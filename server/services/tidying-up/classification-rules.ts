import { createServiceLogger } from '../../lib/logger';
const logger = createServiceLogger('ClassificationRules');

import type { FileCategory, FileMetadata } from './types';

interface ClassificationRule {
  category: FileCategory;
  extensions: string[];
  namePatterns: RegExp[];
  priority: number;
}

const CLASSIFICATION_RULES: ClassificationRule[] = [
  {
    category: 'CONTRACT',
    extensions: ['.pdf', '.doc', '.docx'],
    namePatterns: [/合同|contract|协议|agreement|签约/i],
    priority: 100,
  },
  {
    category: 'INVOICE',
    extensions: ['.pdf', '.jpg', '.png', '.jpeg'],
    namePatterns: [/发票|invoice|收据|receipt|账单|bill/i],
    priority: 95,
  },
  {
    category: 'REPORT',
    extensions: ['.pdf', '.doc', '.docx', '.ppt', '.pptx'],
    namePatterns: [/报告|report|分析|analysis|总结|summary|周报|月报|年报/i],
    priority: 90,
  },
  {
    category: 'PRESENTATION',
    extensions: ['.ppt', '.pptx', '.key', '.odp'],
    namePatterns: [/演示|presentation|幻灯片|slides|汇报/i],
    priority: 85,
  },
  {
    category: 'SPREADSHEET',
    extensions: ['.xls', '.xlsx', '.csv', '.numbers'],
    namePatterns: [/表格|sheet|数据|data|统计|statistics/i],
    priority: 80,
  },
  {
    category: 'CODE',
    extensions: ['.js', '.ts', '.py', '.java', '.cpp', '.c', '.go', '.rs', '.vue', '.jsx', '.tsx', '.html', '.css', '.json', '.xml', '.yaml', '.yml'],
    namePatterns: [],
    priority: 75,
  },
  {
    category: 'IMAGE',
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico', '.tiff', '.heic', '.heif'],
    namePatterns: [],
    priority: 70,
  },
  {
    category: 'VIDEO',
    extensions: ['.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm', '.m4v'],
    namePatterns: [],
    priority: 70,
  },
  {
    category: 'AUDIO',
    extensions: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a'],
    namePatterns: [],
    priority: 70,
  },
  {
    category: 'ARCHIVE',
    extensions: ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz'],
    namePatterns: [],
    priority: 65,
  },
  {
    category: 'TEMP',
    extensions: ['.tmp', '.temp', '.bak', '.swp', '.log'],
    namePatterns: [/^~|\.tmp$|临时|temp|cache|缓存/i],
    priority: 60,
  },
  {
    category: 'DOCUMENT',
    extensions: ['.doc', '.docx', '.pdf', '.txt', '.rtf', '.odt', '.md'],
    namePatterns: [],
    priority: 50,
  },
];

export function classifyFile(file: FileMetadata): FileCategory {
  const ext = getExtension(file.fileName).toLowerCase();
  const fileName = file.fileName.toLowerCase();
  
  let bestMatch: { category: FileCategory; priority: number } = { category: 'UNKNOWN', priority: 0 };
  
  for (const rule of CLASSIFICATION_RULES) {
    let score = 0;
    
    if (rule.extensions.includes(ext)) {
      score += rule.priority;
    }
    
    for (const pattern of rule.namePatterns) {
      if (pattern.test(fileName)) {
        score += rule.priority + 10;
        break;
      }
    }
    
    if (score > bestMatch.priority) {
      bestMatch = { category: rule.category, priority: score };
    }
  }
  
  return bestMatch.category;
}

export function getExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  return lastDot > 0 ? fileName.slice(lastDot) : '';
}

export function isTemporaryFile(file: FileMetadata): boolean {
  const fileName = file.fileName.toLowerCase();
  const ext = getExtension(fileName);
  
  const tempPatterns = [
    /^~\$/,
    /\.tmp$/,
    /\.temp$/,
    /\.bak$/,
    /\.swp$/,
    /^新建/,
    /^untitled/i,
    /^新建文本文档/,
    /^新建 Microsoft/,
    /^\._/,
    /\.DS_Store$/,
    /Thumbs\.db$/i,
    /desktop\.ini$/i,
  ];
  
  return tempPatterns.some(p => p.test(fileName)) || ext === '.tmp' || ext === '.temp';
}

export function isDuplicateLikeName(fileName: string): boolean {
  const patterns = [
    /\(\d+\)\.[^.]+$/,
    /副本\.[^.]+$/,
    /copy\.[^.]+$/i,
    /-\d+\.[^.]+$/,
    /_\d+\.[^.]+$/,
    /\s+\d+\.[^.]+$/,
  ];
  
  return patterns.some(p => p.test(fileName));
}

export function getCategoryDisplayName(category: FileCategory): string {
  const names: Record<FileCategory, string> = {
    CONTRACT: '合同',
    REPORT: '报告',
    INVOICE: '发票',
    PRESENTATION: '演示文稿',
    CODE: '代码',
    IMAGE: '图片',
    VIDEO: '视频',
    AUDIO: '音频',
    DOCUMENT: '文档',
    SPREADSHEET: '表格',
    ARCHIVE: '压缩包',
    TEMP: '临时文件',
    UNKNOWN: '未知',
  };
  return names[category] || '未知';
}

export function getCategoryIcon(category: FileCategory): string {
  const icons: Record<FileCategory, string> = {
    CONTRACT: '📜',
    REPORT: '📊',
    INVOICE: '🧾',
    PRESENTATION: '📽️',
    CODE: '💻',
    IMAGE: '🖼️',
    VIDEO: '🎬',
    AUDIO: '🎵',
    DOCUMENT: '📄',
    SPREADSHEET: '📈',
    ARCHIVE: '📦',
    TEMP: '🗑️',
    UNKNOWN: '❓',
  };
  return icons[category] || '❓';
}
