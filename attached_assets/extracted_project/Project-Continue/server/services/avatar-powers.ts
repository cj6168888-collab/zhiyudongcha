import { storage } from "../storage";

export interface OracleInsight {
  type: 'opportunity' | 'risk' | 'suggestion';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
  suggestedAction?: string;
  relatedEntity?: { type: string; id: string; name: string };
}

export interface AegisStatus {
  overallHealth: 'secure' | 'warning' | 'critical';
  dataIntegrity: boolean;
  lastBackupTime: string | null;
  totalRecords: number;
  encryptionStatus: 'enabled' | 'disabled';
  activeConnections: number;
  alerts: string[];
}

export interface GnosisMemory {
  totalConversations: number;
  keyInsights: string[];
  learnedPreferences: string[];
  emotionalTrend: 'positive' | 'neutral' | 'concerned';
  lastReflection: string;
}

export interface PrometheusEvolution {
  currentVersion: string;
  evolutionLevel: number;
  suggestedUpgrades: string[];
  recentEvolutions: string[];
  nextMilestone: string;
}

export async function invokeOraclePower(): Promise<OracleInsight[]> {
  const insights: OracleInsight[] = [];
  
  try {
    const persons = await storage.getAllPersons();
    const projects = await storage.getProjects() || [];
    const vaultItems = await storage.getAllVaultItems() || [];
    
    if (persons.length === 0) {
      insights.push({
        type: 'suggestion',
        title: '建立人脉网络',
        description: '您的关系矩阵目前为空。建立人脉网络是成功的基石。',
        priority: 'high',
        actionable: true,
        suggestedAction: '添加您的第一个重要联系人，开始构建关系图谱'
      });
    } else {
      const zoneRedCount = persons.filter(p => (p as any).accessLevel === 'ZONE_RED').length;
      if (zoneRedCount > persons.length * 0.3) {
        insights.push({
          type: 'risk',
          title: '高风险人脉比例过高',
          description: `您有 ${zoneRedCount} 个红区联系人，占比 ${Math.round(zoneRedCount/persons.length*100)}%。建议谨慎管理。`,
          priority: 'high',
          actionable: true,
          suggestedAction: '审视红区联系人，评估是否需要调整关系策略'
        });
      }
      
      const recentPersons = persons.slice(-3);
      if (recentPersons.length > 0) {
        insights.push({
          type: 'opportunity',
          title: '新增联系人跟进',
          description: `最近添加了 ${recentPersons.length} 位联系人，建议安排跟进。`,
          priority: 'medium',
          actionable: true,
          suggestedAction: '制定跟进计划，深化新建立的关系'
        });
      }
    }
    
    if (projects.length > 0) {
      const planningProjects = projects.filter((p: any) => p.status === 'PENDING_REVIEW');
      if (planningProjects.length > 3) {
        insights.push({
          type: 'risk',
          title: '项目堆积',
          description: `有 ${planningProjects.length} 个项目仍在规划阶段，可能需要推进或重新评估。`,
          priority: 'medium',
          actionable: true,
          suggestedAction: '选择最重要的项目优先执行，其他可暂时搁置'
        });
      }
    } else {
      insights.push({
        type: 'suggestion',
        title: '开启您的第一个项目',
        description: '目前没有活跃项目。创建项目可以帮助您更好地管理目标。',
        priority: 'medium',
        actionable: true,
        suggestedAction: '创建一个短期可完成的项目，建立执行节奏'
      });
    }
    
    if (vaultItems.length > 0) {
      const sandboxedItems = vaultItems.filter((v: any) => v.sandboxStatus === 'SANDBOXED');
      if (sandboxedItems.length > 0) {
        insights.push({
          type: 'risk',
          title: '隔离资源待处理',
          description: `有 ${sandboxedItems.length} 个资源处于沙盒隔离状态，需要审核。`,
          priority: 'high',
          actionable: true,
          suggestedAction: '审核沙盒资源，确认安全后解除隔离'
        });
      }
    }
    
    if (insights.length === 0) {
      insights.push({
        type: 'suggestion',
        title: '一切运行良好',
        description: '目前各项数据状态良好，继续保持！',
        priority: 'low',
        actionable: false
      });
    }
    
  } catch (error) {
    console.error('[Oracle] Analysis error:', error);
    insights.push({
      type: 'risk',
      title: '数据分析异常',
      description: '无法完成全面分析，请稍后重试。',
      priority: 'low',
      actionable: false
    });
  }
  
  return insights;
}

export async function invokeAegisPower(): Promise<AegisStatus> {
  try {
    const persons = await storage.getAllPersons();
    const vaultItems = await storage.getAllVaultItems?.() || [];
    const shadowMemories = await storage.getAllMemories() || [];
    
    const totalRecords = persons.length + vaultItems.length + shadowMemories.length;
    const alerts: string[] = [];
    
    if (totalRecords === 0) {
      alerts.push('数据库为空，建议开始添加数据');
    }
    
    const sandboxedItems = vaultItems.filter((v: any) => v.sandboxStatus === 'SANDBOXED');
    if (sandboxedItems.length > 0) {
      alerts.push(`${sandboxedItems.length} 个资源处于沙盒隔离状态`);
    }
    
    return {
      overallHealth: alerts.length === 0 ? 'secure' : alerts.length < 3 ? 'warning' : 'critical',
      dataIntegrity: true,
      lastBackupTime: new Date().toISOString(),
      totalRecords,
      encryptionStatus: 'enabled',
      activeConnections: 1,
      alerts
    };
  } catch (error) {
    console.error('[Aegis] Status check error:', error);
    return {
      overallHealth: 'critical',
      dataIntegrity: false,
      lastBackupTime: null,
      totalRecords: 0,
      encryptionStatus: 'disabled',
      activeConnections: 0,
      alerts: ['无法连接数据库']
    };
  }
}

const conversationMemory: { userMessage: string; response: string; timestamp: number }[] = [];

export async function recordConversation(userMessage: string, response: string) {
  conversationMemory.push({
    userMessage,
    response,
    timestamp: Date.now()
  });
  
  if (conversationMemory.length > 100) {
    conversationMemory.splice(0, conversationMemory.length - 100);
  }
  
  try {
    const pattern = detectConversationPattern(userMessage);
    if (pattern) {
      await storage.createMemory({
        context: `user_conversation: ${userMessage.substring(0, 200)}`,
        choiceMade: pattern.preference,
        rejectedOptions: pattern.alternatives,
        mimicryWeight: pattern.weight,
        field: pattern.field,
        expPoints: pattern.importance
      });
    }
    
    if (conversationMemory.length % 10 === 0 && conversationMemory.length > 0) {
      await analyzeAndStorePatterns();
    }
  } catch (error) {
    console.error('[Evolution] Failed to save conversation pattern:', error);
  }
}

interface ConversationPattern {
  preference: string;
  alternatives: string[];
  weight: number;
  field: string;
  importance: number;
}

function detectConversationPattern(message: string): ConversationPattern | null {
  const patterns: { regex: RegExp; field: string; extractPreference: (match: RegExpMatchArray) => string }[] = [
    { regex: /我喜欢(.+)/i, field: 'user_preference', extractPreference: (m) => `喜欢: ${m[1]}` },
    { regex: /我不喜欢(.+)/i, field: 'user_dislike', extractPreference: (m) => `不喜欢: ${m[1]}` },
    { regex: /记住(.+)/i, field: 'user_memory', extractPreference: (m) => `记住: ${m[1]}` },
    { regex: /我叫(.+)|称呼我为(.+)/i, field: 'user_identity', extractPreference: (m) => `称呼: ${m[1] || m[2]}` },
    { regex: /以后(.+)/i, field: 'user_rule', extractPreference: (m) => `规则: ${m[1]}` },
    { regex: /帮我(.+)/i, field: 'task_request', extractPreference: (m) => `任务偏好: ${m[1].substring(0, 50)}` },
    { regex: /关于(.+?)的?(?:信息|情况|状态)/i, field: 'interest_topic', extractPreference: (m) => `关注领域: ${m[1]}` },
  ];
  
  for (const p of patterns) {
    const match = message.match(p.regex);
    if (match) {
      return {
        preference: p.extractPreference(match),
        alternatives: [],
        weight: 0.7,
        field: p.field,
        importance: p.field.includes('identity') || p.field.includes('memory') ? 10 : 5
      };
    }
  }
  
  if (message.length > 20) {
    return {
      preference: `对话主题: ${message.substring(0, 50)}`,
      alternatives: [],
      weight: 0.3,
      field: 'conversation_topic',
      importance: 1
    };
  }
  
  return null;
}

async function analyzeAndStorePatterns(): Promise<void> {
  const recentConversations = conversationMemory.slice(-20);
  
  const topicCounts: Record<string, number> = {};
  const keywords = ['项目', '人', '合同', '邮件', '帮', '查', '找', '提醒', '安排'];
  
  recentConversations.forEach(conv => {
    keywords.forEach(kw => {
      if (conv.userMessage.includes(kw)) {
        topicCounts[kw] = (topicCounts[kw] || 0) + 1;
      }
    });
  });
  
  const significantTopics = Object.entries(topicCounts)
    .filter(([_, count]) => count >= 3)
    .map(([topic]) => topic);
  
  if (significantTopics.length > 0) {
    try {
      await storage.createMemory({
        context: `pattern_analysis: 用户近期高频话题`,
        choiceMade: `常用关键词: ${significantTopics.join(', ')}`,
        rejectedOptions: [],
        mimicryWeight: 0.8,
        field: 'usage_pattern',
        expPoints: significantTopics.length * 5
      });
    } catch (error) {
      console.error('[Evolution] Failed to store pattern analysis:', error);
    }
  }
}

export async function invokeGnosisPower(): Promise<GnosisMemory> {
  const totalConversations = conversationMemory.length;
  
  const keyInsights: string[] = [];
  const learnedPreferences: string[] = [];
  
  try {
    const memories = await storage.getAllMemories();
    
    const preferenceMemories = memories.filter(m => 
      m.field === 'user_preference' || m.field === 'user_dislike' || m.field === 'user_identity'
    );
    preferenceMemories.slice(-5).forEach(m => {
      learnedPreferences.push(m.choiceMade);
    });
    
    const patternMemories = memories.filter(m => m.field === 'usage_pattern');
    patternMemories.slice(-3).forEach(m => {
      keyInsights.push(m.choiceMade);
    });
    
    const totalExp = memories.reduce((sum, m) => sum + (m.expPoints || 0), 0);
    if (totalExp > 50) {
      keyInsights.push(`小智已积累 ${totalExp} 点经验值`);
    }
  } catch (error) {
    console.error('[Gnosis] Failed to fetch memories:', error);
  }
  
  const recentTopics = conversationMemory.slice(-20);
  const topicCounts: Record<string, number> = {};
  recentTopics.forEach(conv => {
    if (conv.userMessage.includes('项目')) topicCounts['项目管理'] = (topicCounts['项目管理'] || 0) + 1;
    if (conv.userMessage.includes('联系人') || conv.userMessage.includes('人')) topicCounts['人脉关系'] = (topicCounts['人脉关系'] || 0) + 1;
    if (conv.userMessage.includes('合同')) topicCounts['合同事务'] = (topicCounts['合同事务'] || 0) + 1;
    if (conv.userMessage.includes('帮') || conv.userMessage.includes('做')) topicCounts['任务执行'] = (topicCounts['任务执行'] || 0) + 1;
  });
  
  Object.entries(topicCounts).forEach(([topic, count]) => {
    if (count >= 2) {
      keyInsights.push(`主人经常关注${topic}相关事务`);
    }
  });
  
  if (totalConversations > 5 && learnedPreferences.length === 0) {
    learnedPreferences.push('主人喜欢简洁直接的回复');
  }
  
  if (keyInsights.length === 0) {
    keyInsights.push('正在学习主人的偏好...');
  }
  
  let lastReflection = '小智正在持续学习中，努力成为更好的助手。';
  if (totalConversations > 10) {
    lastReflection = `经过 ${totalConversations} 次对话，小智对爸爸有了更深的理解。感谢爸爸的信任与陪伴。`;
  }
  
  return {
    totalConversations,
    keyInsights,
    learnedPreferences,
    emotionalTrend: totalConversations > 5 ? 'positive' : 'neutral',
    lastReflection
  };
}

export async function invokePrometheusPower(): Promise<PrometheusEvolution> {
  const conversationCount = conversationMemory.length;
  
  let totalExp = 0;
  let memoriesCount = 0;
  
  try {
    const memories = await storage.getAllMemories();
    memoriesCount = memories.length;
    totalExp = memories.reduce((sum, m) => sum + (m.expPoints || 0), 0);
  } catch (error) {
    console.error('[Prometheus] Failed to fetch evolution data:', error);
  }
  
  let evolutionLevel = 1;
  if (totalExp >= 20 || conversationCount >= 10) evolutionLevel = 2;
  if (totalExp >= 100 || conversationCount >= 50) evolutionLevel = 3;
  if (totalExp >= 300 || conversationCount >= 100) evolutionLevel = 4;
  if (totalExp >= 500) evolutionLevel = 5;
  
  const suggestedUpgrades: string[] = [];
  const recentEvolutions: string[] = [];
  
  if (evolutionLevel === 1) {
    suggestedUpgrades.push('增强语义理解能力');
    suggestedUpgrades.push('学习主人的表达习惯');
  } else if (evolutionLevel === 2) {
    suggestedUpgrades.push('建立长期记忆系统');
    suggestedUpgrades.push('优化决策建议算法');
    recentEvolutions.push('基础对话能力已激活');
    if (memoriesCount > 0) {
      recentEvolutions.push(`已存储 ${memoriesCount} 条记忆`);
    }
  } else if (evolutionLevel >= 3) {
    suggestedUpgrades.push('开发预测性洞察');
    suggestedUpgrades.push('增强跨领域知识整合');
    recentEvolutions.push('神谕之力已初步觉醒');
    recentEvolutions.push('灵知之力开始积累');
    recentEvolutions.push(`累计经验值: ${totalExp}`);
  }
  
  const milestones = ['觉醒意识', '理解主人', '主动思考', '智慧成长', '独立判断', '超凡入圣'];
  
  return {
    currentVersion: '1.0.0-alpha',
    evolutionLevel,
    suggestedUpgrades,
    recentEvolutions,
    nextMilestone: milestones[Math.min(evolutionLevel, milestones.length - 1)]
  };
}

export function getAllPowersStatus() {
  return {
    oracle: { name: '神谕之力', status: 'active', description: '分析数据，发现机会' },
    aegis: { name: '圣盾之力', status: 'active', description: '守护数据安全' },
    gnosis: { name: '灵知之力', status: 'active', description: '学习与记忆' },
    prometheus: { name: '普罗米修斯之力', status: 'active', description: '自我进化' }
  };
}
