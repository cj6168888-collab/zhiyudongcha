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
  basisWarnings?: string[];
  factGaps?: string[];
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
  threat: ['警告', '侵权', '违约', '赔偿', '损失', '起诉', '法院', '强制执行'],
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

      if (options.extractRiskAssessment !== false) {
        result.processingSteps.push('7. 风险评估 - 开始');
        result.riskAssessment = await this.assessRisk(letterInfo, entities);
        result.processingSteps.push('8. 风险评估 - 完成');
      }

      result.processingSteps.push('9. 摘要生成 - 开始');
      result.summary = await this.generateSummary(decodeResult.text, letterInfo, result.riskAssessment, entities);
      result.processingSteps.push('10. 摘要生成 - 完成');

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

      if (options.extractRiskAssessment !== false) {
        result.processingSteps.push('7. 风险评估 - 开始');
        result.riskAssessment = await this.assessRisk(letterInfo, entities);
        result.processingSteps.push('8. 风险评估 - 完成');
      }

      result.processingSteps.push('9. 摘要生成 - 开始');
      result.summary = await this.generateSummary(visionResult.textContent, letterInfo, result.riskAssessment, entities);
      result.processingSteps.push('10. 摘要生成 - 完成');

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

  private async generateSummary(
    text: string,
    letterInfo: LawyerLetterInfo,
    riskAssessment?: RiskAssessment,
    entities?: ProcessResult['entities']
  ): Promise<string> {
    const lines: string[] = [];

    lines.push('**律师函摘要**');
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
    lines.push('**主张与诉求**:');

    const claimLines = [...letterInfo.keyClaims, ...letterInfo.demands];
    const displayClaims = claimLines.length > 0
      ? [...new Set(claimLines)].slice(0, 5)
      : text.split(/[。！？]/).filter(s => s.trim().length > 20).slice(0, 3).map(s => `${s.trim()}。`);

    for (const claim of displayClaims) {
      lines.push(`- ${claim}`);
    }

    if (entities?.amounts?.length) {
      lines.push(`- 涉及金额: ${entities.amounts.join('、')}`);
    }

    if (riskAssessment) {
      lines.push('');
      lines.push('**风险等级**:');
      lines.push(`- ${riskAssessment.severity}（评分 ${riskAssessment.score}，依据期限、金额、争议类型和拟采取法律行动综合判断）`);
      if (riskAssessment.responseDeadline) {
        lines.push(`- 回复期限: ${riskAssessment.responseDeadline}`);
      }

      lines.push('');
      lines.push('**法律依据校验**:');
      if (riskAssessment.relatedLaws.length > 0) {
        for (const law of riskAssessment.relatedLaws.slice(0, 6)) {
          lines.push(`- ${law}`);
        }
      } else {
        lines.push('- 原函未列明可核验的具体法条，不能仅凭函件表述确认责任成立。');
      }
      for (const warning of riskAssessment.basisWarnings || []) {
        lines.push(`- 注意: ${warning}`);
      }

      lines.push('');
      lines.push('**事实与证据缺口**:');
      for (const gap of (riskAssessment.factGaps || []).slice(0, 6)) {
        lines.push(`- ${gap}`);
      }

      lines.push('');
      lines.push('**建议动作**:');
      for (const action of riskAssessment.suggestedActions.slice(0, 6)) {
        lines.push(`- ${action}`);
      }
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
        factors.push(`存在法律争议关键词: ${keyword}`);
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
        factors.push(`函件明示涉及法律领域: ${keyword}`);
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

    relatedLaws.push(...this.inferRelatedLaws(fullText));

    const totalScore = urgencyScore + threatScore + demandScore;
    const responseDeadline = this.extractResponseDeadline(fullText, entities);
    const hasShortDeadline = Boolean(responseDeadline && !responseDeadline.includes('30日内'));
    const hasLargeClaim = Boolean(entities.amounts && entities.amounts.length > 0);
    const hasFormalActionThreat = /诉讼|仲裁|起诉|法院|报案|强制执行/.test(fullText);

    let severity: RiskAssessment['severity'];
    let recommendations: string[];

    if (totalScore >= 18 || (hasShortDeadline && hasLargeClaim && hasFormalActionThreat)) {
      severity = 'CRITICAL';
      recommendations = [
        '在回复期限内组织法务或律师复核，避免逾期造成对方推进诉讼或保全。',
        '先核验权属、授权范围、侵权比对和损失计算，不在事实未明前承认全部责任或赔偿金额。',
        '冻结并保全代码仓库、部署记录、合同、沟通记录和访问日志。',
        '准备带保留意见的书面回函，要求对方补充证据清单和计算依据。',
      ];
    } else if (totalScore >= 10) {
      severity = 'HIGH';
      recommendations = [
        '尽快完成内部事实核验并准备书面回复。',
        '要求对方明确权属、授权边界、侵权行为和损失依据。',
        '收集合同、代码、付款、验收和沟通证据。',
      ];
    } else if (totalScore >= 5) {
      severity = 'MEDIUM';
      recommendations = [
        '梳理函件诉求与自身证据。',
        '评估是否存在授权、履行或抗辩依据。',
        '必要时咨询律师后回复。',
      ];
    } else {
      severity = 'LOW';
      recommendations = [
        '确认函件真实性和发送主体。',
        '根据事实材料决定是否回复或补充沟通。',
      ];
    }

    const factGaps = this.identifyFactGaps(fullText, letterInfo, entities);
    const basisWarnings = this.identifyBasisWarnings(fullText);
    suggestedActions.push(...this.generateSuggestedActions(fullText, severity, responseDeadline));

    return {
      severity,
      score: totalScore,
      factors,
      recommendations,
      relatedLaws: [...new Set(relatedLaws)],
      basisWarnings,
      factGaps,
      responseDeadline,
      suggestedActions,
    };
  }

  private inferRelatedLaws(text: string): string[] {
    const laws: string[] = [];

    if (/软件|代码|源代码|著作权|版权|复制|未经授权|侵权/.test(text)) {
      laws.push('《中华人民共和国著作权法》第十条：著作权包括复制权、发行权、信息网络传播权等权利，软件代码问题需先核验作品属性和权属。');
      laws.push('《中华人民共和国著作权法》第五十二条：未经许可使用作品等侵权行为，应根据情况承担停止侵害、消除影响、赔礼道歉、赔偿损失等民事责任。');
      laws.push('《中华人民共和国民法典》第一千一百六十五条：过错侵害他人民事权益造成损害的，应承担侵权责任。');
      laws.push('《中华人民共和国民法典》第一千一百八十五条：故意侵害知识产权且情节严重的，权利人可请求惩罚性赔偿。');
    }

    if (/合同|违约|尾款|验收|付款|服务/.test(text)) {
      laws.push('《中华人民共和国民法典》第五百七十七条：不履行合同义务或履行不符合约定的，应承担继续履行、补救措施或赔偿损失等违约责任。');
      laws.push('《中华人民共和国民法典》第五百八十五条：约定违约金过分高于造成损失的，可请求人民法院或仲裁机构予以适当减少。');
    }

    return laws;
  }

  private identifyFactGaps(
    text: string,
    letterInfo: LawyerLetterInfo,
    entities: ProcessResult['entities']
  ): string[] {
    const gaps: string[] = [];

    if (!letterInfo.senderCompany) {
      gaps.push('发函主体不明确，需要核验律所、委托人和授权委托手续。');
    }
    if (/软件|代码|源代码|未经授权|侵权/.test(text)) {
      gaps.push('需核验对方是否为软件代码权利人，包括著作权登记、开发记录、委托开发/职务作品协议。');
      gaps.push('需核验授权范围和实际使用行为，包括合同许可、交付范围、部署记录、访问日志和代码仓库历史。');
      gaps.push('需通过代码比对或技术鉴定判断接触可能性、实质性相似和被控代码范围。');
    }
    if (/赔偿|损失/.test(text) || entities.amounts?.length) {
      gaps.push('赔偿金额需要损失、获利、许可使用费或合理开支依据，不能只按函件金额直接确认。');
    }
    if (/公开道歉|道歉/.test(text)) {
      gaps.push('公开道歉诉求需核验是否涉及著作人身权、名誉或商誉损害，不能当然适用于所有财产性争议。');
    }
    if (!/第[一二三四五六七八九十百千万\d]+条|民法典|著作权法|合同法|劳动法|公司法/.test(text)) {
      gaps.push('原函未列明具体法条，应要求对方补充法律依据和对应事实。');
    }

    return gaps.length > 0 ? gaps : ['事实材料基本完整，但仍需核验原件、授权链条和证据真实性。'];
  }

  private identifyBasisWarnings(text: string): string[] {
    const warnings: string[] = [];

    if (/公开道歉|道歉/.test(text)) {
      warnings.push('公开道歉不是所有侵权或违约纠纷的当然救济，应结合权利类型、影响范围和损害后果判断。');
    }
    if (/删除/.test(text)) {
      warnings.push('删除代码或资料前应先完成证据保全，避免影响后续举证或被解读为销毁证据。');
    }
    if (/7日内|3日内|5日内/.test(text)) {
      warnings.push('短期限属于对方单方催告期限，不等于法院或仲裁机构确定的法定期限。');
    }

    return warnings;
  }

  private generateSuggestedActions(
    text: string,
    severity: RiskAssessment['severity'],
    responseDeadline?: string
  ): string[] {
    const actions: string[] = [];

    if (responseDeadline) {
      actions.push(`在 ${responseDeadline} 前发送书面回函，说明已收到函件、保留权利并要求对方补充证据。`);
    } else if (severity === 'HIGH' || severity === 'CRITICAL') {
      actions.push('尽快发送书面回函，避免被对方主张怠于回应或扩大损失。');
    }

    actions.push('核验发函主体和授权委托材料，确认对方是否有权代表权利人主张。');

    if (/软件|代码|源代码/.test(text)) {
      actions.push('立即保全代码仓库、提交记录、部署包、访问日志、合同附件和交付记录，必要时做公证或第三方存证。');
      actions.push('要求对方提供权属证明、授权链条、代码比对范围、侵权样本和损失计算依据。');
    }

    if (/赔偿|损失/.test(text)) {
      actions.push('对赔偿金额逐项核验，区分实际损失、对方获利、许可费、合理维权费用和惩罚性赔偿条件。');
    }

    if (/停止|删除/.test(text)) {
      actions.push('如存在持续使用风险，可先暂停争议范围内的新增使用；删除或下线前先完成证据保全和业务影响评估。');
    }

    if (/诉讼|仲裁|起诉|法院/.test(text)) {
      actions.push('同步准备管辖、仲裁条款、合同履行地、证据目录和可能抗辩点。');
    }

    return [...new Set(actions)];
  }

  private extractResponseDeadline(text: string, entities: ProcessResult['entities']): string | undefined {
    const relativeMatch = text.match(/(?:\d+|[一二三四五六七八九十]+)日内/);
    if (relativeMatch) return relativeMatch[0];

    for (const date of entities.dates || []) {
      if (date.includes('日内') || date.includes('日前')) {
        return date;
      }
    }

    const deadlineMatch = text.match(/(?:截止|到期)[^。；\n]{0,30}/);
    return deadlineMatch?.[0];
  }
}

export const lawyerLetterProcessor = new LawyerLetterProcessor();
export default lawyerLetterProcessor;
