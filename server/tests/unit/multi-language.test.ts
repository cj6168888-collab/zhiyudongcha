/**
 * 多语言服务测试
 */

import { describe, it, expect } from 'vitest';
import { multiLanguageService } from '../../services/multi-language';

describe('MultiLanguageService', () => {
  describe('getSupportedLanguages', () => {
    it('应该返回支持的语言列表', () => {
      const languages = multiLanguageService.getSupportedLanguages();
      
      expect(languages).toContain('zh-CN');
      expect(languages).toContain('en-US');
    });
  });
  
  describe('getDefaultLanguage', () => {
    it('应该返回默认语言', () => {
      const defaultLang = multiLanguageService.getDefaultLanguage();
      
      expect(defaultLang).toBeDefined();
    });
  });
  
  describe('detectLanguage', () => {
    it('应该检测中文', () => {
      const lang = multiLanguageService.detectLanguage('今天天气很好');
      
      expect(lang).toBe('zh-CN');
    });
    
    it('应该检测英文', () => {
      const lang = multiLanguageService.detectLanguage('Hello world today');
      
      expect(lang).toBe('en-US');
    });
    
    it('应该检测粤语', () => {
      const lang = multiLanguageService.detectLanguage('你好');
      
      expect(lang).toBe('zh-CN');
    });
  });
  
  describe('isWakeWord', () => {
    it('应该识别中文唤醒词', () => {
      const result = multiLanguageService.isWakeWord('小智');
      
      expect(result).toBe(true);
    });
    
    it('应该识别小智小智', () => {
      const result = multiLanguageService.isWakeWord('小智小智');
      
      expect(result).toBe(true);
    });
    
    it('应该识别智智', () => {
      const result = multiLanguageService.isWakeWord('智智');
      
      expect(result).toBe(true);
    });
    
    it('不包含唤醒词应该返回false', () => {
      const result = multiLanguageService.isWakeWord('今天天气很好');
      
      expect(result).toBe(false);
    });
  });
  
  describe('matchCommandType', () => {
    it('应该识别打开命令', () => {
      const type = multiLanguageService.matchCommandType('打开应用');
      
      expect(type).toBe('open');
    });
    
    it('应该识别关闭命令', () => {
      const type = multiLanguageService.matchCommandType('关闭电视');
      
      expect(type).toBe('close');
    });
    
    it('应该识别搜索命令', () => {
      const type = multiLanguageService.matchCommandType('搜索天气');
      
      expect(type).toBe('search');
    });
    
    it('应该识别播放命令', () => {
      const type = multiLanguageService.matchCommandType('播放音乐');
      
      expect(type).toBe('play');
    });
    
    it('未知命令应该返回null', () => {
      const type = multiLanguageService.matchCommandType('你好');
      
      expect(type).toBeNull();
    });
  });
  
  describe('getKeywordType', () => {
    it('应该识别会议关键词', () => {
      const type = multiLanguageService.getKeywordType('我们开会讨论这个方案');
      
      expect(type).toBe('meeting');
    });
    
    it('应该识别闲聊关键词', () => {
      const type = multiLanguageService.getKeywordType('今天天气很好');
      
      expect(type).toBe('casual');
    });
    
    it('无关键词应该返回null', () => {
      const type = multiLanguageService.getKeywordType('执行操作');
      
      expect(type).toBeNull();
    });
  });
  
  describe('getConfig', () => {
    it('应该返回语言配置', () => {
      const config = multiLanguageService.getConfig('zh-CN');
      
      expect(config).toBeDefined();
      expect(config?.wakeWords).toBeDefined();
      expect(config?.commandPatterns).toBeDefined();
    });
    
    it('不支持的语言应该返回undefined', () => {
      const config = multiLanguageService.getConfig('fr-FR');
      
      expect(config).toBeUndefined();
    });
  });
});
