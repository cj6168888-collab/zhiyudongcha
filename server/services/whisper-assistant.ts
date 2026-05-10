/**
 * 耳语助手服务 (Whisper Assistant) - 实时智能耳语反馈
 * 
 * 在谈话/会议/谈判中，实时检测问题并通过耳机悄悄告诉用户答案
 * 
 * 支持场景：
 * 1. 法律问题 - 查询知识库，引用条款
 * 2. 计算问题 - 快速计算复杂数学表达式
 * 3. 事实问题 - 查询知识库回答
 * 4. 人物信息 - 查询人脉库提供背景
 * 5. 项目进度 - 查询项目状态
 */

import { createServiceLogger } from '../lib/logger';
import { completeWithAI, type AICompletionOptions } from '../lib/ai-provider';
import { getDatabase } from '../db';
import { persons, projects } from '@shared/schema';
import { ilike, or, desc } from 'drizzle-orm';

const logger = createServiceLogger('WhisperAssistant');

export type QuestionType = 
  | 'LEGAL'        // 法律条款
  | 'CALCULATION'  // 数学计算
  | 'FACT'         // 事实查询
  | 'PERSON'       // 人物信息
  | 'PROJECT'      // 项目进度
  | 'NEGOTIATION'  // 谈判策略
  | 'HESITATION'   // 停顿/忘词
  | 'UNKNOWN';

export interface ConversationContext {
  sessionId: string;
  mentionedPersons: MentionedPerson[];
  mentionedTopics: string[];
  lastUpdateTime: number;
  recentTranscripts: string[];
}

export interface MentionedPerson {
  id?: number;
  name: string;
  organization?: string;
  role?: string;
  mentionedAt: number;
  context?: string;
}

export interface HesitationHint {
  type: 'NAME_HINT' | 'TOPIC_HINT' | 'CONTINUATION_HINT';
  hint: string;
  confidence: number;
  relatedPerson?: MentionedPerson;
}

export interface DetectedQuestion {
  type: QuestionType;
  originalText: string;
  extractedQuery: string;
  confidence: number;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

export interface WhisperResponse {
  success: boolean;
  questionType: QuestionType;
  answer: string;
  shortAnswer: string;  // 简短版本，适合耳语
  sources?: string[];
  confidence: number;
  processingTime: number;
}

const QUESTION_PATTERNS: Record<QuestionType, RegExp[]> = {
  LEGAL: [
    /根据.*法.*第.*条/,
    /法律.*规定/,
    /合同法|劳动法|公司法|民法典|刑法|知识产权法|专利法|商标法|著作权法/,
    /违约.*责任|赔偿.*标准|诉讼时效|法定.*期限/,
    /法律.*怎么.*规定|依据.*什么.*法/,
    /合规|合法|违法|违规/,
  ],
  CALCULATION: [
    /计算|算一下|多少钱|总共.*多少|百分之|利率|折扣/,
    /\d+[\+\-\*\/\×\÷]\d+/,
    /\d+.*加上.*\d+|\d+.*减去.*\d+|\d+.*乘以.*\d+|\d+.*除以.*\d+/,
    /\d+%.*的.*\d+|年化.*收益|复利|单利/,
    /首付.*多少|月供.*多少|利息.*多少/,
    /成本.*核算|利润率|毛利|净利/,
  ],
  PERSON: [
    /谁是.*|.*是谁|认识.*吗|.*背景|.*什么公司|.*什么职位/,
    /介绍一下.*|.*简历|.*履历/,
  ],
  PROJECT: [
    /项目.*进度|.*项目.*怎么样|.*完成.*多少|.*项目.*状态/,
    /任务.*进展|里程碑.*情况/,
  ],
  NEGOTIATION: [
    /怎么.*谈|如何.*应对|对策|策略|底线|让步/,
    /这个价.*合理|市场价|行情/,
  ],
  FACT: [
    /什么是.*|.*是什么|如何.*|怎么.*|为什么/,
    /定义|概念|原理|机制/,
  ],
  HESITATION: [],
  UNKNOWN: [],
};

const HESITATION_PATTERNS = [
  /^[嗯啊呃额哦唔]{1,3}[\.。…]*$/,
  /那个[\.。…]+/,
  /就是[\.。…]+说/,
  /怎么说[\.。…]*/,
  /[\.。…]{2,}/,
  /我忘了?[\.。…]*/,
  /叫什么来着/,
  /什么名字来着/,
  /那位[\.。…]+/,
  /那边[\.。…]+/,
  /之前说的[\.。…]+/,
  /刚才提到的[\.。…]+/,
  /你知道的[\.。…]+那个/,
];

const LEGAL_KNOWLEDGE_BASE: Record<string, string> = {
  '合同法违约': '根据《民法典》第五百七十七条，当事人一方不履行合同义务或者履行合同义务不符合约定的，应当承担继续履行、采取补救措施或者赔偿损失等违约责任。',
  '合同法解除': '根据《民法典》第五百六十三条，有下列情形之一的，当事人可以解除合同：(一)因不可抗力致使不能实现合同目的；(二)在履行期限届满前，当事人一方明确表示或者以自己的行为表明不履行主要债务；(三)当事人一方迟延履行主要债务，经催告后在合理期限内仍未履行；(四)当事人一方迟延履行债务或者有其他违约行为致使不能实现合同目的；(五)法律规定的其他情形。',
  '劳动法解雇': '根据《劳动合同法》第三十九条，劳动者有下列情形之一的，用人单位可以解除劳动合同：(一)在试用期间被证明不符合录用条件的；(二)严重违反用人单位的规章制度的；(三)严重失职，营私舞弊，给用人单位造成重大损害的。',
  '劳动法经济补偿': '根据《劳动合同法》第四十七条，经济补偿按劳动者在本单位工作的年限，每满一年支付一个月工资的标准向劳动者支付。六个月以上不满一年的，按一年计算；不满六个月的，向劳动者支付半个月工资的经济补偿。',
  '公司法股东权利': '根据《公司法》第四条，公司股东依法享有资产收益、参与重大决策和选择管理者等权利。',
  '知识产权侵权': '根据《专利法》第六十五条，侵犯专利权的赔偿数额按照权利人因被侵权所受到的实际损失确定；实际损失难以确定的，可以按照侵权人因侵权所获得的利益确定。',
  '诉讼时效': '根据《民法典》第一百八十八条，向人民法院请求保护民事权利的诉讼时效期间为三年。法律另有规定的，依照其规定。',
  '定金规则': '根据《民法典》第五百八十七条，收受定金的一方不履行债务的，应当双倍返还定金。给付定金的一方不履行债务的，无权请求返还定金。',
  '不可抗力': '根据《民法典》第一百八十条，因不可抗力不能履行民事义务的，不承担民事责任。法律另有规定的，依照其规定。不可抗力是不能预见、不能避免且不能克服的客观情况。',
};

export class WhisperAssistant {
  private static instance: WhisperAssistant;
  private contexts: Map<string, ConversationContext> = new Map();
  private readonly CONTEXT_EXPIRY_MS = 30 * 60 * 1000;
  private readonly MAX_RECENT_TRANSCRIPTS = 20;

  private constructor() {
    setInterval(() => this.cleanupExpiredContexts(), 5 * 60 * 1000);
  }

  static getInstance(): WhisperAssistant {
    if (!WhisperAssistant.instance) {
      WhisperAssistant.instance = new WhisperAssistant();
    }
    return WhisperAssistant.instance;
  }

  getOrCreateContext(sessionId: string): ConversationContext {
    let context = this.contexts.get(sessionId);
    if (!context) {
      context = {
        sessionId,
        mentionedPersons: [],
        mentionedTopics: [],
        lastUpdateTime: Date.now(),
        recentTranscripts: [],
      };
      this.contexts.set(sessionId, context);
    }
    return context;
  }

  private cleanupExpiredContexts(): void {
    const now = Date.now();
    for (const [sessionId, context] of this.contexts.entries()) {
      if (now - context.lastUpdateTime > this.CONTEXT_EXPIRY_MS) {
        this.contexts.delete(sessionId);
        logger.info({ sessionId }, '清理过期会话上下文');
      }
    }
  }

  async updateContext(sessionId: string, text: string): Promise<MentionedPerson[]> {
    const context = this.getOrCreateContext(sessionId);
    context.lastUpdateTime = Date.now();
    
    context.recentTranscripts.push(text);
    if (context.recentTranscripts.length > this.MAX_RECENT_TRANSCRIPTS) {
      context.recentTranscripts.shift();
    }

    const newPersons = await this.extractPersonsFromText(text);
    for (const person of newPersons) {
      const existing = context.mentionedPersons.find(p => p.name === person.name);
      if (!existing) {
        context.mentionedPersons.push(person);
        logger.info({ sessionId, personName: person.name }, '检测到新人物');
      }
    }

    const topics = this.extractTopicsFromText(text);
    for (const topic of topics) {
      if (!context.mentionedTopics.includes(topic)) {
        context.mentionedTopics.push(topic);
      }
    }

    return newPersons;
  }

  private async extractPersonsFromText(text: string): Promise<MentionedPerson[]> {
    const persons: MentionedPerson[] = [];
    const seenNames = new Set<string>();
    
    const titleMatches = text.matchAll(/([\u4e00-\u9fa5])(总|经理|董事长?|主任|老板)/gu);
    for (const match of titleMatches) {
      const name = match[1];
      const title = match[2];
      if (this.isValidPersonName(name) && !seenNames.has(name)) {
        seenNames.add(name);
        const dbPerson = await this.findPersonInDatabase(name);
        persons.push({
          id: dbPerson?.id,
          name,
          organization: dbPerson?.organization || undefined,
          role: dbPerson?.role || title || undefined,
          mentionedAt: Date.now(),
          context: match[0],
        });
      }
    }

    const honorificMatches = text.matchAll(/([\u4e00-\u9fa5]{2,3})(先生|女士|老师|教授|博士|医生|工程师)/gu);
    for (const match of honorificMatches) {
      const name = match[1];
      const title = match[2];
      if (this.isValidPersonName(name) && !seenNames.has(name)) {
        seenNames.add(name);
        const dbPerson = await this.findPersonInDatabase(name);
        persons.push({
          id: dbPerson?.id,
          name,
          organization: dbPerson?.organization || undefined,
          role: dbPerson?.role || title || undefined,
          mentionedAt: Date.now(),
          context: match[0],
        });
      }
    }

    const introMatches = text.matchAll(/(?:我是|这是|叫做?|姓|认识|见过|介绍)\s*([\u4e00-\u9fa5]{2,3})/gu);
    for (const match of introMatches) {
      const name = match[1];
      if (this.isValidPersonName(name) && !seenNames.has(name)) {
        seenNames.add(name);
        const dbPerson = await this.findPersonInDatabase(name);
        persons.push({
          id: dbPerson?.id,
          name,
          organization: dbPerson?.organization || undefined,
          role: dbPerson?.role || undefined,
          mentionedAt: Date.now(),
          context: match[0],
        });
      }
    }

    return persons;
  }

  private isValidPersonName(name: string): boolean {
    if (!name || name.length < 1 || name.length > 3) return false;
    
    const commonSurnames = ['王', '李', '张', '刘', '陈', '杨', '黄', '赵', '周', '吴', 
      '徐', '孙', '马', '朱', '胡', '郭', '何', '林', '高', '罗', '郑', '梁', '谢', '宋', 
      '唐', '许', '韩', '冯', '邓', '曹', '彭', '曾', '肖', '田', '董', '袁', '潘', '于',
      '蒋', '蔡', '余', '杜', '叶', '程', '苏', '魏', '吕', '丁', '任', '沈', '姚', '卢',
      '姜', '崔', '钟', '谭', '陆', '汪', '范', '金', '石', '廖', '贾', '夏', '韦', '付',
      '方', '白', '邹', '孟', '熊', '秦', '邱', '江', '尹', '薛', '闫', '段', '雷', '侯'];
    
    if (name.length === 1) {
      return commonSurnames.includes(name);
    }
    
    const excludeWords = [
      '这个', '那个', '什么', '怎么', '如何', '可以', '应该', '需要', '已经', '正在',
      '今天', '明天', '昨天', '现在', '以后', '之前', '之后', '这里', '那里', '哪里',
      '公司', '集团', '企业', '项目', '合同', '业务', '方案', '计划', '问题', '事项',
      '采购', '销售', '财务', '技术', '研发', '运营', '市场', '人事', '行政', '法务',
      '他是', '她是', '我是', '你是', '他们', '她们', '我们', '你们', '大家', '各位',
      '是华', '和张', '天和', '的采', '事情', '合作', '华为',
    ];
    
    if (excludeWords.includes(name)) return false;
    
    if (name.length >= 2 && commonSurnames.includes(name.charAt(0))) {
      return true;
    }
    
    return false;
  }

  private async findPersonInDatabase(name: string): Promise<{ id: number; organization: string | null; role: string | null } | null> {
    try {
      const [person] = await getDatabase().select({
        id: persons.id,
        organization: persons.organization,
        role: persons.role,
      }).from(persons).where(ilike(persons.name, `%${name}%`)).limit(1);
      return person || null;
    } catch (error) {
      return null;
    }
  }

  private extractTopicsFromText(text: string): string[] {
    const topics: string[] = [];
    const topicPatterns = [
      /(?:关于|讨论|说说|聊聊|谈谈)[\s]*([一-龥a-zA-Z0-9]{2,10})/g,
      /([一-龥]{2,6})(?:项目|合同|方案|计划|问题|事项|业务)/g,
    ];

    for (const pattern of topicPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (match[1] && !topics.includes(match[1])) {
          topics.push(match[1]);
        }
      }
    }

    return topics;
  }

  async detectHesitation(sessionId: string, text: string): Promise<HesitationHint | null> {
    const normalized = text.trim();
    
    let isHesitating = false;
    for (const pattern of HESITATION_PATTERNS) {
      if (pattern.test(normalized)) {
        isHesitating = true;
        break;
      }
    }

    if (!isHesitating) return null;

    const context = this.getOrCreateContext(sessionId);
    logger.info({ sessionId, text: normalized, personsCount: context.mentionedPersons.length }, '检测到停顿/犹豫');

    if (/那位|那个人|他叫|她叫|叫什么|名字/.test(normalized)) {
      const recentPerson = context.mentionedPersons
        .sort((a, b) => b.mentionedAt - a.mentionedAt)[0];
      
      if (recentPerson) {
        let hint = recentPerson.name;
        if (recentPerson.organization) {
          hint += `，${recentPerson.organization}`;
        }
        if (recentPerson.role) {
          hint += `的${recentPerson.role}`;
        }
        
        return {
          type: 'NAME_HINT',
          hint,
          confidence: 0.9,
          relatedPerson: recentPerson,
        };
      }
    }

    if (/之前说|刚才提到|那件事|那个事/.test(normalized)) {
      const recentTopic = context.mentionedTopics[context.mentionedTopics.length - 1];
      if (recentTopic) {
        return {
          type: 'TOPIC_HINT',
          hint: recentTopic,
          confidence: 0.7,
        };
      }
    }

    if (context.mentionedPersons.length > 0) {
      const recentPerson = context.mentionedPersons
        .sort((a, b) => b.mentionedAt - a.mentionedAt)[0];
      
      return {
        type: 'NAME_HINT',
        hint: recentPerson.name,
        confidence: 0.6,
        relatedPerson: recentPerson,
      };
    }

    if (context.recentTranscripts.length > 0) {
      const lastTranscript = context.recentTranscripts[context.recentTranscripts.length - 1];
      const hint = lastTranscript.length > 20 
        ? lastTranscript.substring(0, 20) + '...' 
        : lastTranscript;
      
      return {
        type: 'CONTINUATION_HINT',
        hint: `刚才说到: ${hint}`,
        confidence: 0.5,
      };
    }

    return null;
  }

  async detectQuestion(text: string): Promise<DetectedQuestion | null> {
    const normalized = text.trim();
    if (normalized.length < 5) return null;

    const hasQuestionMark = /[？?]/.test(normalized);
    const hasQuestionWord = /什么|怎么|如何|多少|谁|哪|是否|能不能|可不可以/.test(normalized);

    if (!hasQuestionMark && !hasQuestionWord) {
      return null;
    }

    for (const [type, patterns] of Object.entries(QUESTION_PATTERNS) as [QuestionType, RegExp[]][]) {
      if (type === 'UNKNOWN') continue;
      
      for (const pattern of patterns) {
        if (pattern.test(normalized)) {
          const urgency = this.calculateUrgency(type, normalized);
          return {
            type,
            originalText: normalized,
            extractedQuery: normalized,
            confidence: 0.8,
            urgency,
          };
        }
      }
    }

    if (hasQuestionMark || hasQuestionWord) {
      return {
        type: 'UNKNOWN',
        originalText: normalized,
        extractedQuery: normalized,
        confidence: 0.5,
        urgency: 'LOW',
      };
    }

    return null;
  }

  private calculateUrgency(type: QuestionType, text: string): DetectedQuestion['urgency'] {
    if (type === 'CALCULATION') return 'HIGH';
    if (type === 'LEGAL' && /违约|赔偿|诉讼/.test(text)) return 'URGENT';
    if (type === 'NEGOTIATION') return 'HIGH';
    if (/马上|立刻|现在|急/.test(text)) return 'URGENT';
    return 'MEDIUM';
  }

  async generateWhisper(question: DetectedQuestion): Promise<WhisperResponse> {
    const startTime = Date.now();
    
    try {
      let answer: string;
      let shortAnswer: string;
      let sources: string[] = [];
      let confidence = 0.8;

      switch (question.type) {
        case 'CALCULATION':
          const calcResult = await this.handleCalculation(question.extractedQuery);
          answer = calcResult.answer;
          shortAnswer = calcResult.shortAnswer;
          confidence = calcResult.confidence;
          break;

        case 'LEGAL':
          const legalResult = await this.handleLegalQuestion(question.extractedQuery);
          answer = legalResult.answer;
          shortAnswer = legalResult.shortAnswer;
          sources = legalResult.sources;
          confidence = legalResult.confidence;
          break;

        case 'PERSON':
          const personResult = await this.handlePersonQuestion(question.extractedQuery);
          answer = personResult.answer;
          shortAnswer = personResult.shortAnswer;
          confidence = personResult.confidence;
          break;

        case 'PROJECT':
          const projectResult = await this.handleProjectQuestion(question.extractedQuery);
          answer = projectResult.answer;
          shortAnswer = projectResult.shortAnswer;
          confidence = projectResult.confidence;
          break;

        case 'NEGOTIATION':
          const negotiationResult = await this.handleNegotiationAdvice(question.extractedQuery);
          answer = negotiationResult.answer;
          shortAnswer = negotiationResult.shortAnswer;
          confidence = negotiationResult.confidence;
          break;

        default:
          const aiResult = await this.handleGeneralQuestion(question.extractedQuery);
          answer = aiResult.answer;
          shortAnswer = aiResult.shortAnswer;
          confidence = aiResult.confidence;
      }

      const processingTime = Date.now() - startTime;
      logger.info({ type: question.type, processingTime, shortAnswer }, '耳语生成完成');

      return {
        success: true,
        questionType: question.type,
        answer,
        shortAnswer,
        sources,
        confidence,
        processingTime,
      };

    } catch (error) {
      logger.error({ err: error }, '耳语生成失败');
      return {
        success: false,
        questionType: question.type,
        answer: '抱歉，暂时无法回答',
        shortAnswer: '无法回答',
        confidence: 0,
        processingTime: Date.now() - startTime,
      };
    }
  }

  private async handleCalculation(query: string): Promise<{ answer: string; shortAnswer: string; confidence: number }> {
    try {
      let expression = query
        .replace(/[，,]/g, '')
        .replace(/[×x]/gi, '*')
        .replace(/[÷]/g, '/')
        .replace(/加上?/g, '+')
        .replace(/减去?/g, '-')
        .replace(/乘以?/g, '*')
        .replace(/除以?/g, '/')
        .replace(/百分之(\d+)/g, '0.$1')
        .replace(/(\d+)%/g, '($1/100)')
        .replace(/的/g, '*')
        .replace(/万/g, '*10000')
        .replace(/亿/g, '*100000000')
        .replace(/[^0-9+\-*/().%\s]/g, '');

      const numbers = expression.match(/[\d.]+/g);
      const operators = expression.match(/[+\-*/]/g);
      
      if (!numbers || numbers.length === 0) {
        return {
          answer: '无法识别计算表达式',
          shortAnswer: '无法计算',
          confidence: 0.3,
        };
      }

      let result: number;
      try {
        result = Function('"use strict"; return (' + expression + ')')();
      } catch {
        if (numbers.length >= 2 && operators && operators.length >= 1) {
          const a = parseFloat(numbers[0]);
          const b = parseFloat(numbers[1]);
          const op = operators[0];
          switch (op) {
            case '+': result = a + b; break;
            case '-': result = a - b; break;
            case '*': result = a * b; break;
            case '/': result = b !== 0 ? a / b : NaN; break;
            default: result = NaN;
          }
        } else {
          return {
            answer: '计算表达式无效',
            shortAnswer: '无法计算',
            confidence: 0.3,
          };
        }
      }

      if (isNaN(result) || !isFinite(result)) {
        return {
          answer: '计算结果无效',
          shortAnswer: '无效',
          confidence: 0.3,
        };
      }

      const formattedResult = Number.isInteger(result) 
        ? result.toLocaleString('zh-CN')
        : result.toFixed(2).replace(/\.?0+$/, '');

      return {
        answer: `计算结果是 ${formattedResult}`,
        shortAnswer: formattedResult,
        confidence: 0.95,
      };
    } catch (error) {
      logger.error({ err: error, query }, '计算失败');
      return {
        answer: '计算出错了',
        shortAnswer: '计算错误',
        confidence: 0,
      };
    }
  }

  private async handleLegalQuestion(query: string): Promise<{ answer: string; shortAnswer: string; sources: string[]; confidence: number }> {
    const sources: string[] = [];
    
    for (const [key, content] of Object.entries(LEGAL_KNOWLEDGE_BASE)) {
      const keywords = key.split(/(?=[A-Z])|_/).join('|');
      if (new RegExp(keywords, 'i').test(query) || query.includes(key)) {
        sources.push(key);
        const shortContent = content.split('。')[0] + '。';
        return {
          answer: content,
          shortAnswer: shortContent.length > 50 ? shortContent.substring(0, 47) + '...' : shortContent,
          sources: [key],
          confidence: 0.9,
        };
      }
    }

    if (/违约/.test(query)) {
      const content = LEGAL_KNOWLEDGE_BASE['合同法违约'];
      return {
        answer: content,
        shortAnswer: '违约方应承担继续履行、补救或赔偿损失责任',
        sources: ['民法典第577条'],
        confidence: 0.85,
      };
    }

    if (/解除.*合同|合同.*解除/.test(query)) {
      const content = LEGAL_KNOWLEDGE_BASE['合同法解除'];
      return {
        answer: content,
        shortAnswer: '不可抗力、明确违约、催告后仍不履行等情形可解除',
        sources: ['民法典第563条'],
        confidence: 0.85,
      };
    }

    if (/经济补偿|赔偿.*标准|N\+1/.test(query)) {
      const content = LEGAL_KNOWLEDGE_BASE['劳动法经济补偿'];
      return {
        answer: content,
        shortAnswer: '每满一年支付一个月工资，不满半年付半月',
        sources: ['劳动合同法第47条'],
        confidence: 0.85,
      };
    }

    if (/定金/.test(query)) {
      const content = LEGAL_KNOWLEDGE_BASE['定金规则'];
      return {
        answer: content,
        shortAnswer: '收定金方违约双倍返还，付定金方违约不退',
        sources: ['民法典第587条'],
        confidence: 0.9,
      };
    }

    if (/诉讼时效/.test(query)) {
      const content = LEGAL_KNOWLEDGE_BASE['诉讼时效'];
      return {
        answer: content,
        shortAnswer: '一般诉讼时效三年',
        sources: ['民法典第188条'],
        confidence: 0.9,
      };
    }

    return {
      answer: '暂未找到相关法律条款，建议咨询专业律师',
      shortAnswer: '需咨询律师',
      sources: [],
      confidence: 0.4,
    };
  }

  private async handlePersonQuestion(query: string): Promise<{ answer: string; shortAnswer: string; confidence: number }> {
    const nameMatch = query.match(/谁是(.+?)[？?]?$|(.+?)是谁|认识(.+?)吗|介绍.*?(.+)/);
    const name = nameMatch?.[1] || nameMatch?.[2] || nameMatch?.[3] || nameMatch?.[4];
    
    if (!name) {
      return {
        answer: '请说明要查询的人名',
        shortAnswer: '请说人名',
        confidence: 0.3,
      };
    }

    const cleanName = name.replace(/[？?。，,\s]/g, '').trim();
    
    try {
      const found = await getDatabase().select().from(persons)
        .where(ilike(persons.name, `%${cleanName}%`))
        .limit(1);

      if (found.length > 0) {
        const person = found[0];
        const info = [
          person.name,
          person.organization ? `${person.organization}` : null,
          person.role ? person.role : null,
          person.negotiationStyle ? `风格: ${person.negotiationStyle}` : null,
        ].filter(Boolean).join('，');

        const tags = person.tags?.join('、') || '';
        return {
          answer: `${person.name}: ${info}。${tags ? '标签: ' + tags : ''}`,
          shortAnswer: info,
          confidence: 0.9,
        };
      }

      return {
        answer: `未找到「${cleanName}」的信息`,
        shortAnswer: '无此人记录',
        confidence: 0.5,
      };
    } catch (error) {
      logger.error({ err: error }, '查询人物失败');
      return {
        answer: '查询失败',
        shortAnswer: '查询失败',
        confidence: 0,
      };
    }
  }

  private async handleProjectQuestion(query: string): Promise<{ answer: string; shortAnswer: string; confidence: number }> {
    const projectMatch = query.match(/(.+?)项目.*(?:进度|怎么样|状态|情况)/);
    const projectName = projectMatch?.[1]?.trim();

    try {
      const found = await getDatabase().select().from(projects)
        .where(projectName 
          ? ilike(projects.title, `%${projectName}%`)
          : undefined
        )
        .orderBy(desc(projects.updatedAt))
        .limit(3);

      if (found.length > 0) {
        const project = found[0];
        const statusMap: Record<string, string> = {
          'PENDING_REVIEW': '待审核',
          'DRAFT': '草稿',
          'PLANNING': '规划中',
          'IN_PROGRESS': '进行中',
          'COMPLETED': '已完成',
          'ON_HOLD': '暂停',
          'CANCELLED': '已取消',
        };
        const status = statusMap[project.status || ''] || project.status || '未知';
        
        return {
          answer: `项目「${project.title}」当前状态: ${status}`,
          shortAnswer: `${project.title}: ${status}`,
          confidence: 0.85,
        };
      }

      return {
        answer: '未找到相关项目',
        shortAnswer: '无此项目',
        confidence: 0.5,
      };
    } catch (error) {
      logger.error({ err: error }, '查询项目失败');
      return {
        answer: '查询失败',
        shortAnswer: '查询失败',
        confidence: 0,
      };
    }
  }

  private async handleNegotiationAdvice(query: string): Promise<{ answer: string; shortAnswer: string; confidence: number }> {
    if (/价.*合理|市场价|行情/.test(query)) {
      return {
        answer: '建议：可以询问对方的预算范围，避免先报价。如需报价，留有10-15%谈判空间',
        shortAnswer: '别先报价，留10-15%空间',
        confidence: 0.7,
      };
    }

    if (/怎么.*应对|对策/.test(query)) {
      return {
        answer: '建议：保持冷静，倾听对方诉求，寻找共同利益点，适当沉默给对方压力',
        shortAnswer: '冷静倾听，找共同点',
        confidence: 0.7,
      };
    }

    if (/让步|底线/.test(query)) {
      return {
        answer: '建议：让步要有条件，每次让步幅度递减，显示已接近底线',
        shortAnswer: '有条件让步，幅度递减',
        confidence: 0.7,
      };
    }

    return {
      answer: '保持专业态度，寻找双赢方案',
      shortAnswer: '寻求双赢',
      confidence: 0.5,
    };
  }

  private async handleGeneralQuestion(query: string): Promise<{ answer: string; shortAnswer: string; confidence: number }> {
    try {
      const options: AICompletionOptions = {
        messages: [
          { role: 'system', content: '你是小智的耳语助手。用户正在进行商务谈话，需要你快速简洁地回答问题。回答要简短（不超过50字），直接给出答案，不要啰嗦。' },
          { role: 'user', content: query },
        ],
        temperature: 0.3,
        maxTokens: 100,
        timeout: 5000,
      };

      const result = await completeWithAI(options);
      const answer = result.content.trim();
      const shortAnswer = answer.length > 30 ? answer.substring(0, 27) + '...' : answer;

      return {
        answer,
        shortAnswer,
        confidence: 0.7,
      };
    } catch (error) {
      logger.error({ err: error }, 'AI回答失败');
      return {
        answer: '暂时无法回答',
        shortAnswer: '无法回答',
        confidence: 0,
      };
    }
  }

  async processTranscript(text: string, speakerId?: string): Promise<WhisperResponse | null> {
    const question = await this.detectQuestion(text);
    
    if (!question) {
      return null;
    }

    if (question.confidence < 0.5) {
      return null;
    }

    logger.info({ 
      type: question.type, 
      urgency: question.urgency,
      text: question.extractedQuery 
    }, '检测到问题');

    return await this.generateWhisper(question);
  }
}

export const whisperAssistant = WhisperAssistant.getInstance();
