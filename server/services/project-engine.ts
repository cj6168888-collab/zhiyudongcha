/**
 * Phase 2.1: 项目生命周期引擎 (Project Lifecycle Engine)
 * 
 * 功能：
 * 1. 智能项目拆解 - 从用户描述生成里程碑和任务
 * 2. 进度追踪 - 任务状态自动更新、延期预警
 * 3. 风险预警 - 基于模式识别主动提醒潜在问题
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('ProjectEngine');

import { getDatabase } from '../db';
import {
  projects,
  projectMilestones,
  projectTasks,
  projectRisks,
  projectLogs,
  InsertProject,
  InsertProjectMilestone,
  InsertProjectTask,
  InsertProjectRisk,
  InsertProjectLog,
  Project,
  ProjectMilestone,
  ProjectTask,
  ProjectRisk,
  ProjectLog,
} from '@shared/schema';
import { eq, and, desc, asc, sql, gte, lte } from 'drizzle-orm';

export interface ProjectDecomposition {
  title: string;
  description: string;
  category: string;
  milestones: MilestoneTemplate[];
  risks: RiskTemplate[];
  estimatedTotalDays: number;
}

export interface MilestoneTemplate {
  title: string;
  description: string;
  estimatedDays: number;
  deliverables: string[];
  tasks: TaskTemplate[];
}

export interface TaskTemplate {
  title: string;
  description: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  estimatedHours: number;
  tags: string[];
}

export interface RiskTemplate {
  title: string;
  description: string;
  category: string;
  probability: 'HIGH' | 'MEDIUM' | 'LOW';
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  mitigation: string;
}

export interface ProjectProgress {
  projectId: string;
  totalMilestones: number;
  completedMilestones: number;
  totalTasks: number;
  completedTasks: number;
  overallProgress: number;
  delayedTasks: ProjectTask[];
  upcomingDeadlines: ProjectTask[];
  activeRisks: ProjectRisk[];
}

export interface ProgressAlert {
  type: 'DELAY' | 'RISK' | 'DEADLINE' | 'MILESTONE_COMPLETE';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  entityId: string;
  entityType: string;
  suggestedAction?: string;
}

class ProjectEngineService {
  
  async decomposeProject(
    userDescription: string,
    category?: string
  ): Promise<ProjectDecomposition> {
    const decomposition = await this.generateAIDecomposition(userDescription, category);
    
    await this.logAction(null, 'AI_DECOMPOSE', 'PROJECT', null, {
      input: userDescription,
      output: decomposition,
    });
    
    return decomposition;
  }

  async createProjectFromDecomposition(
    decomposition: ProjectDecomposition,
    creatorId?: string
  ): Promise<Project> {
    const [project] = await getDatabase().insert(projects).values({
      title: decomposition.title,
      description: decomposition.description,
      category: decomposition.category,
      status: 'IN_PROGRESS',
    }).returning();

    let milestoneOrder = 0;
    for (const milestoneTemplate of decomposition.milestones) {
      const [milestone] = await getDatabase().insert(projectMilestones).values({
        projectId: project.id,
        title: milestoneTemplate.title,
        description: milestoneTemplate.description,
        orderIndex: milestoneOrder++,
        estimatedDays: milestoneTemplate.estimatedDays,
        deliverables: milestoneTemplate.deliverables,
        status: 'PENDING',
      }).returning();

      let taskOrder = 0;
      for (const taskTemplate of milestoneTemplate.tasks) {
        await getDatabase().insert(projectTasks).values({
          projectId: project.id,
          milestoneId: milestone.id,
          title: taskTemplate.title,
          description: taskTemplate.description,
          orderIndex: taskOrder++,
          priority: taskTemplate.priority,
          estimatedHours: taskTemplate.estimatedHours,
          tags: taskTemplate.tags,
          status: 'TODO',
          aiGenerated: 1,
          aiConfidence: 0.85,
        });
      }
    }

    for (const riskTemplate of decomposition.risks) {
      await getDatabase().insert(projectRisks).values({
        projectId: project.id,
        title: riskTemplate.title,
        description: riskTemplate.description,
        category: riskTemplate.category,
        probability: riskTemplate.probability,
        impact: riskTemplate.impact,
        mitigation: riskTemplate.mitigation,
        riskScore: this.calculateRiskScore(riskTemplate.probability, riskTemplate.impact),
        aiIdentified: 1,
        status: 'IDENTIFIED',
      });
    }

    await this.logAction(project.id, 'CREATE', 'PROJECT', project.id, {
      decomposition,
      creatorId,
    });

    return project;
  }

  async getProjectProgress(projectId: string): Promise<ProjectProgress> {
    const milestones = await getDatabase().select().from(projectMilestones)
      .where(eq(projectMilestones.projectId, projectId));
    
    const tasks = await getDatabase().select().from(projectTasks)
      .where(eq(projectTasks.projectId, projectId));
    
    const risks = await getDatabase().select().from(projectRisks)
      .where(and(
        eq(projectRisks.projectId, projectId),
        eq(projectRisks.status, 'IDENTIFIED')
      ));

    const completedMilestones = milestones.filter(m => m.status === 'COMPLETED').length;
    const completedTasks = tasks.filter(t => t.status === 'DONE').length;

    const now = new Date();
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const delayedTasks = tasks.filter(t => 
      t.dueDate && new Date(t.dueDate) < now && t.status !== 'DONE'
    );

    const upcomingDeadlines = tasks.filter(t =>
      t.dueDate && 
      new Date(t.dueDate) >= now && 
      new Date(t.dueDate) <= threeDaysLater &&
      t.status !== 'DONE'
    );

    const overallProgress = tasks.length > 0 
      ? Math.round((completedTasks / tasks.length) * 100) 
      : 0;

    return {
      projectId,
      totalMilestones: milestones.length,
      completedMilestones,
      totalTasks: tasks.length,
      completedTasks,
      overallProgress,
      delayedTasks,
      upcomingDeadlines,
      activeRisks: risks,
    };
  }

  async getProgressAlerts(projectId: string): Promise<ProgressAlert[]> {
    const alerts: ProgressAlert[] = [];
    const progress = await this.getProjectProgress(projectId);

    for (const task of progress.delayedTasks) {
      alerts.push({
        type: 'DELAY',
        severity: 'HIGH',
        title: `任务延期: ${task.title}`,
        description: `该任务原定于 ${task.dueDate?.toLocaleDateString()} 完成，但目前仍未完成`,
        entityId: task.id,
        entityType: 'TASK',
        suggestedAction: '建议立即跟进任务进度，或重新评估截止日期',
      });
    }

    for (const task of progress.upcomingDeadlines) {
      alerts.push({
        type: 'DEADLINE',
        severity: 'MEDIUM',
        title: `即将到期: ${task.title}`,
        description: `该任务将于 ${task.dueDate?.toLocaleDateString()} 到期`,
        entityId: task.id,
        entityType: 'TASK',
        suggestedAction: '请确保任务能按时完成',
      });
    }

    for (const risk of progress.activeRisks) {
      if (risk.riskScore && risk.riskScore >= 7) {
        alerts.push({
          type: 'RISK',
          severity: 'HIGH',
          title: `高风险警告: ${risk.title}`,
          description: risk.description || '请关注此风险项',
          entityId: risk.id,
          entityType: 'RISK',
          suggestedAction: risk.mitigation || '建议制定应对措施',
        });
      }
    }

    return alerts;
  }

  async updateTaskStatus(
    taskId: string,
    newStatus: string,
    actorId?: string
  ): Promise<ProjectTask | undefined> {
    const [existingTask] = await getDatabase().select().from(projectTasks)
      .where(eq(projectTasks.id, taskId));
    
    if (!existingTask) return undefined;

    const updates: Partial<ProjectTask> = {
      status: newStatus,
      updatedAt: new Date(),
    };

    if (newStatus === 'DONE') {
      updates.completedAt = new Date();
    }

    const [updated] = await getDatabase().update(projectTasks)
      .set(updates)
      .where(eq(projectTasks.id, taskId))
      .returning();

    await this.logAction(existingTask.projectId, 'UPDATE_STATUS', 'TASK', taskId, {
      previousStatus: existingTask.status,
      newStatus,
      actorId,
    });

    await this.checkMilestoneCompletion(existingTask.milestoneId);

    return updated;
  }

  async addRisk(
    projectId: string,
    risk: Omit<InsertProjectRisk, 'projectId'>
  ): Promise<ProjectRisk> {
    const riskScore = this.calculateRiskScore(
      risk.probability || 'MEDIUM',
      risk.impact || 'MEDIUM'
    );

    const [newRisk] = await getDatabase().insert(projectRisks).values({
      ...risk,
      projectId,
      riskScore,
      status: 'IDENTIFIED',
    }).returning();

    await this.logAction(projectId, 'ADD_RISK', 'RISK', newRisk.id, {
      risk: newRisk,
    });

    return newRisk;
  }

  async resolveRisk(
    riskId: string,
    resolutionNotes: string,
    actorId?: string
  ): Promise<ProjectRisk | undefined> {
    const [updated] = await getDatabase().update(projectRisks)
      .set({
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolutionNotes,
        updatedAt: new Date(),
      })
      .where(eq(projectRisks.id, riskId))
      .returning();

    if (updated) {
      await this.logAction(updated.projectId, 'RESOLVE_RISK', 'RISK', riskId, {
        resolutionNotes,
        actorId,
      });
    }

    return updated;
  }

  async getMilestones(projectId: string): Promise<ProjectMilestone[]> {
    return getDatabase().select().from(projectMilestones)
      .where(eq(projectMilestones.projectId, projectId))
      .orderBy(asc(projectMilestones.orderIndex));
  }

  async getTasks(projectId: string, milestoneId?: string): Promise<ProjectTask[]> {
    if (milestoneId) {
      return getDatabase().select().from(projectTasks)
        .where(and(
          eq(projectTasks.projectId, projectId),
          eq(projectTasks.milestoneId, milestoneId)
        ))
        .orderBy(asc(projectTasks.orderIndex));
    }
    
    return getDatabase().select().from(projectTasks)
      .where(eq(projectTasks.projectId, projectId))
      .orderBy(asc(projectTasks.orderIndex));
  }

  async getRisks(projectId: string): Promise<ProjectRisk[]> {
    return getDatabase().select().from(projectRisks)
      .where(eq(projectRisks.projectId, projectId))
      .orderBy(desc(projectRisks.riskScore));
  }

  async getProjectLogs(projectId: string, limit = 50): Promise<ProjectLog[]> {
    return getDatabase().select().from(projectLogs)
      .where(eq(projectLogs.projectId, projectId))
      .orderBy(desc(projectLogs.createdAt))
      .limit(limit);
  }

  private async checkMilestoneCompletion(milestoneId: string | null): Promise<void> {
    if (!milestoneId) return;

    const tasks = await getDatabase().select().from(projectTasks)
      .where(eq(projectTasks.milestoneId, milestoneId));

    const allCompleted = tasks.every(t => t.status === 'DONE');
    const completedCount = tasks.filter(t => t.status === 'DONE').length;
    const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

    await getDatabase().update(projectMilestones)
      .set({
        status: allCompleted ? 'COMPLETED' : 'IN_PROGRESS',
        progress,
        actualEndDate: allCompleted ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(projectMilestones.id, milestoneId));
  }

  private calculateRiskScore(probability: string, impact: string): number {
    const probScore: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    const impactScore: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    return (probScore[probability] || 2) * (impactScore[impact] || 2);
  }

  private async logAction(
    projectId: string | null,
    action: string,
    entityType: string,
    entityId: string | null,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    if (!projectId) return;
    
    await getDatabase().insert(projectLogs).values({
      projectId,
      action,
      entityType,
      entityId,
      actorType: 'SYSTEM',
      actorName: '小智',
      metadata,
    });
  }

  private async generateAIDecomposition(
    userDescription: string,
    category?: string
  ): Promise<ProjectDecomposition> {
    const categoryTemplates: Record<string, ProjectDecomposition> = {
      'SOFTWARE': {
        title: this.extractTitle(userDescription),
        description: userDescription,
        category: 'SOFTWARE',
        estimatedTotalDays: 30,
        milestones: [
          {
            title: '需求分析',
            description: '明确项目需求和技术方案',
            estimatedDays: 5,
            deliverables: ['需求文档', '技术方案', '原型设计'],
            tasks: [
              { title: '竞品调研', description: '分析竞争对手产品', priority: 'HIGH', estimatedHours: 8, tags: ['调研'] },
              { title: '功能清单梳理', description: '整理所需功能列表', priority: 'HIGH', estimatedHours: 4, tags: ['需求'] },
              { title: '技术选型', description: '确定技术栈', priority: 'MEDIUM', estimatedHours: 4, tags: ['技术'] },
              { title: '原型设计', description: '绘制产品原型', priority: 'MEDIUM', estimatedHours: 8, tags: ['设计'] },
            ],
          },
          {
            title: 'UI/UX设计',
            description: '完成界面和交互设计',
            estimatedDays: 7,
            deliverables: ['设计稿', '切图资源', '交互说明'],
            tasks: [
              { title: '视觉风格定义', description: '确定设计风格', priority: 'HIGH', estimatedHours: 6, tags: ['设计'] },
              { title: '页面设计', description: '完成所有页面设计', priority: 'HIGH', estimatedHours: 16, tags: ['设计'] },
              { title: '交互设计', description: '定义交互逻辑', priority: 'MEDIUM', estimatedHours: 8, tags: ['交互'] },
              { title: '设计评审', description: '评审设计稿', priority: 'LOW', estimatedHours: 2, tags: ['评审'] },
            ],
          },
          {
            title: '开发实现',
            description: '完成核心功能开发',
            estimatedDays: 12,
            deliverables: ['可运行代码', '接口文档', '单元测试'],
            tasks: [
              { title: '环境搭建', description: '配置开发环境', priority: 'HIGH', estimatedHours: 4, tags: ['开发'] },
              { title: '后端开发', description: '实现后端接口', priority: 'HIGH', estimatedHours: 24, tags: ['开发', '后端'] },
              { title: '前端开发', description: '实现前端界面', priority: 'HIGH', estimatedHours: 24, tags: ['开发', '前端'] },
              { title: '联调测试', description: '前后端联调', priority: 'MEDIUM', estimatedHours: 8, tags: ['测试'] },
            ],
          },
          {
            title: '测试上线',
            description: '完成测试和上线部署',
            estimatedDays: 6,
            deliverables: ['测试报告', '上线清单', '运维文档'],
            tasks: [
              { title: '功能测试', description: '全功能测试', priority: 'HIGH', estimatedHours: 12, tags: ['测试'] },
              { title: 'BUG修复', description: '修复发现的问题', priority: 'HIGH', estimatedHours: 8, tags: ['开发'] },
              { title: '部署准备', description: '准备生产环境', priority: 'MEDIUM', estimatedHours: 4, tags: ['运维'] },
              { title: '上线发布', description: '正式发布上线', priority: 'HIGH', estimatedHours: 2, tags: ['运维'] },
            ],
          },
        ],
        risks: [
          {
            title: '需求变更',
            description: '开发过程中需求可能发生变化',
            category: 'SCOPE',
            probability: 'HIGH',
            impact: 'MEDIUM',
            mitigation: '制定变更管理流程，评估变更影响后再执行',
          },
          {
            title: '技术难点',
            description: '可能遇到未预料的技术问题',
            category: 'TECHNICAL',
            probability: 'MEDIUM',
            impact: 'HIGH',
            mitigation: '预留技术攻关时间，提前进行技术验证',
          },
          {
            title: '进度延期',
            description: '实际开发时间超出预期',
            category: 'SCHEDULE',
            probability: 'MEDIUM',
            impact: 'MEDIUM',
            mitigation: '设置里程碑检查点，及时调整计划',
          },
        ],
      },
      'BUSINESS': {
        title: this.extractTitle(userDescription),
        description: userDescription,
        category: 'BUSINESS',
        estimatedTotalDays: 20,
        milestones: [
          {
            title: '市场调研',
            description: '了解市场情况和竞争环境',
            estimatedDays: 5,
            deliverables: ['调研报告', '竞品分析', 'SWOT分析'],
            tasks: [
              { title: '行业分析', description: '分析行业趋势', priority: 'HIGH', estimatedHours: 8, tags: ['调研'] },
              { title: '竞品调研', description: '分析竞争对手', priority: 'HIGH', estimatedHours: 8, tags: ['调研'] },
              { title: '客户访谈', description: '了解客户需求', priority: 'MEDIUM', estimatedHours: 6, tags: ['调研'] },
            ],
          },
          {
            title: '方案制定',
            description: '制定商业方案',
            estimatedDays: 7,
            deliverables: ['商业计划书', '财务预测', '执行计划'],
            tasks: [
              { title: '商业模式设计', description: '设计盈利模式', priority: 'HIGH', estimatedHours: 8, tags: ['策略'] },
              { title: '财务规划', description: '制定财务计划', priority: 'HIGH', estimatedHours: 6, tags: ['财务'] },
              { title: '风险评估', description: '评估潜在风险', priority: 'MEDIUM', estimatedHours: 4, tags: ['风险'] },
            ],
          },
          {
            title: '执行落地',
            description: '执行商业计划',
            estimatedDays: 8,
            deliverables: ['执行报告', '阶段成果', '复盘总结'],
            tasks: [
              { title: '资源整合', description: '整合所需资源', priority: 'HIGH', estimatedHours: 8, tags: ['执行'] },
              { title: '团队组建', description: '组建执行团队', priority: 'HIGH', estimatedHours: 6, tags: ['团队'] },
              { title: '启动执行', description: '开始执行计划', priority: 'HIGH', estimatedHours: 16, tags: ['执行'] },
            ],
          },
        ],
        risks: [
          {
            title: '市场风险',
            description: '市场环境可能发生变化',
            category: 'MARKET',
            probability: 'MEDIUM',
            impact: 'HIGH',
            mitigation: '持续关注市场动态，制定应急预案',
          },
          {
            title: '资金风险',
            description: '资金可能不足或周转困难',
            category: 'FINANCIAL',
            probability: 'MEDIUM',
            impact: 'HIGH',
            mitigation: '预留备用资金，多渠道融资准备',
          },
        ],
      },
    };

    const detectedCategory = category || this.detectCategory(userDescription);
    const template = categoryTemplates[detectedCategory] || categoryTemplates['BUSINESS'];
    
    return {
      ...template,
      title: this.extractTitle(userDescription),
      description: userDescription,
    };
  }

  private extractTitle(description: string): string {
    const keywords = ['做', '开发', '建设', '创建', '搭建', '实现'];
    for (const keyword of keywords) {
      const match = description.match(new RegExp(`${keyword}[一个]?(.{2,15})`));
      if (match) {
        return match[1].replace(/[，。！？]/g, '').trim();
      }
    }
    return description.slice(0, 20) + (description.length > 20 ? '...' : '');
  }

  private detectCategory(description: string): string {
    const softwareKeywords = ['app', '小程序', '网站', '系统', '软件', '开发', '代码', '程序'];
    const businessKeywords = ['商业', '生意', '投资', '合作', '市场', '销售', '客户'];
    
    const lowerDesc = description.toLowerCase();
    
    if (softwareKeywords.some(kw => lowerDesc.includes(kw))) {
      return 'SOFTWARE';
    }
    if (businessKeywords.some(kw => lowerDesc.includes(kw))) {
      return 'BUSINESS';
    }
    
    return 'BUSINESS';
  }
}

export const projectEngineService = new ProjectEngineService();
