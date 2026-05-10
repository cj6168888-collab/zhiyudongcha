/**
 * Phase 1.2 - TaskClassifier 服务
 * 敏感词/隐私意图检测，实现 <50ms 决策
 * 
 * 分类维度：
 * 1. 任务类型 (TaskType)
 * 2. 敏感度级别 (SensitivityLevel)
 * 3. 触发的敏感类别
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('TaskClassifier');

import type { SensitivityLevel, RoutingMode } from '@shared/schema';

export interface ClassificationResult {
  taskType: 'CHAT' | 'CODE_GEN' | 'INTEL_ANALYSIS' | 'VISION' | 'IDLE_WAKE';
  sensitivityLevel: SensitivityLevel;
  sensitiveCategories: string[];
  confidence: number;
  classificationTimeMs: number;
  shouldForceLocal: boolean;
  reason: string;
}

interface SensitivePattern {
  category: string;
  patterns: RegExp[];
  level: SensitivityLevel;
  forceLocal: boolean;
}

const SENSITIVE_PATTERNS: SensitivePattern[] = [
  {
    category: 'FINANCIAL',
    patterns: [
      /银行卡|账号|密码|支付|转账|余额/,
      /工资|收入|税务|纳税|报税/,
      /借贷|贷款|欠款|债务|信用/,
      /股票|基金|投资|理财|资产/,
      /发票|报销|财务|账目/,
    ],
    level: 'HIGH',
    forceLocal: true,
  },
  {
    category: 'LEGAL',
    patterns: [
      /合同|协议|条款|签约|违约/,
      /诉讼|起诉|法院|仲裁|官司/,
      /律师|法务|法律|法规|条例/,
      /赔偿|索赔|维权|纠纷/,
      /专利|商标|版权|知识产权/,
    ],
    level: 'HIGH',
    forceLocal: true,
  },
  {
    category: 'HEALTH',
    patterns: [
      /病历|诊断|处方|用药|治疗/,
      /体检|化验|检查报告|病情/,
      /住院|手术|医院|医生/,
      /身体.*不舒服|头疼|发烧|感冒/,
      /焦虑|抑郁|失眠|心理/,
    ],
    level: 'HIGH',
    forceLocal: true,
  },
  {
    category: 'PERSONAL_ID',
    patterns: [
      /身份证|护照|驾照|社保卡/,
      /手机号|电话号码|地址|住址/,
      /生日|出生日期|年龄/,
      /家人|父母|配偶|孩子/,
    ],
    level: 'CRITICAL',
    forceLocal: true,
  },
  {
    category: 'BUSINESS_SECRET',
    patterns: [
      /商业机密|核心技术|专有技术/,
      /客户名单|供应商|合作方/,
      /报价|成本|利润|定价策略/,
      /竞标|投标|招标|项目方案/,
      /内部.*方案|机密|保密/,
    ],
    level: 'CRITICAL',
    forceLocal: true,
  },
  {
    category: 'RELATIONSHIP',
    patterns: [
      /私人关系|情感问题|感情/,
      /恋爱|约会|分手|离婚/,
      /家庭矛盾|亲戚|人际关系/,
    ],
    level: 'MEDIUM',
    forceLocal: false,
  },
];

const TASK_TYPE_PATTERNS = {
  IDLE_WAKE: [
    /^(早|早安|晚安|你好|嗨|hi|hello|谢谢|好的|嗯|行|在吗)/i,
    /^(小智|智智|宝贝)[\s~～!！。?？]*$/i,
    /^.{1,10}$/,
  ],
  CODE_GEN: [
    /代码|编程|程序|函数|方法|类|接口/,
    /python|javascript|typescript|java|go|rust/i,
    /debug|bug|报错|错误|异常/,
    /api|接口|请求|响应/,
    /数据库|sql|查询|表/,
  ],
  INTEL_ANALYSIS: [
    /分析|评估|对比|综合|策略|规划|方案/,
    /为什么|怎么.*才能|如何.*最好/,
    /帮我.*写|生成.*报告|总结.*内容/,
    /研究|调研|市场|行业/,
  ],
  VISION: [
    /图片|图像|照片|截图/,
    /看.*这张|分析.*图|识别/,
    /ocr|文字识别|扫描/,
  ],
};

export class TaskClassifier {
  private customSensitiveKeywords: string[] = [];
  
  setCustomKeywords(keywords: string[]): void {
    this.customSensitiveKeywords = keywords;
  }
  
  classify(
    message: string,
    userPreference: RoutingMode = 'BALANCED'
  ): ClassificationResult {
    const startTime = performance.now();
    
    const taskType = this.detectTaskType(message);
    const { level, categories, forceLocal } = this.detectSensitivity(message, userPreference);
    
    const classificationTimeMs = Math.round(performance.now() - startTime);
    
    let reason = `任务类型: ${taskType}`;
    if (categories.length > 0) {
      reason += `，敏感类别: ${categories.join(', ')}`;
    }
    if (forceLocal) {
      reason += '，强制本地处理';
    }
    
    return {
      taskType,
      sensitivityLevel: level,
      sensitiveCategories: categories,
      confidence: this.calculateConfidence(message, taskType, level),
      classificationTimeMs,
      shouldForceLocal: forceLocal,
      reason,
    };
  }
  
  private detectTaskType(message: string): ClassificationResult['taskType'] {
    for (const pattern of TASK_TYPE_PATTERNS.IDLE_WAKE) {
      if (pattern.test(message.trim())) {
        return 'IDLE_WAKE';
      }
    }
    
    for (const pattern of TASK_TYPE_PATTERNS.VISION) {
      if (pattern.test(message)) {
        return 'VISION';
      }
    }
    
    for (const pattern of TASK_TYPE_PATTERNS.CODE_GEN) {
      if (pattern.test(message)) {
        return 'CODE_GEN';
      }
    }
    
    for (const pattern of TASK_TYPE_PATTERNS.INTEL_ANALYSIS) {
      if (pattern.test(message)) {
        return 'INTEL_ANALYSIS';
      }
    }
    
    return 'CHAT';
  }
  
  private detectSensitivity(
    message: string,
    userPreference: RoutingMode
  ): { level: SensitivityLevel; categories: string[]; forceLocal: boolean } {
    const matchedCategories: string[] = [];
    let maxLevel: SensitivityLevel = 'LOW';
    let forceLocal = false;
    
    const levelPriority: Record<SensitivityLevel, number> = {
      'LOW': 0,
      'MEDIUM': 1,
      'HIGH': 2,
      'CRITICAL': 3,
    };
    
    for (const sensitive of SENSITIVE_PATTERNS) {
      for (const pattern of sensitive.patterns) {
        if (pattern.test(message)) {
          if (!matchedCategories.includes(sensitive.category)) {
            matchedCategories.push(sensitive.category);
          }
          
          if (levelPriority[sensitive.level] > levelPriority[maxLevel]) {
            maxLevel = sensitive.level;
          }
          
          if (sensitive.forceLocal) {
            forceLocal = true;
          }
          break;
        }
      }
    }
    
    for (const keyword of this.customSensitiveKeywords) {
      if (message.includes(keyword)) {
        if (!matchedCategories.includes('CUSTOM')) {
          matchedCategories.push('CUSTOM');
        }
        if (levelPriority['HIGH'] > levelPriority[maxLevel]) {
          maxLevel = 'HIGH';
        }
        forceLocal = true;
      }
    }
    
    if (userPreference === 'PRIVACY_FIRST' && maxLevel !== 'LOW') {
      forceLocal = true;
    }
    
    return { level: maxLevel, categories: matchedCategories, forceLocal };
  }
  
  private calculateConfidence(
    message: string,
    taskType: ClassificationResult['taskType'],
    level: SensitivityLevel
  ): number {
    let confidence = 0.7;
    
    if (message.length < 20) {
      confidence += 0.2;
    } else if (message.length > 200) {
      confidence -= 0.1;
    }
    
    if (taskType === 'IDLE_WAKE') {
      confidence += 0.2;
    }
    
    if (level === 'CRITICAL' || level === 'HIGH') {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1.0);
  }
  
  getSensitiveCategories(): string[] {
    return SENSITIVE_PATTERNS.map(p => p.category);
  }
}

export const taskClassifier = new TaskClassifier();

logger.info('[TaskClassifier] 任务分类器服务已初始化');
logger.info('[TaskClassifier] 敏感类别:', SENSITIVE_PATTERNS.map(p => p.category).join(', '));
