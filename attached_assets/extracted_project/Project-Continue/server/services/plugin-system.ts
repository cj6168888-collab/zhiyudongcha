/**
 * 小智 Plugin System - 热更新插件系统
 * 
 * 设计原则（基于文章建议）：
 * - 不修改核心代码，而是生成"逻辑指令包"和"知识库补丁"
 * - 所有更新通过可回滚的插件机制应用
 * - 沙箱验证后才能激活插件
 * 
 * 插件类型：
 * 1. LogicPackage - 逻辑指令包：决策权重、响应模板、处理流程
 * 2. KnowledgePatch - 知识库补丁：RAG更新、术语库扩展
 * 3. BehaviorProfile - 行为配置：交互风格、语气模板
 * 4. SkillModule - 技能模块：新功能的热加载
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { db } from '../db';
import { evolutionEvents, auditLogs } from '@shared/schema';
import { eq, desc, and, gte } from 'drizzle-orm';
import crypto from 'crypto';

export type PluginType = 'LOGIC_PACKAGE' | 'KNOWLEDGE_PATCH' | 'BEHAVIOR_PROFILE' | 'SKILL_MODULE';
export type PluginStatus = 'DRAFT' | 'VALIDATING' | 'VALIDATED' | 'ACTIVE' | 'DISABLED' | 'ROLLED_BACK';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  type: PluginType;
  description: string;
  author: string;
  createdAt: Date;
  activatedAt?: Date;
  hash: string;
}

export interface LogicPackage extends PluginManifest {
  type: 'LOGIC_PACKAGE';
  content: {
    decisionWeights: Record<string, number>;
    responseTemplates: Record<string, string>;
    processingRules: Array<{
      condition: string;
      action: string;
      priority: number;
    }>;
    triggerConditions: string[];
  };
}

export interface KnowledgePatch extends PluginManifest {
  type: 'KNOWLEDGE_PATCH';
  content: {
    domain: string;
    entries: Array<{
      key: string;
      value: string;
      embedding?: number[];
      metadata?: Record<string, unknown>;
    }>;
    synonyms: Record<string, string[]>;
    relations: Array<{
      source: string;
      target: string;
      relation: string;
    }>;
  };
}

export interface BehaviorProfile extends PluginManifest {
  type: 'BEHAVIOR_PROFILE';
  content: {
    toneStyle: 'formal' | 'casual' | 'professional' | 'friendly';
    responsePatterns: Record<string, string>;
    emotionalTuning: {
      empathyLevel: number;
      assertivenessLevel: number;
      formalityLevel: number;
    };
    languagePreferences: {
      preferredPhrases: string[];
      avoidPhrases: string[];
    };
  };
}

export interface SkillModule extends PluginManifest {
  type: 'SKILL_MODULE';
  content: {
    skillName: string;
    triggerPhrases: string[];
    parameters: Record<string, { type: string; required: boolean; default?: unknown }>;
    executionLogic: string;
    fallbackBehavior: string;
  };
}

export type Plugin = LogicPackage | KnowledgePatch | BehaviorProfile | SkillModule;

interface ValidationResult {
  pluginId: string;
  passed: boolean;
  score: number;
  checks: Array<{
    name: string;
    passed: boolean;
    message: string;
  }>;
  sandboxOutput?: string;
}

export interface PluginStats {
  totalPlugins: number;
  activePlugins: number;
  byType: Record<PluginType, number>;
  byStatus: Record<PluginStatus, number>;
  lastUpdated: Date;
}

class PluginSystemService {
  private plugins: Map<string, Plugin & { status: PluginStatus }> = new Map();
  private activeLogicPackages: LogicPackage[] = [];
  private activeKnowledgePatches: KnowledgePatch[] = [];
  private activeBehaviorProfiles: BehaviorProfile[] = [];
  private activeSkillModules: SkillModule[] = [];
  private validationHistory: Map<string, ValidationResult[]> = new Map();

  async createLogicPackage(params: {
    name: string;
    description: string;
    decisionWeights: Record<string, number>;
    responseTemplates?: Record<string, string>;
    processingRules?: Array<{ condition: string; action: string; priority: number }>;
    triggerConditions?: string[];
  }): Promise<LogicPackage> {
    const id = `logic_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const content = {
      decisionWeights: params.decisionWeights,
      responseTemplates: params.responseTemplates || {},
      processingRules: params.processingRules || [],
      triggerConditions: params.triggerConditions || [],
    };

    const plugin: LogicPackage & { status: PluginStatus } = {
      id,
      name: params.name,
      version: '1.0.0',
      type: 'LOGIC_PACKAGE',
      description: params.description,
      author: 'chrysalis_system',
      createdAt: new Date(),
      hash: this.computeHash(content),
      content,
      status: 'DRAFT',
    };

    this.plugins.set(id, plugin);
    console.log(`[PluginSystem] 创建逻辑指令包: ${params.name}`);
    return plugin;
  }

  async createKnowledgePatch(params: {
    name: string;
    description: string;
    domain: string;
    entries: Array<{ key: string; value: string; metadata?: Record<string, unknown> }>;
    synonyms?: Record<string, string[]>;
    relations?: Array<{ source: string; target: string; relation: string }>;
  }): Promise<KnowledgePatch> {
    const id = `knowledge_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const content = {
      domain: params.domain,
      entries: params.entries,
      synonyms: params.synonyms || {},
      relations: params.relations || [],
    };

    const plugin: KnowledgePatch & { status: PluginStatus } = {
      id,
      name: params.name,
      version: '1.0.0',
      type: 'KNOWLEDGE_PATCH',
      description: params.description,
      author: 'chrysalis_system',
      createdAt: new Date(),
      hash: this.computeHash(content),
      content,
      status: 'DRAFT',
    };

    this.plugins.set(id, plugin);
    console.log(`[PluginSystem] 创建知识库补丁: ${params.name} (${params.domain})`);
    return plugin;
  }

  async createBehaviorProfile(params: {
    name: string;
    description: string;
    toneStyle: 'formal' | 'casual' | 'professional' | 'friendly';
    responsePatterns?: Record<string, string>;
    emotionalTuning?: { empathyLevel: number; assertivenessLevel: number; formalityLevel: number };
  }): Promise<BehaviorProfile> {
    const id = `behavior_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const content = {
      toneStyle: params.toneStyle,
      responsePatterns: params.responsePatterns || {},
      emotionalTuning: params.emotionalTuning || {
        empathyLevel: 0.7,
        assertivenessLevel: 0.5,
        formalityLevel: 0.6,
      },
      languagePreferences: {
        preferredPhrases: [],
        avoidPhrases: [],
      },
    };

    const plugin: BehaviorProfile & { status: PluginStatus } = {
      id,
      name: params.name,
      version: '1.0.0',
      type: 'BEHAVIOR_PROFILE',
      description: params.description,
      author: 'chrysalis_system',
      createdAt: new Date(),
      hash: this.computeHash(content),
      content,
      status: 'DRAFT',
    };

    this.plugins.set(id, plugin);
    console.log(`[PluginSystem] 创建行为配置: ${params.name}`);
    return plugin;
  }

  async validatePlugin(pluginId: string): Promise<ValidationResult> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error('插件不存在');
    }

    plugin.status = 'VALIDATING';
    console.log(`[PluginSystem] 验证插件: ${plugin.name}`);

    const checks: Array<{ name: string; passed: boolean; message: string }> = [];

    checks.push({
      name: 'schema_valid',
      passed: this.validateSchema(plugin),
      message: '插件结构验证',
    });

    checks.push({
      name: 'hash_integrity',
      passed: this.computeHash(plugin.content) === plugin.hash,
      message: '完整性校验',
    });

    checks.push({
      name: 'no_code_injection',
      passed: this.checkNoCodeInjection(plugin),
      message: '代码注入检查',
    });

    checks.push({
      name: 'size_limit',
      passed: JSON.stringify(plugin.content).length < 1024 * 1024,
      message: '大小限制检查 (<1MB)',
    });

    if (plugin.type === 'LOGIC_PACKAGE') {
      checks.push({
        name: 'weight_bounds',
        passed: this.validateWeightBounds(plugin as LogicPackage),
        message: '权重边界验证',
      });
    }

    const passed = checks.every(c => c.passed);
    const score = checks.filter(c => c.passed).length / checks.length;

    plugin.status = passed ? 'VALIDATED' : 'DRAFT';

    const result: ValidationResult = {
      pluginId,
      passed,
      score,
      checks,
    };

    const history = this.validationHistory.get(pluginId) || [];
    history.push(result);
    this.validationHistory.set(pluginId, history);

    console.log(`[PluginSystem] 验证结果: ${passed ? '通过' : '失败'} (${score * 100}%)`);

    return result;
  }

  async activatePlugin(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error('插件不存在');
    }

    if (plugin.status !== 'VALIDATED') {
      const validation = await this.validatePlugin(pluginId);
      if (!validation.passed) {
        throw new Error('插件验证未通过');
      }
    }

    plugin.status = 'ACTIVE';
    plugin.activatedAt = new Date();

    switch (plugin.type) {
      case 'LOGIC_PACKAGE':
        this.activeLogicPackages.push(plugin as LogicPackage);
        break;
      case 'KNOWLEDGE_PATCH':
        this.activeKnowledgePatches.push(plugin as KnowledgePatch);
        break;
      case 'BEHAVIOR_PROFILE':
        this.activeBehaviorProfiles.push(plugin as BehaviorProfile);
        break;
      case 'SKILL_MODULE':
        this.activeSkillModules.push(plugin as SkillModule);
        break;
    }

    await this.logPluginEvent(pluginId, 'ACTIVATE', plugin.name);
    console.log(`[PluginSystem] 激活插件: ${plugin.name}`);

    return true;
  }

  async deactivatePlugin(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return false;
    }

    plugin.status = 'DISABLED';

    switch (plugin.type) {
      case 'LOGIC_PACKAGE':
        this.activeLogicPackages = this.activeLogicPackages.filter(p => p.id !== pluginId);
        break;
      case 'KNOWLEDGE_PATCH':
        this.activeKnowledgePatches = this.activeKnowledgePatches.filter(p => p.id !== pluginId);
        break;
      case 'BEHAVIOR_PROFILE':
        this.activeBehaviorProfiles = this.activeBehaviorProfiles.filter(p => p.id !== pluginId);
        break;
      case 'SKILL_MODULE':
        this.activeSkillModules = this.activeSkillModules.filter(p => p.id !== pluginId);
        break;
    }

    await this.logPluginEvent(pluginId, 'DEACTIVATE', plugin.name);
    console.log(`[PluginSystem] 停用插件: ${plugin.name}`);

    return true;
  }

  async rollbackPlugin(pluginId: string, reason: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return false;
    }

    await this.deactivatePlugin(pluginId);
    plugin.status = 'ROLLED_BACK';

    await this.logPluginEvent(pluginId, 'ROLLBACK', `${plugin.name}: ${reason}`);
    console.log(`[PluginSystem] 回滚插件: ${plugin.name}, 原因: ${reason}`);

    return true;
  }

  getActiveDecisionWeights(): Record<string, number> {
    const weights: Record<string, number> = {};

    for (const pkg of this.activeLogicPackages) {
      for (const [key, value] of Object.entries(pkg.content.decisionWeights)) {
        weights[key] = (weights[key] || 0) + value;
      }
    }

    return weights;
  }

  getActiveResponseTemplates(): Record<string, string> {
    const templates: Record<string, string> = {};

    for (const pkg of this.activeLogicPackages) {
      Object.assign(templates, pkg.content.responseTemplates);
    }

    return templates;
  }

  getActiveKnowledge(domain?: string): Array<{ key: string; value: string }> {
    let patches = this.activeKnowledgePatches;
    if (domain) {
      patches = patches.filter(p => p.content.domain === domain);
    }

    const entries: Array<{ key: string; value: string }> = [];
    for (const patch of patches) {
      entries.push(...patch.content.entries);
    }

    return entries;
  }

  getCurrentBehaviorProfile(): BehaviorProfile['content'] | null {
    if (this.activeBehaviorProfiles.length === 0) {
      return null;
    }
    return this.activeBehaviorProfiles[this.activeBehaviorProfiles.length - 1].content;
  }

  async getStats(): Promise<PluginStats> {
    const byType: Record<PluginType, number> = {
      LOGIC_PACKAGE: 0,
      KNOWLEDGE_PATCH: 0,
      BEHAVIOR_PROFILE: 0,
      SKILL_MODULE: 0,
    };

    const byStatus: Record<PluginStatus, number> = {
      DRAFT: 0,
      VALIDATING: 0,
      VALIDATED: 0,
      ACTIVE: 0,
      DISABLED: 0,
      ROLLED_BACK: 0,
    };

    for (const plugin of Array.from(this.plugins.values())) {
      byType[plugin.type]++;
      byStatus[plugin.status]++;
    }

    return {
      totalPlugins: this.plugins.size,
      activePlugins: byStatus.ACTIVE,
      byType,
      byStatus,
      lastUpdated: new Date(),
    };
  }

  async listPlugins(filter?: { type?: PluginType; status?: PluginStatus }): Promise<Array<PluginManifest & { status: PluginStatus }>> {
    let plugins = Array.from(this.plugins.values());

    if (filter?.type) {
      plugins = plugins.filter(p => p.type === filter.type);
    }
    if (filter?.status) {
      plugins = plugins.filter(p => p.status === filter.status);
    }

    return plugins.map(p => ({
      id: p.id,
      name: p.name,
      version: p.version,
      type: p.type,
      description: p.description,
      author: p.author,
      createdAt: p.createdAt,
      activatedAt: p.activatedAt,
      hash: p.hash,
      status: p.status,
    }));
  }

  getPlugin(pluginId: string): Plugin | null {
    return this.plugins.get(pluginId) || null;
  }

  private computeHash(content: unknown): string {
    return crypto.createHash('sha256')
      .update(JSON.stringify(content))
      .digest('hex')
      .slice(0, 16);
  }

  private validateSchema(plugin: Plugin): boolean {
    if (!plugin.id || !plugin.name || !plugin.type || !plugin.content) {
      return false;
    }
    return true;
  }

  private checkNoCodeInjection(plugin: Plugin): boolean {
    const contentStr = JSON.stringify(plugin.content);
    const dangerousPatterns = [
      /eval\s*\(/,
      /Function\s*\(/,
      /require\s*\(/,
      /import\s*\(/,
      /<script/i,
      /process\./,
      /child_process/,
      /fs\./,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(contentStr)) {
        return false;
      }
    }

    return true;
  }

  private validateWeightBounds(pkg: LogicPackage): boolean {
    for (const weight of Object.values(pkg.content.decisionWeights)) {
      if (weight < -1 || weight > 1) {
        return false;
      }
    }
    return true;
  }

  private async logPluginEvent(pluginId: string, action: string, details: string): Promise<void> {
    try {
      await db.insert(evolutionEvents).values({
        sourceModule: 'plugin_system',
        eventType: `PLUGIN_${action}`,
        newValue: { pluginId, details } as any,
        deltaDescription: `插件${action}: ${details}`,
        triggeredBy: 'chrysalis_system',
      });
    } catch (error) {
      console.error('[PluginSystem] 日志记录失败:', error);
    }
  }
}

export const pluginSystem = new PluginSystemService();
