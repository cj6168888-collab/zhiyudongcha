import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('EntityExtractor');

import { getDatabase } from "../db";
import { unifiedContacts, type InsertUnifiedContact, type UnifiedContact } from "@shared/schema";
import { eq, ilike, or, sql } from "drizzle-orm";

export interface ExtractedEntity {
  type: 'person' | 'company' | 'project' | 'contact_info';
  value: string;
  confidence: number;
  metadata?: Record<string, unknown>;
}

export interface ExtractedPerson {
  name: string;
  role?: string;
  organization?: string;
  phone?: string[];
  email?: string[];
  wechatId?: string;
  dingdingId?: string;
  tags?: string[];
  context?: string;
  confidence: number;
}

export interface ExtractedProject {
  title: string;
  description?: string;
  category?: string;
  relatedPersons?: string[];
  confidence: number;
}

export interface ExtractionResult {
  persons: ExtractedPerson[];
  projects: ExtractedProject[];
  companies: string[];
  contactInfos: Array<{ type: string; value: string }>;
  rawEntities: ExtractedEntity[];
}

const EXTRACTION_PROMPT = `你是一个信息提取专家。请从以下文本中提取关键实体信息。

提取要求：
1. 人物：姓名、职位/角色、所属公司/组织、联系方式（电话、邮箱、微信）
2. 公司/组织：名称
3. 项目：项目名称、描述
4. 联系信息：电话号码、邮箱地址、微信号

请以JSON格式返回，结构如下：
{
  "persons": [
    {
      "name": "姓名",
      "role": "职位",
      "organization": "公司名",
      "phone": ["电话"],
      "email": ["邮箱"],
      "wechatId": "微信号",
      "tags": ["标签"],
      "context": "提及此人的上下文",
      "confidence": 0.9
    }
  ],
  "projects": [
    {
      "title": "项目名",
      "description": "描述",
      "category": "类别",
      "relatedPersons": ["相关人员姓名"],
      "confidence": 0.8
    }
  ],
  "companies": ["公司名1", "公司名2"],
  "contactInfos": [
    { "type": "phone", "value": "13800138000" },
    { "type": "email", "value": "example@test.com" }
  ]
}

注意：
- 只提取明确提到的信息，不要推测
- confidence表示提取的确信度(0-1)
- 如果某类信息不存在，返回空数组
- 中国手机号格式：1开头的11位数字
- 邮箱格式：包含@符号

文本内容：
`;

export class EntityExtractor {
  private dashscopeApiKey: string | undefined;

  constructor() {
    this.dashscopeApiKey = process.env.DASHSCOPE_API_KEY;
  }

  async extractFromText(text: string): Promise<ExtractionResult> {
    if (!this.dashscopeApiKey) {
      logger.warn('[EntityExtractor] No API key, using regex fallback');
      return this.regexFallback(text);
    }

    try {
      const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.dashscopeApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are an entity extraction expert. Always respond with valid JSON only, no markdown.'
            },
            {
              role: 'user',
              content: EXTRACTION_PROMPT + text
            }
          ],
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        logger.error({ status: response.status }, '[EntityExtractor] API error');
        return this.regexFallback(text);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.error('[EntityExtractor] No JSON in response');
        return this.regexFallback(text);
      }

      const result = JSON.parse(jsonMatch[0]) as ExtractionResult;
      result.rawEntities = this.buildRawEntities(result);
      return result;
    } catch (error) {
      logger.error({ err: error }, '[EntityExtractor] Error');
      return this.regexFallback(text);
    }
  }

  private regexFallback(text: string): ExtractionResult {
    const result: ExtractionResult = {
      persons: [],
      projects: [],
      companies: [],
      contactInfos: [],
      rawEntities: [],
    };

    const phoneRegex = /1[3-9]\d{9}/g;
    const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
    const wechatRegex = /微信[：:]\s*([a-zA-Z0-9_-]+)/g;

    const phones = text.match(phoneRegex) || [];
    phones.forEach(phone => {
      result.contactInfos.push({ type: 'phone', value: phone });
      result.rawEntities.push({ type: 'contact_info', value: phone, confidence: 0.9 });
    });

    const emails = text.match(emailRegex) || [];
    emails.forEach(email => {
      result.contactInfos.push({ type: 'email', value: email });
      result.rawEntities.push({ type: 'contact_info', value: email, confidence: 0.9 });
    });

    let wechatMatch;
    while ((wechatMatch = wechatRegex.exec(text)) !== null) {
      result.contactInfos.push({ type: 'wechat', value: wechatMatch[1] });
    }

    const chineseNameRegex = /[\u4e00-\u9fa5]{2,4}(?:先生|女士|老师|总|经理|主任|院长|教授|博士)/g;
    const names = text.match(chineseNameRegex) || [];
    names.forEach(name => {
      const cleanName = name.replace(/(先生|女士|老师|总|经理|主任|院长|教授|博士)$/, '');
      const title = name.match(/(先生|女士|老师|总|经理|主任|院长|教授|博士)$/)?.[0];
      result.persons.push({
        name: cleanName,
        role: title,
        confidence: 0.6,
      });
    });

    return result;
  }

  private buildRawEntities(result: ExtractionResult): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    
    result.persons.forEach(p => {
      entities.push({ type: 'person', value: p.name, confidence: p.confidence, metadata: p });
    });
    
    result.companies.forEach(c => {
      entities.push({ type: 'company', value: c, confidence: 0.8 });
    });
    
    result.contactInfos.forEach(c => {
      entities.push({ type: 'contact_info', value: c.value, confidence: 0.9, metadata: c });
    });

    return entities;
  }

  async createPersonsFromExtraction(extraction: ExtractionResult, options?: {
    autoConfirm?: boolean;
    source?: string;
  }): Promise<{ created: number; updated: number; skipped: number; persons: Array<UnifiedContact & { isNew?: boolean; updated?: boolean }> }> {
    const result = { created: 0, updated: 0, skipped: 0, persons: [] as Array<UnifiedContact & { isNew?: boolean; updated?: boolean }> };

    for (const extracted of extraction.persons) {
      if (extracted.confidence < 0.5) {
        result.skipped++;
        continue;
      }

      try {
        const existing = await this.findExistingContact(extracted.name, extracted.phone, extracted.email);
        
        if (existing) {
          const mergedPhones = this.mergeArrays(existing.phone || [], extracted.phone || []);
          const mergedEmails = this.mergeArrays(existing.email || [], extracted.email || []);
          
          await getDatabase().update(unifiedContacts)
            .set({
              role: extracted.role || existing.role,
              organization: extracted.organization || existing.organization,
              phone: mergedPhones,
              email: mergedEmails,
              wechatId: extracted.wechatId || existing.wechatId,
              lastInteraction: new Date(),
            })
            .where(eq(unifiedContacts.id, existing.id));
          result.updated++;
          result.persons.push({ ...existing, updated: true });
        } else {
          const [created] = await getDatabase().insert(unifiedContacts).values({
            name: extracted.name,
            role: extracted.role,
            organization: extracted.organization,
            phone: extracted.phone || [],
            email: extracted.email || [],
            wechatId: extracted.wechatId,
            sources: [{ platform: options?.source || 'AI_EXTRACTION', lastSync: new Date() }],
            importance: 50,
            trustScore: 50,
            interactionCount: 0,
            initiatedByMe: 0,
            initiatedByThem: 0,
          }).returning();
          result.created++;
          result.persons.push({ ...created, isNew: true });
        }
      } catch (error) {
        logger.error({ err: error }, '[EntityExtractor] Error creating contact');
        result.skipped++;
      }
    }

    return result;
  }

  private async findExistingContact(name: string, phones?: string[], emails?: string[]): Promise<UnifiedContact | null> {
    const conditions = [];
    
    if (phones?.length) {
      for (const phone of phones) {
        conditions.push(sql`${phone} = ANY(${unifiedContacts.phone})`);
      }
    }
    
    if (emails?.length) {
      for (const email of emails) {
        conditions.push(sql`${email} = ANY(${unifiedContacts.email})`);
      }
    }
    
    if (conditions.length === 0) {
      conditions.push(ilike(unifiedContacts.name, `%${name}%`));
    }
    
    const [existing] = await db
      .select()
      .from(unifiedContacts)
      .where(or(...conditions))
      .limit(1);

    return existing || null;
  }

  private mergeArrays(existing: string[], incoming: string[]): string[] {
    const set = new Set([...existing, ...incoming].map(s => s.toLowerCase().trim()));
    return Array.from(set);
  }

  async extractAndHarvest(text: string, options?: {
    autoConfirm?: boolean;
    source?: string;
    minConfidence?: number;
  }): Promise<{
    extraction: ExtractionResult;
    harvest: { created: number; updated: number; skipped: number; persons: Array<UnifiedContact & { isNew?: boolean; updated?: boolean }> };
  }> {
    const extraction = await this.extractFromText(text);
    
    if (options?.minConfidence) {
      extraction.persons = extraction.persons.filter(p => p.confidence >= options.minConfidence!);
    }
    
    const harvest = await this.createPersonsFromExtraction(extraction, options);
    
    return { extraction, harvest };
  }
}

export const entityExtractor = new EntityExtractor();
