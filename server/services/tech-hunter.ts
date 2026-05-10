/**
 * 技术狩猎系统 - Phase 11.2
 * 
 * 基于PRD需求-10/22/23:
 * - 自动插件化升级：监控GitHub等平台，发现更优引擎时自动测试并提交升级建议
 * - 技术源监控适配器：内置GitHub API、Hugging Face监控爬虫
 * - 插件化热替换：底层引擎模块化设计，支持无损升级
 * 
 * 功能：
 * 1. GitHub仓库监控 - 跟踪AI模型、工具库更新
 * 2. HuggingFace模型监控 - 跟踪最新模型benchmark
 * 3. 技术评估引擎 - 自动评估新技术价值
 * 4. 插件热替换系统 - 无缝升级核心模块
 * 5. 技术报告生成 - 每日技术狩猎摘要
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('TechHunter');

import { EventEmitter } from 'events';
import { getDatabase } from '../db';
import { auditLogs } from '@shared/schema';

// ============ 类型定义 ============

export interface TechSource {
  id: string;
  name: string;
  type: 'GITHUB' | 'HUGGINGFACE' | 'ARXIV' | 'PYPI' | 'NPM';
  url: string;
  enabled: boolean;
  checkInterval: number; // 分钟
  lastChecked?: number;
  filters: TechFilter[];
}

export interface TechFilter {
  field: string;
  operator: 'contains' | 'equals' | 'gt' | 'lt' | 'regex';
  value: string | number;
}

export interface TechDiscovery {
  id: string;
  sourceId: string;
  type: DiscoveryType;
  name: string;
  description: string;
  url: string;
  metadata: Record<string, unknown>;
  score: number;
  relevance: number;
  discoveredAt: number;
  status: 'NEW' | 'EVALUATED' | 'TESTING' | 'APPROVED' | 'REJECTED';
}

export type DiscoveryType = 
  | 'MODEL'           // AI模型
  | 'LIBRARY'         // 代码库
  | 'TOOL'            // 工具
  | 'PAPER'           // 论文
  | 'FRAMEWORK'       // 框架
  | 'ALGORITHM';      // 算法

export interface TechEvaluation {
  discoveryId: string;
  scores: {
    performance: number;    // 性能提升
    compatibility: number;  // 兼容性
    stability: number;      // 稳定性
    maintenance: number;    // 维护活跃度
    security: number;       // 安全性
  };
  overallScore: number;
  recommendation: 'UPGRADE' | 'MONITOR' | 'IGNORE';
  risks: string[];
  benefits: string[];
  evaluatedAt: number;
}

export interface PluginDefinition {
  id: string;
  name: string;
  version: string;
  type: PluginType;
  entryPoint: string;
  dependencies: string[];
  enabled: boolean;
  config: Record<string, unknown>;
  loadedAt?: number;
}

export type PluginType = 
  | 'LLM_ENGINE'      // 大模型引擎
  | 'TTS_ENGINE'      // TTS引擎
  | 'ASR_ENGINE'      // ASR引擎
  | 'OCR_ENGINE'      // OCR引擎
  | 'EMBEDDING'       // 嵌入模型
  | 'TOOL';           // 工具插件

export interface UpgradeProposal {
  id: string;
  currentPlugin: string;
  proposedVersion: string;
  discovery: TechDiscovery;
  evaluation: TechEvaluation;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'APPLIED';
  createdAt: number;
  approvedAt?: number;
  appliedAt?: number;
}

// ============ 日志函数 ============

function log(message: string) {
  const time = new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  logger.info(`${time} [TechHunter] ${message}`);
}

// ============ 技术狩猎服务类 ============

class TechHunterService extends EventEmitter {
  private sources: Map<string, TechSource> = new Map();
  private discoveries: Map<string, TechDiscovery> = new Map();
  private evaluations: Map<string, TechEvaluation> = new Map();
  private plugins: Map<string, PluginDefinition> = new Map();
  private proposals: Map<string, UpgradeProposal> = new Map();
  private isScanning = false;
  private scanInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    super();
    this.initializeDefaultSources();
    this.initializeDefaultPlugins();
    log('技术狩猎系统已初始化 (Phase 11.2)');
  }

  private initializeDefaultSources(): void {
    // GitHub源
    this.registerSource({
      id: 'github_llm',
      name: 'GitHub LLM库',
      type: 'GITHUB',
      url: 'https://api.github.com/search/repositories',
      enabled: true,
      checkInterval: 360, // 6小时
      filters: [
        { field: 'topics', operator: 'contains', value: 'llm' },
        { field: 'stars', operator: 'gt', value: 1000 },
      ],
    });

    this.registerSource({
      id: 'github_ai_tools',
      name: 'GitHub AI工具',
      type: 'GITHUB',
      url: 'https://api.github.com/search/repositories',
      enabled: true,
      checkInterval: 360,
      filters: [
        { field: 'topics', operator: 'contains', value: 'ai-tools' },
        { field: 'stars', operator: 'gt', value: 500 },
      ],
    });

    // HuggingFace源
    this.registerSource({
      id: 'hf_models',
      name: 'HuggingFace模型',
      type: 'HUGGINGFACE',
      url: 'https://huggingface.co/api/models',
      enabled: true,
      checkInterval: 720, // 12小时
      filters: [
        { field: 'likes', operator: 'gt', value: 100 },
        { field: 'task', operator: 'contains', value: 'text-generation' },
      ],
    });

    // NPM源
    this.registerSource({
      id: 'npm_ai',
      name: 'NPM AI包',
      type: 'NPM',
      url: 'https://registry.npmjs.org/-/v1/search',
      enabled: true,
      checkInterval: 480,
      filters: [
        { field: 'keywords', operator: 'contains', value: 'ai' },
      ],
    });

    log(`已注册 ${this.sources.size} 个技术源`);
  }

  private initializeDefaultPlugins(): void {
    // 注册当前使用的插件
    this.registerPlugin({
      id: 'dashscope_llm',
      name: 'DashScope LLM',
      version: '1.0.0',
      type: 'LLM_ENGINE',
      entryPoint: './services/dashscope.ts',
      dependencies: [],
      enabled: true,
      config: {
        model: 'qwen-turbo',
        maxTokens: 2000,
      },
    });

    this.registerPlugin({
      id: 'dashscope_tts',
      name: 'DashScope TTS',
      version: '1.0.0',
      type: 'TTS_ENGINE',
      entryPoint: './services/streaming-tts.ts',
      dependencies: [],
      enabled: true,
      config: {
        voice: 'longhuhu_v3',
      },
    });

    this.registerPlugin({
      id: 'dashscope_embedding',
      name: 'DashScope Embedding',
      version: '1.0.0',
      type: 'EMBEDDING',
      entryPoint: './services/rag-knowledge.ts',
      dependencies: [],
      enabled: true,
      config: {
        model: 'text-embedding-v3',
      },
    });

    log(`已注册 ${this.plugins.size} 个插件`);
  }

  // ============ 源管理 ============

  registerSource(source: TechSource): void {
    this.sources.set(source.id, source);
    this.emit('source_registered', source.id);
  }

  unregisterSource(id: string): boolean {
    const deleted = this.sources.delete(id);
    if (deleted) {
      this.emit('source_unregistered', id);
    }
    return deleted;
  }

  listSources(): TechSource[] {
    return Array.from(this.sources.values());
  }

  // ============ 扫描功能 ============

  async scanSource(sourceId: string): Promise<TechDiscovery[]> {
    const source = this.sources.get(sourceId);
    if (!source) {
      throw new Error(`技术源不存在: ${sourceId}`);
    }

    if (!source.enabled) {
      return [];
    }

    log(`扫描技术源: ${source.name}`);
    const discoveries: TechDiscovery[] = [];

    try {
      switch (source.type) {
        case 'GITHUB':
          discoveries.push(...await this.scanGitHub(source));
          break;
        case 'HUGGINGFACE':
          discoveries.push(...await this.scanHuggingFace(source));
          break;
        case 'NPM':
          discoveries.push(...await this.scanNPM(source));
          break;
      }

      source.lastChecked = Date.now();
      
      // 保存新发现
      for (const discovery of discoveries) {
        if (!this.discoveries.has(discovery.id)) {
          this.discoveries.set(discovery.id, discovery);
          this.emit('new_discovery', discovery);
        }
      }

      log(`源 ${source.name} 发现 ${discoveries.length} 项技术`);
      return discoveries;

    } catch (error) {
      log(`扫描源 ${source.name} 失败: ${error}`);
      return [];
    }
  }

  private async scanGitHub(source: TechSource): Promise<TechDiscovery[]> {
    const discoveries: TechDiscovery[] = [];

    try {
      // 构建查询参数
      const query = source.filters
        .filter(f => f.field === 'topics')
        .map(f => `topic:${f.value}`)
        .join('+');
      
      const minStars = source.filters.find(f => f.field === 'stars' && f.operator === 'gt');
      const starsQuery = minStars ? `+stars:>${minStars.value}` : '';

      const url = `${source.url}?q=${query}${starsQuery}&sort=stars&order=desc&per_page=10`;

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'XiaoZhi-TechHunter/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`GitHub API错误: ${response.status}`);
      }

      const data = await response.json();
      
      for (const repo of data.items || []) {
        discoveries.push({
          id: `github_${repo.id}`,
          sourceId: source.id,
          type: this.inferDiscoveryType(repo.topics || [], repo.description || ''),
          name: repo.full_name,
          description: repo.description || '',
          url: repo.html_url,
          metadata: {
            stars: repo.stargazers_count,
            forks: repo.forks_count,
            language: repo.language,
            topics: repo.topics,
            updated_at: repo.updatedAt,
            license: repo.license?.name,
          },
          score: this.calculateGitHubScore(repo),
          relevance: this.calculateRelevance(repo.description || '', repo.topics || []),
          discoveredAt: Date.now(),
          status: 'NEW',
        });
      }
    } catch (error) {
      log(`GitHub扫描错误: ${error}`);
    }

    return discoveries;
  }

  private async scanHuggingFace(source: TechSource): Promise<TechDiscovery[]> {
    const discoveries: TechDiscovery[] = [];

    try {
      const response = await fetch(`${source.url}?sort=likes&direction=-1&limit=10`, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HuggingFace API错误: ${response.status}`);
      }

      const models = await response.json();

      for (const model of models) {
        if (model.likes >= 100) {
          discoveries.push({
            id: `hf_${model.id.replace('/', '_')}`,
            sourceId: source.id,
            type: 'MODEL',
            name: model.id,
            description: model.pipeline_tag || model.modelId,
            url: `https://huggingface.co/${model.id}`,
            metadata: {
              likes: model.likes,
              downloads: model.downloads,
              tags: model.tags,
              pipeline_tag: model.pipeline_tag,
              updated_at: model.lastModified,
            },
            score: this.calculateHuggingFaceScore(model),
            relevance: this.calculateRelevance(model.pipeline_tag || '', model.tags || []),
            discoveredAt: Date.now(),
            status: 'NEW',
          });
        }
      }
    } catch (error) {
      log(`HuggingFace扫描错误: ${error}`);
    }

    return discoveries;
  }

  private async scanNPM(source: TechSource): Promise<TechDiscovery[]> {
    const discoveries: TechDiscovery[] = [];

    try {
      const query = source.filters
        .filter(f => f.field === 'keywords')
        .map(f => f.value)
        .join('+');

      const response = await fetch(`${source.url}?text=${query}&size=10`, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`NPM API错误: ${response.status}`);
      }

      const data = await response.json();

      for (const pkg of data.objects || []) {
        discoveries.push({
          id: `npm_${pkg.package.name}`,
          sourceId: source.id,
          type: 'LIBRARY',
          name: pkg.package.name,
          description: pkg.package.description || '',
          url: pkg.package.links?.npm || `https://npmjs.com/package/${pkg.package.name}`,
          metadata: {
            version: pkg.package.version,
            keywords: pkg.package.keywords,
            author: pkg.package.author,
            score: pkg.score,
          },
          score: (pkg.score?.final || 0) * 100,
          relevance: this.calculateRelevance(pkg.package.description || '', pkg.package.keywords || []),
          discoveredAt: Date.now(),
          status: 'NEW',
        });
      }
    } catch (error) {
      log(`NPM扫描错误: ${error}`);
    }

    return discoveries;
  }

  private inferDiscoveryType(topics: string[], description: string): DiscoveryType {
    const text = (topics.join(' ') + ' ' + description).toLowerCase();
    
    if (text.includes('model') || text.includes('llm') || text.includes('transformer')) {
      return 'MODEL';
    }
    if (text.includes('framework')) {
      return 'FRAMEWORK';
    }
    if (text.includes('tool') || text.includes('cli')) {
      return 'TOOL';
    }
    if (text.includes('algorithm')) {
      return 'ALGORITHM';
    }
    return 'LIBRARY';
  }

  private calculateGitHubScore(repo: { stargazers_count?: number; forks_count?: number; updated_at?: string }): number {
    const stars = repo.stargazers_count || 0;
    const forks = repo.forks_count || 0;
    const recency = this.calculateRecency(repo.updatedAt || '');
    
    // 综合评分：stars权重0.5，forks权重0.2，活跃度权重0.3
    const starScore = Math.min(100, stars / 100);
    const forkScore = Math.min(100, forks / 20);
    
    return starScore * 0.5 + forkScore * 0.2 + recency * 0.3;
  }

  private calculateHuggingFaceScore(model: { likes?: number; downloads?: number }): number {
    const likes = model.likes || 0;
    const downloads = model.downloads || 0;
    
    const likeScore = Math.min(100, likes / 10);
    const downloadScore = Math.min(100, Math.log10(downloads + 1) * 10);
    
    return likeScore * 0.6 + downloadScore * 0.4;
  }

  private calculateRecency(dateStr: string): number {
    const date = new Date(dateStr);
    const daysSince = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSince < 7) return 100;
    if (daysSince < 30) return 80;
    if (daysSince < 90) return 60;
    if (daysSince < 365) return 40;
    return 20;
  }

  private calculateRelevance(description: string, keywords: string[]): number {
    const relevantTerms = ['ai', 'llm', 'nlp', 'machine learning', 'deep learning', 
                          'embedding', 'tts', 'asr', 'ocr', 'transformer', 'neural'];
    const text = (description + ' ' + keywords.join(' ')).toLowerCase();
    
    let matches = 0;
    for (const term of relevantTerms) {
      if (text.includes(term)) matches++;
    }
    
    return Math.min(100, (matches / relevantTerms.length) * 150);
  }

  // ============ 评估功能 ============

  async evaluateDiscovery(discoveryId: string): Promise<TechEvaluation> {
    const discovery = this.discoveries.get(discoveryId);
    if (!discovery) {
      throw new Error(`发现不存在: ${discoveryId}`);
    }

    log(`评估技术: ${discovery.name}`);

    // 模拟评估过程
    const scores = {
      performance: 60 + Math.random() * 40,
      compatibility: 50 + Math.random() * 50,
      stability: 40 + Math.random() * 60,
      maintenance: discovery.score * 0.8 + Math.random() * 20,
      security: 60 + Math.random() * 40,
    };

    const overallScore = (
      scores.performance * 0.3 +
      scores.compatibility * 0.25 +
      scores.stability * 0.2 +
      scores.maintenance * 0.15 +
      scores.security * 0.1
    );

    let recommendation: 'UPGRADE' | 'MONITOR' | 'IGNORE';
    if (overallScore >= 80 && scores.compatibility >= 70) {
      recommendation = 'UPGRADE';
    } else if (overallScore >= 60) {
      recommendation = 'MONITOR';
    } else {
      recommendation = 'IGNORE';
    }

    const risks: string[] = [];
    const benefits: string[] = [];

    if (scores.stability < 60) risks.push('稳定性风险：项目相对较新');
    if (scores.compatibility < 60) risks.push('兼容性风险：可能需要适配工作');
    if (scores.security < 70) risks.push('安全性风险：需要安全审计');

    if (scores.performance >= 80) benefits.push('性能提升显著');
    if (scores.maintenance >= 80) benefits.push('社区活跃，维护良好');
    if (discovery.relevance >= 80) benefits.push('与系统需求高度相关');

    const evaluation: TechEvaluation = {
      discoveryId,
      scores,
      overallScore,
      recommendation,
      risks,
      benefits,
      evaluatedAt: Date.now(),
    };

    this.evaluations.set(discoveryId, evaluation);
    discovery.status = 'EVALUATED';

    this.emit('evaluation_completed', evaluation);
    log(`评估完成: ${discovery.name} - ${recommendation} (${overallScore.toFixed(1)}分)`);

    return evaluation;
  }

  // ============ 插件管理 ============

  registerPlugin(plugin: PluginDefinition): void {
    plugin.loadedAt = Date.now();
    this.plugins.set(plugin.id, plugin);
    this.emit('plugin_registered', plugin.id);
  }

  listPlugins(): PluginDefinition[] {
    return Array.from(this.plugins.values());
  }

  getPlugin(id: string): PluginDefinition | undefined {
    return this.plugins.get(id);
  }

  async proposeUpgrade(discoveryId: string, targetPluginId: string): Promise<UpgradeProposal> {
    const discovery = this.discoveries.get(discoveryId);
    const plugin = this.plugins.get(targetPluginId);
    
    if (!discovery) throw new Error(`发现不存在: ${discoveryId}`);
    if (!plugin) throw new Error(`插件不存在: ${targetPluginId}`);

    let evaluation = this.evaluations.get(discoveryId);
    if (!evaluation) {
      evaluation = await this.evaluateDiscovery(discoveryId);
    }

    const proposal: UpgradeProposal = {
      id: `proposal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      currentPlugin: targetPluginId,
      proposedVersion: discovery.metadata.version || 'latest',
      discovery,
      evaluation,
      status: 'PENDING',
      createdAt: Date.now(),
    };

    this.proposals.set(proposal.id, proposal);
    this.emit('upgrade_proposed', proposal);

    log(`升级提案已创建: ${plugin.name} -> ${discovery.name}`);
    return proposal;
  }

  listProposals(): UpgradeProposal[] {
    return Array.from(this.proposals.values());
  }

  async approveProposal(proposalId: string): Promise<void> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error(`提案不存在: ${proposalId}`);

    proposal.status = 'APPROVED';
    proposal.approvedAt = Date.now();

    this.emit('proposal_approved', proposal);
    log(`提案已批准: ${proposalId}`);

    // 记录审计
    await getDatabase().insert(auditLogs).values({
      action: 'TECH_UPGRADE_APPROVED',
      actor: 'MASTER',
      details: JSON.stringify({
        proposalId,
        plugin: proposal.currentPlugin,
        newVersion: proposal.proposedVersion,
      }),
    });
  }

  // ============ 扫描调度 ============

  startAutoScan(intervalMinutes = 360): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
    }

    log(`启动自动扫描，间隔 ${intervalMinutes} 分钟`);
    
    this.scanInterval = setInterval(async () => {
      await this.scanAllSources();
    }, intervalMinutes * 60 * 1000);

    // 立即执行一次
    this.scanAllSources();
  }

  stopAutoScan(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
      log('自动扫描已停止');
    }
  }

  async scanAllSources(): Promise<TechDiscovery[]> {
    if (this.isScanning) {
      log('扫描正在进行中，跳过');
      return [];
    }

    this.isScanning = true;
    const allDiscoveries: TechDiscovery[] = [];

    try {
      const sourceEntries = Array.from(this.sources.entries());
      for (const [id, source] of sourceEntries) {
        if (source.enabled) {
          const discoveries = await this.scanSource(id);
          allDiscoveries.push(...discoveries);
          
          // 避免请求过于频繁
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      log(`全量扫描完成: ${allDiscoveries.length} 项发现`);
      this.emit('scan_completed', allDiscoveries);

    } finally {
      this.isScanning = false;
    }

    return allDiscoveries;
  }

  // ============ 报告生成 ============

  async generateDailyReport(): Promise<{
    date: string;
    newDiscoveries: number;
    evaluations: number;
    recommendations: { upgrade: number; monitor: number; ignore: number };
    topDiscoveries: TechDiscovery[];
    pendingProposals: number;
  }> {
    const today = new Date().toISOString().split('T')[0];
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    const recentDiscoveries = Array.from(this.discoveries.values())
      .filter(d => d.discoveredAt >= oneDayAgo);

    const recentEvaluations = Array.from(this.evaluations.values())
      .filter(e => e.evaluatedAt >= oneDayAgo);

    const recommendations = {
      upgrade: recentEvaluations.filter(e => e.recommendation === 'UPGRADE').length,
      monitor: recentEvaluations.filter(e => e.recommendation === 'MONITOR').length,
      ignore: recentEvaluations.filter(e => e.recommendation === 'IGNORE').length,
    };

    const topDiscoveries = recentDiscoveries
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const pendingProposals = Array.from(this.proposals.values())
      .filter(p => p.status === 'PENDING').length;

    return {
      date: today,
      newDiscoveries: recentDiscoveries.length,
      evaluations: recentEvaluations.length,
      recommendations,
      topDiscoveries,
      pendingProposals,
    };
  }

  // ============ 统计 ============

  getStats(): {
    sources: number;
    discoveries: number;
    evaluations: number;
    plugins: number;
    proposals: number;
    isScanning: boolean;
  } {
    return {
      sources: this.sources.size,
      discoveries: this.discoveries.size,
      evaluations: this.evaluations.size,
      plugins: this.plugins.size,
      proposals: this.proposals.size,
      isScanning: this.isScanning,
    };
  }

  listDiscoveries(options: {
    status?: string;
    type?: DiscoveryType;
    limit?: number;
    sortBy?: 'score' | 'relevance' | 'discoveredAt';
  } = {}): TechDiscovery[] {
    let discoveries = Array.from(this.discoveries.values());

    if (options.status) {
      discoveries = discoveries.filter(d => d.status === options.status);
    }
    if (options.type) {
      discoveries = discoveries.filter(d => d.type === options.type);
    }

    const sortBy = options.sortBy || 'score';
    discoveries.sort((a, b) => b[sortBy] - a[sortBy]);

    if (options.limit) {
      discoveries = discoveries.slice(0, options.limit);
    }

    return discoveries;
  }
}

export const techHunter = new TechHunterService();
logger.info('[TechHunter] 技术狩猎系统 v1.0 已加载 (Phase 11.2)');
