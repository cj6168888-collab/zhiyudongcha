/**
 * 自动处理工作流服务 - AutoProcessWorkflow
 * 
 * 定义完整的自动处理工作流
 * 从文件检测 -> 智能分类 -> 内容处理 -> 结果通知
 */

import { createServiceLogger } from '../../lib/logger';
import { weChatFileService, type ProcessedDocument, type DocumentCategory } from './WeChatFileService';
import { lawyerLetterProcessor } from '../LawyerLetterProcessor';
import companionAppService from './CompanionAppService';
import type { CompanionPayload } from './CompanionAppService';

const logger = createServiceLogger('AutoProcessWorkflow');

export interface WorkflowConfig {
  enabled: boolean;
  autoProcessCategories: DocumentCategory[];
  notifyOnStart: boolean;
  notifyOnComplete: boolean;
  notifyOnHighRisk: boolean;
}

const DEFAULT_WORKFLOW_CONFIG: WorkflowConfig = {
  enabled: true,
  autoProcessCategories: ['LAWYER_LETTER', 'CONTRACT', 'INVOICE', 'ID_CARD', 'BUSINESS_LICENSE'],
  notifyOnStart: false,
  notifyOnComplete: true,
  notifyOnHighRisk: true,
};

export interface WorkflowResult {
  workflowId: string;
  document: ProcessedDocument;
  steps: WorkflowStep[];
  completedAt: number;
  duration: number;
}

export interface WorkflowStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: number;
  completedAt?: number;
  error?: string;
  result?: unknown;
}

type WorkflowEventType = 'START' | 'CATEGORY_DETECTED' | 'PROCESSING' | 'COMPLETE' | 'HIGH_RISK' | 'ERROR';

interface WorkflowEvent {
  type: WorkflowEventType;
  workflowId: string;
  document?: ProcessedDocument;
  step?: WorkflowStep;
  timestamp: number;
}

class AutoProcessWorkflow {
  private config: WorkflowConfig;
  private workflows: Map<string, WorkflowResult> = new Map();
  private eventListeners: Array<(event: WorkflowEvent) => void> = [];

  constructor(config: Partial<WorkflowConfig> = {}) {
    this.config = { ...DEFAULT_WORKFLOW_CONFIG, ...config };
    this.setupFileHandlers();
  }

  private setupFileHandlers(): void {
    weChatFileService.onProcessNotification((doc: ProcessedDocument) => {
      if (!this.config.enabled) return;
      if (!this.config.autoProcessCategories.includes(doc.category)) return;

      this.startWorkflow(doc);
    });
  }

  async startWorkflow(document: ProcessedDocument): Promise<WorkflowResult> {
    const workflowId = `wf_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const workflow: WorkflowResult = {
      workflowId,
      document,
      steps: [],
      completedAt: 0,
      duration: 0,
    };

    this.workflows.set(workflowId, workflow);

    logger.info({
      workflowId,
      category: document.category,
      fileName: document.metadata.fileName,
    }, 'Workflow started');

    this.emitEvent({
      type: 'START',
      workflowId,
      document,
      timestamp: Date.now(),
    });

    try {
      workflow.steps.push(await this.executeStep(workflowId, 'classification', async () => {
        return {
          category: document.category,
          confidence: document.confidence,
        };
      }));

      if (document.category === 'LAWYER_LETTER' && document.metadata.fileName) {
        workflow.steps.push(await this.executeStep(workflowId, 'lawyer_letter_processing', async () => {
          const result = await lawyerLetterProcessor.processFromFile({
            path: document.metadata.fileName,
            content: '',
            encoding: 'base64',
          });
          
          return result;
        }));
      }

      workflow.steps.push(await this.executeStep(workflowId, 'risk_assessment', async () => {
        if (document.category === 'LAWYER_LETTER') {
          const riskLevel = document.processingResult?.riskAssessment?.severity;
          return { riskLevel, needsAttention: riskLevel === 'HIGH' || riskLevel === 'CRITICAL' };
        }
        return { riskLevel: 'LOW', needsAttention: false };
      }));

      workflow.steps.push(await this.executeStep(workflowId, 'notification', async () => {
        const needsHighRiskNotify = 
          this.config.notifyOnHighRisk && 
          document.category === 'LAWYER_LETTER' &&
          document.processingResult?.riskAssessment?.severity !== 'LOW';

        if (needsHighRiskNotify) {
          this.emitEvent({
            type: 'HIGH_RISK',
            workflowId,
            document,
            timestamp: Date.now(),
          });
        }

        return { notified: true };
      }));

      workflow.completedAt = Date.now();
      workflow.duration = workflow.completedAt - (workflow.steps[0]?.startedAt || workflow.completedAt);

      logger.info({
        workflowId,
        category: document.category,
        duration: workflow.duration,
      }, 'Workflow completed');

      this.emitEvent({
        type: 'COMPLETE',
        workflowId,
        document,
        timestamp: Date.now(),
      });

    } catch (error) {
      logger.error({ workflowId, error }, 'Workflow failed');
      
      workflow.steps.push({
        name: 'error',
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });

      this.emitEvent({
        type: 'ERROR',
        workflowId,
        document,
        timestamp: Date.now(),
      });
    }

    return workflow;
  }

  private async executeStep(
    workflowId: string, 
    name: string, 
    executor: () => Promise<any>
  ): Promise<WorkflowStep> {
    const step: WorkflowStep = {
      name,
      status: 'running',
      startedAt: Date.now(),
    };

    const workflow = this.workflows.get(workflowId);
    if (workflow) {
      workflow.steps.push(step);
    }

    try {
      const result = await executor();
      
      step.status = 'completed';
      step.completedAt = Date.now();
      step.result = result;

      logger.info({ workflowId, step: name }, 'Workflow step completed');

      return step;
    } catch (error) {
      step.status = 'failed';
      step.completedAt = Date.now();
      step.error = error instanceof Error ? error.message : String(error);

      logger.error({ workflowId, step: name, error }, 'Workflow step failed');

      return step;
    }
  }

  onEvent(listener: (event: WorkflowEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      const index = this.eventListeners.indexOf(listener);
      if (index > -1) {
        this.eventListeners.splice(index, 1);
      }
    };
  }

  private emitEvent(event: WorkflowEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        logger.error({ error }, 'Failed to emit workflow event');
      }
    }
  }

  getWorkflow(workflowId: string): WorkflowResult | null {
    return this.workflows.get(workflowId) || null;
  }

  getRecentWorkflows(deviceId: string, limit: number = 10): WorkflowResult[] {
    const workflows: WorkflowResult[] = [];
    
    for (const wf of this.workflows.values()) {
      if (wf.document.metadata.wechatPath) {
        workflows.push(wf);
      }
    }

    return workflows
      .sort((a, b) => b.completedAt - a.completedAt)
      .slice(0, limit);
  }

  updateConfig(config: Partial<WorkflowConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info({ config: this.config }, 'Workflow config updated');
  }

  getConfig(): WorkflowConfig {
    return { ...this.config };
  }

  getStatistics(): {
    totalWorkflows: number;
    completedWorkflows: number;
    failedWorkflows: number;
    byCategory: Record<string, number>;
  } {
    let completed = 0;
    let failed = 0;
    const byCategory: Record<string, number> = {};

    for (const wf of this.workflows.values()) {
      const lastStep = wf.steps[wf.steps.length - 1];
      
      if (lastStep?.status === 'completed') {
        completed++;
      } else if (lastStep?.status === 'failed') {
        failed++;
      }

      const category = wf.document.category;
      byCategory[category] = (byCategory[category] || 0) + 1;
    }

    return {
      totalWorkflows: this.workflows.size,
      completedWorkflows: completed,
      failedWorkflows: failed,
      byCategory,
    };
  }
}

export const autoProcessWorkflow = new AutoProcessWorkflow();
export default autoProcessWorkflow;
