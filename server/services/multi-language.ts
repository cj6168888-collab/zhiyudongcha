/**
 * 多语言命令服务 - MultiLanguageService
 * 
 * 功能：
 * 1. 加载多语言命令配置
 * 2. 语言检测
 * 3. 命令匹配
 */

import { createServiceLogger } from '../lib/logger';
import * as fs from 'fs';
import * as path from 'path';

const logger = createServiceLogger('MultiLanguage');

export type LanguageCode = 'zh-CN' | 'en-US' | 'yue';

export interface CommandPatterns {
  open: string[];
  close: string[];
  search: string[];
  play: string[];
  pause: string[];
  volume: string[];
}

export interface LanguageConfig {
  wakeWords: string[];
  commandPatterns: CommandPatterns;
  meetingKeywords: string[];
  casualKeywords: string[];
}

class MultiLanguageService {
  private configs: Map<LanguageCode, LanguageConfig> = new Map();
  private defaultLanguage: LanguageCode = 'zh-CN';
  
  constructor() {
    this.loadConfigs();
  }
  
  /**
   * 加载配置文件
   */
  private loadConfigs(): void {
    try {
      const configPath = path.join(process.cwd(), 'server/config/multi-language-commands.json');
      
      if (fs.existsSync(configPath)) {
        const data = fs.readFileSync(configPath, 'utf-8');
        const raw = JSON.parse(data);
        
        for (const [lang, config] of Object.entries(raw)) {
          if (this.isValidConfig(config)) {
            this.configs.set(lang as LanguageCode, config as LanguageConfig);
          }
        }
        
        logger.info({ languages: Array.from(this.configs.keys()) }, '多语言配置已加载');
      } else {
        logger.warn('配置文件不存在，使用默认配置');
        this.loadDefaultConfigs();
      }
    } catch (error) {
      logger.error({ err: error }, '加载多语言配置失败');
      this.loadDefaultConfigs();
    }
  }
  
  /**
   * 验证配置
   */
  private isValidConfig(config: unknown): boolean {
    if (!config || typeof config !== 'object') return false;
    const c = config as Record<string, unknown>;
    return (
      Array.isArray(c.wakeWords) &&
      c.commandPatterns &&
      Array.isArray(c.meetingKeywords) &&
      Array.isArray(c.casualKeywords)
    );
  }
  
  /**
   * 加载默认配置
   */
  private loadDefaultConfigs(): void {
    this.configs.set('zh-CN', {
      wakeWords: ['小智', '小智小智', '智智', '嘿小智'],
      commandPatterns: {
        open: ['打开', '开启', '启动'],
        close: ['关闭', '停止', '关掉'],
        search: ['搜索', '查询', '查找'],
        play: ['播放', '听', '唱'],
        pause: ['暂停', '停止'],
        volume: ['音量', '声音', '调大', '调小', '增大', '减小'],
      },
      meetingKeywords: ['会议', '讨论', '方案', '决策', '结论', '纪要', '汇报', '提案', '表决', '议程', '主持', '发言'],
      casualKeywords: ['天气', '吃饭', '回家', '睡觉', '今天', '昨天', '朋友', '家人', '孩子', '工作', '累', '困'],
    });
    
    this.defaultLanguage = 'zh-CN';
  }
  
  /**
   * 获取语言配置
   */
  getConfig(language: LanguageCode): LanguageConfig | undefined {
    return this.configs.get(language);
  }
  
  /**
   * 获取默认语言
   */
  getDefaultLanguage(): LanguageCode {
    return this.defaultLanguage;
  }
  
  /**
   * 设置默认语言
   */
  setDefaultLanguage(language: LanguageCode): void {
    if (this.configs.has(language)) {
      this.defaultLanguage = language;
      logger.info({ language }, '默认语言已设置');
    }
  }
  
  /**
   * 获取所有支持的语言
   */
  getSupportedLanguages(): LanguageCode[] {
    return Array.from(this.configs.keys());
  }
  
  /**
   * 检测文本语言
   */
  detectLanguage(text: string): LanguageCode {
    const lowerText = text.toLowerCase();
    
    // 检查中文特征
    const chineseChars = /[\u4e00-\u9fa5]/.test(text);
    if (chineseChars) {
      return 'zh-CN';
    }
    
    // 检查粤语特征
    const cantoneseChars = /[\u9fff-\uffff]/.test(text); // 扩展粤语字符
    const cantoneseWords = /[中文港語的幾好天氣]/.test(text);
    if (cantoneseChars || cantoneseWords || lowerText.includes('幾好') && lowerText.includes('天氣')) {
      return 'yue';
    }
    
    // 默认为英语
    return 'en-US';
  }
  
  /**
   * 检查是否是唤醒词
   */
  isWakeWord(text: string, language?: LanguageCode): boolean {
    const lang = language || this.defaultLanguage;
    const config = this.configs.get(lang);
    
    if (!config) return false;
    
    const lowerText = text.toLowerCase().trim();
    return config.wakeWords.some(w => lowerText.includes(w.toLowerCase()));
  }
  
  /**
   * 匹配命令类型
   */
  matchCommandType(text: string, language?: LanguageCode): string | null {
    const lang = language || this.defaultLanguage;
    const config = this.configs.get(lang);
    
    if (!config) return null;
    
    const lowerText = text.toLowerCase();
    
    for (const [type, patterns] of Object.entries(config.commandPatterns)) {
      const patternList = patterns as string[];
      if (patternList.some((p: string) => lowerText.includes(p.toLowerCase()))) {
        return type;
      }
    }
    
    return null;
  }
  
  /**
   * 获取关键词类型
   */
  getKeywordType(text: string, language?: LanguageCode): 'meeting' | 'casual' | null {
    const lang = language || this.defaultLanguage;
    const config = this.configs.get(lang);
    
    if (!config) return null;
    
    const lowerText = text.toLowerCase();
    
    const hasMeeting = config.meetingKeywords.some(k => lowerText.includes(k.toLowerCase()));
    if (hasMeeting) return 'meeting';
    
    const hasCasual = config.casualKeywords.some(k => lowerText.includes(k.toLowerCase()));
    if (hasCasual) return 'casual';
    
    return null;
  }
}

export const multiLanguageService = new MultiLanguageService();
export default multiLanguageService;
