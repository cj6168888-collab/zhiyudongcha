/**
 * 律师函处理场景演示服务 - LawyerLetterProcessor
 *
 * 核心逻辑修正：不再无视输入的图片数据而强制执行远程截图。
 */

import { createServiceLogger } from '../lib/logger';
import { documentDecoderService } from './document-decoder';
import { visionRecognitionService } from './mobile';
import type { FileContent } from './mobile/types';

const logger = createServiceLogger('LawyerLetterProcessor');

export interface LawyerLetterInfo {
  senderCompany: string;
  senderLawFirm?: string;
  senderContact?: string;
  recipientCompany: string;
  recipientContact?: string;
  letterDate: string;
  letterNumber?: string;
  subject: string;
  mainContent: string;
  keyClaims: string[];
  demands: string[];
  deadline?: string;
  legalBasis?: string[];
  signatures: string[];
  attachments?: string[];
}

export interface RiskAssessment {
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  score: number;
  factors: string[];
  recommendations: string[];
  relatedLaws: string[];
  responseDeadline?: string;
  suggestedActions: string[];
}

export interface ProcessResult {
  success: boolean;
  letterInfo?: LawyerLetterInfo;
  riskAssessment?: RiskAssessment;
  originalText?: string;
  summary?: string;
  entities?: {
    companies: string[];
    persons: string[];
    dates: string[];
    amounts?: string[];
    addresses?: string[];
    phoneNumbers?: string[];
    emails?: string[];
  };
  processingSteps: string[];
  timestamp: number;
  error?: string;
}

const LEGAL_KEYWORDS = {
  urgency: ['紧急', '催告', '最后期限', '逾期', '法律后果', '将采取法律行动', '诉讼', '仲裁'],
  threat: ['警告', '律师函', '侵权', '违约', '赔偿', '损失', '起诉', '法院', '强制执行'],
  demand: ['要求', '必须', '应当', '立即', '停止', '删除', '更正', '赔偿', '道歉', '补偿'],
  legalBasis: ['合同法', '民法典', '著作权法', '商标法', '专利法', '反不正当竞争法', '劳动法', '公司法'],
  deadline: ['3日内', '5日内', '7日内', '10日内', '15日内', '30日内', '截止', '到期'],
};

const COMPANY_SUFFIXES = ['有限公司', '股份有限公司', '有限责任公司', '集团', '公司', '企业'];

class LawyerLetterProcessor {
  async processFromFile(
    fileContent: FileContent,
    options: {
      extractRiskAssessment?: boolean;
      language?: 'zh' | 'en';
    } = {}
  ): Promise<ProcessResult> {
    const result: ProcessResult = {
      success: false,
      processingSteps: [],
      timestamp: Date.now(),
    };

    try {
      result.processingSteps.push('1. 文档解码 - 开始');

      const decodeResult = await documentDecoderService.decodeDocument(
        fileContent.path,
        fileContent.content || '',
        fileContent.encoding
      );

      if (!decodeResult.success || !decodeResult.text) {
        throw new Error(decodeResult.error || '文档解码失败');
      }

      result.originalText = decodeResult.text;
      result.processingSteps.push('2. 文档解码 - 完成');

      result.processingSteps.push('3. 内容理解 - 开始');
      const letterInfo = await this.extractLetterInfo(decodeResult.text);
      result.letterInfo = letterInfo;
      result.processingSteps.push('4. 内容理解 - 完成');

      result.processingSteps.push('5. 实体提取 - 开始');
      const entities = await this.extractEntities(decodeResult.text);
      result.entities = entities;
      result.processingSteps.push('6. 实体提取 - 完成');

      result.processingSteps.push('7. 摘要生成 - 开始');
      result.summary = await this.generateSummary(decodeResult.text, letterInfo);
      result.processingSteps.push('8. 摘要生成 - 完成');

      if (options.extractRiskAssessment !== false) {
        result.processingSteps.push('9. 风险评估 - 开始');
        result.riskAssessment = await this.assessRisk(letterInfo, entities);
        result.processingSteps.push('10. 风险评估 - 完成');
      }

      result.success = true;
      logger.info({
        sender: letterInfo.senderCompany,
        recipient: letterInfo.recipientCompany,
        subject: letterInfo.subject,
      }, 'Lawyer letter processed successfully');

      return result;
    } catch (error) {
      logger.error({ error }, 'Failed to process lawyer letter');
      result.error = error instanceof Error ? error.message : String(error);
      return result;
    }
  }

  async processFromScreenshot(
    imageBase64: string,
    options: {
      extractRiskAssessment?: boolean;
    } = {}
  ): Promise<ProcessResult> {
    const result: ProcessResult = {
      success: false,
      processingSteps: [],
      timestamp: Date.now(),
    };

    try {
      result.processingSteps.push('1. 视觉识别 - 开始');

      // 核心修复：直接使用传入的 imageBase64 进行 OCR 分析
      // 使用新添加的 analyzeBase64Image 方法，避免依赖设备截屏
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

      const visionResult = await visionRecognitionService.analyzeBase64Image(cleanBase64, {
        includeElements: false,
        includeText: true,
        customPrompt: '请提取并识别此商务函件的全部文本内容。'
      });

      if (!visionResult.textContent) {
        throw new Error('无法识别图片中的文字信息');
      }

      result.processingSteps.push('2. 视觉识别 - 完成');
      result.originalText = visionResult.textContent;

      result.processingSteps.push('3. 内容理解 - 开始');
      const letterInfo = await this.extractLetterInfo(visionResult.textContent);
      result.letterInfo = letterInfo;
      result.processingSteps.push('4. 内容理解 - 完成');

      result.processingSteps.push('5. 实体提取 - 开始');
      const entities = await this.extractEntities(visionResult.textContent);
      result.entities = entities;
      result.processingSteps.push('6. 实体提取 - 完成');

      result.processingSteps.push('7. 摘要生成 - 开始');
      result.summary = await this.generateSummary(visionResult.textContent, letterInfo);
      result.processingSteps.push('8. 摘要生成 - 完成');

      if (options.extractRiskAssessment !== false) {
        result.processingSteps.push('9. 风险评估 - 开始');
        result.riskAssessment = await this.assessRisk(letterInfo, entities);
        result.processingSteps.push('10. 风险评估 - 完成');
      }

      result.success = true;
      return result;
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      return result;
    }
  }

  private async extractLetterInfo(text: string): Promise<LawyerLetterInfo> {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);

    const info: LawyerLetterInfo = {
      senderCompany: '',
      recipientCompany: '',
      letterDate: '',
      subject: '',
      mainContent: text,
      keyClaims: [],
      demands: [],
      signatures: [],
    };

    for (const line of lines) {
      if (line.includes('致：') || line.includes('致:')) {
        const match = line.match(/致[：:]\s*(.+)/);
        if (match) info.recipientCompany = match[1].trim();
      }

      if (line.includes('发自：') || line.includes('发自:') || line.includes('发件人：')) {
        const match = line.match(/发自[：:]\s*(.+)/);
        if (match) info.senderCompany = match[1].trim();
      }

      if (line.includes('日期：') || line.includes('日期:')) {
        const match = line.match(/日期[：:]\s*(.+)/);
        if (match) info.letterDate = match[1].trim();
      }

      if (line.includes('文号：') || line.includes('文号:') || line.includes('编号：')) {
        const match = line.match(/(?:文号|编号)[：:]\s*(.+)/);
        if (match) info.letterNumber = match[1].trim();
      }

      if (line.includes('关于') && line.includes('的函')) {
        info.subject = line.replace(/^[\d\.、\s]*/, '').trim();
      }

      for (const suffix of COMPANY_SUFFIXES) {
        if (line.includes(suffix) && !info.senderCompany) {
          info.senderCompany = line;
          break;
        }
      }
    }

    info.keyClaims = this.extractKeyClaims(text);
    info.demands = this.extractDemands(text);
    info.signatures = this.extractSignatures(text);

    return info;
  }

  private extractKeyClaims(text: string): string[] {
    const claims: string[] = [];
    const lines = text.split('\n');

    for (const line of lines) {
      if (
        line.includes('侵权') ||
        line.includes('违约') ||
        line.includes('侵犯') ||
        line.includes('未经授权') ||
        line.includes('擅自')
      ) {
        claims.push(line.trim());
      }
    }

    return claims.slice(0, 5);
  }

  private extractDemands(text: string): string[] {
    const demands: string[] = [];
    const lines = text.split('\n');

    for (const line of lines) {
      for (const keyword of LEGAL_KEYWORDS.demand) {
        if (line.includes(keyword)) {
          demands.push(line.trim());
          break;
        }
      }
    }

    return demands.slice(0, 5);
  }

  private extractSignatures(text: string): string[] {
    const signatures: string[] = [];
    const lines = text.split('\n');

    for (let i = lines.length - 1; i >= 0 && signatures.length < 3; i--) {
      const line = lines[i].trim();
      if (
        line.includes('律师') ||
        line.includes('律师事务所') ||
        line.match(/\d{4}[年]\d{1,2}[月]\d{1,2}[日]/)
      ) {
        signatures.push(line);
      }
    }

    return signatures;
  }

  private async extractEntities(text: string) {
    const entities = {
      companies: [] as string[],
      persons: [] as string[],
      dates: [] as string[],
      amounts: [] as string[],
      addresses: [] as string[],
      phoneNumbers: [] as string[],
      emails: [] as string[],
    };

    const phoneRegex = /1[3-9]\d{9}|\d{3,4}[-\s]?\d{7,8}/g;
    const phoneMatches = text.match(phoneRegex);
    if (phoneMatches) {
      entities.phoneNumbers = [...new Set(phoneMatches)];
    }

    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emailMatches = text.match(emailRegex);
    if (emailMatches) {
      entities.emails = [...new Set(emailMatches)];
    }

    const dateRegex = /\d{4}[年]\d{1,2}[月]\d{1,2}[日](?!\s*[A-Za-z])/g;
    const dateMatches = text.match(dateRegex);
    if (dateMatches) {
      entities.dates = [...new Set(dateMatches)];
    }

    const amountRegex = /[\d,]+(?:\.\d+)?\s*(?:万|亿|元|美元|欧元|英镑)/g;
    const amountMatches = text.match(amountRegex);
    if (amountMatches) {
      entities.amounts = [...new Set(amountMatches)];
    }

    for (const suffix of COMPANY_SUFFIXES) {
      const regex = new RegExp(`[^\\n]{2,15}${suffix}`, 'g');
      const matches = text.match(regex);
      if (matches) {
        entities.companies.push(...matches);
      }
    }
    entities.companies = [...new Set(entities.companies)];

    return entities;
  }

  private async generateSummary(text: string, letterInfo: LawyerLetterInfo): Promise<string> {
    const lines: string[] = [];

    lines.push(`📋 **律师函摘要**`);
    lines.push('');

    if (letterInfo.senderCompany) {
      lines.push(`**发件方**: ${letterInfo.senderCompany}`);
    }
    if (letterInfo.recipientCompany) {
      lines.push(`**收件方**: ${letterInfo.recipientCompany}`);
    }
    if (letterInfo.letterDate) {
      lines.push(`**日期**: ${letterInfo.letterDate}`);
    }
    if (letterInfo.letterNumber) {
      lines.push(`**文号**: ${letterInfo.letterNumber}`);
    }
    if (letterInfo.subject) {
      lines.push(`**主题**: ${letterInfo.subject}`);
    }

    lines.push('');
    lines.push('**主要内容**:');

    const sentences = text.split(/[。！？]/).filter(s => s.trim().length > 20);
    for (const sentence of sentences.slice(0, 3)) {
      lines.push(`- ${sentence.trim()}。`);
    }

    return lines.join('\n');
  }

  private async assessRisk(
    letterInfo: LawyerLetterInfo,
    entities: ProcessResult['entities']
  ): Promise<RiskAssessment> {
    const factors: string[] = [];
    const suggestedActions: string[] = [];
    const relatedLaws: string[] = [];
    let urgencyScore = 0;
    let threatScore = 0;
    let demandScore = 0;

    const fullText = letterInfo.mainContent;

    for (const keyword of LEGAL_KEYWORDS.urgency) {
      if (fullText.includes(keyword)) {
        urgencyScore += 2;
        factors.push(`存在紧迫性关键词: ${keyword}`);
      }
    }

    for (const keyword of LEGAL_KEYWORDS.threat) {
      if (fullText.includes(keyword)) {
        threatScore += 2;
        factors.push(`存在威胁性关键词: ${keyword}`);
      }
    }

    for (const keyword of LEGAL_KEYWORDS.demand) {
      if (fullText.includes(keyword)) {
        demandScore += 1;
      }
    }

    for (const keyword of LEGAL_KEYWORDS.legalBasis) {
      if (fullText.includes(keyword)) {
        relatedLaws.push(keyword);
        factors.push(`涉及法律条款: ${keyword}`);
      }
    }

    for (const keyword of LEGAL_KEYWORDS.deadline) {
      if (fullText.includes(keyword)) {
        urgencyScore += 3;
        const match = fullText.match(new RegExp(keyword.replace(/[()]/g, '\\$&') + '[^。]*'));
        if (match) {
          factors.push(`存在截止日期: ${match[0]}`);
        }
      }
    }

    if (entities.amounts && entities.amounts.length > 0) {
      threatScore += 2;
      factors.push(`涉及金额: ${entities.amounts.join(', ')}`);
    }

    const totalScore = urgencyScore + threatScore + demandScore;

    let severity: RiskAssessment['severity'];
    let recommendations: string[];

    if (totalScore >= 15) {
      severity = 'CRITICAL';
      recommendations = [
        '立即咨询专业律师',
        '评估对方证据的充分性',
        '准备可能的诉讼应对方案',
        '注意保留相关证据',
        '在截止日期前作出回应',
      ];
    } else if (totalScore >= 10) {
      severity = 'HIGH';
      recommendations = [
        '尽快咨询律师',
        '认真评估函件内容',
        '准备书面答复',
        '收集相关证据材料',
      ];
    } else if (totalScore >= 5) {
      severity = 'MEDIUM';
      recommendations = [
        '了解函件具体诉求',
        '评估自身法律立场',
        '必要时咨询律师',
      ];
    } else {
      severity = 'LOW';
      recommendations = [
        '了解函件内容',
        '根据实际情况处理',
      ];
    }

    for (const law of relatedLaws) {
      if (!relatedLaws.includes(law)) {
        relatedLaws.push(law);
      }
    }

    let deadline: string | undefined;
    for (const date of entities.dates || []) {
      if (date.includes('日内') || date.includes('日前')) {
        deadline = date;
        break;
      }
    }

    return {
      severity,
      score: totalScore,
      factors,
      recommendations,
      relatedLaws,
      responseDeadline: deadline,
      suggestedActions,
    };
  }
}

export const lawyerLetterProcessor = new LawyerLetterProcessor();
export default lawyerLetterProcessor;
