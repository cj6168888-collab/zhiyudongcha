/**
 * 小智 Capability Indexer - 团队能力自动索引服务
 * 
 * 功能：
 * 1. 从联系人信息中AI识别技能和能力
 * 2. 构建团队能力索引
 * 3. 支持按能力搜索人员
 * 4. 团队能力分布分析
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { db } from '../db';
import { persons, teamCapabilityIndex } from '@shared/schema';
import { eq, ilike, sql, inArray } from 'drizzle-orm';
import { chatWithDashScope, ChatMessage } from './dashscope';

const CAPABILITY_CATEGORIES = [
  '技术开发',
  '产品设计',
  '市场营销',
  '财务金融',
  '法律合规',
  '人力资源',
  '运营管理',
  '销售商务',
  '创意策划',
  '数据分析',
  '项目管理',
  '行政后勤',
  '其他专长',
];

interface CapabilityExtraction {
  capabilities: Array<{
    name: string;
    category: string;
    level: number;
    keywords: string[];
  }>;
  specialties: string[];
}

class CapabilityIndexerService {
  
  async extractCapabilitiesFromPerson(person: {
    name: string;
    role?: string | null;
    organization?: string | null;
    tags?: string[] | null;
    weakness?: string | null;
    interestChain?: any;
    decisionStyle?: string | null;
  }): Promise<CapabilityExtraction> {
    const prompt = `分析以下人员信息，提取其专业能力和特长。

人员信息：
- 姓名：${person.name}
- 职位：${person.role || '未知'}
- 组织：${person.organization || '未知'}
- 标签：${person.tags?.join(', ') || '无'}
- 决策风格：${person.decisionStyle || '未知'}
- 利益链：${JSON.stringify(person.interestChain) || '未知'}

请提取此人的能力特长，返回JSON格式：
{
  "capabilities": [
    {
      "name": "能力名称",
      "category": "类别（从以下选择：${CAPABILITY_CATEGORIES.join('、')}）",
      "level": 1-10的熟练度,
      "keywords": ["相关关键词"]
    }
  ],
  "specialties": ["核心特长1", "核心特长2"]
}

只返回JSON，不要其他内容。`;

    try {
      const messages: ChatMessage[] = [
        { role: 'system', content: '你是一个人才分析专家，擅长从有限信息中识别人员的专业能力。' },
        { role: 'user', content: prompt },
      ];
      const response = await chatWithDashScope(messages, prompt);

      const jsonMatch = response.message.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('[CapabilityIndexer] AI extraction failed:', error);
    }

    return this.inferCapabilitiesFromRole(person);
  }

  private inferCapabilitiesFromRole(person: {
    role?: string | null;
    organization?: string | null;
    tags?: string[] | null;
  }): CapabilityExtraction {
    const capabilities: CapabilityExtraction['capabilities'] = [];
    const specialties: string[] = [];
    const role = (person.role || '').toLowerCase();
    const tags = person.tags || [];

    if (role.includes('开发') || role.includes('工程师') || role.includes('程序')) {
      capabilities.push({ name: '软件开发', category: '技术开发', level: 7, keywords: ['编程', '代码'] });
      specialties.push('技术开发');
    }
    if (role.includes('设计') || role.includes('ui') || role.includes('ux')) {
      capabilities.push({ name: '产品设计', category: '产品设计', level: 7, keywords: ['UI', 'UX', '视觉'] });
      specialties.push('设计');
    }
    if (role.includes('销售') || role.includes('商务') || role.includes('bd')) {
      capabilities.push({ name: '商务拓展', category: '销售商务', level: 7, keywords: ['客户', '合作'] });
      specialties.push('商务');
    }
    if (role.includes('财务') || role.includes('会计') || role.includes('cfo')) {
      capabilities.push({ name: '财务管理', category: '财务金融', level: 7, keywords: ['财务', '账务'] });
      specialties.push('财务');
    }
    if (role.includes('法务') || role.includes('律师') || role.includes('法律')) {
      capabilities.push({ name: '法律咨询', category: '法律合规', level: 7, keywords: ['合同', '法规'] });
      specialties.push('法律');
    }
    if (role.includes('运营') || role.includes('operation')) {
      capabilities.push({ name: '运营管理', category: '运营管理', level: 7, keywords: ['运营', '流程'] });
      specialties.push('运营');
    }
    if (role.includes('市场') || role.includes('营销') || role.includes('marketing')) {
      capabilities.push({ name: '市场营销', category: '市场营销', level: 7, keywords: ['推广', '品牌'] });
      specialties.push('市场');
    }
    if (role.includes('产品') || role.includes('pm') || role.includes('产品经理')) {
      capabilities.push({ name: '产品规划', category: '产品设计', level: 7, keywords: ['需求', '规划'] });
      specialties.push('产品');
    }
    if (role.includes('项目') || role.includes('pmo')) {
      capabilities.push({ name: '项目管理', category: '项目管理', level: 7, keywords: ['项目', '进度'] });
      specialties.push('项目管理');
    }
    if (role.includes('ceo') || role.includes('总裁') || role.includes('创始人') || role.includes('董事')) {
      capabilities.push({ name: '战略决策', category: '运营管理', level: 9, keywords: ['战略', '决策'] });
      capabilities.push({ name: '领导力', category: '运营管理', level: 8, keywords: ['管理', '团队'] });
      specialties.push('领导力');
    }

    for (const tag of tags) {
      if (!capabilities.some(c => c.name.includes(tag))) {
        capabilities.push({ name: tag, category: '其他专长', level: 5, keywords: [tag] });
      }
    }

    return { capabilities, specialties };
  }

  async indexPerson(personId: string): Promise<void> {
    const [person] = await db.select().from(persons).where(eq(persons.id, personId)).limit(1);

    if (!person) {
      console.error('[CapabilityIndexer] Person not found:', personId);
      return;
    }

    console.log(`[CapabilityIndexer] Indexing capabilities for: ${person.name}`);

    const extraction = await this.extractCapabilitiesFromPerson(person);

    await db.update(persons)
      .set({
        capabilities: extraction.capabilities.map(c => c.name),
        capabilityLevel: extraction.capabilities.reduce((acc, c) => {
          acc[c.name] = c.level;
          return acc;
        }, {} as Record<string, number>),
        specialties: extraction.specialties,
        capabilityIndexedAt: new Date(),
      })
      .where(eq(persons.id, personId));

    for (const cap of extraction.capabilities) {
      await this.updateCapabilityIndex(cap.name, cap.category, personId, person.name, cap.level, cap.keywords);
    }

    console.log(`[CapabilityIndexer] Indexed ${extraction.capabilities.length} capabilities for ${person.name}`);
  }

  private async updateCapabilityIndex(
    capability: string,
    category: string,
    personId: string,
    personName: string,
    level: number,
    keywords: string[]
  ): Promise<void> {
    const [existing] = await db.select().from(teamCapabilityIndex).where(eq(teamCapabilityIndex.capability, capability)).limit(1);

    if (existing) {
      const personIds = existing.personIds || [];
      const personNames = existing.personNames || [];
      
      if (!personIds.includes(personId)) {
        personIds.push(personId);
        personNames.push(personName);
      }

      const totalCount = personIds.length;
      const existingKeywords = existing.keywords || [];
      const mergedKeywords = Array.from(new Set([...existingKeywords, ...keywords]));

      await db.update(teamCapabilityIndex)
        .set({
          personIds,
          personNames,
          totalCount,
          avgLevel: ((existing.avgLevel || 0) * (totalCount - 1) + level) / totalCount,
          keywords: mergedKeywords,
          lastUpdated: new Date(),
        })
        .where(eq(teamCapabilityIndex.id, existing.id));
    } else {
      await db.insert(teamCapabilityIndex).values({
        capability,
        category,
        personIds: [personId],
        personNames: [personName],
        totalCount: 1,
        avgLevel: level,
        keywords,
      });
    }
  }

  async indexAllPersons(): Promise<{ indexed: number; failed: number }> {
    const allPersons = await db.select().from(persons);
    let indexed = 0;
    let failed = 0;

    for (const person of allPersons) {
      try {
        await this.indexPerson(person.id);
        indexed++;
      } catch (error) {
        console.error(`[CapabilityIndexer] Failed to index ${person.name}:`, error);
        failed++;
      }
    }

    return { indexed, failed };
  }

  async searchByCapability(query: string): Promise<Array<{
    personId: string;
    personName: string;
    capability: string;
    level: number;
  }>> {
    const results: Array<{
      personId: string;
      personName: string;
      capability: string;
      level: number;
    }> = [];

    const matchingIndices = await db.select().from(teamCapabilityIndex).where(ilike(teamCapabilityIndex.capability, `%${query}%`));

    for (const index of matchingIndices) {
      const personIds = index.personIds || [];
      const personNames = index.personNames || [];
      
      for (let i = 0; i < personIds.length; i++) {
        results.push({
          personId: personIds[i],
          personName: personNames[i] || 'Unknown',
          capability: index.capability,
          level: index.avgLevel || 5,
        });
      }
    }

    return results;
  }

  async getTeamCapabilityOverview(): Promise<{
    totalCapabilities: number;
    byCategory: Record<string, number>;
    topCapabilities: Array<{ capability: string; count: number }>;
    coverageGaps: string[];
  }> {
    const allIndices = await db.select().from(teamCapabilityIndex);
    
    const byCategory: Record<string, number> = {};
    for (const index of allIndices) {
      byCategory[index.category] = (byCategory[index.category] || 0) + (index.totalCount || 0);
    }

    const topCapabilities = allIndices
      .sort((a, b) => (b.totalCount || 0) - (a.totalCount || 0))
      .slice(0, 10)
      .map(i => ({ capability: i.capability, count: i.totalCount || 0 }));

    const coveredCategories = new Set(allIndices.map(i => i.category));
    const coverageGaps = CAPABILITY_CATEGORIES.filter(c => !coveredCategories.has(c));

    return {
      totalCapabilities: allIndices.length,
      byCategory,
      topCapabilities,
      coverageGaps,
    };
  }

  async findPersonsWithCapabilities(requiredCapabilities: string[]): Promise<Array<{
    personId: string;
    personName: string;
    matchedCapabilities: string[];
    matchRate: number;
  }>> {
    const personScores: Map<string, { name: string; matched: Set<string> }> = new Map();

    for (const cap of requiredCapabilities) {
      const [index] = await db.select().from(teamCapabilityIndex).where(ilike(teamCapabilityIndex.capability, `%${cap}%`)).limit(1);

      if (index) {
        const personIds = index.personIds || [];
        const personNames = index.personNames || [];
        
        for (let i = 0; i < personIds.length; i++) {
          const existing = personScores.get(personIds[i]);
          if (existing) {
            existing.matched.add(cap);
          } else {
            personScores.set(personIds[i], {
              name: personNames[i] || 'Unknown',
              matched: new Set([cap]),
            });
          }
        }
      }
    }

    return Array.from(personScores.entries())
      .map(([personId, data]) => ({
        personId,
        personName: data.name,
        matchedCapabilities: Array.from(data.matched),
        matchRate: data.matched.size / requiredCapabilities.length,
      }))
      .sort((a, b) => b.matchRate - a.matchRate);
  }

  /**
   * 生成团队战斗力分布图数据
   * 用于可视化团队能力分布和综合战斗力评估
   */
  async getTeamCombatPowerDistribution(): Promise<{
    radarData: Array<{ category: string; value: number; fullMark: number }>;
    memberPowerRanking: Array<{
      personId: string;
      personName: string;
      combatPower: number;
      topCapabilities: string[];
      tier: 'S' | 'A' | 'B' | 'C';
    }>;
    categoryBreakdown: Array<{
      category: string;
      members: Array<{ name: string; level: number }>;
      avgLevel: number;
      coverage: number;
    }>;
    teamStrength: {
      overallScore: number;
      strongAreas: string[];
      weakAreas: string[];
      recommendations: string[];
    };
  }> {
    const allIndices = await db.select().from(teamCapabilityIndex);
    const allPersons = await db.select().from(persons);
    
    const radarData = CAPABILITY_CATEGORIES.map(category => {
      const categoryIndices = allIndices.filter(i => i.category === category);
      const totalPeople = categoryIndices.reduce((sum, i) => sum + (i.totalCount || 0), 0);
      const avgLevel = categoryIndices.length > 0
        ? categoryIndices.reduce((sum, i) => sum + (i.avgLevel || 0), 0) / categoryIndices.length
        : 0;
      return {
        category,
        value: Math.round(avgLevel * totalPeople / 10 * 100) / 100,
        fullMark: 10,
      };
    });

    const memberPowerRanking = allPersons
      .filter(p => p.capabilities && p.capabilities.length > 0)
      .map(p => {
        let capLevels: Record<string, number> = {};
        if (p.capabilityLevel && typeof p.capabilityLevel === 'object') {
          capLevels = p.capabilityLevel as Record<string, number>;
        } else if (typeof p.capabilityLevel === 'string') {
          try { capLevels = JSON.parse(p.capabilityLevel); } catch { capLevels = {}; }
        }
        const levels = Object.values(capLevels).filter(v => typeof v === 'number') as number[];
        const avgLevel = levels.length > 0
          ? levels.reduce((a, b) => a + b, 0) / levels.length
          : 0;
        const combatPower = Math.round(avgLevel * (p.capabilities?.length || 1) * 10);
        
        let tier: 'S' | 'A' | 'B' | 'C' = 'C';
        if (combatPower >= 80) tier = 'S';
        else if (combatPower >= 60) tier = 'A';
        else if (combatPower >= 40) tier = 'B';

        return {
          personId: p.id,
          personName: p.name,
          combatPower,
          topCapabilities: (p.capabilities || []).slice(0, 3),
          tier,
        };
      })
      .sort((a, b) => b.combatPower - a.combatPower);

    const categoryBreakdown = CAPABILITY_CATEGORIES.map(category => {
      const categoryIndices = allIndices.filter(i => i.category === category);
      const members: Array<{ name: string; level: number }> = [];
      
      for (const index of categoryIndices) {
        const personNames = index.personNames || [];
        for (const name of personNames) {
          if (!members.some(m => m.name === name)) {
            members.push({ name, level: index.avgLevel || 5 });
          }
        }
      }
      
      const avgLevel = members.length > 0
        ? members.reduce((sum, m) => sum + m.level, 0) / members.length
        : 0;
      
      return {
        category,
        members,
        avgLevel: Math.round(avgLevel * 10) / 10,
        coverage: members.length > 0 ? 1 : 0,
      };
    });

    const strongAreas = categoryBreakdown
      .filter(c => c.avgLevel >= 7 && c.members.length >= 2)
      .map(c => c.category);
    
    const weakAreas = categoryBreakdown
      .filter(c => c.avgLevel < 5 || c.members.length === 0)
      .map(c => c.category);

    const totalMembers = memberPowerRanking.length;
    const avgPower = totalMembers > 0
      ? memberPowerRanking.reduce((sum, m) => sum + m.combatPower, 0) / totalMembers
      : 0;
    const overallScore = Math.min(100, Math.round(avgPower + (strongAreas.length * 5) - (weakAreas.length * 3)));

    const recommendations: string[] = [];
    if (weakAreas.length > 0) {
      recommendations.push(`建议补强领域: ${weakAreas.slice(0, 2).join('、')}`);
    }
    const sTierCount = memberPowerRanking.filter(m => m.tier === 'S').length;
    if (sTierCount === 0) {
      recommendations.push('团队缺少顶级核心人才，建议重点培养或引进');
    }
    if (totalMembers < 5) {
      recommendations.push('团队规模较小，建议扩充人员覆盖更多能力维度');
    }

    return {
      radarData,
      memberPowerRanking,
      categoryBreakdown,
      teamStrength: {
        overallScore,
        strongAreas,
        weakAreas,
        recommendations,
      },
    };
  }

  /**
   * 获取单个成员的能力雷达图数据
   */
  async getMemberCapabilityRadar(personId: string): Promise<{
    personName: string;
    radarData: Array<{ category: string; value: number; fullMark: number }>;
    combatPower: number;
    tier: 'S' | 'A' | 'B' | 'C';
    strengths: string[];
    growthAreas: string[];
  } | null> {
    const [person] = await db.select().from(persons).where(eq(persons.id, personId)).limit(1);
    
    if (!person) return null;

    let capLevels: Record<string, number> = {};
    if (person.capabilityLevel && typeof person.capabilityLevel === 'object') {
      capLevels = person.capabilityLevel as Record<string, number>;
    } else if (typeof person.capabilityLevel === 'string') {
      try { capLevels = JSON.parse(person.capabilityLevel); } catch { capLevels = {}; }
    }
    
    const radarData = CAPABILITY_CATEGORIES.map(category => {
      const caps = person.capabilities || [];
      const relatedCaps = caps.filter(c => {
        const index = c.toLowerCase();
        return this.categoryKeywords[category]?.some(kw => index.includes(kw)) || false;
      });
      
      let value = 0;
      for (const cap of relatedCaps) {
        value = Math.max(value, (capLevels as Record<string, number>)[cap] || 5);
      }
      
      return { category, value, fullMark: 10 };
    });

    const levels = Object.values(capLevels) as number[];
    const avgLevel = levels.length > 0 ? levels.reduce((a, b) => a + b, 0) / levels.length : 0;
    const combatPower = Math.round(avgLevel * (person.capabilities?.length || 1) * 10);
    
    let tier: 'S' | 'A' | 'B' | 'C' = 'C';
    if (combatPower >= 80) tier = 'S';
    else if (combatPower >= 60) tier = 'A';
    else if (combatPower >= 40) tier = 'B';

    const sortedCaps = Object.entries(capLevels as Record<string, number>)
      .sort((a, b) => b[1] - a[1]);
    
    const strengths = sortedCaps.filter(([, lv]) => lv >= 7).slice(0, 3).map(([name]) => name);
    const growthAreas = sortedCaps.filter(([, lv]) => lv < 5).slice(0, 3).map(([name]) => name);

    return {
      personName: person.name,
      radarData,
      combatPower,
      tier,
      strengths,
      growthAreas,
    };
  }

  private categoryKeywords: Record<string, string[]> = {
    '技术开发': ['开发', '编程', '技术', '代码', '软件', '工程'],
    '产品设计': ['设计', 'ui', 'ux', '产品', '交互'],
    '市场营销': ['市场', '营销', '推广', '品牌'],
    '财务金融': ['财务', '金融', '会计', '投资'],
    '法律合规': ['法律', '法务', '合规', '合同'],
    '人力资源': ['人力', 'hr', '招聘', '培训'],
    '运营管理': ['运营', '管理', '流程'],
    '销售商务': ['销售', '商务', 'bd', '客户'],
    '创意策划': ['创意', '策划', '文案'],
    '数据分析': ['数据', '分析', '统计'],
    '项目管理': ['项目', 'pmo', '进度'],
    '行政后勤': ['行政', '后勤', '办公'],
    '其他专长': [],
  };
}

export const capabilityIndexer = new CapabilityIndexerService();
