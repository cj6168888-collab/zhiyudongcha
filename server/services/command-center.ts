/**
 * Navigator-X 审批与分派中枢 (Command Center)
 *
 * 核心功能：
 * 1. 汇报汇总流 - 接收节点端提交的汇报，以极简卡片形式呈现
 * 2. 一键审批 - 准予立项 / 打回修正 / 即刻执行
 * 3. 灵感拆解 - 将老板的语音灵感自动拆解为细分任务
 * 4. 任务分派 - 精准投送任务至相关节点端
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('CommandCenter');

import { EventEmitter } from 'events';
import { navigatorCore } from './navigator-core';
import { semanticBloodlineEngine } from './semantic-bloodline';

// ============ 类型定义 ============

export type ReportStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED';
export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface ReportCard {
  id: string;
  nodeId: string;           // 来源节点
  nodeName: string;        // 节点名称
  summary: string;         // AI压缩后的摘要
  rawContent: string;       // 原始内容
  attachments: string[];    // 附件
  authenticityScore: number; // 真实性评分 (0-100)
  submittedAt: number;
  status: ReportStatus;
  processedAt?: number;
  feedback?: string;        // 打回时的反馈
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assigneeNodeId: string;
  assigneeNodeName: string;
  priority: TaskPriority;
  deadline?: number;
  checkpoints: Checkpoint[];
  parentReportId?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  createdAt: number;
  updatedAt: number;
}

export interface Checkpoint {
  id: string;
  description: string;
  completed: boolean;
  completedAt?: number;
}

export interface Inspiration {
  id: string;
  rawText: string;
  source: 'VOICE' | 'TEXT';
  capturedAt: number;
}

export interface EnrichedInspiration extends Inspiration {
  enrichedText: string;
  context: string[];
  kpis: KPI[];
  tasks: Partial<Task>[];
  broadcastedAt?: number;
}

export interface KPI {
  id: string;
  metric: string;
  target: string;
  deadline?: number;
}

export interface RedAlert {
  id: string;
  nodeId: string;
  type: 'SUPPLY_BREAK' | 'PERSON_ABSENT' | 'PROGRESS_DELAY' | 'QUALITY_DROP';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  evidence: string[];
  detectedAt: number;
  acknowledged: boolean;
  acknowledgedAt?: number;
}

// ============ 日志函数 ============

function log(message: string) {
  const time = new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  logger.info(`${time} [CommandCenter] ${message}`);
}

// ============ 命令中枢服务类 ============

class CommandCenterService extends EventEmitter {
  private reports: Map<string, ReportCard> = new Map();
  private tasks: Map<string, Task> = new Map();
  private redAlerts: Map<string, RedAlert> = new Map();
  private inspirationHistory: EnrichedInspiration[] = [];

  constructor() {
    super();
    log('审批与分派中枢已初始化 (Navigator-X Command Center)');
  }

  // ============ 汇报管理 ============

  /**
   * 提交汇报（节点端调用）
   */
  async submitReport(config: {
    nodeId: string;
    nodeName: string;
    content: string;
    attachments?: string[];
  }): Promise<ReportCard> {
    const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // AI压缩摘要
    const summary = await this.generateSummary(config.content);

    // 真实性审计
    const authenticityScore = await this.performAuthenticityAudit(config.content);

    const report: ReportCard = {
      id: reportId,
      nodeId: config.nodeId,
      nodeName: config.nodeName,
      summary,
      rawContent: config.content,
      attachments: config.attachments || [],
      authenticityScore,
      submittedAt: Date.now(),
      status: 'PENDING',
    };

    this.reports.set(reportId, report);

    this.emit('report_submitted', report);
    log(`收到节点 ${config.nodeName} 提交的汇报: ${reportId}`);

    return report;
  }

  /**
   * 获取待审批汇报列表
   */
  getPendingReports(): ReportCard[] {
    return Array.from(this.reports.values())
      .filter(r => r.status === 'PENDING')
      .sort((a, b) => b.submittedAt - a.submittedAt);
  }

  /**
   * 获取所有汇报
   */
  getAllReports(): ReportCard[] {
    return Array.from(this.reports.values())
      .sort((a, b) => b.submittedAt - a.submittedAt);
  }

  /**
   * 准予立项
   */
  async approveReport(reportId: string): Promise<void> {
    const report = this.reports.get(reportId);
    if (!report) throw new Error(`汇报不存在: ${reportId}`);

    report.status = 'APPROVED';
    report.processedAt = Date.now();

    this.emit('report_approved', report);
    log(`汇报已准予立项: ${reportId}`);

    // 触发灵感拆解（如果有的话）
    if (report.rawContent.includes('灵感') || report.rawContent.includes('想法')) {
      await this.parseInspiration(report.rawContent);
    }
  }

  /**
   * 打回修正
   */
  async rejectReport(reportId: string, reason: string): Promise<void> {
    const report = this.reports.get(reportId);
    if (!report) throw new Error(`汇报不存在: ${reportId}`);

    report.status = 'REJECTED';
    report.processedAt = Date.now();
    report.feedback = reason;

    this.emit('report_rejected', { report, reason });
    log(`汇报已打回: ${reportId}, 原因: ${reason}`);
  }

  /**
   * 即刻执行
   */
  async executeReport(reportId: string): Promise<Task[]> {
    const report = this.reports.get(reportId);
    if (!report) throw new Error(`汇报不存在: ${reportId}`);

    report.status = 'EXECUTED';
    report.processedAt = Date.now();

    // 将汇报内容拆解为任务
    const tasks = await this.parseInspiration(report.rawContent);

    // 立即分派任务
    for (const task of tasks) {
      await this.dispatchTask(task);
    }

    this.emit('report_executed', { report, tasks });
    log(`汇报已即刻执行，生成 ${tasks.length} 个任务: ${reportId}`);

    return tasks;
  }

  // ============ 灵感处理 ============

  /**
   * 捕捉灵感
   */
  async captureInspiration(text: string, source: 'VOICE' | 'TEXT' = 'TEXT'): Promise<Inspiration> {
    const inspiration: Inspiration = {
      id: `insp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      rawText: text,
      source,
      capturedAt: Date.now(),
    };

    log(`捕捉到灵感: ${inspiration.id}`);
    return inspiration;
  }

  /**
   * 语义血缘补全 + 拆解任务
   */
  async enrichWithBloodline(inspiration: Inspiration): Promise<EnrichedInspiration> {
    // 使用语义血缘引擎补全
    const enrichedText = await semanticBloodlineEngine.enrichIntent(inspiration.rawText);

    // 生成KPI
    const kpis = await semanticBloodlineEngine.generateKPIs({
      enrichedText,
      rawText: inspiration.rawText,
      capturedAt: inspiration.capturedAt,
    });

    // 拆解任务
    const tasks = await this.parseInspiration(inspiration.rawText);

    const enriched: EnrichedInspiration = {
      ...inspiration,
      enrichedText,
      context: enrichedText.context || [],
      kpis,
      tasks,
    };

    this.inspirationHistory.push(enriched);
    log(`灵感已语义血缘补全，生成 ${tasks.length} 个任务`);

    return enriched;
  }

  /**
   * 灵感拆解为任务
   */
  async parseInspiration(rawText: string): Promise<Task[]> {
    const taskCount = Math.min(Math.max(Math.floor(rawText.length / 30), 3), 10);

    const tasks: Task[] = [];
    const nodes = navigatorCore.listNodes({ type: 'NODE', status: 'ACTIVE' });

    for (let i = 0; i < taskCount; i++) {
      const node = nodes[i % nodes.length];
      const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

      const task: Task = {
        id: taskId,
        title: `子任务 ${i + 1}`,
        description: `根据灵感"${rawText.slice(0, 50)}..."执行的具体任务`,
        assigneeNodeId: node?.id || '',
        assigneeNodeName: node?.name || '未分配',
        priority: i < 2 ? 'HIGH' : 'NORMAL',
        checkpoints: [
          { id: `cp_${taskId}_1`, description: '初步分析', completed: false },
          { id: `cp_${taskId}_2`, description: '方案制定', completed: false },
          { id: `cp_${taskId}_3`, description: '执行落地', completed: false },
        ],
        status: 'PENDING',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      tasks.push(task);
      this.tasks.set(taskId, task);
    }

    log(`灵感拆解完成，生成 ${tasks.length} 个任务`);
    return tasks;
  }

  /**
   * 分派任务至节点
   */
  async dispatchTask(task: Partial<Task>): Promise<Task> {
    const taskId = task.id || `task_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const fullTask: Task = {
      id: taskId,
      title: task.title || '未命名任务',
      description: task.description || '',
      assigneeNodeId: task.assigneeNodeId || '',
      assigneeNodeName: task.assigneeNodeName || '未分配',
      priority: task.priority || 'NORMAL',
      deadline: task.deadline,
      checkpoints: task.checkpoints || [],
      status: 'PENDING',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.tasks.set(taskId, fullTask);

    this.emit('task_dispatched', fullTask);
    log(`任务已分派: ${fullTask.title} -> ${fullTask.assigneeNodeName}`);

    return fullTask;
  }

  // ============ 红线预警 ============

  /**
   * 发送红线预警
   */
  async sendRedAlert(alert: Omit<RedAlert, 'id' | 'detectedAt' | 'acknowledged'>): Promise<RedAlert> {
    const redAlert: RedAlert = {
      ...alert,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      detectedAt: Date.now(),
      acknowledged: false,
    };

    this.redAlerts.set(redAlert.id, redAlert);

    this.emit('red_alert', redAlert);
    log(`🚨 红线预警: ${redAlert.title} [${redAlert.severity}]`);

    return redAlert;
  }

  /**
   * 获取未确认的预警
   */
  getUnacknowledgedAlerts(): RedAlert[] {
    return Array.from(this.redAlerts.values())
      .filter(a => !a.acknowledged)
      .sort((a, b) => {
        const severityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });
  }

  /**
   * 确认预警
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.redAlerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = Date.now();
      this.emit('alert_acknowledged', alert);
      log(`预警已确认: ${alertId}`);
    }
  }

  // ============ 任务管理 ============

  /**
   * 获取任务列表
   */
  getTasks(filter?: { status?: Task['status']; assigneeNodeId?: string }): Task[] {
    let tasks = Array.from(this.tasks.values());

    if (filter?.status) {
      tasks = tasks.filter(t => t.status === filter.status);
    }
    if (filter?.assigneeNodeId) {
      tasks = tasks.filter(t => t.assigneeNodeId === filter.assigneeNodeId);
    }

    return tasks.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * 更新任务状态
   */
  updateTaskStatus(taskId: string, status: Task['status']): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = status;
      task.updatedAt = Date.now();
      this.emit('task_updated', task);
    }
  }

  /**
   * 完成检查点
   */
  completeCheckpoint(taskId: string, checkpointId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      const checkpoint = task.checkpoints.find(c => c.id === checkpointId);
      if (checkpoint) {
        checkpoint.completed = true;
        checkpoint.completedAt = Date.now();
        task.updatedAt = Date.now();

        // 检查是否所有检查点都已完成
        if (task.checkpoints.every(c => c.completed)) {
          task.status = 'COMPLETED';
        }

        this.emit('checkpoint_completed', { task, checkpoint });
      }
    }
  }

  // ============ 辅助方法 ============

  private async generateSummary(content: string): Promise<string> {
    // 简单实现：取前100字作为摘要
    if (content.length <= 100) return content;
    return content.slice(0, 100) + '...';
  }

  private async performAuthenticityAudit(content: string): Promise<number> {
    // 简单实现：基于内容长度和复杂度评分
    const baseScore = 70;
    const lengthBonus = Math.min(content.length / 10, 20);
    const hasNumbers = /\d/.test(content) ? 5 : 0;
    const hasDetails = content.includes('具体') || content.includes('详情') ? 5 : 0;

    return Math.min(100, baseScore + lengthBonus + hasNumbers + hasDetails);
  }

  // ============ 统计 ============

  getStats(): {
    pendingReports: number;
    totalReports: number;
    activeTasks: number;
    completedTasks: number;
    unacknowledgedAlerts: number;
  } {
    const reports = Array.from(this.reports.values());
    const tasks = Array.from(this.tasks.values());
    const alerts = Array.from(this.redAlerts.values());

    return {
      pendingReports: reports.filter(r => r.status === 'PENDING').length,
      totalReports: reports.length,
      activeTasks: tasks.filter(t => t.status === 'IN_PROGRESS').length,
      completedTasks: tasks.filter(t => t.status === 'COMPLETED').length,
      unacknowledgedAlerts: alerts.filter(a => !a.acknowledged).length,
    };
  }
}

// 导出单例
export const commandCenter = new CommandCenterService();
logger.info('[CommandCenter] 审批与分派中枢已加载 (Navigator-X)');
