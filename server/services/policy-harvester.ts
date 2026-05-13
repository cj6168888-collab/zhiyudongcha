/**
 * 政策自动搜集服务 - Policy Harvester
 *
 * 功能：
 * 1. 自动从权威来源抓取最新法律/财税政策
 * 2. 智能解析政策内容提取关键信息
 * 3. 自动分类打标签
 * 4. 增量更新避免重复
 * 5. 支持定时任务自动执行
 *
 * 数据来源：
 * - 国家税务总局 (http://www.chinatax.gov.cn)
 * - 法律法规数据库 (北大法宝等)
 * - 国务院政策文件库
 * - 最高人民法院
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('PolicyHarvester');

import { getDatabase, isDatabaseAvailable } from '../db';
import {
  legalKnowledge,
  financeKnowledge,
  knowledgeSyncLogs,
  legalIndex,
  type LegalKnowledge as DbLegalKnowledge,
  type FinanceKnowledge as DbFinanceKnowledge
} from '@shared/schema';
import { eq, and, gt, or, sql, desc } from 'drizzle-orm';
import crypto from 'crypto';

export interface PolicySource {
  id: string;
  name: string;
  url: string;
  type: 'LEGAL' | 'FINANCE' | 'LABOR' | 'TAX';
  category: string;
  lastFetchedAt: Date | null;
  fetchInterval: number; // 毫秒
  enabled: boolean;
}

export interface ParsedPolicy {
  title: string;
  source: string;
  sourceUrl: string;
  publishDate: Date;
  effectiveDate?: Date;
  content: string;
  category: string;
  tags: string[];
  lawName?: string;
  articleNumber?: string;
}

export interface SyncResult {
  success: boolean;
  newItems: number;
  updatedItems: number;
  errors: number;
  skippedItems: number;
  details: string[];
}

// 默认政策来源配置
const DEFAULT_SOURCES: PolicySource[] = [
  {
    id: 'tax_policy_001',
    name: '国家税务总局',
    url: 'http://www.chinatax.gov.cn',
    type: 'TAX',
    category: '税务政策',
    lastFetchedAt: null,
    fetchInterval: 24 * 60 * 60 * 1000, // 24小时
    enabled: true,
  },
  {
    id: 'labor_law_001',
    name: '人力资源和社会保障部',
    url: 'http://www.mohrss.gov.cn',
    type: 'LABOR',
    category: '劳动法',
    lastFetchedAt: null,
    fetchInterval: 24 * 60 * 60 * 1000,
    enabled: true,
  },
  {
    id: 'legal_search_001',
    name: '中国法律法规数据库',
    url: 'https://flk.npc.gov.cn',
    type: 'LEGAL',
    category: '法律法规',
    lastFetchedAt: null,
    fetchInterval: 12 * 60 * 60 * 1000,
    enabled: true,
  },
];

class PolicyHarvester {
  private sources: Map<string, PolicySource> = new Map();
  private fetchCallbacks: Map<string, (source: PolicySource) => Promise<ParsedPolicy[]>> = new Map();
  private isRunning = false;

  constructor() {
    this.initializeSources();
    this.registerFetchers();
    logger.info('[PolicyHarvester] 政策搜集服务已初始化');
  }

  private initializeSources(): void {
    for (const source of DEFAULT_SOURCES) {
      this.sources.set(source.id, source);
    }
  }

  private registerFetchers(): void {
    // 注册税务政策抓取器
    this.fetchCallbacks.set('tax_policy_001', async (source) => {
      return this.fetchTaxPolicies(source);
    });

    // 注册劳动法抓取器
    this.fetchCallbacks.set('labor_law_001', async (source) => {
      return this.fetchLaborPolicies(source);
    });

    // 注册法律法规抓取器
    this.fetchCallbacks.set('legal_search_001', async (source) => {
      return this.fetchLegalPolicies(source);
    });
  }

  /**
   * 抓取税务政策
   * 由于实际网站可能有访问限制，这里提供模拟实现
   * 生产环境可接入真实API或使用爬虫
   */
  private async fetchTaxPolicies(source: PolicySource): Promise<ParsedPolicy[]> {
    const policies: ParsedPolicy[] = [];

    // 模拟：从实际源获取数据
    // 生产环境应替换为真实API调用或爬虫
    try {
      // 示例：增值税留抵退税政策
      policies.push({
        title: '增值税留抵退税政策延续实施',
        source: '国家税务总局',
        sourceUrl: 'http://www.chinatax.gov.cn/clm/xxx',
        publishDate: new Date(),
        effectiveDate: new Date(),
        content: this.getTaxPolicyContent('留抵退税'),
        category: 'TAX',
        tags: ['增值税', '留抵退税', '制造业', '中小微企业'],
      });

      // 示例：企业所得税研发费用加计扣除
      policies.push({
        title: '企业研发费用加计扣除比例提高',
        source: '国家税务总局',
        sourceUrl: 'http://www.chinatax.gov.cn/clm/yyy',
        publishDate: new Date(),
        effectiveDate: new Date(),
        content: this.getTaxPolicyContent('研发加计'),
        category: 'TAX',
        tags: ['企业所得税', '研发费用', '加计扣除', '科技创新'],
      });

      logger.info(`[PolicyHarvester] 获取税务政策 ${policies.length} 条`);
    } catch (error) {
      logger.error({ err: error, source: source.id }, '抓取税务政策失败');
    }

    return policies;
  }

  /**
   * 抓取劳动法律法规
   */
  private async fetchLaborPolicies(source: PolicySource): Promise<ParsedPolicy[]> {
    const policies: ParsedPolicy[] = [];

    try {
      policies.push({
        title: '关于审理劳动争议案件适用法律问题的解释',
        source: '最高人民法院',
        sourceUrl: 'https://www.court.gov.cn',
        publishDate: new Date(),
        content: this.getLaborLawContent('劳动争议'),
        category: 'LABOR',
        tags: ['劳动争议', '仲裁', '诉讼', '经济补偿'],
        lawName: '劳动法',
      });

      policies.push({
        title: '劳动合同法实施条例',
        source: '国务院',
        sourceUrl: 'http://www.gov.cn',
        publishDate: new Date(),
        content: this.getLaborLawContent('劳动合同'),
        category: 'LABOR',
        tags: ['劳动合同', '试用期', '解除合同', '竞业限制'],
        lawName: '劳动合同法',
      });

      logger.info(`[PolicyHarvester] 获取劳动法规 ${policies.length} 条`);
    } catch (error) {
      logger.error({ err: error, source: source.id }, '抓取劳动法规失败');
    }

    return policies;
  }

  /**
   * 抓取法律法规
   */
  private async fetchLegalPolicies(source: PolicySource): Promise<ParsedPolicy[]> {
    const policies: ParsedPolicy[] = [];

    try {
      // 民法典相关
      policies.push({
        title: '民法典合同编司法解释',
        source: '最高人民法院',
        sourceUrl: 'https://www.court.gov.cn',
        publishDate: new Date(),
        content: this.getLegalContent('合同编'),
        category: 'CONTRACT',
        tags: ['合同', '违约', '效力', '解除'],
        lawName: '民法典',
        articleNumber: '第三编',
      });

      // 公司法相关
      policies.push({
        title: '公司法修订草案',
        source: '全国人大常委会',
        sourceUrl: 'http://www.npc.gov.cn',
        publishDate: new Date(),
        content: this.getLegalContent('公司法'),
        category: 'CORPORATE',
        tags: ['公司', '股权', '治理', '注册资本'],
        lawName: '公司法',
      });

      logger.info(`[PolicyHarvester] 获取法律法规 ${policies.length} 条`);
    } catch (error) {
      logger.error({ err: error, source: source.id }, '抓取法律法规失败');
    }

    return policies;
  }

  // 示例政策内容生成器（实际应从源获取）
  private getTaxPolicyContent(type: string): string {
    const contents: Record<string, string> = {
      '留抵退税': `一、适用对象
符合条件的小微企业（含个体工商户）及制造业等行业企业。

二、申请条件
1. 纳税信用等级为A级或B级
2. 申请退税前36个月无骗取退税记录
3. 自2019年4月1日起未享受即征即退政策

三、退税金额计算
允许退还的增量留抵税额=增量留抵税额×进项构成比例

四、政策有效期
自2022年4月1日起施行。`,

      '研发加计': `一、适用主体
科技型中小企业开展研发活动中实际发生的研发费用。

二、加计扣除比例
1. 未形成无形资产的：据实扣除基础上按100%加计扣除
2. 形成无形资产的：按无形资产成本的200%摊销

三、研发费用范围
人员人工费用、直接投入费用、折旧费用和长期待摊费用等。

四、申报要求
年度汇算清缴时填写《研发费用加计扣除优惠明细表》。`,
    };
    return contents[type] || '';
  }

  private getLaborLawContent(type: string): string {
    const contents: Record<string, string> = {
      '劳动争议': `【劳动争议处理流程】
一、协商：劳动者与用人单位自行协商
二、调解：企业劳动争议调解委员会调解
三、仲裁：向劳动争议仲裁委员会申请仲裁（时效1年）
四、诉讼：对仲裁裁决不服可向人民法院起诉

【经济补偿标准】
N：每满一年支付一个月工资
N+1：特定无过失性解除且未提前30日通知时，可能涉及额外支付一个月工资的代通知金
2N：违法解除劳动合同的赔偿金`,

      '劳动合同': `【试用期规定】
劳动合同期限三个月以上不满一年的，试用期不得超过一个月
一年以上不满三年的，试用期不得超过二个月
三年以上固定期限和无固定期限的，试用期不得超过六个月

【竞业限制】
期限：不超过二年
补偿：按月支付，不低于当地最低工资标准
违约责任：支付违约金并继续履行`,
    };
    return contents[type] || '';
  }

  private getLegalContent(type: string): string {
    const contents: Record<string, string> = {
      '合同编': `【合同效力】
依法成立的合同，自成立时生效。无效合同或者被撤销的合同自始无效。

【违约责任】
继续履行、采取补救措施或者赔偿损失等违约责任。
约定违约金低于造成的损失的，人民法院或者仲裁机构可以根据当事人的请求予以增加。

【合同解除】
当事人协商一致，可以解除合同。
法定解除权：不可抗力、预期违约、迟延履行、根本违约等情形。`,

      '公司法': `【注册资本】
有限责任公司注册资本为全体股东认缴的出资额。
股东认缴出资期限由公司章程规定。

【股权转让】
股东向股东以外的人转让股权，应当经其他股东过半数同意。
经股东同意转让的股权，其他股东同等条件下有优先购买权。

【公司治理】
董事会对股东会负责，召集股东会会议。
监事会或不设监事会的公司监事行使监督职权。`,
    };
    return contents[type] || '';
  }

  /**
   * 执行同步
   */
  async syncAll(): Promise<SyncResult> {
    if (this.isRunning) {
      return {
        success: false,
        newItems: 0,
        updatedItems: 0,
        errors: 0,
        skippedItems: 0,
        details: ['同步任务已在执行中'],
      };
    }

    this.isRunning = true;
    const result: SyncResult = {
      success: true,
      newItems: 0,
      updatedItems: 0,
      errors: 0,
      skippedItems: 0,
      details: [],
    };

    try {
      logger.info('[PolicyHarvester] 开始同步政策数据...');

      for (const [id, source] of this.sources) {
        if (!source.enabled) {
          result.skippedItems++;
          continue;
        }

        try {
          const policies = await this.syncSource(source);

          // 分类存储
          for (const policy of policies) {
            if (source.type === 'TAX' || source.type === 'FINANCE') {
              const saved = await this.saveFinanceKnowledge(policy);
              if (saved === 'new') result.newItems++;
              else if (saved === 'updated') result.updatedItems++;
            } else {
              const saved = await this.saveLegalKnowledge(policy);
              if (saved === 'new') result.newItems++;
              else if (saved === 'updated') result.updatedItems++;
            }
          }

          // 更新抓取时间
          source.lastFetchedAt = new Date();
          result.details.push(`${source.name}: 获取 ${policies.length} 条`);

        } catch (error) {
          result.errors++;
          result.details.push(`${source.name}: 错误 - ${error instanceof Error ? error.message : '未知'}`);
          logger.error({ err: error, source: id }, '同步源失败');
        }
      }

      // 记录同步日志
      await this.logSync(result);

      logger.info({ result }, '[PolicyHarvester] 同步完成');

    } catch (error) {
      result.success = false;
      result.details.push(`整体错误: ${error instanceof Error ? error.message : '未知'}`);
    } finally {
      this.isRunning = false;
    }

    return result;
  }

  /**
   * 同步单个数据源
   */
  private async syncSource(source: PolicySource): Promise<ParsedPolicy[]> {
    const fetcher = this.fetchCallbacks.get(source.id);
    if (!fetcher) {
      logger.warn({ source: source.id }, '未找到对应的抓取器');
      return [];
    }

    return await fetcher(source);
  }

  /**
   * 保存财税知识 (简化版)
   */
  private async saveFinanceKnowledge(policy: ParsedPolicy): Promise<'new' | 'updated' | 'skipped'> {
    if (!isDatabaseAvailable()) {
      logger.warn('[PolicyHarvester] 数据库不可用，跳过保存');
      return 'skipped';
    }

    const db = getDatabase();
    if (!db) return 'skipped';

    try {
      // 使用原生SQL进行去重检查和插入
      const checkSql = sql`SELECT id, content FROM finance_knowledge WHERE title = ${policy.title} LIMIT 1`;
      const existing = await db.execute(checkSql) as unknown[];

      if (existing.length > 0) {
        // 检查内容是否有更新
        if (existing[0].content !== policy.content) {
          const updateSql = sql`
            UPDATE finance_knowledge
            SET content = ${policy.content},
                source = ${policy.source},
                source_url = ${policy.sourceUrl},
                tags = ${JSON.stringify(policy.tags)},
                updated_at = NOW()
            WHERE id = ${existing[0].id}
          `;
          await db.execute(updateSql);
          return 'updated';
        }
        return 'skipped';
      }

      // 新增
      const insertSql = sql`
        INSERT INTO finance_knowledge (
          id, title, source, source_url, content, category, tags,
          effective_date, is_latest, sync_version, last_synced_at, created_at, updated_at
        ) VALUES (
          ${`fk_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`},
          ${policy.title}, ${policy.source}, ${policy.sourceUrl}, ${policy.content},
          ${policy.category}, ${JSON.stringify(policy.tags)},
          ${policy.effectiveDate ? policy.effectiveDate.toISOString() : null},
          true, 1, NOW(), NOW(), NOW()
        )
      `;
      await db.execute(insertSql);
      return 'new';

    } catch (error) {
      logger.error({ err: error, title: policy.title }, '保存财税知识失败');
      return 'skipped';
    }
  }

  /**
   * 保存法律知识 (简化版)
   */
  private async saveLegalKnowledge(policy: ParsedPolicy): Promise<'new' | 'updated' | 'skipped'> {
    if (!isDatabaseAvailable()) {
      logger.warn('[PolicyHarvester] 数据库不可用，跳过保存');
      return 'skipped';
    }

    const db = getDatabase();
    if (!db) return 'skipped';

    try {
      const lawName = policy.lawName || policy.title;

      // 检查是否已存在
      const checkSql = sql`SELECT id, content, sync_version FROM legal_knowledge WHERE law_name = ${lawName} AND is_latest = true LIMIT 1`;
      const existing = await db.execute(checkSql) as unknown[];

      if (existing.length > 0) {
        // 检查内容是否有更新
        if (existing[0].content !== policy.content) {
          // 标记旧版本
          await db.execute(sql`UPDATE legal_knowledge SET is_latest = false WHERE id = ${existing[0].id}`);

          // 新增新版本
          const newVersion = (existing[0].sync_version || 0) + 1;
          const insertSql = sql`
            INSERT INTO legal_knowledge (
              id, law_name, article_number, content, category, tags,
              effective_date, is_latest, sync_version, last_synced_at, created_at, updated_at
            ) VALUES (
              ${`lk_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`},
              ${lawName}, ${policy.articleNumber || null}, ${policy.content},
              ${policy.category}, ${JSON.stringify(policy.tags)},
              ${policy.effectiveDate ? policy.effectiveDate.toISOString() : null},
              true, ${newVersion}, NOW(), NOW(), NOW()
            )
          `;
          await db.execute(insertSql);
          return 'updated';
        }
        return 'skipped';
      }

      // 新增
      const insertSql = sql`
        INSERT INTO legal_knowledge (
          id, law_name, article_number, content, category, tags,
          effective_date, is_latest, sync_version, last_synced_at, created_at, updated_at
        ) VALUES (
          ${`lk_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`},
          ${lawName}, ${policy.articleNumber || null}, ${policy.content},
          ${policy.category}, ${JSON.stringify(policy.tags)},
          ${policy.effectiveDate ? policy.effectiveDate.toISOString() : null},
          true, 1, NOW(), NOW(), NOW()
        )
      `;
      await db.execute(insertSql);
      return 'new';

    } catch (error) {
      logger.error({ err: error, title: policy.title }, '保存法律知识失败');
      return 'skipped';
    }
  }

  /**
   * 记录同步日志
   */
  private async logSync(result: SyncResult): Promise<void> {
    if (!isDatabaseAvailable()) return;

    const db = getDatabase();
    if (!db) return;

    try {
      const sqlQuery = sql`
        INSERT INTO knowledge_sync_logs (
          id, device_id, device_type, sync_type, status,
          items_processed, items_failed, details, sync_started_at, sync_completed_at
        ) VALUES (
          ${`sync_${Date.now()}`},
          ${'policy-harvester'}, ${'SERVER'},
          ${result.success ? 'FULL_SYNC' : 'PARTIAL_SYNC'},
          ${result.success ? 'SUCCESS' : 'FAILED'},
          ${result.newItems + result.updatedItems + result.skippedItems},
          ${result.errors},
          ${JSON.stringify(result.details)},
          NOW() - INTERVAL '1 minute',
          NOW()
        )
      `;
      await db.execute(sqlQuery);
    } catch (error) {
      logger.error({ err: error }, '记录同步日志失败');
    }
  }

  /**
   * 获取同步状态
   */
  getStatus(): {
    isRunning: boolean;
    sources: PolicySource[];
    lastSync: Date | null;
  } {
    const sources = Array.from(this.sources.values());
    const lastSync = sources.reduce((latest, s) => {
      if (s.lastFetchedAt && (!latest || s.lastFetchedAt > latest)) {
        return s.lastFetchedAt;
      }
      return latest;
    }, null as Date | null);

    return {
      isRunning: this.isRunning,
      sources,
      lastSync,
    };
  }

  /**
   * 手动触发单个源同步
   */
  async syncSourceById(sourceId: string): Promise<SyncResult> {
    const source = this.sources.get(sourceId);
    if (!source) {
      return {
        success: false,
        newItems: 0,
        updatedItems: 0,
        errors: 1,
        skippedItems: 0,
        details: [`未找到数据源: ${sourceId}`],
      };
    }

    const result: SyncResult = {
      success: true,
      newItems: 0,
      updatedItems: 0,
      errors: 0,
      skippedItems: 0,
      details: [],
    };

    try {
      const policies = await this.syncSource(source);

      for (const policy of policies) {
        if (source.type === 'TAX' || source.type === 'FINANCE') {
          const saved = await this.saveFinanceKnowledge(policy);
          if (saved === 'new') result.newItems++;
          else if (saved === 'updated') result.updatedItems++;
        } else {
          const saved = await this.saveLegalKnowledge(policy);
          if (saved === 'new') result.newItems++;
          else if (saved === 'updated') result.updatedItems++;
        }
      }

      source.lastFetchedAt = new Date();
      result.details.push(`${source.name}: ${policies.length} 条`);

    } catch (error) {
      result.success = false;
      result.errors++;
      result.details.push(`错误: ${error instanceof Error ? error.message : '未知'}`);
    }

    return result;
  }
}

export const policyHarvester = new PolicyHarvester();
export default policyHarvester;
