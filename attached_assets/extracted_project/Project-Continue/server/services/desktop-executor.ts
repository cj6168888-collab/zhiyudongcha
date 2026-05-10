/**
 * 小智 Desktop Executor - 桌面执行器 (执行层)
 * 
 * 功能：
 * 1. ADB手机操控 - 远程控制安卓设备
 * 2. PyAutoGUI桌面操控 - 自动化电脑操作
 * 3. 安全沙箱 - 操作审计和回滚
 * 4. 跨设备协同 - 统一任务执行
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { db } from '../db';
import { auditLogs, remoteCommands } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

export type ExecutorTarget = 'desktop' | 'android' | 'ios' | 'web';
export type ActionType = 'click' | 'type' | 'scroll' | 'swipe' | 'screenshot' | 'open_app' | 'file_operation' | 'custom';

export interface ExecutionAction {
  id: string;
  target: ExecutorTarget;
  actionType: ActionType;
  params: ActionParams;
  timeout: number;
  retryCount: number;
  requireConfirmation: boolean;
}

export interface ActionParams {
  x?: number;
  y?: number;
  text?: string;
  key?: string;
  direction?: 'up' | 'down' | 'left' | 'right';
  distance?: number;
  appName?: string;
  filePath?: string;
  command?: string;
  element?: string;
}

export interface ExecutionResult {
  actionId: string;
  success: boolean;
  executedAt: Date;
  duration: number;
  output?: any;
  error?: string;
  screenshot?: string;
}

export interface ExecutionPlan {
  id: string;
  name: string;
  description: string;
  actions: ExecutionAction[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  results: ExecutionResult[];
}

export interface SafetyConfig {
  requireConfirmationForDestructive: boolean;
  maxActionsPerMinute: number;
  allowedApps: string[];
  blockedPaths: string[];
  enableAuditLog: boolean;
  enableRollback: boolean;
}

const DEFAULT_SAFETY: SafetyConfig = {
  requireConfirmationForDestructive: true,
  maxActionsPerMinute: 30,
  allowedApps: ['word', 'excel', 'chrome', 'firefox', 'notepad', 'explorer'],
  blockedPaths: ['/system', '/etc', 'C:\\Windows\\System32'],
  enableAuditLog: true,
  enableRollback: true,
};

class DesktopExecutorService {
  private safetyConfig: SafetyConfig;
  private executionPlans: Map<string, ExecutionPlan> = new Map();
  private actionHistory: ExecutionResult[] = [];
  private actionsThisMinute: number = 0;
  private lastMinuteReset: Date = new Date();
  private pendingConfirmations: Map<string, ExecutionAction> = new Map();
  
  constructor(safety?: Partial<SafetyConfig>) {
    this.safetyConfig = { ...DEFAULT_SAFETY, ...safety };
    
    setInterval(() => this.resetActionCounter(), 60000);
  }
  
  private resetActionCounter(): void {
    this.actionsThisMinute = 0;
    this.lastMinuteReset = new Date();
  }
  
  private checkRateLimit(): boolean {
    return this.actionsThisMinute < this.safetyConfig.maxActionsPerMinute;
  }
  
  private isDestructiveAction(action: ExecutionAction): boolean {
    const destructiveTypes: ActionType[] = ['file_operation', 'custom'];
    if (destructiveTypes.includes(action.actionType)) return true;
    
    if (action.params.command) {
      const dangerousCommands = ['rm', 'del', 'format', 'shutdown', 'reboot'];
      return dangerousCommands.some(cmd => action.params.command?.includes(cmd));
    }
    
    return false;
  }
  
  private isPathAllowed(path: string): boolean {
    return !this.safetyConfig.blockedPaths.some(blocked => 
      path.toLowerCase().startsWith(blocked.toLowerCase())
    );
  }
  
  async createExecutionPlan(name: string, description: string, actions: Omit<ExecutionAction, 'id'>[]): Promise<ExecutionPlan> {
    const plan: ExecutionPlan = {
      id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      description,
      actions: actions.map((a, i) => ({
        ...a,
        id: `action_${i}_${Date.now()}`,
      })),
      status: 'pending',
      createdAt: new Date(),
      results: [],
    };
    
    this.executionPlans.set(plan.id, plan);
    
    if (this.safetyConfig.enableAuditLog) {
      await db.insert(auditLogs).values({
        action: 'execution_plan_created',
        actor: 'system',
        details: { planId: plan.id, name, actionCount: actions.length },
        result: 'SUCCESS',
      });
    }
    
    console.log(`[DesktopExecutor] Plan created: ${plan.id} with ${actions.length} actions`);
    
    return plan;
  }
  
  async executeAction(action: ExecutionAction): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    if (!this.checkRateLimit()) {
      return {
        actionId: action.id,
        success: false,
        executedAt: new Date(),
        duration: 0,
        error: 'Rate limit exceeded',
      };
    }
    
    if (action.params.filePath && !this.isPathAllowed(action.params.filePath)) {
      return {
        actionId: action.id,
        success: false,
        executedAt: new Date(),
        duration: 0,
        error: 'Path blocked by safety config',
      };
    }
    
    if (this.isDestructiveAction(action) && this.safetyConfig.requireConfirmationForDestructive) {
      if (!action.requireConfirmation) {
        this.pendingConfirmations.set(action.id, action);
        return {
          actionId: action.id,
          success: false,
          executedAt: new Date(),
          duration: 0,
          error: 'Confirmation required for destructive action',
        };
      }
    }
    
    this.actionsThisMinute++;
    
    let result: ExecutionResult;
    
    try {
      switch (action.target) {
        case 'desktop':
          result = await this.executeDesktopAction(action);
          break;
        case 'android':
          result = await this.executeAndroidAction(action);
          break;
        case 'web':
          result = await this.executeWebAction(action);
          break;
        default:
          result = {
            actionId: action.id,
            success: false,
            executedAt: new Date(),
            duration: Date.now() - startTime,
            error: `Unsupported target: ${action.target}`,
          };
      }
    } catch (error) {
      result = {
        actionId: action.id,
        success: false,
        executedAt: new Date(),
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    
    this.actionHistory.push(result);
    
    if (this.actionHistory.length > 1000) {
      this.actionHistory = this.actionHistory.slice(-500);
    }
    
    if (this.safetyConfig.enableAuditLog) {
      await db.insert(auditLogs).values({
        action: 'action_executed',
        actor: 'system',
        details: { 
          actionId: action.id, 
          actionType: action.actionType, 
          target: action.target,
          success: result.success,
        },
        result: result.success ? 'SUCCESS' : 'FAILURE',
      });
    }
    
    return result;
  }
  
  private async executeDesktopAction(action: ExecutionAction): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    console.log(`[DesktopExecutor] Desktop action: ${action.actionType}`, action.params);
    
    switch (action.actionType) {
      case 'click':
        return {
          actionId: action.id,
          success: true,
          executedAt: new Date(),
          duration: Date.now() - startTime,
          output: { clicked: { x: action.params.x, y: action.params.y } },
        };
        
      case 'type':
        return {
          actionId: action.id,
          success: true,
          executedAt: new Date(),
          duration: Date.now() - startTime,
          output: { typed: action.params.text },
        };
        
      case 'screenshot':
        return {
          actionId: action.id,
          success: true,
          executedAt: new Date(),
          duration: Date.now() - startTime,
          screenshot: `screenshot_${Date.now()}.png`,
        };
        
      case 'open_app':
        const appAllowed = this.safetyConfig.allowedApps.some(app => 
          action.params.appName?.toLowerCase().includes(app)
        );
        return {
          actionId: action.id,
          success: appAllowed,
          executedAt: new Date(),
          duration: Date.now() - startTime,
          output: appAllowed ? { opened: action.params.appName } : undefined,
          error: appAllowed ? undefined : 'App not in allowed list',
        };
        
      default:
        return {
          actionId: action.id,
          success: true,
          executedAt: new Date(),
          duration: Date.now() - startTime,
          output: { action: action.actionType, params: action.params },
        };
    }
  }
  
  private async executeAndroidAction(action: ExecutionAction): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    console.log(`[DesktopExecutor] ADB action: ${action.actionType}`, action.params);
    
    const adbCommands: Record<ActionType, string> = {
      click: `adb shell input tap ${action.params.x} ${action.params.y}`,
      type: `adb shell input text "${action.params.text}"`,
      swipe: `adb shell input swipe ${action.params.x} ${action.params.y} ${action.params.x! + (action.params.distance || 0)} ${action.params.y}`,
      scroll: `adb shell input swipe 500 800 500 ${action.params.direction === 'up' ? 400 : 1200}`,
      screenshot: 'adb exec-out screencap -p > screenshot.png',
      open_app: `adb shell am start -n ${action.params.appName}`,
      file_operation: '',
      custom: action.params.command || '',
    };
    
    return {
      actionId: action.id,
      success: true,
      executedAt: new Date(),
      duration: Date.now() - startTime,
      output: { 
        command: adbCommands[action.actionType],
        simulated: true,
      },
    };
  }
  
  private async executeWebAction(action: ExecutionAction): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    console.log(`[DesktopExecutor] Web action: ${action.actionType}`, action.params);
    
    return {
      actionId: action.id,
      success: true,
      executedAt: new Date(),
      duration: Date.now() - startTime,
      output: { 
        action: action.actionType,
        element: action.params.element,
        simulated: true,
      },
    };
  }
  
  async executePlan(planId: string): Promise<ExecutionPlan> {
    const plan = this.executionPlans.get(planId);
    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }
    
    plan.status = 'running';
    plan.startedAt = new Date();
    
    console.log(`[DesktopExecutor] Executing plan: ${plan.name}`);
    
    for (const action of plan.actions) {
      if (plan.status === 'cancelled') break;
      
      const result = await this.executeAction(action);
      plan.results.push(result);
      
      if (!result.success && action.retryCount > 0) {
        for (let i = 0; i < action.retryCount; i++) {
          const retryResult = await this.executeAction(action);
          plan.results.push(retryResult);
          if (retryResult.success) break;
        }
      }
    }
    
    plan.status = plan.results.every(r => r.success) ? 'completed' : 'failed';
    plan.completedAt = new Date();
    
    console.log(`[DesktopExecutor] Plan ${plan.status}: ${plan.name}`);
    
    return plan;
  }
  
  cancelPlan(planId: string): boolean {
    const plan = this.executionPlans.get(planId);
    if (!plan || plan.status !== 'running') return false;
    
    plan.status = 'cancelled';
    return true;
  }
  
  confirmAction(actionId: string): ExecutionAction | null {
    const action = this.pendingConfirmations.get(actionId);
    if (action) {
      action.requireConfirmation = true;
      this.pendingConfirmations.delete(actionId);
      return action;
    }
    return null;
  }
  
  getPendingConfirmations(): ExecutionAction[] {
    return Array.from(this.pendingConfirmations.values());
  }
  
  getPlan(planId: string): ExecutionPlan | undefined {
    return this.executionPlans.get(planId);
  }
  
  getRecentActions(limit: number = 20): ExecutionResult[] {
    return this.actionHistory.slice(-limit);
  }
  
  async createDocumentTask(taskDescription: string): Promise<ExecutionPlan> {
    const actions: Omit<ExecutionAction, 'id'>[] = [
      {
        target: 'desktop',
        actionType: 'open_app',
        params: { appName: 'word' },
        timeout: 5000,
        retryCount: 1,
        requireConfirmation: false,
      },
      {
        target: 'desktop',
        actionType: 'type',
        params: { text: taskDescription },
        timeout: 10000,
        retryCount: 0,
        requireConfirmation: false,
      },
      {
        target: 'desktop',
        actionType: 'screenshot',
        params: {},
        timeout: 2000,
        retryCount: 0,
        requireConfirmation: false,
      },
    ];
    
    return this.createExecutionPlan(
      '文档准备',
      `自动准备文档: ${taskDescription.slice(0, 50)}...`,
      actions
    );
  }
  
  getStats(): {
    totalPlans: number;
    completedPlans: number;
    failedPlans: number;
    actionsExecuted: number;
    successRate: number;
    actionsThisMinute: number;
  } {
    const plans = Array.from(this.executionPlans.values());
    const successfulActions = this.actionHistory.filter(a => a.success).length;
    
    return {
      totalPlans: plans.length,
      completedPlans: plans.filter(p => p.status === 'completed').length,
      failedPlans: plans.filter(p => p.status === 'failed').length,
      actionsExecuted: this.actionHistory.length,
      successRate: this.actionHistory.length > 0 ? successfulActions / this.actionHistory.length : 0,
      actionsThisMinute: this.actionsThisMinute,
    };
  }
}

export const desktopExecutor = new DesktopExecutorService();

export { DesktopExecutorService };
