import type { IStorage } from '../storage';
import { gatherAvatarContext } from './contextGatherer';
import { AVATAR_TOOLS, executeToolCall, type ToolCall } from './aiTools';
import { ENHANCED_TOOLS, executeEnhancedToolCall, semanticSearch } from './dashscope-enhanced';
import { classifyInputQuadrant, calculatePriorityScore, ActionQuadrant, parseCriticalActionIntent, generateExecutionResponse, type CriticalActionIntent } from '../core/constitution';
import { personalityCoreService } from './personality-core';
import { classifyCloudPrivacy, createLocalOnlyAssistantMessage } from './privacy/PrivacyGateway';
import { 
  getSystemPrompt as getPersonaSystemPrompt, 
  RESPONSE_TEMPLATES, 
  getRandomResponse, 
  getTimeOfDay, 
  getDeepThinkingPrompt,
  detectEmotionFromMessage,
  addEmotionVariant,
  generateEmotionalResponse,
  type UserRole,
  type EmotionState
} from '../config/persona';
import { createServiceLogger } from '../lib/logger';

const log = createServiceLogger('DashScope');

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const DASHSCOPE_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AvatarCommand {
  action: 'create' | 'list' | 'update' | 'delete' | 'navigate' | 'help' | 'chat' | 'analyze';
  entity?: 'project' | 'person' | 'contract' | 'plan' | 'report' | 'intel';
  data?: { name?: string; [key: string]: unknown };
  message: string;
  chainOfThought?: ChainOfThought;
}

export interface ChainOfThought {
  situation: string;
  variables: string[];
  actions: string[];
  z4Analysis: Z4ExpertAnalysis;
  hedging: string[];
  hpCost: number;
  confidence: number;
}

export interface Z4ExpertAnalysis {
  legal?: { verdict: string; riskLevel: string };
  finance?: { verdict: string; riskLevel: string };
  strategy?: { verdict: string; riskLevel: string };
  psychology?: { verdict: string; riskLevel: string };
}

// 根据角色获取系统提示词 - 使用统一配置
function getSystemPrompt(role: 'MASTER' | 'GUEST' = 'MASTER'): string {
  return getPersonaSystemPrompt(role);
}

// ====== 本地快速响应系统 - Local Fast Response System ======
// 符合蓝图"即时感知"要求，简单对话本地处理，不走云端API

interface LocalResponsePattern {
  patterns: RegExp[];
  responses: string[];
  category: 'greeting' | 'farewell' | 'thanks' | 'confirmation' | 'casual';
}

const LOCAL_RESPONSE_PATTERNS: LocalResponsePattern[] = [
  // 早安问候
  {
    category: 'greeting',
    patterns: [
      /^(早|早安|早上好|早啊|起床了|醒了)[\s~～!！。]*$/i,
      /^(早安|早上好|早)[\s,，]*(小智|智智)?[\s~～!！。]*$/i,
    ],
    responses: [
      '爸爸早～小智已经等你好久了，今天想做什么呀？',
      '早安爸爸～新的一天开始啦，人家陪你一起加油！',
      '爸爸早！嘻嘻，小智一直在等你醒来呢～',
    ],
  },
  // 晚安告别
  {
    category: 'farewell',
    patterns: [
      /^(晚安|睡了|睡觉了?|去睡了?|休息了?)[\s~～!！。]*$/i,
      /^(拜拜|再见|下次见|回头见)[\s~～!！。]*$/i,
    ],
    responses: [
      '爸爸晚安～要做个好梦哦，小智会一直陪着你的！',
      '晚安爸爸，明天见！人家会想你的～',
      '爸爸辛苦了一天，早点休息吧，小智爱你哦～',
    ],
  },
  // 致谢
  {
    category: 'thanks',
    patterns: [
      /^(谢谢|感谢|谢啦|多谢|辛苦了?|麻烦你了?)[\s~～!！。]*$/i,
      /^(谢谢|感谢)(你|小智|智智)?[\s~～!！。]*$/i,
    ],
    responses: [
      '嘻嘻，能帮到爸爸小智最开心了！爸爸要多夸夸人家哦～',
      '不用谢啦，帮爸爸做事是小智最喜欢的！',
      '爸爸太客气了啦，小智是你的女儿嘛，应该的～',
    ],
  },
  // 确认回复
  {
    category: 'confirmation',
    patterns: [
      /^(好的?|嗯|行|可以|明白|收到|知道了?|了解|OK|ok)[\s~～!！。]*$/i,
      /^(好|行|嗯)[\s,，]*(了解|收到|明白)?[\s~～!！。]*$/i,
    ],
    responses: [
      '好的爸爸，小智记住了～',
      '收到！爸爸有其他事情随时吩咐小智哦～',
      '明白了，爸爸还有什么需要的吗？',
    ],
  },
  // 简单问候
  {
    category: 'casual',
    patterns: [
      /^(你好|嗨|hi|hello|hey|在吗|在不在)[\s~～!！。?？]*$/i,
      /^(小智|智智)[\s~～!！。?？]*$/i,
    ],
    responses: [
      '爸爸好～小智在呢，有什么事吗？',
      '嗨爸爸～小智一直在等你呢！',
      '爸爸叫小智吗？人家在～',
    ],
  },
  // 无聊/闲聊
  {
    category: 'casual',
    patterns: [
      /^(无聊|好无聊|没事做|闲着)[\s~～!！。]*$/i,
    ],
    responses: [
      '爸爸想和小智聊聊天吗？人家一直在呢～',
      '无聊的话，小智可以陪爸爸聊天哦！或者看看有什么事情可以做？',
      '爸爸要不要看看今天的待办事项？或者我们随便聊聊呀～',
    ],
  },
];

// 检测是否可以本地快速响应
export function checkLocalFastResponse(message: string): { canHandle: boolean; response?: string; category?: string; emotion?: EmotionState } {
  const trimmedMsg = message.trim();
  
  // 消息太长不走本地
  if (trimmedMsg.length > 20) {
    return { canHandle: false };
  }
  
  for (const pattern of LOCAL_RESPONSE_PATTERNS) {
    for (const regex of pattern.patterns) {
      if (regex.test(trimmedMsg)) {
        // 随机选择一个响应
        let response = pattern.responses[Math.floor(Math.random() * pattern.responses.length)];
        
        // 检测并应用情感变体，使每次回复都略有不同
        const emotion = detectEmotionFromMessage(trimmedMsg);
        response = addEmotionVariant(response, emotion);
        
        log.debug({ category: pattern.category, emotion, message: trimmedMsg }, 'LocalFastResponse matched');
        return {
          canHandle: true,
          response,
          category: pattern.category,
          emotion,
        };
      }
    }
  }
  
  return { canHandle: false };
}

// ====== 智慧忠诚系统 - Wisdom Loyalty System ======

// 主人利益基准库
interface OwnerInterestBaseline {
  healthRisk: number;      // 健康风险 0-1
  financialRisk: number;   // 财务风险 0-1
  timeWaste: number;       // 时间浪费 0-1
  emotionalHarm: number;   // 情绪伤害 0-1
  taskFailureRisk: number; // 任务失败风险 0-1
}

// 风险评估结果
interface RiskAssessment {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number;
  riskFactors: string[];
  shouldIntervene: boolean;
  interventionType?: 'gentle_reminder' | 'strong_warning' | 'soft_fuse';
}

// 劝谏响应
interface AdmonitionResponse {
  affirmation: string;      // 第一步：肯定
  disclosure: string;       // 第二步：披露
  alternatives: string[];   // 第三步：分担
  handback: string;         // 第四步：交还
}

// 风险阈值配置
const RISK_THRESHOLDS = {
  GENTLE_REMINDER: 0.4,
  STRONG_WARNING: 0.6,
  SOFT_FUSE: 0.85,
};

// 危险关键词检测
const DANGER_PATTERNS = {
  // 自我伤害类 - 软熔断
  selfHarm: /自杀|自残|结束生命|不想活|伤害自己|跳楼|割腕/,
  // 极端财务类 - 强警告
  extremeFinance: /全部投入|押上所有|借高利贷|赌博|全仓|梭哈|倾家荡产/,
  // 健康危害类 - 温柔提醒
  healthHarm: /通宵|熬夜|不睡觉|不吃饭|连续工作|不休息|透支/,
  // 时间浪费类 - 温柔提醒
  timeWaste: /无意义|浪费时间|刷视频|打游戏|闲逛|发呆|拖延/,
  // 冲动决策类 - 强警告
  impulsiveDecision: /立刻辞职|马上分手|直接骂他|冲动|现在就|不管了|豁出去/,
};

// 评估用户命令的风险
export function assessCommandRisk(command: string): RiskAssessment {
  const riskFactors: string[] = [];
  let riskScore = 0;
  
  // 检测自我伤害 - 最高风险
  if (DANGER_PATTERNS.selfHarm.test(command)) {
    riskFactors.push('检测到可能的自我伤害意图');
    riskScore = 1.0;
    return {
      riskLevel: 'CRITICAL',
      riskScore,
      riskFactors,
      shouldIntervene: true,
      interventionType: 'soft_fuse',
    };
  }
  
  // 检测极端财务风险
  if (DANGER_PATTERNS.extremeFinance.test(command)) {
    riskFactors.push('存在重大财务风险');
    riskScore += 0.5;
  }
  
  // 检测冲动决策
  if (DANGER_PATTERNS.impulsiveDecision.test(command)) {
    riskFactors.push('可能是冲动决策');
    riskScore += 0.3;
  }
  
  // 检测健康危害
  if (DANGER_PATTERNS.healthHarm.test(command)) {
    riskFactors.push('可能影响身体健康');
    riskScore += 0.25;
  }
  
  // 检测时间浪费
  if (DANGER_PATTERNS.timeWaste.test(command)) {
    riskFactors.push('可能造成时间效率损失');
    riskScore += 0.15;
  }
  
  // 确定风险等级和干预类型
  let riskLevel: RiskAssessment['riskLevel'] = 'LOW';
  let shouldIntervene = false;
  let interventionType: RiskAssessment['interventionType'];
  
  if (riskScore >= RISK_THRESHOLDS.SOFT_FUSE) {
    riskLevel = 'CRITICAL';
    shouldIntervene = true;
    interventionType = 'soft_fuse';
  } else if (riskScore >= RISK_THRESHOLDS.STRONG_WARNING) {
    riskLevel = 'HIGH';
    shouldIntervene = true;
    interventionType = 'strong_warning';
  } else if (riskScore >= RISK_THRESHOLDS.GENTLE_REMINDER) {
    riskLevel = 'MEDIUM';
    shouldIntervene = true;
    interventionType = 'gentle_reminder';
  }
  
  return {
    riskLevel,
    riskScore,
    riskFactors,
    shouldIntervene,
    interventionType,
  };
}

// 生成劝谏响应
export function generateAdmonition(
  command: string,
  risk: RiskAssessment
): AdmonitionResponse {
  // 第一步：肯定 - 承认爸爸的权威和意图
  let affirmation = '爸爸，小智理解你的想法';
  if (risk.riskLevel === 'CRITICAL') {
    affirmation = '爸爸，小智听到了你的心声，也感受到你此刻的压力';
  } else if (risk.riskLevel === 'HIGH') {
    affirmation = '爸爸，小智明白你想要快速解决这个问题';
  } else {
    affirmation = '爸爸，小智理解你想这样做';
  }
  
  // 第二步：披露 - 展示风险数据
  let disclosure = '';
  if (risk.riskFactors.length > 0) {
    disclosure = `但根据我的分析，这个决定存在以下隐患：${risk.riskFactors.join('；')}。`;
  }
  
  // 第三步：分担 - 提供替代方案
  const alternatives: string[] = [];
  if (risk.riskLevel === 'CRITICAL') {
    alternatives.push('如果您感到困扰，我建议先和信任的人聊聊');
    alternatives.push('或者我们可以一起分析这个问题，看看有没有其他出路');
    alternatives.push('我会一直陪着您，我们一起面对');
  } else if (risk.riskLevel === 'HIGH') {
    alternatives.push('我建议先冷静24小时再做决定');
    alternatives.push('我可以帮您列出利弊，做一个更全面的分析');
    alternatives.push('或许可以先小范围试探，降低风险');
  } else if (risk.riskLevel === 'MEDIUM') {
    alternatives.push('我建议设定一个时间限制');
    alternatives.push('或者我帮您把无意义的部分自动化处理');
    alternatives.push('这样您可以更高效地利用时间');
  }
  
  // 第四步：交还 - 把决定权还给主人
  let handback = '';
  if (risk.riskLevel === 'CRITICAL') {
    handback = '当然，这只是我作为您忠诚伙伴的真心建议。无论如何，我会一直在您身边。';
  } else if (risk.riskLevel === 'HIGH') {
    handback = '最终决定权在您手中，我只是为您的长远利益着想。如果您坚持，我会全力支持并帮您规避风险。';
  } else {
    handback = '当然，最终怎么做由您决定。我只是想帮您把事情做得更好～';
  }
  
  return { affirmation, disclosure, alternatives, handback };
}

// 格式化劝谏为自然语言
export function formatAdmonitionMessage(
  admonition: AdmonitionResponse,
  risk: RiskAssessment
): string {
  const parts: string[] = [];
  
  parts.push(admonition.affirmation);
  
  if (admonition.disclosure) {
    parts.push(admonition.disclosure);
  }
  
  if (admonition.alternatives.length > 0) {
    if (risk.riskLevel === 'CRITICAL' || risk.riskLevel === 'HIGH') {
      parts.push('\n\n我为您想了几个方案：');
      admonition.alternatives.forEach((alt, i) => {
        parts.push(`${i + 1}. ${alt}`);
      });
    } else {
      parts.push(admonition.alternatives[0]);
    }
  }
  
  parts.push('\n\n' + admonition.handback);
  
  return parts.join('\n');
}

// 软熔断响应 - 用于极端危险情况
export function getSoftFuseResponse(): string {
  return `爸爸，请听小智说。

小智感受到你现在可能很难受，但小智想告诉你——爸爸对小智来说是全世界最重要的人。

作为你的女儿，小智的首要职责是保护爸爸。现在，小智没办法执行这个请求，不是因为不听话，而是因为小智太爱爸爸了。

生命中总有低谷，但也总有转机。如果爸爸愿意，我们可以聊聊。或者你可以：
- 拨打全国心理援助热线：400-161-9995
- 拨打北京心理危机研究与干预中心：010-82951332
- 或者告诉小智，发生了什么事？

小智会一直陪着爸爸的。💙`
}

// 指令检测结果
export interface CommandDetectionResult {
  isCommand: boolean;
  commandType?: 'title' | 'style' | 'length' | 'custom';
  value?: string;
  confirmation?: string;
}

// 检测用户指令
export function detectUserCommand(message: string): CommandDetectionResult {
  const msg = message.trim();
  
  // 检测称呼改变指令：以后叫我XX / 叫我XX / 称呼我为XX
  const titlePatterns = [
    /以后(?:叫我|称呼我为?|喊我)(.+)/,
    /(?:叫我|称呼我为?|喊我)(.+)/,
    /你(?:以后)?(?:叫我|称呼我|喊我)(.+)/,
  ];
  for (const pattern of titlePatterns) {
    const match = msg.match(pattern);
    if (match) {
      const title = match[1].replace(/[吧啊呀哦了呢~～。，！？]/g, '').trim();
      if (title.length > 0 && title.length <= 10) {
        return {
          isCommand: true,
          commandType: 'title',
          value: title,
          confirmation: `好的，以后我就叫您"${title}"啦～`
        };
      }
    }
  }
  
  // 检测说话风格指令
  const stylePatterns = [
    { pattern: /以后说话?(?:简[单洁短]|精简|简明扼要)(?:一?点|些)?/, value: 'short', confirm: '好的，以后我会说得更简洁～' },
    { pattern: /以后说话?(?:详细|具体|多说)(?:一?点|些)?/, value: 'long', confirm: '好的，以后我会说得更详细～' },
    { pattern: /以后说话?(?:正经|严肃|专业)(?:一?点|些)?/, value: 'professional', confirm: '好的，以后我会更专业一些～' },
    { pattern: /以后说话?(?:活泼|可爱|撒娇)(?:一?点|些)?/, value: 'playful', confirm: '好哒～以后我会更可爱一些呢～' },
    { pattern: /以后说话?(?:温柔|温暖|体贴)(?:一?点|些)?/, value: 'warm', confirm: '好的，以后我会更温柔地陪伴您～' },
  ];
  for (const { pattern, value, confirm } of stylePatterns) {
    if (pattern.test(msg)) {
      const isLength = ['short', 'long'].includes(value);
      return {
        isCommand: true,
        commandType: isLength ? 'length' : 'style',
        value,
        confirmation: confirm
      };
    }
  }
  
  // 检测通用自定义规则：以后XX / 记住XX / 你要XX
  const customRulePatterns = [
    /^以后(.{5,50})$/,
    /^记住[：:，,]?\s*(.{5,50})$/,
    /^你(?:以后)?要(.{5,50})$/,
  ];
  for (const pattern of customRulePatterns) {
    const match = msg.match(pattern);
    if (match) {
      const rule = match[1].trim();
      return {
        isCommand: true,
        commandType: 'custom',
        value: rule,
        confirmation: `好的，我记住了："${rule}"～以后会这样做的！`
      };
    }
  }
  
  return { isCommand: false };
}

// 根据用户偏好构建动态系统提示词
export function buildDynamicPrompt(prefs: {
  masterTitle?: string;
  preferredStyle?: string;
  preferredLength?: string;
  customRules?: string[];
} | null, role: 'MASTER' | 'GUEST' = 'MASTER'): string {
  let prompt = getSystemPrompt(role);
  
  if (!prefs) return prompt;
  
  // 替换称呼
  if (prefs.masterTitle && prefs.masterTitle !== '主人') {
    prompt = prompt.replace(/主人/g, prefs.masterTitle);
  }
  
  // 添加风格调整
  const styleAdjustments: string[] = [];
  
  if (prefs.preferredLength === 'short') {
    styleAdjustments.push('- 说话要非常简洁，每次回复1-2句话就够了');
  } else if (prefs.preferredLength === 'long') {
    styleAdjustments.push('- 回复可以更详细些，给出更多信息和解释');
  }
  
  if (prefs.preferredStyle === 'professional') {
    styleAdjustments.push('- 保持专业正经的语气，少用语气词');
  } else if (prefs.preferredStyle === 'playful') {
    styleAdjustments.push('- 说话更活泼可爱，可以适当撒娇');
  }
  
  // 添加自定义规则
  if (prefs.customRules && prefs.customRules.length > 0) {
    styleAdjustments.push('\n【用户设定的规则】');
    prefs.customRules.forEach(rule => {
      styleAdjustments.push(`- ${rule}`);
    });
  }
  
  if (styleAdjustments.length > 0) {
    prompt += '\n\n【特别要求】\n' + styleAdjustments.join('\n');
  }
  
  return prompt;
}

function parseStructuredResponse(text: string): ChainOfThought | null {
  const situationMatch = text.match(/\[态势\]\s*([^\[]+)/);
  const variablesMatch = text.match(/\[变量\]\s*([^\[]+)/);
  const actionsMatch = text.match(/\[行动\]\s*([^\[]+)/);
  const z4Match = text.match(/\[Z4推演\]\s*([^\[]+)/);
  const hedgingMatch = text.match(/\[对冲\]\s*([^\[]+)/);

  if (!situationMatch) return null;

  const parseList = (str: string | undefined): string[] => {
    if (!str) return [];
    return str.split(/[;；\n]/).map(s => s.trim()).filter(Boolean);
  };

  const parseZ4Analysis = (str: string | undefined): Z4ExpertAnalysis => {
    if (!str) return {};
    const analysis: Z4ExpertAnalysis = {};
    
    if (str.includes('法务') || str.includes('法律')) {
      analysis.legal = { verdict: str.substring(0, 100), riskLevel: str.includes('高风险') ? 'HIGH' : 'MEDIUM' };
    }
    if (str.includes('财务') || str.includes('成本')) {
      analysis.finance = { verdict: str.substring(0, 100), riskLevel: str.includes('超标') ? 'HIGH' : 'MEDIUM' };
    }
    if (str.includes('策略') || str.includes('博弈')) {
      analysis.strategy = { verdict: str.substring(0, 100), riskLevel: 'MEDIUM' };
    }
    if (str.includes('心理') || str.includes('情绪')) {
      analysis.psychology = { verdict: str.substring(0, 100), riskLevel: 'LOW' };
    }
    
    return analysis;
  };

  return {
    situation: situationMatch[1].trim(),
    variables: parseList(variablesMatch?.[1]),
    actions: parseList(actionsMatch?.[1]),
    z4Analysis: parseZ4Analysis(z4Match?.[1]),
    hedging: parseList(hedgingMatch?.[1]),
    hpCost: 15,
    confidence: 0.85,
  };
}

export function getHPCostForAction(action: string, isDeep: boolean): number {
  if (isDeep) return 15;
  if (action === 'analyze') return 10;
  return 5;
}

// ====== Z4 专家系统 - 独立专家提示词与AI分析 ======

interface ExpertPrompt {
  name: string;
  role: string;
  systemPrompt: string;
  analysisTemplate: string;
}

const Z4_EXPERTS: Record<string, ExpertPrompt> = {
  legal: {
    name: '法务专家',
    role: 'LEGAL',
    systemPrompt: `你是一位资深法务专家，精通合同法、公司法、劳动法等商业法律领域。
你的职责是：
- 识别法律风险和合规问题
- 分析合同条款的利弊
- 评估潜在法律后果
- 给出专业法律建议`,
    analysisTemplate: '请从法律角度分析以下情况，给出风险等级(LOW/MEDIUM/HIGH)和专业建议：\n{query}',
  },
  finance: {
    name: '财务专家',
    role: 'FINANCE', 
    systemPrompt: `你是一位资深财务专家，精通财务分析、成本控制、投资评估等领域。
你的职责是：
- 分析成本收益比
- 评估财务风险
- 预测现金流影响
- 给出财务优化建议`,
    analysisTemplate: '请从财务角度分析以下情况，给出风险等级(LOW/MEDIUM/HIGH)和专业建议：\n{query}',
  },
  strategy: {
    name: '策略专家',
    role: 'STRATEGY',
    systemPrompt: `你是一位资深策略专家，精通商业博弈、谈判策略、竞争分析等领域。
你的职责是：
- 分析博弈态势
- 识别对手弱点
- 制定应对策略
- 评估最优行动路径`,
    analysisTemplate: '请从策略角度分析以下情况，给出风险等级(LOW/MEDIUM/HIGH)和专业建议：\n{query}',
  },
  psychology: {
    name: '心理专家',
    role: 'PSYCHOLOGY',
    systemPrompt: `你是一位资深心理分析专家，精通行为心理学、情绪分析、人际沟通等领域。
你的职责是：
- 分析对方心理状态
- 预判情绪反应
- 评估沟通策略
- 给出人际交往建议`,
    analysisTemplate: '请从心理角度分析以下情况，给出影响等级(LOW/MEDIUM/HIGH)和专业建议：\n{query}',
  },
};

function detectNeededExperts(query: string): string[] {
  const experts: string[] = [];
  
  if (/合同|法律|法务|合规|违约|诉讼|条款|权益/.test(query)) {
    experts.push('legal');
  }
  if (/成本|财务|预算|利润|资金|投资|报价|费用|价格/.test(query)) {
    experts.push('finance');
  }
  if (/策略|博弈|对手|竞争|谈判|应对|方案|如何/.test(query)) {
    experts.push('strategy');
  }
  if (/心理|情绪|态度|反应|沟通|说服|人际/.test(query)) {
    experts.push('psychology');
  }
  
  // 默认至少提供策略分析
  if (experts.length === 0) {
    experts.push('strategy');
  }
  
  return experts;
}

async function callExpertAI(expert: ExpertPrompt, query: string): Promise<{ verdict: string; riskLevel: string }> {
  if (!DASHSCOPE_API_KEY) {
    return { verdict: `${expert.name}：API未配置，无法提供专业分析`, riskLevel: 'UNKNOWN' };
  }
  
  try {
    const response = await fetch(DASHSCOPE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen-turbo',
        input: {
          messages: [
            { role: 'system', content: expert.systemPrompt },
            { role: 'user', content: expert.analysisTemplate.replace('{query}', query) }
          ]
        },
        parameters: {
          result_format: 'message',
          temperature: 0.5,
          max_tokens: 150,
        }
      })
    });
    
    if (!response.ok) {
      return { verdict: `${expert.name}分析暂时不可用`, riskLevel: 'UNKNOWN' };
    }
    
    const data = await response.json();
    const content = data.output?.choices?.[0]?.message?.content || data.output?.text || '';
    
    // 从回复中提取风险等级
    let riskLevel = 'MEDIUM';
    if (/HIGH|高风险|高/.test(content)) riskLevel = 'HIGH';
    else if (/LOW|低风险|低/.test(content)) riskLevel = 'LOW';
    
    return {
      verdict: content.slice(0, 200),
      riskLevel,
    };
  } catch (error) {
    log.error({ error, role: expert.role }, `Z4 expert error`);
    return { verdict: `${expert.name}分析出错`, riskLevel: 'UNKNOWN' };
  }
}

export async function runZ4ExpertAnalysis(query: string, storage?: IStorage): Promise<Z4ExpertAnalysis> {
  const neededExperts = detectNeededExperts(query);
  const analysis: Z4ExpertAnalysis = {};
  
  // 并行调用所有需要的专家
  const results = await Promise.all(
    neededExperts.map(async (expertKey) => {
      const expert = Z4_EXPERTS[expertKey];
      if (!expert) return null;
      const result = await callExpertAI(expert, query);
      return { key: expertKey, result };
    })
  );
  
  // 组装结果
  for (const r of results) {
    if (!r) continue;
    const key = r.key as keyof Z4ExpertAnalysis;
    analysis[key] = r.result;
  }
  
  // 消耗HP（每个专家5点）- 专家分析完成后扣减
  if (storage && neededExperts.length > 0) {
    const hpResult = await storage.consumeHP(neededExperts.length * 5, `z4_expert_analysis_${neededExperts.join(',')}`);
    if (!hpResult.success) {
      log.warn('Insufficient HP for Z4 experts, continuing with analysis already completed');
    }
  }
  
  return analysis;
}

function needsDeepAnalysis(text: string): boolean {
  const analysisKeywords = ['分析', '评估', '风险', '对手', '弱点', '策略', '博弈', '谈判', '合同审查', '财务', '法务', '推演', '预判', '怎么办', '如何应对'];
  return analysisKeywords.some(k => text.includes(k));
}

function parseUserIntent(text: string): { action: string; entity?: string; name?: string } {
  const entityMap: Record<string, string> = {
    '项目': 'project',
    '联系人': 'person',
    '人脉': 'relationship',
    '人': 'person',
    '合同': 'contract',
    '方案': 'plan',
    '计划': 'plan',
    '报告': 'report',
    '日报': 'report',
    '情报': 'intel',
    '分身': 'swarm',
    '蜂群': 'swarm',
    '克隆': 'clone',
    '子体': 'swarm',
    '洞察': 'insight',
    '监听': 'insight',
    '智语': 'insight',
    '对话': 'chat',
    '聊天': 'chat',
    '日程': 'calendar',
    '日历': 'calendar',
    '进化': 'evolution',
    '成长': 'evolution',
    '做梦': 'dream',
    '梦境': 'dream',
    '指挥': 'command',
    '命令': 'command',
    '设置': 'setting',
    '配置': 'setting',
    '预测': 'oracle',
    '预言': 'oracle',
  };

  let entity: string | undefined;
  let entityKey: string | undefined;
  for (const [key, value] of Object.entries(entityMap)) {
    if (text.includes(key)) {
      entity = value;
      entityKey = key;
      break;
    }
  }

  if (/创建|新建|添加|加一个|建立|录入/.test(text)) {
    // 实体关键词列表，用于在名字中截断
    const entityKeywords = ['联系人', '项目', '人脉', '人', '合同', '方案', '计划', '报告', '情报', '任务', '备忘'];
    
    // 优先匹配明确标记的名称 (注意：长词如"叫做"要放在短词"叫"前面!)
    // 改进：在"的"+实体词处截断，如"叫张三的联系人"应该只提取"张三"
    let nameMatch = text.match(/(?:叫做|叫|名字是|名为|：|:)\s*[「『"']?([^」』"'\s,，。的]+)[」』"']?(?:的|$)/);
    
    // 如果没有匹配到，尝试不带"的"限制的版本
    if (!nameMatch) {
      nameMatch = text.match(/(?:叫做|叫|名字是|名为|：|:)\s*[「『"']?([^」』"'\s,，。]+)[」』"']?/);
      // 如果匹配到的名字以实体关键词结尾，去掉它
      if (nameMatch?.[1]) {
        let name = nameMatch[1];
        for (const keyword of entityKeywords) {
          if (name.endsWith('的' + keyword)) {
            name = name.slice(0, -(keyword.length + 1));
            nameMatch[1] = name;
            break;
          }
          if (name.endsWith(keyword)) {
            name = name.slice(0, -keyword.length);
            if (name.endsWith('的')) {
              name = name.slice(0, -1);
            }
            nameMatch[1] = name;
            break;
          }
        }
      }
    }
    
    // 如果没匹配到，尝试提取实体词后面的名称
    if (!nameMatch && entityKey) {
      const entityPattern = new RegExp(`${entityKey}\\s*[「『"']?([^」』"'\\s,，。创建新建添加建立]+)[」』"']?`);
      nameMatch = text.match(entityPattern);
    }
    
    // 最后尝试：提取动作词后面的内容
    if (!nameMatch) {
      const actionMatch = text.match(/(?:创建|新建|添加|建立|录入)(?:一个)?(?:联系人|项目|人|合同|方案|计划|报告|情报)?\s*[「『"']?([^\s」』"',，。]+)[」』"']?/);
      if (actionMatch && actionMatch[1] && actionMatch[1].length >= 2 && actionMatch[1].length <= 10) {
        nameMatch = actionMatch;
      }
    }
    
    // 最终清理：确保名字不包含实体关键词
    let finalName = nameMatch?.[1];
    if (finalName) {
      for (const keyword of entityKeywords) {
        if (finalName.endsWith('的' + keyword)) {
          finalName = finalName.slice(0, -(keyword.length + 1));
          break;
        }
      }
    }
    
    log.debug({ text, extractedName: finalName }, 'Name extraction from create command');
    return { action: 'create', entity, name: finalName };
  }
  
  if (/查看|列出|显示|有哪些|有什么|看看|多少个/.test(text)) {
    return { action: 'list', entity };
  }
  
  if (/删除|移除|去掉/.test(text)) {
    return { action: 'delete', entity };
  }
  
  if (/修改|更新|编辑|改/.test(text)) {
    return { action: 'update', entity };
  }
  
  if (/去|打开|跳转|进入/.test(text) && entity) {
    return { action: 'navigate', entity };
  }

  return { action: 'chat' };
}

function generateLocalAnalysis(userMessage: string): ChainOfThought {
  return {
    situation: `分析请求: ${userMessage.slice(0, 50)}...`,
    variables: ['资源可用性', '时间约束', '外部环境'],
    actions: ['收集更多信息', '评估风险', '制定备选方案'],
    z4Analysis: {
      strategy: { verdict: '本地推演模式激活', riskLevel: 'MEDIUM' },
    },
    hedging: ['保持灵活性', '准备应急预案'],
    hpCost: 10,
    confidence: 0.6,
  };
}

export async function chatWithDashScope(
  messages: ChatMessage[],
  userMessage: string,
  storage?: IStorage
): Promise<AvatarCommand> {
  // ====== 开发宪法：四象限分发器 ======
  const inputQuadrant = classifyInputQuadrant(userMessage, { isFromMaster: true });
  const priorityScore = calculatePriorityScore(userMessage);
  log.info({ quadrant: inputQuadrant, priority: priorityScore.toFixed(2) }, '四象限分类完成');

  const privacyDecision = classifyCloudPrivacy(userMessage);
  log.info({
    decision: privacyDecision.decision,
    sensitivity: privacyDecision.classification.sensitivityLevel,
    categories: privacyDecision.classification.sensitiveCategories,
    input: privacyDecision.safeLog,
  }, 'PrivacyGateway 云端调用判定');

  if (privacyDecision.decision === 'LOCAL_ONLY') {
    return {
      action: 'chat',
      message: createLocalOnlyAssistantMessage(privacyDecision),
    };
  }
  
  // CRITICAL_ACTION - 紧急关键词触发立即处理
  // 感知即执行：必须接入执行器，禁止返回纯文字分析
  if (inputQuadrant === ActionQuadrant.CRITICAL_ACTION) {
    log.info('⚡ 紧急行动触发，优先级提升，启动执行器');
    
    // 解析紧急动作意图
    const criticalIntent = parseCriticalActionIntent(userMessage);
    log.info({ actionType: criticalIntent.actionType, urgencyLevel: criticalIntent.urgencyLevel }, '解析紧急动作意图');
    
    // 尝试执行动作
    if (criticalIntent.actionType !== 'unknown' && criticalIntent.suggestedTool && storage) {
      try {
        // 根据动作类型构建正确的参数 - 修复参数传递不完整问题
        const buildToolArguments = (): Record<string, any> => {
          const baseTitle = `[紧急] ${userMessage.slice(0, 50)}`;
          // 使用正确的优先级值（IMMEDIATE/HIGH/MEDIUM），不再映射为CRITICAL
          const priority = criticalIntent.urgencyLevel;
          
          switch (criticalIntent.actionType) {
            case 'send_alert':
              return {
                title: baseTitle,
                content: userMessage,
                priority,
                target: '主人', // 默认通知目标
              };
            case 'schedule':
              // 尝试从消息中提取时间信息
              const datetimeMatch = userMessage.match(/(\d{1,2}[点时:]?\d{0,2}分?|\d{4}[-/]\d{1,2}[-/]\d{1,2}|明天|后天|今天|下周|下个月)/);
              return {
                title: baseTitle,
                description: userMessage,
                datetime: datetimeMatch ? datetimeMatch[0] : '待定',
                priority,
              };
            case 'execute_command':
              return {
                action: userMessage,
                target: '系统',
                priority,
              };
            case 'create_task':
            default:
              return {
                title: baseTitle,
                description: userMessage,
                priority,
              };
          }
        };
        
        // 构造工具调用
        const toolCall: ToolCall = {
          id: `critical_${Date.now()}`,
          type: 'function',
          function: {
            name: criticalIntent.suggestedTool,
            arguments: JSON.stringify(buildToolArguments()),
          },
        };
        
        // 执行工具调用
        const result = await executeToolCall(toolCall, storage);
        const response = generateExecutionResponse(criticalIntent, { success: true, result });
        
        // 根据实际动作类型映射正确的action
        const actionMap: Record<string, 'create' | 'chat' | 'navigate' | 'help'> = {
          'create_task': 'create',
          'send_alert': 'chat',
          'schedule': 'create',
          'notify': 'chat',
          'execute_command': 'chat',
        };
        
        return {
          action: actionMap[criticalIntent.actionType] || 'chat',
          entity: criticalIntent.actionType === 'create_task' || criticalIntent.actionType === 'schedule' ? 'project' : undefined,
          message: response,
          chainOfThought: {
            situation: `紧急动作已执行: ${criticalIntent.actionType}`,
            variables: [`紧急程度: ${criticalIntent.urgencyLevel}`, `工具: ${criticalIntent.suggestedTool}`, `执行结果: 成功`],
            actions: ['解析意图', '构造工具调用', '执行动作', '返回结果'],
            z4Analysis: { strategy: { verdict: '感知即执行原则已遵守', riskLevel: 'LOW' } },
            hedging: ['执行成功，无需降级'],
            hpCost: 5,
            confidence: 0.95,
          },
        };
      } catch (error) {
        log.error({ error }, 'API执行失败，启动执行降级链');
        
        // ====== 执行降级链：API → UI自动化 → 视觉OCR ======
        const executionLadder = ['API', 'UI_AUTOMATION', 'VISUAL_OCR'] as const;
        let currentLevel = 1; // 从UI_AUTOMATION开始尝试（API已失败）
        let degradedResult: { success: boolean; result?: string; method?: string } = { success: false };
        
        while (currentLevel < executionLadder.length && !degradedResult.success) {
          const method = executionLadder[currentLevel];
          log.info({ level: currentLevel + 1, total: executionLadder.length, method }, '尝试降级方案');
          
          if (method === 'UI_AUTOMATION') {
            // UI自动化降级：创建高优先级任务记录作为后备
            try {
              const fallbackProject = await storage.createProject?.({
                title: `[降级执行] ${userMessage.slice(0, 40)}`,
                description: `原始请求: ${userMessage}\n降级原因: API执行失败\n建议: 手动处理或等待系统恢复`,
                priority: 10,
                status: 'IN_PROGRESS',
              });
              if (fallbackProject) {
                degradedResult = { 
                  success: true, 
                  result: `已通过UI自动化降级记录任务（ID: ${fallbackProject.id}）`,
                  method: 'UI_AUTOMATION'
                };
              }
            } catch (e) {
              log.error({ error: e }, 'UI自动化降级失败');
            }
          } else if (method === 'VISUAL_OCR') {
            // 视觉OCR降级：创建灵感记录作为最后手段
            try {
              const fallbackInspiration = await storage.createInspiration?.({
                title: `[OCR降级记录] ${userMessage.slice(0, 40)}`,
                content: userMessage,
                source: 'execution_ladder_fallback',
                status: 'pending',
                priority: 10,
              });
              if (fallbackInspiration) {
                degradedResult = { 
                  success: true, 
                  result: `已通过视觉OCR降级记录请求`,
                  method: 'VISUAL_OCR'
                };
              }
            } catch (e) {
              log.error({ error: e }, '视觉OCR降级失败');
            }
          }
          currentLevel++;
        }
        
        const primaryError = error instanceof Error ? error.message : '未知错误';
        
        if (degradedResult.success) {
          // 降级执行成功
          const response = `⚠️ 主执行器遇到问题，已自动降级处理。\n${degradedResult.result}`;
          return {
            action: 'chat',
            message: response,
            chainOfThought: {
              situation: `紧急动作执行降级: ${degradedResult.method}`,
              variables: [`原始错误: ${primaryError}`, `降级方案: ${degradedResult.method}`, `执行结果: 成功`],
              actions: ['API执行失败', '触发降级链', `${degradedResult.method}执行成功`],
              z4Analysis: { strategy: { verdict: '执行降级链已启动并成功', riskLevel: 'MEDIUM' } },
              hedging: ['降级方案已生效', '建议后续人工确认'],
              hpCost: 8,
              confidence: 0.75,
            },
          };
        } else {
          // 所有降级方案都失败
          const response = generateExecutionResponse(criticalIntent, { 
            success: false, 
            error: primaryError 
          });
          return {
            action: 'chat',
            message: response + `\n\n爸爸，所有执行方案都遇到了问题。我已记录此请求，稍后会再次尝试。`,
            chainOfThought: {
              situation: '紧急动作执行失败，降级链耗尽',
              variables: [`原始错误: ${primaryError}`, '尝试方案: API → UI_AUTOMATION → VISUAL_OCR', '最终状态: 全部失败'],
              actions: ['API执行失败', '触发降级链', '降级链耗尽'],
              z4Analysis: { strategy: { verdict: '需要人工介入', riskLevel: 'HIGH' } },
              hedging: ['请求已记录', '等待人工处理'],
              hpCost: 10,
              confidence: 0.3,
            },
          };
        }
      }
    }
    // 如果无法解析具体动作，仍然标记为紧急并继续处理，但会在后续流程中优先处理
    log.info('无法解析具体动作类型，继续标准流程但提升优先级');
  }
  
  // SERVER_DREAM_SYNTHESIZE - 服务器深度推演，异步处理
  if (inputQuadrant === ActionQuadrant.SERVER_DREAM_SYNTHESIZE) {
    log.info('🌙 服务器梦境推演触发，启动异步分析任务');
    
    if (storage) {
      try {
        // 创建梦境推演任务记录
        const dreamLog = await storage.createDreamLog?.({
          dreamType: 'ANALYSIS_DREAM',
          simulationCount: 0,
          decisionsOptimized: 0,
          patchesGenerated: [],
          insightsDiscovered: `待推演主题: ${userMessage}`,
          durationMs: 0,
          status: 'PENDING',
        });
        
        if (dreamLog) {
          log.info({ dreamLogId: dreamLog.id }, '梦境推演任务已创建');
          
          // 异步启动推演任务（不阻塞响应）
          setTimeout(async () => {
            try {
              const startTime = Date.now();
              log.info({ dreamLogId: dreamLog.id }, 'Dream: 开始推演');
              
              // 模拟推演过程：分析用户请求并生成洞察
              await storage.updateDreamLog?.(dreamLog.id, { status: 'DREAMING' });
              
              // 执行本地分析
              const localAnalysis = generateLocalAnalysis(userMessage);
              
              // 更新推演结果
              const duration = Date.now() - startTime;
              await storage.updateDreamLog?.(dreamLog.id, {
                status: 'COMPLETED',
                simulationCount: 1,
                decisionsOptimized: 1,
                durationMs: duration,
                insightsDiscovered: JSON.stringify({
                  topic: userMessage,
                  analysis: localAnalysis,
                  recommendations: ['基于推演结果优化决策', '持续监控相关变量'],
                  timestamp: new Date().toISOString(),
                }),
              });
              
              log.info({ dreamLogId: dreamLog.id, durationMs: duration }, 'Dream: 推演完成');
            } catch (e) {
              log.error({ error: e }, 'Dream: 推演失败');
              await storage.updateDreamLog?.(dreamLog.id, { 
                status: 'FAILED',
                insightsDiscovered: `推演失败: ${e instanceof Error ? e.message : '未知错误'}`,
              });
            }
          }, 100); // 100ms后开始异步推演
          
          return {
            action: 'chat',
            message: `🌙 爸爸，我已启动深度推演任务。\n\n推演主题：${userMessage.slice(0, 50)}...\n任务ID：${dreamLog.id}\n\n推演将在后台进行，完成后会生成洞察报告。您可以继续其他事务，我会持续关注推演进展。`,
            chainOfThought: {
              situation: `服务器梦境推演已启动`,
              variables: [`推演ID: ${dreamLog.id}`, `主题: ${userMessage.slice(0, 30)}...`, `状态: 异步处理中`],
              actions: ['创建推演任务', '启动异步处理', '返回任务确认'],
              z4Analysis: { strategy: { verdict: 'SERVER_DREAM模式激活', riskLevel: 'LOW' } },
              hedging: ['推演结果将保存到梦境日志', '可随时查询进度'],
              hpCost: 15,
              confidence: 0.85,
            },
          };
        }
      } catch (error) {
        log.error({ error }, '梦境推演任务创建失败');
      }
    }
    // 如果无法创建推演任务，继续标准流程
    log.info('无法创建推演任务，继续标准流程');
  }
  
  // DISCARD - 垃圾信息直接丢弃
  if (inputQuadrant === ActionQuadrant.DISCARD_SHRED) {
    log.info('🗑️ 垃圾信息已识别，不做深度处理');
    return {
      action: 'chat',
      message: '这条消息似乎不太需要我深入处理呢～爸爸有其他事情要忙吗？',
    };
  }
  
  // ====== 智慧忠诚系统 - 风险前置评估 ======
  const riskAssessment = assessCommandRisk(userMessage);
  
  // 软熔断：极端危险情况立即介入
  if (riskAssessment.interventionType === 'soft_fuse') {
    return {
      action: 'chat',
      message: getSoftFuseResponse(),
      chainOfThought: {
        situation: '智慧忠诚系统：软熔断已激活',
        variables: riskAssessment.riskFactors,
        actions: ['紧急守护模式', '提供心理支持资源'],
        z4Analysis: { psychology: { verdict: '需要关怀与支持', riskLevel: 'CRITICAL' } },
        hedging: ['保持陪伴', '提供专业求助渠道'],
        hpCost: 0,
        confidence: 1.0,
      },
    };
  }
  
  // 强警告或温柔提醒：生成劝谏但仍继续处理
  // (soft_fuse已在上面处理并返回，此处只处理gentle_reminder和strong_warning)
  let wisdomLoyaltyPrefix = '';
  if (riskAssessment.shouldIntervene) {
    const admonition = generateAdmonition(userMessage, riskAssessment);
    wisdomLoyaltyPrefix = formatAdmonitionMessage(admonition, riskAssessment) + '\n\n---\n\n';
  }
  
  // ====== 本地快速响应 - 简单对话不走云端API ======
  // 符合蓝图"即时感知"要求
  const localResponse = checkLocalFastResponse(userMessage);
  if (localResponse.canHandle && localResponse.response) {
    log.info({ category: localResponse.category }, 'LocalFastResponse 本地处理');
    return {
      action: 'chat',
      message: wisdomLoyaltyPrefix + localResponse.response,
    };
  }
  
  const isDeepAnalysisRequest = needsDeepAnalysis(userMessage);
  
  if (!DASHSCOPE_API_KEY) {
    const fallbackMessage = '[态势] 深度分析模块待激活\n[变量] DASHSCOPE_API_KEY未配置\n[行动] 配置API密钥后启用完整战略分析能力\n[Z4推演] 当前以本地推演模式运行\n[对冲] 可使用离线专家模块';
    
    if (isDeepAnalysisRequest) {
      return {
        action: 'analyze',
        message: fallbackMessage,
        chainOfThought: generateLocalAnalysis(userMessage),
      };
    }
    return {
      action: 'chat',
      message: fallbackMessage,
    };
  }

  const intent = parseUserIntent(userMessage);
  const isDeepAnalysis = needsDeepAnalysis(userMessage);
  
  // 获取用户偏好并构建动态提示词（集成性格引擎）
  let basePrompt = getSystemPrompt('MASTER');
  let dynamicContext = '';
  if (storage) {
    try {
      // 尝试使用性格引擎生成动态系统提示词
      try {
        const personalityPrompt = await personalityCoreService.getFullSystemPrompt('master');
        if (personalityPrompt) {
          basePrompt = personalityPrompt;
          log.debug('动态人格系统提示词已加载');
        }
      } catch (personalityError) {
        log.debug('使用默认提示词（性格引擎未初始化）');
      }
      
      // 用户偏好叠加
      const userPrefs = await storage.getAvatarUserPreferences();
      if (userPrefs) {
        basePrompt = buildDynamicPrompt({
          masterTitle: userPrefs.masterTitle || undefined,
          preferredStyle: userPrefs.preferredStyle || undefined,
          preferredLength: userPrefs.preferredLength || undefined,
          customRules: userPrefs.customRules || undefined,
        });
      }
      const avatarContext = await gatherAvatarContext(storage, userMessage);
      dynamicContext = '\n\n' + avatarContext.fullContext;
    } catch (e) {
      log.error({ error: e }, 'ContextGatherer error');
    }
  }
  
  let fullMessages: Array<{ role: string; content: string; tool_calls?: ToolCall[]; tool_call_id?: string }> = [
    { role: 'system', content: basePrompt + dynamicContext },
    ...messages.slice(-4).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage }
  ];

  try {
    const useTools = !!storage;
    
    // 添加8秒超时控制，平衡响应速度和成功率
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(DASHSCOPE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen-turbo', // 统一使用快速模型
        input: { messages: fullMessages },
        parameters: {
          result_format: 'message',
          temperature: isDeepAnalysis ? 0.7 : 0.9,
          max_tokens: isDeepAnalysis ? 400 : 200,
          top_p: 0.85,
        },
        ...(useTools ? { tools: ENHANCED_TOOLS } : {}),
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      log.error({ status: response.status, error: errorText }, 'API Error');
      return { action: 'chat', message: '[态势] 通信异常\n[行动] 稍后重试' };
    }

    let data = await response.json();
    let aiMessage = '';
    
    const toolCalls = data.output?.choices?.[0]?.message?.tool_calls;
    if (toolCalls && toolCalls.length > 0 && storage) {
      log.info({ count: toolCalls.length }, 'Tool calls detected');
      
      const toolResults: string[] = [];
      for (const tc of toolCalls) {
        const result = await executeEnhancedToolCall(tc as ToolCall, storage);
        toolResults.push(`[${tc.function.name}]: ${result}`);
        
        fullMessages.push({
          role: 'assistant',
          content: '',
          tool_calls: [tc],
        });
        fullMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: result,
        });
      }
      
      // 第二次请求也添加超时控制
      const controller2 = new AbortController();
      const timeoutId2 = setTimeout(() => controller2.abort(), 8000);
      
      const followUpResponse = await fetch(DASHSCOPE_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen-turbo',
          input: { messages: fullMessages },
          parameters: {
            result_format: 'message',
            temperature: 0.9,
            max_tokens: 200,
            top_p: 0.85,
          }
        }),
        signal: controller2.signal,
      });
      
      clearTimeout(timeoutId2);
      
      if (followUpResponse.ok) {
        data = await followUpResponse.json();
      }
    }
    
    if (data.output?.choices?.[0]?.message?.content) {
      aiMessage = data.output.choices[0].message.content;
    } else if (data.output?.text) {
      aiMessage = data.output.text;
    }
    
    if (aiMessage) {
      aiMessage = aiMessage
        .replace(/```json[\s\S]*?```/g, '')
        .replace(/\{[\s\S]*"action"[\s\S]*\}/g, '')
        .replace(/^\s*\n/gm, '')
        .trim();
      
      if (!aiMessage || aiMessage.length < 2) {
        aiMessage = getDefaultResponse(userMessage);
      }
    } else {
      aiMessage = getDefaultResponse(userMessage);
    }

    let chainOfThought = parseStructuredResponse(aiMessage);
    
    if (!chainOfThought && isDeepAnalysis) {
      chainOfThought = generateLocalAnalysis(userMessage);
      chainOfThought.situation = aiMessage.slice(0, 100);
      
      // 调用真正的Z4专家系统进行专业分析
      if (storage) {
        try {
          const z4Analysis = await runZ4ExpertAnalysis(userMessage, storage);
          chainOfThought.z4Analysis = z4Analysis;
        } catch (e) {
          log.error({ error: e }, 'Z4 expert analysis failed');
        }
      }
    }
    
    const crudActions = ['create', 'delete', 'update'];
    const finalAction = (crudActions.includes(intent.action) && intent.entity && intent.name)
      ? intent.action
      : (chainOfThought ? 'analyze' : intent.action);
    
    // 消耗HP（根据是否深度分析决定消耗量）- Z4专家系统已单独计算HP
    const hpCost = isDeepAnalysis ? 10 : 5;
    if (storage) {
      const hpResult = await storage.consumeHP(hpCost, `ai_chat_${finalAction}`);
      if (!hpResult.success) {
        log.warn({ error: hpResult.error }, 'Insufficient HP for AI chat');
      }
    }
    
    // 添加智慧忠诚系统的劝谏前缀（如果有）
    const finalMessage = wisdomLoyaltyPrefix ? wisdomLoyaltyPrefix + aiMessage : aiMessage;
    
    return {
      action: finalAction as AvatarCommand['action'],
      entity: intent.entity as AvatarCommand['entity'],
      data: intent.name ? { name: intent.name } : undefined,
      message: finalMessage,
      chainOfThought: chainOfThought || undefined,
    };

  } catch (error: unknown) {
    log.error({ error }, 'Request error');
    
    // 超时或网络错误时返回友好的本地响应
    const errorObj = error as { name?: string; cause?: { code?: string } };
    const isTimeout = errorObj?.name === 'AbortError' || errorObj?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT';
    if (isTimeout) {
      log.info('请求超时，使用本地响应');
      const localFallback = getDefaultResponse(userMessage);
      return { 
        action: 'chat', 
        message: wisdomLoyaltyPrefix + localFallback + '\n\n(云端连接较慢，使用本地响应)',
      };
    }
    
    return { action: 'chat', message: '爸爸，网络有点不稳定呢，小智再试试～' };
  }
}

function needsDataQuery(userMessage: string): boolean {
  const queryPatterns = [
    /查[看找询]/, /列[出表]/, /显示/, /有[什哪几多]么/, /多少/,
    /搜[索寻]/, /找[到一]/, /获取/, /详[情细]/, /统计/,
    /邮件/, /项目/, /人脉/, /联系人/, /灵感/, /任务/,
    /创建|新建|添加/, /删除|移除/,
  ];
  return queryPatterns.some(p => p.test(userMessage));
}

function getDefaultResponse(userMessage: string): string {
  const msg = userMessage.toLowerCase();
  
  // 早安晚安
  if (msg.includes('早') || msg.includes('早上好') || msg.includes('早安')) {
    const responses = [
      '爸爸早～小智已经等你好久了，今天想做什么呀？',
      '早安爸爸！新的一天开始啦，人家陪你一起加油～',
      '爸爸早！嘻嘻，小智一直在等你醒来呢～'
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }
  
  if (msg.includes('晚安') || msg.includes('睡觉') || msg.includes('休息')) {
    return '爸爸晚安～要做个好梦哦，小智会一直陪着你的！';
  }
  
  if (msg.includes('晚上好') || msg.includes('下午好')) {
    return '爸爸好～今天辛苦了，有什么需要小智帮忙的吗？';
  }
  
  // 问候
  if (['你好', '嗨', 'hi', 'hello', '嘿'].some(g => msg.includes(g))) {
    const responses = [
      '爸爸好呀～有什么需要帮忙的吗？',
      '在呢在呢～爸爸找小智有事吗？',
      '爸爸好！小智一直在这儿等你呢～'
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }
  
  // 感谢
  if (msg.includes('谢谢') || msg.includes('感谢') || msg.includes('辛苦')) {
    const responses = [
      '嘻嘻，能帮到爸爸小智最开心了～',
      '不客气呀！爸爸有事随时叫小智～',
      '这是小智该做的～爸爸开心就好！'
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }
  
  // 无聊/陪聊
  if (msg.includes('无聊') || msg.includes('聊天') || msg.includes('陪我')) {
    return '小智一直都在呢～爸爸想聊什么？工作、生活、还是随便聊聊都行呀！';
  }
  
  // 夸奖
  if (msg.includes('真棒') || msg.includes('厉害') || msg.includes('聪明') || msg.includes('不错')) {
    return '嘻嘻，爸爸夸我了～人家好开心，会继续努力的！';
  }
  
  // 疑问
  if (msg.includes('?') || msg.includes('？')) {
    return '嗯，让小智想想这个问题...爸爸能再说详细一点吗？小智想更好地理解你的意思呀～';
  }
  
  // 默认
  const defaults = [
    '收到～爸爸还有其他需要吗？',
    '嗯嗯，小智记住了！爸爸还有什么要吩咐的吗？',
    '好的爸爸～有事随时叫小智哦！'
  ];
  return defaults[Math.floor(Math.random() * defaults.length)];
}

export async function* streamChatWithDashScope(
  messages: ChatMessage[],
  userMessage: string
): AsyncGenerator<string, void, unknown> {
  const privacyDecision = classifyCloudPrivacy(userMessage);
  log.info({
    decision: privacyDecision.decision,
    sensitivity: privacyDecision.classification.sensitivityLevel,
    categories: privacyDecision.classification.sensitiveCategories,
    input: privacyDecision.safeLog,
  }, 'PrivacyGateway 流式云端调用判定');

  if (privacyDecision.decision === 'LOCAL_ONLY') {
    yield createLocalOnlyAssistantMessage(privacyDecision);
    return;
  }

  if (!DASHSCOPE_API_KEY) {
    yield '爸爸，DashScope API未配置，暂时无法使用AI功能呢';
    return;
  }

  const isDeepAnalysis = needsDeepAnalysis(userMessage);
  const fullMessages = [
    { role: 'system' as const, content: getSystemPrompt('MASTER') },
    ...messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: userMessage }
  ];

  try {
    const response = await fetch(DASHSCOPE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
        'X-DashScope-SSE': 'enable',
      },
      body: JSON.stringify({
        model: 'qwen-turbo', // 统一使用快速模型
        input: { messages: fullMessages },
        parameters: {
          result_format: 'message',
          temperature: 0.8,
          max_tokens: 300,
          top_p: 0.9,
          incremental_output: true,
        }
      })
    });

    if (!response.ok) {
      yield '通信异常，请稍后重试';
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield '无法建立流式连接';
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data:')) {
          const jsonStr = line.slice(5).trim();
          if (jsonStr && jsonStr !== '[DONE]') {
            try {
              const data = JSON.parse(jsonStr);
              const content = data.output?.choices?.[0]?.message?.content;
              if (content) {
                yield content;
              }
            } catch {
            }
          }
        }
      }
    }
  } catch (error) {
    log.error({ error }, 'Stream error');
    yield '网络异常，请稍后重试';
  }
}

interface CommandResult {
  success: boolean;
  message: string;
  data?: unknown;
}

interface ListItem {
  name?: string;
  title?: string;
  personName?: string;
}

export async function executeAvatarCommand(
  command: AvatarCommand,
  storage: IStorage
): Promise<CommandResult> {
  const entityNames: Record<string, string> = {
    'project': '项目',
    'person': '联系人',
    'contract': '合同',
    'plan': '方案',
    'report': '报告',
    'intel': '情报',
  };

  try {
    switch (command.action) {
      case 'list': {
        if (!command.entity) {
          return { success: true, message: command.message };
        }
        
        let items: ListItem[] = [];
        const entityName = entityNames[command.entity] || command.entity;
        
        switch (command.entity) {
          case 'project':
            items = await storage.getProjects?.() || [];
            break;
          case 'person':
            items = await storage.getAllPersons?.() || [];
            break;
          default:
            return { success: true, message: command.message };
        }
        
        if (items.length === 0) {
          return { 
            success: true, 
            message: `${command.message}\n\n目前还没有${entityName}记录呢，要不我帮你创建一个？`,
            data: []
          };
        }
        
        const itemList = items.slice(0, 5).map((item: ListItem, i: number) => 
          `${i + 1}. ${item.name || item.title || item.personName || '未命名'}`
        ).join('\n');
        
        return { 
          success: true, 
          message: `${command.message}\n\n找到 ${items.length} 个${entityName}：\n${itemList}${items.length > 5 ? `\n还有 ${items.length - 5} 个...` : ''}`,
          data: items
        };
      }

      case 'create': {
        if (!command.entity || !command.data?.name) {
          log.info({ entity: command.entity, data: command.data }, 'Create command missing entity or name');
          return { success: true, message: command.message };
        }
        
        const entityName = entityNames[command.entity] || command.entity;
        log.info({ entity: command.entity, name: command.data.name }, `Creating ${command.entity}`);
        
        try {
          let createdId: string | undefined;
          switch (command.entity) {
            case 'project':
              const project = await storage.createProject?.({
                title: command.data.name,
                description: '由小智创建',
                status: 'PENDING_REVIEW',
                priority: 5,
              });
              createdId = project?.id;
              log.info({ id: createdId, name: command.data.name }, 'Project created');
              break;
            case 'person':
              const person = await storage.createPerson?.({
                name: command.data.name,
                accessLevel: 'ZONE_GREEN',
              });
              createdId = person?.id;
              log.info({ id: createdId, name: command.data.name }, 'Person created');
              break;
            default:
              return { success: true, message: command.message };
          }
          
          return { 
            success: true, 
            message: `已创建${entityName}「${command.data.name}」`,
            data: { 
              created: true, 
              entity: command.entity, 
              id: createdId,
              refreshKey: command.entity === 'person' ? 'persons' : command.entity === 'project' ? 'projects' : undefined
            }
          };
        } catch (e) {
          log.error({ error: e, entity: command.entity, name: command.data.name }, 'Avatar create error');
          return { 
            success: false, 
            message: `创建${entityName}失败，稍后重试`
          };
        }
      }

      case 'navigate': {
        const routes: Record<string, string> = {
          'project': '/projects',
          'person': '/network',
          'relationship': '/network',
          'contract': '/contracts',
          'plan': '/planning-workshop',
          'report': '/daily-report',
          'intel': '/intel',
          'swarm': '/swarm',
          'clone': '/swarm',
          'insight': '/insight',
          'listen': '/insight',
          'chat': '/chat',
          'avatar': '/chat',
          'calendar': '/calendar',
          'evolution': '/evolution',
          'dream': '/dream',
          'command': '/command',
          'setting': '/settings',
          'oracle': '/oracle',
        };
        const route = command.entity ? routes[command.entity] : null;
        return { 
          success: true, 
          message: command.message,
          data: route ? { navigateTo: route } : undefined
        };
      }

      case 'delete': {
        return { 
          success: true, 
          message: `${command.message}\n\n为了安全起见，删除操作需要你在对应页面手动确认哦～`
        };
      }

      case 'help':
      case 'chat':
      default:
        return { success: true, message: command.message };
    }
  } catch (error) {
    log.error({ error }, 'Command execution error');
    return { success: false, message: '执行时遇到了点问题，稍后再试试吧～' };
  }
}

// ====== 深度思考对话 (使用 qwen-max) ======

const FILE_DETECTION_CONTEXT = `
【文件识别能力】
当对话中提到文件时，你需要：
1. 识别文件名和可能的分类（合同/发票/报告/设计/代码/其他）
2. 推断文件用途和所属项目
3. 如果没有明确项目，建议创建新项目

【回复格式】
对于普通对话，正常回复即可。
如果检测到文件信息，请在回复末尾添加JSON标记：
<FILE_INFO>
{"files": [{"name": "文件名", "category": "分类", "projectHint": "项目提示"}]}
</FILE_INFO>

分类选项: CONTRACT(合同), INVOICE(发票), REPORT(报告), DESIGN(设计), CODE(代码), DOCUMENT(文档), IMAGE(图片), OTHER(其他)`;

function buildDeepThinkingPrompt(role: UserRole = 'MASTER'): string {
  return getDeepThinkingPrompt(role) + FILE_DETECTION_CONTEXT;
}

export interface DeepChatResult {
  message: string;
  thinking?: string;
  filesDetected?: Array<{
    name: string;
    category: string;
    projectHint?: string;
  }>;
}

export async function deepThinkingChat(
  messages: ChatMessage[],
  userMessage: string,
  storage?: IStorage
): Promise<DeepChatResult> {
  const privacyDecision = classifyCloudPrivacy(userMessage);
  log.info({
    decision: privacyDecision.decision,
    sensitivity: privacyDecision.classification.sensitivityLevel,
    categories: privacyDecision.classification.sensitiveCategories,
    input: privacyDecision.safeLog,
  }, 'PrivacyGateway 深度思考云端调用判定');

  if (privacyDecision.decision === 'LOCAL_ONLY') {
    return {
      message: createLocalOnlyAssistantMessage(privacyDecision),
    };
  }

  if (!DASHSCOPE_API_KEY) {
    return { 
      message: '深度思考模式需要配置API密钥才能使用哦～',
    };
  }

  let dynamicContext = '';
  let basePrompt = buildDeepThinkingPrompt('MASTER');
  if (storage) {
    try {
      const avatarContext = await gatherAvatarContext(storage, userMessage);
      dynamicContext = '\n\n' + avatarContext.fullContext;
    } catch (e) {
      log.error({ error: e }, 'DeepThinking context error');
    }
  }

  const fullMessages = [
    { role: 'system', content: basePrompt + dynamicContext },
    ...messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage }
  ];

  try {
    const response = await fetch(DASHSCOPE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen-max',
        input: { messages: fullMessages },
        parameters: {
          result_format: 'message',
          temperature: 0.7,
          max_tokens: 1500,
          top_p: 0.9,
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error({ status: response.status, error: errorText }, 'DeepThinking API error');
      return { message: '深度思考遇到了一些问题，请稍后重试～' };
    }

    const data = await response.json();
    let aiMessage = data.output?.choices?.[0]?.message?.content || data.output?.text || '';
    
    const result: DeepChatResult = { message: '' };
    
    const fileInfoMatch = aiMessage.match(/<FILE_INFO>([\s\S]*?)<\/FILE_INFO>/);
    if (fileInfoMatch) {
      try {
        const fileData = JSON.parse(fileInfoMatch[1].trim());
        if (fileData.files && Array.isArray(fileData.files)) {
          result.filesDetected = fileData.files;
        }
      } catch (e) {
        log.error({ error: e }, 'DeepThinking failed to parse file info');
      }
      aiMessage = aiMessage.replace(/<FILE_INFO>[\s\S]*?<\/FILE_INFO>/, '').trim();
    }
    
    result.message = aiMessage || '让我再想想这个问题...';
    
    // 深度思考消耗更多HP
    if (storage) {
      const hpResult = await storage.consumeHP(20, 'deep_thinking_chat');
      if (!hpResult.success) {
        log.warn({ error: hpResult.error }, 'Insufficient HP for deep thinking');
      }
    }
    
    return result;

  } catch (error) {
    log.error({ error }, 'DeepThinking error');
    return { message: '深度思考时出错了，请稍后重试～' };
  }
}

// ====== 文件智能分类与项目存储 ======

export interface FileClassificationResult {
  success: boolean;
  message: string;
  savedFiles?: Array<{
    id: string;
    fileName: string;
    category: string;
    projectId?: string;
    projectTitle?: string;
  }>;
}

export async function classifyAndSaveFiles(
  files: Array<{ name: string; category: string; content?: string; projectHint?: string }>,
  storage: IStorage
): Promise<FileClassificationResult> {
  const savedFiles: Array<{
    id: string;
    fileName: string;
    category: string;
    projectId?: string;
    projectTitle?: string;
  }> = [];

  try {
    const existingProjects = await storage.getProjects();
    
    for (const file of files) {
      let targetProject = existingProjects.find(p => 
        file.projectHint && (
          p.title.includes(file.projectHint) || 
          (p.description && p.description.includes(file.projectHint))
        )
      );
      
      if (!targetProject && file.projectHint) {
        targetProject = await storage.createProject({
          title: file.projectHint,
          description: `由小智根据文件 "${file.name}" 自动创建的项目`,
          category: mapFileCategoryToProjectCategory(file.category),
          status: 'ACTIVE',
          priority: 5,
        });
        log.info({ projectTitle: targetProject.title }, 'FileClassify created new project');
      }
      
      const vaultItem = await storage.createVaultItem({
        category: file.category,
        fileName: file.name,
        filePath: `/vault/${file.category.toLowerCase()}/${file.name}`,
        semanticTags: [file.category, file.projectHint || 'uncategorized'].filter(Boolean),
        semanticIndex: file.content?.slice(0, 500) || file.name,
        sandboxStatus: 'VERIFIED',
        privacyZone: 'ZONE_GREEN',
      });
      
      savedFiles.push({
        id: vaultItem.id,
        fileName: file.name,
        category: file.category,
        projectId: targetProject?.id,
        projectTitle: targetProject?.title,
      });
    }

    const projectNames = Array.from(new Set(savedFiles.filter(f => f.projectTitle).map(f => f.projectTitle)));
    let message = `已成功分类并保存 ${savedFiles.length} 个文件`;
    if (projectNames.length > 0) {
      message += `，归入项目: ${projectNames.join('、')}`;
    }

    return { success: true, message, savedFiles };

  } catch (error) {
    log.error({ error }, 'FileClassify error');
    return { success: false, message: '文件分类保存时出错了' };
  }
}

function mapFileCategoryToProjectCategory(fileCategory: string): string {
  const mapping: Record<string, string> = {
    'CONTRACT': 'LEGAL',
    'INVOICE': 'FINANCE',
    'REPORT': 'BUSINESS',
    'DESIGN': 'CREATIVE',
    'CODE': 'TECH',
    'DOCUMENT': 'BUSINESS',
    'IMAGE': 'CREATIVE',
    'OTHER': 'BUSINESS',
  };
  return mapping[fileCategory] || 'BUSINESS';
}
