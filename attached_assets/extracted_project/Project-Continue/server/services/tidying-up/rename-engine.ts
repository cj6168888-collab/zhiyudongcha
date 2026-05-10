import type { FileMetadata, RenameSuggestion, FileCategory } from './types';
import { classifyFile, getExtension } from './classification-rules';

interface RenamePattern {
  name: string;
  pattern: RegExp;
  replacement: (match: RegExpMatchArray, file: FileMetadata) => string;
  categories?: FileCategory[];
  priority: number;
}

const RENAME_PATTERNS: RenamePattern[] = [
  {
    name: 'remove_duplicate_suffix',
    pattern: /^(.+?)(?:\s*[\(\(]\d+[\)\)]|\s*-\s*副本|\s*copy\s*\d*)\s*(\.[^.]+)$/i,
    replacement: (match) => `${match[1]}${match[2]}`,
    priority: 100,
  },
  {
    name: 'untitled_document',
    pattern: /^(?:新建文本文档|新建\s*Microsoft\s*\w+\s*文档?|Untitled|Document\s*\d*|未命名)(\.[^.]+)?$/i,
    replacement: (match, file) => {
      const date = formatDate(file.modifiedAt);
      const ext = match[1] || getExtension(file.fileName);
      return `文档_${date}${ext}`;
    },
    priority: 95,
  },
  {
    name: 'screenshot_naming',
    pattern: /^(?:屏幕截图|Screenshot|截图|Snipaste)[\s_-]*(\d{4}[-_]?\d{2}[-_]?\d{2})?[\s_-]*(\d{2}[-_:]?\d{2}[-_:]?\d{2})?.*(\.[^.]+)$/i,
    replacement: (match) => {
      const date = match[1] ? match[1].replace(/[-_]/g, '') : formatDate(new Date());
      const time = match[2] ? match[2].replace(/[-_:]/g, '') : '';
      return `截图_${date}${time ? '_' + time : ''}${match[3]}`;
    },
    categories: ['IMAGE'],
    priority: 90,
  },
  {
    name: 'wechat_image',
    pattern: /^(?:微信图片|WeChat\s*Image)[\s_-]*(\d+)?.*(\.[^.]+)$/i,
    replacement: (match) => {
      const id = match[1] || formatDate(new Date());
      return `微信_${id}${match[2]}`;
    },
    categories: ['IMAGE'],
    priority: 90,
  },
  {
    name: 'qq_image',
    pattern: /^(?:QQ图片|QQ\s*Image|QQ截图)[\s_-]*(\d+)?.*(\.[^.]+)$/i,
    replacement: (match) => {
      const id = match[1] || formatDate(new Date());
      return `QQ_${id}${match[2]}`;
    },
    categories: ['IMAGE'],
    priority: 90,
  },
  {
    name: 'downloaded_file',
    pattern: /^(.+?)[\s_-](?:下载|download|downloaded)[\s_-]*\d*(\.[^.]+)$/i,
    replacement: (match) => `${match[1]}${match[2]}`,
    priority: 85,
  },
  {
    name: 'random_hash_name',
    pattern: /^[a-f0-9]{32,}(\.[^.]+)$/i,
    replacement: (match, file) => {
      const date = formatDate(file.modifiedAt);
      const category = classifyFile(file);
      return `${getCategoryPrefix(category)}_${date}${match[1]}`;
    },
    priority: 80,
  },
  {
    name: 'uuid_name',
    pattern: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}(\.[^.]+)$/i,
    replacement: (match, file) => {
      const date = formatDate(file.modifiedAt);
      const category = classifyFile(file);
      return `${getCategoryPrefix(category)}_${date}${match[1]}`;
    },
    priority: 80,
  },
  {
    name: 'tmp_prefix',
    pattern: /^~\$(.+)$/,
    replacement: () => '',
    priority: 75,
  },
  {
    name: 'clean_special_chars',
    pattern: /[<>:"\/\\|?*]+/g,
    replacement: () => '_',
    priority: 50,
  },
];

function formatDate(date: Date): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function getCategoryPrefix(category: FileCategory): string {
  const prefixes: Record<FileCategory, string> = {
    CONTRACT: '合同',
    REPORT: '报告',
    INVOICE: '发票',
    PRESENTATION: '演示',
    CODE: '代码',
    IMAGE: '图片',
    VIDEO: '视频',
    AUDIO: '音频',
    DOCUMENT: '文档',
    SPREADSHEET: '表格',
    ARCHIVE: '压缩',
    TEMP: '临时',
    UNKNOWN: '文件',
  };
  return prefixes[category] || '文件';
}

export function suggestRename(file: FileMetadata): RenameSuggestion | null {
  const category = classifyFile(file);
  const fileName = file.fileName;
  
  for (const rule of RENAME_PATTERNS.sort((a, b) => b.priority - a.priority)) {
    if (rule.categories && !rule.categories.includes(category)) {
      continue;
    }
    
    const match = fileName.match(rule.pattern);
    if (match) {
      const suggested = rule.replacement(match, file);
      
      if (suggested === '') {
        continue;
      }
      
      if (suggested !== fileName) {
        return {
          originalName: fileName,
          suggestedName: sanitizeFileName(suggested),
          reason: getRenameReason(rule.name),
          confidence: rule.priority / 100,
          ruleName: rule.name,
        };
      }
    }
  }
  
  return null;
}

export function suggestBatchRenames(files: FileMetadata[]): RenameSuggestion[] {
  const suggestions: RenameSuggestion[] = [];
  const usedNames = new Set<string>();
  
  for (const file of files) {
    const suggestion = suggestRename(file);
    if (suggestion) {
      let finalName = suggestion.suggestedName;
      let counter = 1;
      
      while (usedNames.has(finalName.toLowerCase())) {
        const ext = getExtension(suggestion.suggestedName);
        const baseName = suggestion.suggestedName.slice(0, -ext.length);
        finalName = `${baseName}_${counter}${ext}`;
        counter++;
      }
      
      usedNames.add(finalName.toLowerCase());
      suggestion.suggestedName = finalName;
      suggestions.push(suggestion);
    }
  }
  
  return suggestions;
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"\/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .trim();
}

function getRenameReason(ruleName: string): string {
  const reasons: Record<string, string> = {
    remove_duplicate_suffix: '移除副本后缀',
    untitled_document: '重命名无标题文档',
    screenshot_naming: '规范截图命名',
    wechat_image: '规范微信图片命名',
    qq_image: '规范QQ图片命名',
    downloaded_file: '清理下载后缀',
    random_hash_name: '替换随机哈希名',
    uuid_name: '替换UUID名称',
    tmp_prefix: '临时文件可删除',
    clean_special_chars: '清理特殊字符',
  };
  return reasons[ruleName] || '优化文件名';
}

export async function suggestSemanticRename(
  file: FileMetadata,
  content: string,
  apiKey?: string
): Promise<RenameSuggestion | null> {
  if (!apiKey || !content) {
    return suggestRename(file);
  }
  
  try {
    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen-turbo',
        messages: [
          {
            role: 'system',
            content: `你是文件命名专家。根据文件内容摘要，生成简洁、专业的文件名。
规则：
1. 使用中文或英文，不超过30个字符
2. 包含日期时用YYYYMMDD格式
3. 用下划线分隔词语
4. 突出关键信息（项目名、类型、日期等）
只返回建议的文件名，不要扩展名，不要解释。`,
          },
          {
            role: 'user',
            content: `原文件名: ${file.fileName}
文件内容摘要: ${content.slice(0, 500)}

请生成一个更好的文件名:`,
          },
        ],
        max_tokens: 50,
        temperature: 0.3,
      }),
    });
    
    if (!response.ok) {
      return suggestRename(file);
    }
    
    const data = await response.json();
    const suggestedBase = data.choices?.[0]?.message?.content?.trim();
    
    if (suggestedBase && suggestedBase !== file.fileName) {
      const ext = getExtension(file.fileName);
      return {
        originalName: file.fileName,
        suggestedName: sanitizeFileName(suggestedBase) + ext,
        reason: 'AI语义分析',
        confidence: 0.9,
        ruleName: 'semantic_ai',
      };
    }
  } catch (error) {
    console.error('Semantic rename failed:', error);
  }
  
  return suggestRename(file);
}
