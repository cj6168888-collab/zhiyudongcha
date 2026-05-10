/**
 * Contract Pipeline Service (合同草拟管道) - Phase 2.3
 * 
 * 功能：
 * 1. 合同模板管理
 * 2. 信息采集和模板匹配
 * 3. AI辅助条款填充
 * 4. 风险分析和标注
 * 5. 输出 Markdown + 谈判要点
 * 
 * 技术：
 * - 与零幻觉知识库集成
 * - 使用国产大模型(DashScope)生成内容
 */

import { db } from '../db';
import { 
  contractTemplates, 
  contractDrafts,
  InsertContractTemplate,
  InsertContractDraft,
  ContractTemplate,
  ContractDraft
} from '@shared/schema';
import { eq, and, desc, ilike, sql } from 'drizzle-orm';

export type ContractCategory = 
  | 'SOFTWARE_DEVELOPMENT'
  | 'CONSULTING'
  | 'NDA'
  | 'EMPLOYMENT'
  | 'LEASE'
  | 'SALES'
  | 'SERVICE'
  | 'PARTNERSHIP'
  | 'OTHER';

export type DraftStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'SIGNED' | 'ARCHIVED';

export interface PartyInfo {
  name: string;
  legalName?: string;
  address?: string;
  representative?: string;
  idNumber?: string;
  phone?: string;
  email?: string;
  bankAccount?: string;
  bankName?: string;
}

export interface ContractRequest {
  category: ContractCategory;
  projectName?: string;
  partyA: PartyInfo;
  partyB: PartyInfo;
  amount?: number;
  currency?: string;
  startDate?: string;
  endDate?: string;
  customRequirements?: string;
  industry?: string;
}

export interface RiskClause {
  clauseTitle: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
  suggestion: string;
  location?: string;
}

export interface ContractOutput {
  draft: ContractDraft;
  content: string;
  risks: RiskClause[];
  negotiationPoints: string[];
}

const DEFAULT_TEMPLATES: Partial<InsertContractTemplate>[] = [
  {
    name: '软件开发外包合同',
    category: 'SOFTWARE_DEVELOPMENT',
    description: '适用于软件开发项目外包，包含需求、交付、验收、知识产权等条款',
    templateContent: `# 软件开发外包合同

**合同编号**: {{contractNumber}}

## 甲方（委托方）
- 名称：{{partyA.name}}
- 地址：{{partyA.address}}
- 法定代表人：{{partyA.representative}}
- 联系电话：{{partyA.phone}}

## 乙方（开发方）
- 名称：{{partyB.name}}
- 地址：{{partyB.address}}
- 法定代表人：{{partyB.representative}}
- 联系电话：{{partyB.phone}}

## 第一条 项目内容
项目名称：{{projectName}}
项目描述：{{projectDescription}}

## 第二条 开发周期
- 开始日期：{{startDate}}
- 结束日期：{{endDate}}
- 总工期：{{duration}}天

## 第三条 合同金额
- 合同总金额：人民币 {{amount}} 元整（¥{{amount}}）
- 付款方式：
  - 签订合同后支付30%：¥{{payment1}}
  - 验收通过后支付60%：¥{{payment2}}
  - 质保期满后支付10%：¥{{payment3}}

## 第四条 交付物
1. 源代码及文档
2. 用户手册
3. 部署文档
4. 测试报告

## 第五条 验收标准
1. 功能符合需求规格说明书
2. 通过甲方验收测试
3. 无严重Bug

## 第六条 知识产权
项目交付后，源代码知识产权归甲方所有。

## 第七条 保密条款
双方对项目涉及的商业秘密和技术秘密负有保密义务。

## 第八条 违约责任
{{breachClause}}

## 第九条 争议解决
本合同争议由双方协商解决，协商不成的，提交{{jurisdiction}}仲裁委员会仲裁。

## 第十条 其他
本合同一式两份，双方各执一份，自签字盖章之日起生效。

---

甲方（盖章）：________________  乙方（盖章）：________________

法定代表人：________________  法定代表人：________________

日期：________________  日期：________________
`,
    requiredFields: ['partyA', 'partyB', 'projectName', 'amount', 'startDate', 'endDate'],
    optionalFields: ['projectDescription', 'breachClause', 'jurisdiction'],
    riskClauses: [
      { clauseTitle: '付款条款', riskLevel: 'MEDIUM', description: '付款比例可能对乙方不利', suggestion: '建议增加预付款比例或缩短账期' },
      { clauseTitle: '知识产权', riskLevel: 'HIGH', description: '源代码归属需明确', suggestion: '明确约定源代码、专利、著作权归属' },
      { clauseTitle: '验收标准', riskLevel: 'MEDIUM', description: '验收标准模糊可能导致争议', suggestion: '细化验收标准，量化指标' }
    ],
    negotiationTips: ['关注付款节点和比例', '明确验收标准和流程', '约定质保期和维护责任'],
    industry: '软件/IT',
    jurisdiction: '中国大陆',
    isActive: true,
  },
  {
    name: '保密协议（NDA）',
    category: 'NDA',
    description: '双向保密协议，保护商业秘密和技术信息',
    templateContent: `# 保密协议

**协议编号**: {{contractNumber}}

## 甲方
- 名称：{{partyA.name}}
- 地址：{{partyA.address}}

## 乙方
- 名称：{{partyB.name}}
- 地址：{{partyB.address}}

鉴于双方拟就{{projectName}}项目进行合作洽谈，为保护双方的商业秘密，特订立本协议。

## 第一条 保密信息定义
保密信息包括但不限于：
1. 技术信息：设计、工艺、技术方案、代码等
2. 经营信息：客户名单、定价策略、财务数据等
3. 其他标注为"保密"的信息

## 第二条 保密义务
1. 未经对方书面同意，不得向第三方披露保密信息
2. 仅限于知悉必要的员工接触保密信息
3. 采取合理的保密措施

## 第三条 例外情形
以下情形不属于违反保密义务：
1. 公开渠道已知的信息
2. 接收方已合法拥有的信息
3. 法律法规要求披露的信息

## 第四条 保密期限
自签署之日起 {{confidentialityPeriod}} 年内有效。

## 第五条 违约责任
违约方应赔偿守约方因此遭受的全部损失，包括但不限于直接损失和合理的律师费用。

## 第六条 法律适用
本协议适用中华人民共和国法律。

---

甲方（盖章）：________________  乙方（盖章）：________________

日期：________________  日期：________________
`,
    requiredFields: ['partyA', 'partyB'],
    optionalFields: ['projectName', 'confidentialityPeriod'],
    riskClauses: [
      { clauseTitle: '保密范围', riskLevel: 'MEDIUM', description: '保密信息范围过宽或过窄', suggestion: '精确定义保密信息范围' },
      { clauseTitle: '保密期限', riskLevel: 'LOW', description: '期限设置需合理', suggestion: '根据项目特点设置2-5年' }
    ],
    negotiationTips: ['明确保密信息范围', '约定违约赔偿金额', '注意例外条款'],
    industry: '通用',
    jurisdiction: '中国大陆',
    isActive: true,
  },
  {
    name: '咨询服务合同',
    category: 'CONSULTING',
    description: '适用于管理咨询、技术咨询等专业服务',
    templateContent: `# 咨询服务合同

**合同编号**: {{contractNumber}}

## 甲方（委托方）
- 名称：{{partyA.name}}
- 地址：{{partyA.address}}
- 联系人：{{partyA.representative}}

## 乙方（咨询方）
- 名称：{{partyB.name}}
- 地址：{{partyB.address}}
- 联系人：{{partyB.representative}}

## 第一条 服务内容
{{serviceContent}}

## 第二条 服务期限
- 开始日期：{{startDate}}
- 结束日期：{{endDate}}

## 第三条 服务费用
- 咨询费：人民币 {{amount}} 元
- 付款方式：{{paymentTerms}}

## 第四条 交付成果
{{deliverables}}

## 第五条 双方权利义务
### 甲方义务
1. 及时提供咨询所需资料
2. 按时支付咨询费用
3. 对咨询成果保密

### 乙方义务
1. 按时提交咨询成果
2. 保证咨询质量
3. 对甲方信息保密

## 第六条 知识产权
咨询成果的知识产权归{{ipOwner}}所有。

## 第七条 违约责任
{{breachClause}}

---

甲方（盖章）：________________  乙方（盖章）：________________

日期：________________  日期：________________
`,
    requiredFields: ['partyA', 'partyB', 'amount', 'startDate', 'endDate'],
    optionalFields: ['serviceContent', 'deliverables', 'paymentTerms', 'ipOwner', 'breachClause'],
    riskClauses: [
      { clauseTitle: '服务内容', riskLevel: 'MEDIUM', description: '服务范围不明确', suggestion: '详细列明咨询范围和工作量' },
      { clauseTitle: '知识产权', riskLevel: 'HIGH', description: '成果归属需明确', suggestion: '明确约定咨询成果归属' }
    ],
    negotiationTips: ['明确服务范围和标准', '约定验收流程', '关注知识产权归属'],
    industry: '咨询',
    jurisdiction: '中国大陆',
    isActive: true,
  }
];

class ContractPipelineService {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    await this.seedDefaultTemplates();
    this.initialized = true;
    console.log('[ContractPipeline] Service initialized');
  }

  private async seedDefaultTemplates(): Promise<void> {
    const existing = await db.select().from(contractTemplates).limit(1);
    
    if (existing.length === 0) {
      console.log('[ContractPipeline] Seeding default templates...');
      
      for (const template of DEFAULT_TEMPLATES) {
        await db.insert(contractTemplates).values(template as InsertContractTemplate);
      }
      
      console.log(`[ContractPipeline] Seeded ${DEFAULT_TEMPLATES.length} default templates`);
    }
  }

  async getTemplates(options?: {
    category?: ContractCategory;
    industry?: string;
    search?: string;
  }): Promise<ContractTemplate[]> {
    let query = db.select().from(contractTemplates).where(eq(contractTemplates.isActive, true));
    
    const conditions = [eq(contractTemplates.isActive, true)];
    
    if (options?.category) {
      conditions.push(eq(contractTemplates.category, options.category));
    }
    
    if (options?.industry) {
      conditions.push(eq(contractTemplates.industry, options.industry));
    }
    
    if (options?.search) {
      conditions.push(ilike(contractTemplates.name, `%${options.search}%`));
    }
    
    return await db.select()
      .from(contractTemplates)
      .where(and(...conditions))
      .orderBy(desc(contractTemplates.usageCount));
  }

  async getTemplate(id: string): Promise<ContractTemplate | null> {
    const [template] = await db.select()
      .from(contractTemplates)
      .where(eq(contractTemplates.id, id))
      .limit(1);
    
    return template || null;
  }

  async createTemplate(input: InsertContractTemplate): Promise<ContractTemplate> {
    const [template] = await db.insert(contractTemplates)
      .values(input)
      .returning();
    
    console.log(`[ContractPipeline] Template created: ${template.name}`);
    return template;
  }

  async matchTemplate(request: ContractRequest): Promise<ContractTemplate | null> {
    const templates = await this.getTemplates({ 
      category: request.category,
      industry: request.industry 
    });
    
    if (templates.length === 0) {
      const allTemplates = await this.getTemplates();
      return allTemplates[0] || null;
    }
    
    return templates[0];
  }

  async generateDraft(request: ContractRequest): Promise<ContractOutput> {
    await this.initialize();
    
    const template = await this.matchTemplate(request);
    
    if (!template) {
      throw new Error('No matching template found');
    }

    const filledContent = this.fillTemplate(template.templateContent, request);
    
    const risks = this.analyzeRisks(template, request);
    
    const negotiationPoints = this.generateNegotiationPoints(template, request);

    const [draft] = await db.insert(contractDrafts).values({
      templateId: template.id,
      title: `${request.projectName || template.name} - 草稿`,
      category: request.category,
      partyA: request.partyA,
      partyB: request.partyB,
      projectName: request.projectName,
      contractAmount: request.amount,
      currency: request.currency || 'CNY',
      startDate: request.startDate ? new Date(request.startDate) : null,
      endDate: request.endDate ? new Date(request.endDate) : null,
      draftContent: filledContent,
      filledFields: request as any,
      riskAnalysis: risks as any,
      negotiationPoints,
      status: 'DRAFT',
      version: 1,
    }).returning();

    await db.update(contractTemplates)
      .set({ usageCount: sql`${contractTemplates.usageCount} + 1` })
      .where(eq(contractTemplates.id, template.id));

    console.log(`[ContractPipeline] Draft generated: ${draft.id}`);

    return {
      draft,
      content: filledContent,
      risks,
      negotiationPoints,
    };
  }

  private fillTemplate(templateContent: string, request: ContractRequest): string {
    let content = templateContent;
    
    const contractNumber = `CONTRACT-${Date.now().toString(36).toUpperCase()}`;
    content = content.replace(/\{\{contractNumber\}\}/g, contractNumber);
    
    if (request.partyA) {
      content = content.replace(/\{\{partyA\.name\}\}/g, request.partyA.name || '');
      content = content.replace(/\{\{partyA\.address\}\}/g, request.partyA.address || '');
      content = content.replace(/\{\{partyA\.representative\}\}/g, request.partyA.representative || '');
      content = content.replace(/\{\{partyA\.phone\}\}/g, request.partyA.phone || '');
    }
    
    if (request.partyB) {
      content = content.replace(/\{\{partyB\.name\}\}/g, request.partyB.name || '');
      content = content.replace(/\{\{partyB\.address\}\}/g, request.partyB.address || '');
      content = content.replace(/\{\{partyB\.representative\}\}/g, request.partyB.representative || '');
      content = content.replace(/\{\{partyB\.phone\}\}/g, request.partyB.phone || '');
    }
    
    content = content.replace(/\{\{projectName\}\}/g, request.projectName || '待定');
    content = content.replace(/\{\{amount\}\}/g, request.amount?.toLocaleString() || '待定');
    content = content.replace(/\{\{startDate\}\}/g, request.startDate || '待定');
    content = content.replace(/\{\{endDate\}\}/g, request.endDate || '待定');
    
    if (request.amount) {
      const payment1 = Math.round(request.amount * 0.3);
      const payment2 = Math.round(request.amount * 0.6);
      const payment3 = Math.round(request.amount * 0.1);
      content = content.replace(/\{\{payment1\}\}/g, payment1.toLocaleString());
      content = content.replace(/\{\{payment2\}\}/g, payment2.toLocaleString());
      content = content.replace(/\{\{payment3\}\}/g, payment3.toLocaleString());
    }
    
    if (request.startDate && request.endDate) {
      const start = new Date(request.startDate);
      const end = new Date(request.endDate);
      const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      content = content.replace(/\{\{duration\}\}/g, duration.toString());
    }
    
    content = content.replace(/\{\{jurisdiction\}\}/g, '北京');
    content = content.replace(/\{\{breachClause\}\}/g, '违约方应承担违约责任，赔偿守约方因此遭受的直接损失。');
    content = content.replace(/\{\{confidentialityPeriod\}\}/g, '3');
    content = content.replace(/\{\{[^}]+\}\}/g, '______');
    
    return content;
  }

  private analyzeRisks(template: ContractTemplate, request: ContractRequest): RiskClause[] {
    const risks: RiskClause[] = [];
    
    if (template.riskClauses && Array.isArray(template.riskClauses)) {
      risks.push(...(template.riskClauses as RiskClause[]));
    }
    
    if (request.amount && request.amount > 100000) {
      risks.push({
        clauseTitle: '合同金额',
        riskLevel: 'HIGH',
        description: `合同金额较大(¥${request.amount.toLocaleString()})，需谨慎审查`,
        suggestion: '建议增加分期付款条款，设置阶段验收节点',
      });
    }
    
    if (request.startDate && request.endDate) {
      const start = new Date(request.startDate);
      const end = new Date(request.endDate);
      const months = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30);
      
      if (months > 12) {
        risks.push({
          clauseTitle: '合同期限',
          riskLevel: 'MEDIUM',
          description: `合同周期较长(${Math.round(months)}个月)`,
          suggestion: '建议增加中期评估和调整机制',
        });
      }
    }
    
    if (!request.partyA?.address || !request.partyB?.address) {
      risks.push({
        clauseTitle: '当事人信息',
        riskLevel: 'LOW',
        description: '当事人地址信息不完整',
        suggestion: '请补充完整的当事人联系地址',
      });
    }
    
    return risks;
  }

  private generateNegotiationPoints(template: ContractTemplate, request: ContractRequest): string[] {
    const points: string[] = [];
    
    if (template.negotiationTips) {
      points.push(...template.negotiationTips);
    }
    
    if (request.amount && request.amount > 50000) {
      points.push('考虑协商更有利的付款条件');
    }
    
    if (request.category === 'SOFTWARE_DEVELOPMENT') {
      points.push('明确源代码交付时间和格式');
      points.push('约定Bug修复响应时间');
    }
    
    return Array.from(new Set(points));
  }

  async getDrafts(options?: {
    status?: DraftStatus;
    category?: ContractCategory;
    limit?: number;
  }): Promise<ContractDraft[]> {
    const conditions = [];
    
    if (options?.status) {
      conditions.push(eq(contractDrafts.status, options.status));
    }
    
    if (options?.category) {
      conditions.push(eq(contractDrafts.category, options.category));
    }
    
    let query = db.select().from(contractDrafts);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query
      .orderBy(desc(contractDrafts.createdAt))
      .limit(options?.limit || 50);
  }

  async getDraft(id: string): Promise<ContractDraft | null> {
    const [draft] = await db.select()
      .from(contractDrafts)
      .where(eq(contractDrafts.id, id))
      .limit(1);
    
    return draft || null;
  }

  async updateDraft(id: string, updates: Partial<InsertContractDraft>): Promise<ContractDraft | null> {
    const [updated] = await db.update(contractDrafts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(contractDrafts.id, id))
      .returning();
    
    return updated || null;
  }

  async updateDraftStatus(id: string, status: DraftStatus): Promise<ContractDraft | null> {
    return await this.updateDraft(id, { status });
  }

  async deleteDraft(id: string): Promise<boolean> {
    await db.delete(contractDrafts).where(eq(contractDrafts.id, id));
    return true;
  }

  async getStats(): Promise<{
    totalTemplates: number;
    totalDrafts: number;
    draftsByStatus: Record<string, number>;
    draftsByCategory: Record<string, number>;
    popularTemplates: { name: string; usageCount: number }[];
  }> {
    const templates = await db.select().from(contractTemplates);
    const drafts = await db.select().from(contractDrafts);
    
    const draftsByStatus: Record<string, number> = {};
    const draftsByCategory: Record<string, number> = {};
    
    for (const draft of drafts) {
      const status = draft.status || 'DRAFT';
      draftsByStatus[status] = (draftsByStatus[status] || 0) + 1;
      draftsByCategory[draft.category] = (draftsByCategory[draft.category] || 0) + 1;
    }
    
    const popularTemplates = templates
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
      .slice(0, 5)
      .map(t => ({ name: t.name, usageCount: t.usageCount || 0 }));
    
    return {
      totalTemplates: templates.length,
      totalDrafts: drafts.length,
      draftsByStatus,
      draftsByCategory,
      popularTemplates,
    };
  }
}

export const contractPipeline = new ContractPipelineService();
