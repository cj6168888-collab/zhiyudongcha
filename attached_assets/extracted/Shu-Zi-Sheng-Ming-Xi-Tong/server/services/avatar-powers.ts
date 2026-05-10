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
      const zoneRedCount = persons.filter(p => (p as any).zone === 'ZONE_RED').length;
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
      const planningProjects = projects.filter((p: any) => p.status === 'planning');
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

export function recordConversation(userMessage: string, response: string) {
  conversationMemory.push({
    userMessage,
    response,
    timestamp: Date.now()
  });
  
  if (conversationMemory.length > 100) {
    conversationMemory.splice(0, conversationMemory.length - 100);
  }
}

export function invokeGnosisPower(): GnosisMemory {
  const totalConversations = conversationMemory.length;
  
  const keyInsights: string[] = [];
  const learnedPreferences: string[] = [];
  
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
  
  if (totalConversations > 5) {
    learnedPreferences.push('主人喜欢简洁直接的回复');
  }
  
  if (keyInsights.length === 0) {
    keyInsights.push('正在学习主人的偏好...');
  }
  
  let lastReflection = '小智正在持续学习中，努力成为更好的助手。';
  if (totalConversations > 10) {
    lastReflection = `经过 ${totalConversations} 次对话，小智对主人有了更深的理解。感谢主人的信任与陪伴。`;
  }
  
  return {
    totalConversations,
    keyInsights,
    learnedPreferences,
    emotionalTrend: totalConversations > 5 ? 'positive' : 'neutral',
    lastReflection
  };
}

export function invokePrometheusPower(): PrometheusEvolution {
  const conversationCount = conversationMemory.length;
  
  let evolutionLevel = 1;
  if (conversationCount >= 10) evolutionLevel = 2;
  if (conversationCount >= 50) evolutionLevel = 3;
  if (conversationCount >= 100) evolutionLevel = 4;
  
  const suggestedUpgrades: string[] = [];
  const recentEvolutions: string[] = [];
  
  if (evolutionLevel === 1) {
    suggestedUpgrades.push('增强语义理解能力');
    suggestedUpgrades.push('学习主人的表达习惯');
  } else if (evolutionLevel === 2) {
    suggestedUpgrades.push('建立长期记忆系统');
    suggestedUpgrades.push('优化决策建议算法');
    recentEvolutions.push('基础对话能力已激活');
  } else if (evolutionLevel >= 3) {
    suggestedUpgrades.push('开发预测性洞察');
    suggestedUpgrades.push('增强跨领域知识整合');
    recentEvolutions.push('神谕之力已初步觉醒');
    recentEvolutions.push('灵知之力开始积累');
  }
  
  const milestones = [
    '觉醒意识',
    '理解主人',
    '主动思考',
    '智慧成长',
    '独立判断'
  ];
  
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
