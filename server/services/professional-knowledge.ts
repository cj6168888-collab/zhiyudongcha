/**
 * 专业知识库服务 (Professional Edge Intelligence)
 * 
 * 功能：
 * 1. 法律/财务知识的向量存储与检索
 * 2. 离线语义搜索（200ms内响应）
 * 3. 设备端知识同步协议
 * 4. 合同条款风险比对
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('ProfessionalKnowledge');

import { getDatabase } from '../db';
import { legalKnowledge, financeKnowledge, knowledgeSyncLogs, contractAnalysis } from '@shared/schema';
import type { LegalKnowledge, FinanceKnowledge, InsertLegalKnowledge, InsertFinanceKnowledge } from '@shared/schema';
import { eq, desc, sql, and, or, ilike, gte } from 'drizzle-orm';
import { simpleTextToVector, cosineSimilarity } from './vector-memory';
import { 
  laborLawEntries, 
  contractLawEntries, 
  companyLawEntries, 
  competitionLawEntries, 
  judicialInterpretationsEntries, 
  extendedFinanceEntries 
} from '../data/legal-knowledge-seed';

export type KnowledgeType = 'LEGAL' | 'FINANCE';
export type LegalCategory = 'CONTRACT' | 'CORPORATE' | 'LABOR' | 'TAX' | 'TRADE' | 'INTELLECTUAL_PROPERTY';
export type FinanceCategory = 'TAX' | 'ACCOUNTING' | 'INVESTMENT' | 'COMPLIANCE' | 'AUDIT';

export interface KnowledgeSearchResult {
  id: string;
  type: KnowledgeType;
  title: string;
  content: string;
  category: string;
  tags: string[];
  similarity: number;
  source?: string;
  articleNumber?: string;
}

export interface ContractClause {
  index: number;
  text: string;
  type: string;
}

export interface RiskPoint {
  clause: string;
  clauseIndex: number;
  risk: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  legalBasis: string[];
  suggestion: string;
}

export interface ContractAnalysisResult {
  clauses: ContractClause[];
  riskPoints: RiskPoint[];
  overallRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  summary: string;
  processingTimeMs: number;
}

export interface OCRResult {
  text: string;
  confidence: number;
  language: string;
  pageCount: number;
  processingTimeMs: number;
}

export interface ContractOCRAnalysisResult {
  ocrResult: OCRResult;
  analysis: ContractAnalysisResult;
  totalProcessingTimeMs: number;
}

export interface KnowledgeSyncPackage {
  type: 'FULL' | 'DELTA';
  knowledgeType: KnowledgeType;
  fromVersion: number;
  toVersion: number;
  items: (LegalKnowledge | FinanceKnowledge)[];
  totalBytes: number;
  checksum: string;
}

export interface KnowledgePatch {
  id: string;
  version: number;
  type: 'LEGAL_UPDATE' | 'FINANCE_UPDATE' | 'NEW_LAW' | 'CASE_STUDY';
  title: string;
  summary: string;
  items: PatchItem[];
  createdAt: Date;
  scheduledFor: Date;
  status: 'PENDING' | 'APPLIED' | 'SKIPPED';
  affectedDevices: string[];
}

export interface PatchItem {
  operation: 'ADD' | 'UPDATE' | 'DEPRECATE';
  knowledgeType: KnowledgeType;
  knowledgeId?: string;
  data: Partial<InsertLegalKnowledge | InsertFinanceKnowledge>;
  reason: string;
}

export interface PatchScheduleConfig {
  preferredHour: number;
  timezone: string;
  enableAutoApply: boolean;
  notifyBeforeApply: boolean;
}

export interface PatchNotification {
  deviceId: string;
  patchId: string;
  title: string;
  message: string;
  pendingPatches: number;
  estimatedDownloadSize: number;
}

const EMBEDDING_DIMENSIONS = 384;

class ProfessionalKnowledgeService {
  private legalCache: Map<string, LegalKnowledge> = new Map();
  private financeCache: Map<string, FinanceKnowledge> = new Map();
  private currentLegalVersion = 1;
  private currentFinanceVersion = 1;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.info('[ProfKnowledge] Already initialized, skipping');
      return;
    }
    logger.info('[ProfKnowledge] Initializing Professional Knowledge Service...');
    
    try {
      const legalCount = await getDatabase().select({ count: sql<number>`count(*)` }).from(legalKnowledge);
      const financeCount = await getDatabase().select({ count: sql<number>`count(*)` }).from(financeKnowledge);
      
      const legalNum = Number(legalCount[0]?.count) || 0;
      const financeNum = Number(financeCount[0]?.count) || 0;
      
      logger.info(`[ProfKnowledge] Legal entries: ${legalNum}, Finance entries: ${financeNum}`);
      
      if (legalNum === 0) {
        await this.seedSampleLegalKnowledge();
      }
      if (financeNum === 0) {
        await this.seedSampleFinanceKnowledge();
      }
      
      this.initialized = true;
      logger.info('[ProfKnowledge] Service initialized successfully');
    } catch (error) {
      logger.error({ error }, 'Initialization error');
    }
  }

  private async seedSampleLegalKnowledge(): Promise<void> {
    logger.info('[ProfKnowledge] Seeding comprehensive legal knowledge...');
    
    const allLegalEntries: InsertLegalKnowledge[] = [
      ...laborLawEntries,
      ...contractLawEntries,
      ...companyLawEntries,
      ...competitionLawEntries,
      ...judicialInterpretationsEntries,
    ];

    let seededCount = 0;
    for (const entry of allLegalEntries) {
      try {
        const embedding = simpleTextToVector(entry.content, EMBEDDING_DIMENSIONS);
        await getDatabase().insert(legalKnowledge).values({
          ...entry,
          embedding: JSON.stringify(embedding),
        });
        seededCount++;
      } catch (error) {
        logger.info(`[ProfKnowledge] Skip duplicate: ${entry.lawName} ${entry.articleNumber}`);
      }
    }
    
    logger.info(`[ProfKnowledge] Seeded ${seededCount} legal entries from comprehensive database`);
  }

  private async seedSampleFinanceKnowledge(): Promise<void> {
    logger.info('[ProfKnowledge] Seeding comprehensive finance knowledge...');
    
    let seededCount = 0;
    for (const entry of extendedFinanceEntries) {
      try {
        const embedding = simpleTextToVector(entry.content, EMBEDDING_DIMENSIONS);
        await getDatabase().insert(financeKnowledge).values({
          ...entry,
          embedding: JSON.stringify(embedding),
        });
        seededCount++;
      } catch (error) {
        logger.info(`[ProfKnowledge] Skip duplicate finance: ${entry.title}`);
      }
    }
    
    logger.info(`[ProfKnowledge] Seeded ${seededCount} finance entries from comprehensive database`);
  }

  async searchKnowledge(
    query: string,
    type?: KnowledgeType,
    category?: string,
    limit: number = 5,
    similarityThreshold: number = 0.1
  ): Promise<KnowledgeSearchResult[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const queryVector = simpleTextToVector(query, EMBEDDING_DIMENSIONS);
    const results: KnowledgeSearchResult[] = [];
    const addedIds = new Set<string>();

    try {
      if (!type || type === 'LEGAL') {
        const legalEntries = category 
          ? await getDatabase().select().from(legalKnowledge).where(eq(legalKnowledge.category, category)).limit(100)
          : await getDatabase().select().from(legalKnowledge).limit(100);

        for (const entry of legalEntries) {
          let similarity = 0;
          
          if (entry.embedding) {
            const entryVector = JSON.parse(entry.embedding) as number[];
            similarity = cosineSimilarity(queryVector, entryVector);
          }
          
          const keywordMatch = this.calculateKeywordMatch(
            query,
            `${entry.lawName} ${entry.articleNumber || ''} ${entry.content}`,
            entry.tags || []
          );
          const combinedScore = Math.max(similarity, keywordMatch);
          
          if (combinedScore >= similarityThreshold && !addedIds.has(entry.id)) {
            addedIds.add(entry.id);
            results.push({
              id: entry.id,
              type: 'LEGAL',
              title: `${entry.lawName} ${entry.articleNumber || ''}`,
              content: entry.content,
              category: entry.category,
              tags: entry.tags || [],
              similarity: combinedScore,
              articleNumber: entry.articleNumber || undefined,
            });
          }
        }
      }

      if (!type || type === 'FINANCE') {
        const financeEntries = category
          ? await getDatabase().select().from(financeKnowledge).where(eq(financeKnowledge.category, category)).limit(100)
          : await getDatabase().select().from(financeKnowledge).limit(100);

        for (const entry of financeEntries) {
          let similarity = 0;
          
          if (entry.embedding) {
            const entryVector = JSON.parse(entry.embedding) as number[];
            similarity = cosineSimilarity(queryVector, entryVector);
          }
          
          const keywordMatch = this.calculateKeywordMatch(
            query,
            `${entry.title} ${entry.content}`,
            entry.tags || []
          );
          const combinedScore = Math.max(similarity, keywordMatch);
          
          if (combinedScore >= similarityThreshold && !addedIds.has(entry.id)) {
            addedIds.add(entry.id);
            results.push({
              id: entry.id,
              type: 'FINANCE',
              title: entry.title,
              content: entry.content,
              category: entry.category,
              tags: entry.tags || [],
              similarity: combinedScore,
              source: entry.source || undefined,
            });
          }
        }
      }

      const existing = new Set(results.map(result => `${result.title}\u0000${result.content}`));
      for (const fallback of this.searchSeedKnowledge(query, type, category, limit, similarityThreshold)) {
        const key = `${fallback.title}\u0000${fallback.content}`;
        if (!existing.has(key) && !addedIds.has(fallback.id)) {
          existing.add(key);
          addedIds.add(fallback.id);
          results.push(fallback);
        }
      }

      results.sort((a, b) => b.similarity - a.similarity);
      const processingTime = Date.now() - startTime;
      logger.info(`[ProfKnowledge] Search completed in ${processingTime}ms, found ${results.length} matches`);
      
      return results.slice(0, limit);
      
    } catch (error) {
      logger.error({ error }, 'Search error');
      return this.searchSeedKnowledge(query, type, category, limit, similarityThreshold);
    }
  }

  private searchSeedKnowledge(
    query: string,
    type?: KnowledgeType,
    category?: string,
    limit: number = 5,
    similarityThreshold: number = 0.1
  ): KnowledgeSearchResult[] {
    const results: KnowledgeSearchResult[] = [];

    if (!type || type === 'LEGAL') {
      const legalEntries: InsertLegalKnowledge[] = [
        ...laborLawEntries,
        ...contractLawEntries,
        ...companyLawEntries,
        ...competitionLawEntries,
        ...judicialInterpretationsEntries,
      ];

      legalEntries.forEach((entry, index) => {
        if (category && entry.category !== category) return;
        const title = `${entry.lawName} ${entry.articleNumber || ''}`.trim();
        const similarity = this.calculateKeywordMatch(query, `${title} ${entry.content}`, entry.tags || []);
        if (similarity >= similarityThreshold) {
          results.push({
            id: `seed-legal-${index}`,
            type: 'LEGAL',
            title,
            content: entry.content || '',
            category: entry.category || 'GENERAL',
            tags: entry.tags || [],
            similarity,
            articleNumber: entry.articleNumber || undefined,
          });
        }
      });
    }

    if (!type || type === 'FINANCE') {
      extendedFinanceEntries.forEach((entry, index) => {
        if (category && entry.category !== category) return;
        const similarity = this.calculateKeywordMatch(query, `${entry.title} ${entry.content}`, entry.tags || []);
        if (similarity >= similarityThreshold) {
          results.push({
            id: `seed-finance-${index}`,
            type: 'FINANCE',
            title: entry.title,
            content: entry.content || '',
            category: entry.category || 'GENERAL',
            tags: entry.tags || [],
            similarity,
            source: entry.source || undefined,
          });
        }
      });
    }

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }
  
  private calculateKeywordMatch(query: string, content: string, tags: string[]): number {
    const queryChars = query.split('').filter(c => /[\u4e00-\u9fa5a-zA-Z0-9]/.test(c));
    let matchCount = 0;
    
    for (const char of queryChars) {
      if (content.includes(char)) matchCount++;
    }
    
    let charScore = queryChars.length > 0 ? matchCount / queryChars.length : 0;
    
    if (content.includes(query)) {
      charScore = Math.max(charScore, 0.9);
    }

    const searchable = `${content} ${tags.join(' ')}`;
    const synonymGroups = [
      ['拖欠工资', '克扣工资', '无故拖欠劳动者的工资', '未及时足额支付劳动报酬'],
      ['没有缴纳社保', '未缴社保', '未依法为劳动者缴纳社会保险费', '社会保险费'],
      ['解除劳动合同', '可以解除劳动合同', '单方解除', '被迫解除'],
      ['经济补偿', '支付经济补偿', '经济补偿金'],
      ['未签合同', '没签合同', '没签劳动合同', '没签书面合同', '没签书面劳动合同', '没有签合同', '没有签劳动合同', '未订立书面劳动合同', '二倍工资', '双倍工资', '双倍工资差额'],
      ['违法解除', '违法终止', '违法辞退', '非法辞退', '无故辞退', '口头辞退', '不用来了', '赔偿金', '2N'],
      ['违约金', '过分高于', '实际损失', '适当减少'],
      ['管辖', '争议解决', '法院'],
      ['劳动仲裁', '劳动争议仲裁', '仲裁时效', '申请仲裁', '劳动争议', '调解', '诉讼'],
    ];

    let synonymHits = 0;
    for (const group of synonymGroups) {
      const queryHit = group.some(term => query.includes(term));
      const contentHit = group.some(term => searchable.includes(term));
      if (queryHit && contentHit) {
        synonymHits++;
      }
    }
    if (synonymHits > 0) {
      charScore = Math.max(charScore, Math.min(0.98, 0.78 + synonymHits * 0.08));
    }
    if (query.includes('经济补偿') && /经济补偿按劳动者在本单位工作的年限|每满一年支付一个月工资/.test(searchable)) {
      charScore = Math.max(charScore, 0.95);
    }
    if (/拖欠工资|未及时足额支付劳动报酬|未缴社保|社会保险费|解除合同|解除劳动合同|经济补偿|劳动争议/.test(query)) {
      if (/劳动争议申请仲裁的时效期间为一年/.test(searchable)) {
        charScore = Math.max(charScore, 0.96);
      }
      if (/可以向劳动争议仲裁委员会申请仲裁|对仲裁裁决不服/.test(searchable)) {
        charScore = Math.max(charScore, 0.94);
      }
    }
    
    for (const tag of tags) {
      if (query.includes(tag) || tag.includes(query)) {
        charScore = Math.max(charScore, 0.8);
      }
    }
    
    return charScore;
  }

  async analyzeContractRisks(contractText: string): Promise<ContractAnalysisResult> {
    const startTime = Date.now();
    
    const clauses = this.extractClauses(contractText);
    const riskPoints: RiskPoint[] = [];
    
    const riskKeywords = [
      { keyword: '乙方承担全部责任', risk: '责任分配不对等', severity: 'HIGH' as const },
      { keyword: '不可撤销', risk: '权利限制条款', severity: 'MEDIUM' as const },
      { keyword: '自动续期', risk: '合同自动延续风险', severity: 'MEDIUM' as const },
      { keyword: '放弃追诉权', risk: '权利放弃条款', severity: 'CRITICAL' as const },
      { keyword: '违约金.*?%', risk: '高额违约金条款', severity: 'HIGH' as const },
      { keyword: '保密期限.*?永久', risk: '过长保密期限', severity: 'MEDIUM' as const },
      { keyword: '竞业限制', risk: '竞业限制条款需审慎', severity: 'MEDIUM' as const },
      { keyword: '知识产权.*?归.*?方所有', risk: '知识产权归属条款', severity: 'HIGH' as const },
      { keyword: '排他性', risk: '排他性条款限制', severity: 'MEDIUM' as const },
      { keyword: '不承担.*?责任', risk: '免责条款需关注', severity: 'HIGH' as const },
    ];

    for (const clause of clauses) {
      for (const riskPattern of riskKeywords) {
        if (new RegExp(riskPattern.keyword, 'i').test(clause.text)) {
          const relevantLaw = await this.searchKnowledge(clause.text, 'LEGAL', undefined, 1);
          
          riskPoints.push({
            clause: clause.text.slice(0, 100) + (clause.text.length > 100 ? '...' : ''),
            clauseIndex: clause.index,
            risk: riskPattern.risk,
            severity: riskPattern.severity,
            legalBasis: relevantLaw.map(l => l.title),
            suggestion: this.generateSuggestion(riskPattern.risk, riskPattern.severity),
          });
        }
      }
    }

    const overallRiskLevel = this.calculateOverallRisk(riskPoints);
    const processingTime = Date.now() - startTime;

    return {
      clauses,
      riskPoints,
      overallRiskLevel,
      summary: this.generateSummary(riskPoints, overallRiskLevel),
      processingTimeMs: processingTime,
    };
  }

  private extractClauses(text: string): ContractClause[] {
    const clauses: ContractClause[] = [];
    const patterns = [
      /第[一二三四五六七八九十\d]+条[：:]\s*(.+?)(?=第[一二三四五六七八九十\d]+条|$)/g,
      /(\d+)[\.、]\s*(.+?)(?=\d+[\.、]|$)/g,
      /[（\(][一二三四五六七八九十\d]+[）\)]\s*(.+?)(?=[（\(][一二三四五六七八九十\d]+[）\)]|$)/g,
    ];

    let index = 0;
    const lines = text.split(/\n+/).filter(l => l.trim().length > 10);
    
    for (const line of lines) {
      clauses.push({
        index: index++,
        text: line.trim(),
        type: this.classifyClause(line),
      });
    }

    return clauses;
  }

  private classifyClause(text: string): string {
    const classifiers: Record<string, RegExp[]> = {
      '甲乙方定义': [/甲方|乙方|丙方/],
      '标的条款': [/标的|交易内容|服务范围/],
      '价款条款': [/价[款格]|费用|报酬|付款/],
      '期限条款': [/期限|有效期|起止时间/],
      '违约责任': [/违约|赔偿|责任/],
      '争议解决': [/争议|仲裁|诉讼|管辖/],
      '保密条款': [/保密|机密|不得泄露/],
      '知识产权': [/知识产权|著作权|专利|商标/],
    };

    for (const [type, patterns] of Object.entries(classifiers)) {
      if (patterns.some(p => p.test(text))) {
        return type;
      }
    }
    return '一般条款';
  }

  private generateSuggestion(risk: string, severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'): string {
    const suggestions: Record<string, string> = {
      '责任分配不对等': '建议修改为"双方按各自过错程度承担相应责任"',
      '权利限制条款': '建议增加合理的撤销或变更条件',
      '合同自动延续风险': '建议明确续期需双方书面确认',
      '权利放弃条款': '此条款可能无效，建议删除或重新协商',
      '高额违约金条款': '违约金超过损失30%可请求法院调整',
      '过长保密期限': '建议限定合理保密期限（如3-5年）',
      '竞业限制条款需审慎': '竞业限制最长2年，需支付经济补偿',
      '知识产权归属条款': '明确区分现有知识产权与新产生知识产权',
      '排他性条款限制': '评估排他性对业务发展的实际影响',
      '免责条款需关注': '核实免责条款是否符合法律规定的有效性条件',
    };
    return suggestions[risk] || '建议咨询专业律师审核该条款';
  }

  private calculateOverallRisk(riskPoints: RiskPoint[]): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (riskPoints.some(r => r.severity === 'CRITICAL')) return 'CRITICAL';
    const highCount = riskPoints.filter(r => r.severity === 'HIGH').length;
    if (highCount >= 3) return 'CRITICAL';
    if (highCount >= 1) return 'HIGH';
    const mediumCount = riskPoints.filter(r => r.severity === 'MEDIUM').length;
    if (mediumCount >= 3) return 'MEDIUM';
    return 'LOW';
  }

  private generateSummary(riskPoints: RiskPoint[], overallRisk: string): string {
    if (riskPoints.length === 0) {
      return '爸爸，这份合同未发现明显风险条款，但建议仔细阅读全文。';
    }
    
    const critical = riskPoints.filter(r => r.severity === 'CRITICAL').length;
    const high = riskPoints.filter(r => r.severity === 'HIGH').length;
    
    if (critical > 0) {
      return `爸爸，发现 ${critical} 个严重风险条款需要立即处理！建议暂缓签署并与对方重新协商。`;
    }
    if (high > 0) {
      return `爸爸，发现 ${high} 个高风险条款，建议在签署前要求修改这些条款以保护您的权益。`;
    }
    return `爸爸，发现 ${riskPoints.length} 个需要关注的条款，整体风险可控，但建议仔细审阅标注内容。`;
  }

  async prepareSyncPackage(
    deviceId: string,
    knowledgeType: KnowledgeType,
    fromVersion: number = 0
  ): Promise<KnowledgeSyncPackage> {
    const items: (LegalKnowledge | FinanceKnowledge)[] = [];
    
    if (knowledgeType === 'LEGAL') {
      const entries = await getDatabase().select().from(legalKnowledge)
        .where(gte(legalKnowledge.syncVersion, fromVersion));
      items.push(...entries);
    } else {
      const entries = await getDatabase().select().from(financeKnowledge)
        .where(gte(financeKnowledge.syncVersion, fromVersion));
      items.push(...entries);
    }

    const jsonStr = JSON.stringify(items);
    const checksum = this.simpleHash(jsonStr);

    await getDatabase().insert(knowledgeSyncLogs).values({
      deviceId,
      deviceType: 'MOBILE',
      syncType: fromVersion === 0 ? 'FULL' : 'DELTA',
      knowledgeType,
      status: 'IN_PROGRESS',
      itemsCount: items.length,
      bytesTransferred: jsonStr.length,
      fromVersion,
      toVersion: knowledgeType === 'LEGAL' ? this.currentLegalVersion : this.currentFinanceVersion,
    });

    return {
      type: fromVersion === 0 ? 'FULL' : 'DELTA',
      knowledgeType,
      fromVersion,
      toVersion: knowledgeType === 'LEGAL' ? this.currentLegalVersion : this.currentFinanceVersion,
      items,
      totalBytes: jsonStr.length,
      checksum,
    };
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * 合同图像OCR识别
   * 使用DashScope Qwen-VL-Plus进行图像文字识别
   */
  async performContractOCR(imageBase64: string): Promise<OCRResult> {
    const startTime = Date.now();
    const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
    const DASHSCOPE_VL_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';

    if (!DASHSCOPE_API_KEY) {
      logger.warn('[ProfKnowledge] DashScope API未配置，无法执行OCR');
      return {
        text: '',
        confidence: 0,
        language: 'unknown',
        pageCount: 0,
        processingTimeMs: Date.now() - startTime,
      };
    }

    try {
      const imageUrl = imageBase64.startsWith('data:')
        ? imageBase64
        : `data:image/jpeg;base64,${imageBase64}`;

      const response = await fetch(DASHSCOPE_VL_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen-vl-plus',
          input: {
            messages: [
              {
                role: 'user',
                content: [
                  { image: imageUrl },
                  { 
                    text: `请识别这份合同文档中的所有文字。要求：
1. 按照从上到下、从左到右的顺序输出完整文字
2. 保留原文格式，包括段落、序号、标点
3. 特别注意识别金额、日期、专业术语
4. 如有表格，请保持表格结构
5. 只输出识别到的文字，不添加任何解释` 
                  },
                ],
              },
            ],
          },
          parameters: {
            max_tokens: 4000,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DashScope VL API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const extractedText = data.output?.choices?.[0]?.message?.content || data.output?.text || '';

      const detectedLanguage = this.detectLanguage(extractedText);
      const processingTime = Date.now() - startTime;

      logger.info(`[ProfKnowledge] OCR completed in ${processingTime}ms, extracted ${extractedText.length} chars`);

      return {
        text: extractedText.trim(),
        confidence: extractedText.length > 50 ? 0.9 : 0.5,
        language: detectedLanguage,
        pageCount: 1,
        processingTimeMs: processingTime,
      };
    } catch (error) {
      logger.error({ error }, 'OCR error');
      return {
        text: '',
        confidence: 0,
        language: 'unknown',
        pageCount: 0,
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * 合同图像OCR + 风险分析一体化
   * 先OCR提取文字，再进行风险分析
   */
  async analyzeContractFromImage(imageBase64: string): Promise<ContractOCRAnalysisResult> {
    const totalStartTime = Date.now();

    const ocrResult = await this.performContractOCR(imageBase64);

    if (!ocrResult.text || ocrResult.text.length < 20) {
      return {
        ocrResult,
        analysis: {
          clauses: [],
          riskPoints: [],
          overallRiskLevel: 'LOW',
          summary: '爸爸，无法从图片中识别出有效的合同文字，请确保图片清晰可读。',
          processingTimeMs: 0,
        },
        totalProcessingTimeMs: Date.now() - totalStartTime,
      };
    }

    const analysis = await this.analyzeContractRisks(ocrResult.text);

    return {
      ocrResult,
      analysis,
      totalProcessingTimeMs: Date.now() - totalStartTime,
    };
  }

  /**
   * 多页合同OCR分析
   * 支持多张图片合并分析
   */
  async analyzeMultiPageContract(imageBase64Array: string[]): Promise<ContractOCRAnalysisResult> {
    const totalStartTime = Date.now();

    const allTexts: string[] = [];
    let totalConfidence = 0;

    for (let i = 0; i < imageBase64Array.length; i++) {
      logger.info(`[ProfKnowledge] Processing page ${i + 1}/${imageBase64Array.length}`);
      const pageResult = await this.performContractOCR(imageBase64Array[i]);
      if (pageResult.text) {
        allTexts.push(`--- 第${i + 1}页 ---\n${pageResult.text}`);
        totalConfidence += pageResult.confidence;
      }
    }

    const combinedText = allTexts.join('\n\n');
    const avgConfidence = imageBase64Array.length > 0 ? totalConfidence / imageBase64Array.length : 0;

    const ocrResult: OCRResult = {
      text: combinedText,
      confidence: avgConfidence,
      language: this.detectLanguage(combinedText),
      pageCount: imageBase64Array.length,
      processingTimeMs: Date.now() - totalStartTime,
    };

    if (!combinedText || combinedText.length < 20) {
      return {
        ocrResult,
        analysis: {
          clauses: [],
          riskPoints: [],
          overallRiskLevel: 'LOW',
          summary: '爸爸，无法从图片中识别出有效的合同文字，请确保所有图片清晰可读。',
          processingTimeMs: 0,
        },
        totalProcessingTimeMs: Date.now() - totalStartTime,
      };
    }

    const analysis = await this.analyzeContractRisks(combinedText);

    return {
      ocrResult,
      analysis,
      totalProcessingTimeMs: Date.now() - totalStartTime,
    };
  }

  private detectLanguage(text: string): string {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
    const totalChars = text.length;

    if (chineseChars / totalChars > 0.3) return 'zh-CN';
    if (englishChars / totalChars > 0.5) return 'en';
    return 'mixed';
  }

  async getStats(): Promise<{
    legalCount: number;
    financeCount: number;
    legalVersion: number;
    financeVersion: number;
    categoryCounts: Record<string, number>;
  }> {
    const legalEntries = await getDatabase().select().from(legalKnowledge);
    const financeEntries = await getDatabase().select().from(financeKnowledge);
    
    const categoryCounts: Record<string, number> = {};
    
    for (const entry of legalEntries) {
      const key = `LEGAL_${entry.category}`;
      categoryCounts[key] = (categoryCounts[key] || 0) + 1;
    }
    
    for (const entry of financeEntries) {
      const key = `FINANCE_${entry.category}`;
      categoryCounts[key] = (categoryCounts[key] || 0) + 1;
    }

    return {
      legalCount: legalEntries.length,
      financeCount: financeEntries.length,
      legalVersion: this.currentLegalVersion,
      financeVersion: this.currentFinanceVersion,
      categoryCounts,
    };
  }

  // ==================== 夜间知识补丁系统 ====================
  
  private pendingPatches: Map<string, KnowledgePatch> = new Map();
  private patchScheduleConfig: PatchScheduleConfig = {
    preferredHour: 3, // 凌晨3点执行
    timezone: 'Asia/Shanghai',
    enableAutoApply: true,
    notifyBeforeApply: true,
  };
  private patchScheduleTimer: NodeJS.Timeout | null = null;

  /**
   * 创建知识补丁
   * 用于服务器端检测到法规更新后创建补丁
   */
  async createPatch(
    type: KnowledgePatch['type'],
    title: string,
    summary: string,
    items: PatchItem[]
  ): Promise<KnowledgePatch> {
    const patchId = `PATCH_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    const scheduledTime = this.getNextScheduledTime();
    
    const patch: KnowledgePatch = {
      id: patchId,
      version: type.startsWith('LEGAL') ? this.currentLegalVersion + 1 : this.currentFinanceVersion + 1,
      type,
      title,
      summary,
      items,
      createdAt: new Date(),
      scheduledFor: scheduledTime,
      status: 'PENDING',
      affectedDevices: [],
    };
    
    this.pendingPatches.set(patchId, patch);
    logger.info(`[ProfKnowledge] Created patch ${patchId}: ${title}, scheduled for ${scheduledTime.toISOString()}`);
    
    return patch;
  }

  /**
   * 获取下一个补丁执行时间
   */
  private getNextScheduledTime(): Date {
    const now = new Date();
    const scheduled = new Date(now);
    scheduled.setHours(this.patchScheduleConfig.preferredHour, 0, 0, 0);
    
    if (scheduled <= now) {
      scheduled.setDate(scheduled.getDate() + 1);
    }
    
    return scheduled;
  }

  /**
   * 获取待处理的补丁列表
   */
  getPendingPatches(): KnowledgePatch[] {
    return Array.from(this.pendingPatches.values())
      .filter(p => p.status === 'PENDING')
      .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());
  }

  /**
   * 应用单个补丁
   */
  async applyPatch(patchId: string): Promise<{ success: boolean; appliedCount: number; errors: string[] }> {
    const patch = this.pendingPatches.get(patchId);
    if (!patch) {
      return { success: false, appliedCount: 0, errors: ['Patch not found'] };
    }

    if (patch.status !== 'PENDING') {
      return { success: false, appliedCount: 0, errors: ['Patch already processed'] };
    }

    const errors: string[] = [];
    let appliedCount = 0;

    for (const item of patch.items) {
      try {
        if (item.knowledgeType === 'LEGAL') {
          if (item.operation === 'ADD') {
            const embedding = simpleTextToVector((item.data as InsertLegalKnowledge).content || '', EMBEDDING_DIMENSIONS);
            await getDatabase().insert(legalKnowledge).values({
              ...(item.data as InsertLegalKnowledge),
              embedding: JSON.stringify(embedding),
              syncVersion: patch.version,
            });
            appliedCount++;
          } else if (item.operation === 'UPDATE' && item.knowledgeId) {
            await getDatabase().update(legalKnowledge)
              .set({ ...item.data, syncVersion: patch.version })
              .where(eq(legalKnowledge.id, item.knowledgeId));
            appliedCount++;
          } else if (item.operation === 'DEPRECATE' && item.knowledgeId) {
            await getDatabase().update(legalKnowledge)
              .set({ syncVersion: patch.version })
              .where(eq(legalKnowledge.id, item.knowledgeId));
            appliedCount++;
          }
        } else if (item.knowledgeType === 'FINANCE') {
          if (item.operation === 'ADD') {
            const embedding = simpleTextToVector((item.data as InsertFinanceKnowledge).content || '', EMBEDDING_DIMENSIONS);
            await getDatabase().insert(financeKnowledge).values({
              ...(item.data as InsertFinanceKnowledge),
              embedding: JSON.stringify(embedding),
              syncVersion: patch.version,
            });
            appliedCount++;
          } else if (item.operation === 'UPDATE' && item.knowledgeId) {
            await getDatabase().update(financeKnowledge)
              .set({ ...item.data, syncVersion: patch.version })
              .where(eq(financeKnowledge.id, item.knowledgeId));
            appliedCount++;
          } else if (item.operation === 'DEPRECATE' && item.knowledgeId) {
            await getDatabase().update(financeKnowledge)
              .set({ syncVersion: patch.version })
              .where(eq(financeKnowledge.id, item.knowledgeId));
            appliedCount++;
          }
        }
      } catch (error) {
        errors.push(`Failed to apply item: ${error}`);
      }
    }

    if (patch.type.startsWith('LEGAL')) {
      this.currentLegalVersion = patch.version;
    } else {
      this.currentFinanceVersion = patch.version;
    }

    patch.status = 'APPLIED';
    logger.info(`[ProfKnowledge] Applied patch ${patchId}: ${appliedCount} items, ${errors.length} errors`);

    return { success: errors.length === 0, appliedCount, errors };
  }

  /**
   * 生成设备补丁通知
   */
  generatePatchNotification(deviceId: string): PatchNotification | null {
    const pendingPatches = this.getPendingPatches();
    if (pendingPatches.length === 0) return null;

    const nextPatch = pendingPatches[0];
    const totalSize = pendingPatches.reduce((sum, p) => {
      return sum + JSON.stringify(p.items).length;
    }, 0);

    return {
      deviceId,
      patchId: nextPatch.id,
      title: `知识库更新: ${nextPatch.title}`,
      message: nextPatch.summary,
      pendingPatches: pendingPatches.length,
      estimatedDownloadSize: totalSize,
    };
  }

  /**
   * 启动夜间补丁调度器
   */
  startPatchScheduler(): void {
    if (this.patchScheduleTimer) {
      clearInterval(this.patchScheduleTimer);
    }

    this.patchScheduleTimer = setInterval(async () => {
      await this.checkAndApplyScheduledPatches();
    }, 60 * 60 * 1000); // 每小时检查一次

    logger.info(`[ProfKnowledge] Patch scheduler started, preferred hour: ${this.patchScheduleConfig.preferredHour}:00`);
  }

  /**
   * 检查并应用定时补丁
   */
  private async checkAndApplyScheduledPatches(): Promise<void> {
    const now = new Date();
    const currentHour = now.getHours();

    if (currentHour !== this.patchScheduleConfig.preferredHour) {
      return;
    }

    if (!this.patchScheduleConfig.enableAutoApply) {
      logger.info('[ProfKnowledge] Auto-apply disabled, skipping scheduled patches');
      return;
    }

    const pendingPatches = this.getPendingPatches();
    const duePatches = pendingPatches.filter(p => p.scheduledFor <= now);

    logger.info(`[ProfKnowledge] Checking scheduled patches: ${duePatches.length} due`);

    for (const patch of duePatches) {
      logger.info(`[ProfKnowledge] Applying scheduled patch: ${patch.id}`);
      await this.applyPatch(patch.id);
    }
  }

  /**
   * 更新补丁调度配置
   */
  updatePatchScheduleConfig(config: Partial<PatchScheduleConfig>): void {
    this.patchScheduleConfig = { ...this.patchScheduleConfig, ...config };
    logger.info(`[ProfKnowledge] Updated patch schedule config:`, this.patchScheduleConfig);
  }

  /**
   * 获取补丁调度配置
   */
  getPatchScheduleConfig(): PatchScheduleConfig {
    return { ...this.patchScheduleConfig };
  }

  /**
   * 跳过指定补丁
   */
  skipPatch(patchId: string): boolean {
    const patch = this.pendingPatches.get(patchId);
    if (!patch || patch.status !== 'PENDING') {
      return false;
    }
    patch.status = 'SKIPPED';
    logger.info(`[ProfKnowledge] Skipped patch ${patchId}`);
    return true;
  }

  /**
   * 获取补丁历史
   */
  getPatchHistory(): KnowledgePatch[] {
    return Array.from(this.pendingPatches.values())
      .filter(p => p.status !== 'PENDING')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * 创建示例法规更新补丁（用于测试）
   */
  async createSampleLegalUpdatePatch(): Promise<KnowledgePatch> {
    return this.createPatch(
      'LEGAL_UPDATE',
      '民法典司法解释更新',
      '最高人民法院关于适用《中华人民共和国民法典》合同编通则若干问题的解释已发布',
      [
        {
          operation: 'ADD',
          knowledgeType: 'LEGAL',
          data: {
            lawName: '民法典合同编通则司法解释',
            articleNumber: '第一条',
            chapterSection: '总则',
            content: '人民法院依据民法典合同编通则相关规定审理合同纠纷案件，应当坚持鼓励交易原则，依法认定合同效力。',
            category: 'CONTRACT',
            tags: ['司法解释', '合同效力', '鼓励交易'],
            version: '2023',
          },
          reason: '最高院新发布司法解释',
        },
      ]
    );
  }

  /**
   * 生成内容哈希用于去重
   */
  private contentHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  /**
   * 批量导入扩展法律财税知识库
   * 包含：劳动法、合同法、公司法、竞争法、司法解释、财税法规
   * 使用法律名+条款号+版本号进行去重，缺少字段时使用内容哈希
   */
  async seedExtendedKnowledge(): Promise<{ legal: number; finance: number }> {
    logger.info('[ProfKnowledge] Starting extended knowledge seed...');
    
    const allLegalEntries = [
      ...laborLawEntries,
      ...contractLawEntries,
      ...companyLawEntries,
      ...competitionLawEntries,
      ...judicialInterpretationsEntries,
    ];

    let legalInserted = 0;
    let financeInserted = 0;

    for (const entry of allLegalEntries) {
      try {
        let existing;
        if (entry.lawName && entry.articleNumber) {
          existing = await getDatabase().select().from(legalKnowledge)
            .where(and(
              eq(legalKnowledge.lawName, entry.lawName),
              eq(legalKnowledge.articleNumber, entry.articleNumber),
              eq(legalKnowledge.version, entry.version || '')
            ))
            .limit(1);
        } else {
          const hash = this.contentHash(entry.content);
          existing = await getDatabase().select().from(legalKnowledge)
            .where(ilike(legalKnowledge.content, `%${entry.content.substring(0, 50)}%`))
            .limit(1);
        }
        
        if (existing.length === 0) {
          const embedding = simpleTextToVector(entry.content, EMBEDDING_DIMENSIONS);
          await getDatabase().insert(legalKnowledge).values({
            ...entry,
            embedding: JSON.stringify(embedding),
          });
          legalInserted++;
        }
      } catch (error) {
        logger.error({ err: error, lawName: entry.lawName, articleNumber: entry.articleNumber }, 'Failed to insert legal entry');
      }
    }

    for (const entry of extendedFinanceEntries) {
      try {
        let existing;
        if (entry.title) {
          existing = await getDatabase().select().from(financeKnowledge)
            .where(eq(financeKnowledge.title, entry.title))
            .limit(1);
        } else {
          existing = await getDatabase().select().from(financeKnowledge)
            .where(ilike(financeKnowledge.content, `%${entry.content.substring(0, 50)}%`))
            .limit(1);
        }
        
        if (existing.length === 0) {
          const embedding = simpleTextToVector(entry.content, EMBEDDING_DIMENSIONS);
          await getDatabase().insert(financeKnowledge).values({
            ...entry,
            embedding: JSON.stringify(embedding),
          });
          financeInserted++;
        }
      } catch (error) {
        logger.error({ err: error, title: entry.title }, 'Failed to insert finance entry');
      }
    }

    logger.info(`[ProfKnowledge] Extended seed complete: ${legalInserted} legal, ${financeInserted} finance entries`);
    return { legal: legalInserted, finance: financeInserted };
  }

  /**
   * 获取知识库统计信息
   */
  async getKnowledgeStats(): Promise<{ 
    legalCount: number; 
    financeCount: number; 
    categories: { legal: Record<string, number>; finance: Record<string, number> };
  }> {
    const legalResult = await getDatabase().select({ count: sql<number>`count(*)` }).from(legalKnowledge);
    const financeResult = await getDatabase().select({ count: sql<number>`count(*)` }).from(financeKnowledge);
    
    const legalCats = await getDatabase().select({ 
      category: legalKnowledge.category,
      count: sql<number>`count(*)`
    }).from(legalKnowledge).groupBy(legalKnowledge.category);
    
    const financeCats = await getDatabase().select({ 
      category: financeKnowledge.category,
      count: sql<number>`count(*)`
    }).from(financeKnowledge).groupBy(financeKnowledge.category);
    
    const legalCategories: Record<string, number> = {};
    const financeCategories: Record<string, number> = {};
    
    for (const cat of legalCats) {
      if (cat.category) legalCategories[cat.category] = Number(cat.count);
    }
    for (const cat of financeCats) {
      if (cat.category) financeCategories[cat.category] = Number(cat.count);
    }
    
    return {
      legalCount: Number(legalResult[0]?.count) || 0,
      financeCount: Number(financeResult[0]?.count) || 0,
      categories: {
        legal: legalCategories,
        finance: financeCategories,
      }
    };
  }
}

export const professionalKnowledge = new ProfessionalKnowledgeService();

export { ProfessionalKnowledgeService };
