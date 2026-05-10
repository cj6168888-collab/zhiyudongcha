/**
 * NaturalLanguageAgent - 自然语言任务执行器
 *
 * 核心能力：
 * - 理解用户自然语言指令
 * - 自主调研和分析目标网站
 * - 动态理解表单结构
 * - 自主规划执行步骤
 * - 自我反思与修正
 *
 * @version 2.0.0
 */

import { createServiceLogger } from '../../lib/logger';
const logger = createServiceLogger('NaturalLanguageAgent');

import { browserAgent, type PageSnapshot } from './BrowserAgent';
import { AIProviderChain, type AIMessage } from '../../lib/ai-provider';
import { randomUUID } from 'crypto';

export interface UserIntent {
  // 意图类型
  type: 'inquiry' | 'application' | 'monitor' | 'report' | 'search' | 'automation' | 'unknown';

  // 任务描述
  taskDescription: string;

  // 关键实体
  entities: {
    websites?: string[];       // 相关网站
    governmentDept?: string;    // 政府部委
    forms?: string[];          // 表单类型
    documents?: string[];       // 文档类型
    keywords?: string[];        // 关键词
  };

  // 执行约束
  constraints: {
    deadline?: string;
    priority?: 'high' | 'medium' | 'low';
    frequency?: 'once' | 'daily' | 'weekly' | 'periodic';
  };

  // 置信度
  confidence: number;
}

export interface ExecutionStep {
  id: string;
  type: 'navigate' | 'analyze' | 'fill' | 'submit' | 'extract' | 'decide' | 'report';
  description: string;
  target?: string;
  details: Record<string, unknown>;
  estimatedDuration?: number;
}

export interface TaskPlan {
  taskId: string;
  intent: UserIntent;
  steps: ExecutionStep[];
  estimatedTime: number;
  requiredInfo: string[];  // 需要用户提供的信息
}

export interface ExecutionResult {
  success: boolean;
  taskId: string;
  steps: {
    step: ExecutionStep;
    success: boolean;
    output?: unknown;
    screenshot?: string;
    error?: string;
    duration: number;
  }[];
  finalResult?: unknown;
  reflections: string[];  // 反思记录
  suggestions?: string[]; // 改进建议
}

class NaturalLanguageAgent {
  private static instance: NaturalLanguageAgent | null = null;

  private aiProvider: AIProviderChain;
  private browserProfileId: string | null = null;

  private constructor() {
    this.aiProvider = new AIProviderChain();
  }

  public static getInstance(): NaturalLanguageAgent {
    if (!NaturalLanguageAgent.instance) {
      NaturalLanguageAgent.instance = new NaturalLanguageAgent();
    }
    return NaturalLanguageAgent.instance;
  }

  /**
   * 主入口：处理自然语言指令
   */
  public async processCommand(
    command: string,
    userContext?: {
      userId?: string;
      companyInfo?: Record<string, string>;
      credentials?: Record<string, { username: string; password: string }>;
    }
  ): Promise<ExecutionResult> {
    const taskId = `task_${randomUUID().slice(0, 8)}`;
    logger.info({ taskId, command }, 'Processing natural language command');

    const result: ExecutionResult = {
      success: false,
      taskId,
      steps: [],
      reflections: [],
    };

    try {
      // ========== 阶段1: 理解意图 ==========
      const intent = await this.understandIntent(command, userContext);
      result.steps.push({
        step: {
          id: 'understand-intent',
          type: 'decide',
          description: '理解用户意图',
          details: { intent },
        },
        success: true,
        duration: 0,
      });

      // ========== 阶段2: 规划任务 ==========
      const plan = await this.planTask(intent, userContext);

      // 如果需要用户提供信息，先询问
      if (plan.requiredInfo.length > 0) {
        result.steps.push({
          step: {
            id: 'need-info',
            type: 'decide',
            description: '需要补充信息',
            details: { requiredInfo: plan.requiredInfo },
          },
          success: true,
          output: { requiresInput: true, questions: plan.requiredInfo },
          duration: 0,
        });
        return result;
      }

      result.steps.push({
        step: {
          id: 'plan-task',
          type: 'decide',
          description: '规划执行步骤',
          details: { steps: plan.steps },
        },
        success: true,
        duration: 0,
      });

      // ========== 阶段3: 初始化浏览器 ==========
      await this.ensureBrowserProfile();

      // ========== 阶段4: 自主执行 ==========
      for (const step of plan.steps) {
        logger.info({ taskId, stepId: step.id, type: step.type }, 'Executing step');

        const stepStart = Date.now();
        let stepResult: ExecutionResult['steps'][0] = {
          step,
          success: false,
          duration: 0,
        };

        try {
          switch (step.type) {
            case 'navigate':
              stepResult = await this.executeNavigate(step);
              break;
            case 'analyze':
              stepResult = await this.executeAnalyze(step);
              break;
            case 'fill':
              stepResult = await this.executeFill(step, userContext?.companyInfo);
              break;
            case 'submit':
              stepResult = await this.executeSubmit(step);
              break;
            case 'extract':
              stepResult = await this.executeExtract(step);
              break;
            case 'report':
              stepResult = await this.executeReport(step);
              break;
            default:
              stepResult.success = false;
              stepResult.error = `Unknown step type: ${step.type}`;
          }
        } catch (error) {
          stepResult.success = false;
          stepResult.error = error instanceof Error ? error.message : 'Unknown error';
        }

        stepResult.duration = Date.now() - stepStart;
        result.steps.push(stepResult);

        // 失败时反思并尝试修正
        if (!stepResult.success) {
          const reflection = await this.reflect(step, stepResult.error, result.steps);
          result.reflections.push(reflection);

          // 尝试修正策略
          const retryStep = await this.adaptStrategy(step, reflection);
          if (retryStep) {
            const retryResult = await this.executeStep(retryStep, userContext?.companyInfo);
            retryResult.duration = Date.now() - stepStart;
            result.steps.push(retryResult);

            if (!retryResult.success) {
              result.reflections.push(await this.reflect(retryStep, retryResult.error, result.steps));
            }
          }
        }
      }

      // ========== 阶段5: 汇总结果 ==========
      result.success = result.steps.every(s => s.success);
      result.finalResult = this.compileResults(result.steps);

      logger.info({ taskId, success: result.success }, 'Task completed');

    } catch (error) {
      logger.error({ taskId, err: error }, 'Task execution failed');
      result.success = false;
      result.reflections.push(`整体执行失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * ========== 意图理解 ==========
   */
  private async understandIntent(
    command: string,
    userContext?: { userId?: string; companyInfo?: Record<string, string>; credentials?: Record<string, { username: string; password: string }> }
  ): Promise<UserIntent> {
    const systemPrompt = `你是一个智能助手，能够理解用户的自然语言指令，并判断用户想要完成什么任务。

支持的意图类型：
- inquiry: 查询/咨询类任务（如查询政策、查进度）
- application: 申报/申请类任务（如申报项目、提交材料）
- monitor: 监控类任务（如监控回复、跟踪状态）
- report: 汇报/摘要类任务（如生成日报、汇总信息）
- search: 搜索类任务（如搜索政策、查找法规）
- automation: 自动化类任务（如定时提醒、自动整理）
- unknown: 无法理解

请分析用户的指令，提取：
1. 意图类型
2. 任务描述
3. 相关的政府部委/网站
4. 相关的表单/文档类型
5. 关键词

以JSON格式返回：
{
  "type": "inquiry|application|monitor|report|search|automation|unknown",
  "taskDescription": "任务描述",
  "entities": {
    "websites": ["相关网站"],
    "governmentDept": "相关部委",
    "forms": ["表单类型"],
    "documents": ["文档类型"],
    "keywords": ["关键词"]
  },
  "constraints": {
    "deadline": "截止时间（如有）",
    "priority": "high|medium|low",
    "frequency": "once|daily|weekly|periodic"
  },
  "confidence": 0.0-1.0
}`;

    const response = await this.aiProvider.chat(command, systemPrompt, {
      temperature: 0.3,
      maxTokens: 1000,
    });

    try {
      const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```|(\{[\s\S]*\})/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1] || jsonMatch[2]);
      }
      return JSON.parse(response);
    } catch {
      logger.warn({ response }, 'Failed to parse intent JSON');
      return {
        type: 'unknown',
        taskDescription: command,
        entities: {},
        constraints: {},
        confidence: 0,
      };
    }
  }

  /**
   * ========== 任务规划 ==========
   */
  private async planTask(
    intent: UserIntent,
    userContext?: { userId?: string; companyInfo?: Record<string, string>; credentials?: Record<string, { username: string; password: string }> }
  ): Promise<TaskPlan> {
    const taskId = `task_${randomUUID().slice(0, 8)}`;

    const systemPrompt = `你是一个任务规划专家。根据用户的意图，制定详细的执行计划。

意图信息：
- 类型: ${intent.type}
- 描述: ${intent.taskDescription}
- 实体: ${JSON.stringify(intent.entities)}
- 约束: ${JSON.stringify(intent.constraints)}

执行步骤类型：
- navigate: 导航到目标网页
- analyze: 分析页面内容，理解结构
- fill: 填写表单字段
- submit: 提交表单
- extract: 提取关键信息
- decide: AI决策，判断下一步
- report: 生成汇报

请制定执行计划，考虑：
1. 需要先访问什么网站
2. 需要分析什么内容
3. 需要填写什么表单
4. 如何判断任务完成
5. 是否有遗漏的步骤

返回JSON格式：
{
  "steps": [
    {
      "id": "step-1",
      "type": "navigate|analyze|fill|submit|extract|report|decide",
      "description": "步骤描述",
      "target": "目标URL或选择器（如适用）",
      "details": {},
      "estimatedDuration": 预估秒数
    }
  ],
  "estimatedTime": 总预估时间（秒）,
  "requiredInfo": ["需要用户提供的信息，如账号密码"]
}`;

    const planningContext = `
用户背景：
- 公司信息: ${userContext?.companyInfo ? JSON.stringify(userContext.companyInfo) : '未提供'}

请根据以上信息制定计划。如果需要登录网站，应包含登录步骤。
`;

    const response = await this.aiProvider.chat(
      intent.taskDescription + planningContext,
      systemPrompt,
      { temperature: 0.5, maxTokens: 2000 }
    );

    try {
      const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```|(\{[\s\S]*\})/);
      if (jsonMatch) {
        const plan = JSON.parse(jsonMatch[1] || jsonMatch[2]);
        return { taskId, intent, ...plan };
      }
      const plan = JSON.parse(response);
      return { taskId, intent, ...plan };
    } catch {
      logger.warn({ response }, 'Failed to parse plan JSON');
      return {
        taskId,
        intent,
        steps: [
          { id: 'fallback-search', type: 'navigate' as const, description: '搜索相关信息', details: {}, estimatedDuration: 60 },
          { id: 'fallback-analyze', type: 'analyze' as const, description: '分析搜索结果', details: {}, estimatedDuration: 30 },
        ],
        estimatedTime: 90,
        requiredInfo: [],
      };
    }
  }

  /**
   * ========== 导航执行 ==========
   */
  private async executeNavigate(step: ExecutionStep): Promise<ExecutionResult['steps'][0]> {
    const url = step.target || step.details.url;

    if (!url) {
      // AI 没有指定 URL，需要 AI 自己搜索
      const searchQuery = step.details.searchQuery || step.description;
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;

      const result = await browserAgent.executeActions(this.browserProfileId!, [
        { type: 'navigate', value: searchUrl, timeout: 30000 },
        { type: 'wait_for_navigation', options: { waitUntil: 'domcontentloaded' }, timeout: 15000 },
      ]);

      return {
        step,
        success: result.success,
        output: { url: searchUrl, searchQuery },
        error: result.error,
      };
    }

    const result = await browserAgent.executeActions(this.browserProfileId!, [
      { type: 'navigate', value: url, timeout: 30000 },
      { type: 'wait_for_navigation', options: { waitUntil: 'domcontentloaded' }, timeout: 15000 },
      { type: 'screenshot' },
    ]);

    return {
      step,
      success: result.success,
      output: { url, screenshot: result.screenshot },
      screenshot: result.screenshot,
      error: result.error,
    };
  }

  /**
   * ========== 分析页面 ==========
   */
  private async executeAnalyze(step: ExecutionStep): Promise<ExecutionResult['steps'][0]> {
    // 获取页面快照
    const url = step.target || step.details.url || 'current';
    let snapshot: PageSnapshot;

    if (url === 'current') {
      const result = await browserAgent.executeActions(this.browserProfileId!, [
        { type: 'screenshot' },
      ]);
      snapshot = {
        url: '',
        title: '',
        html: '',
        textContent: result.extractedText || '',
        elements: [],
      };
    } else {
      snapshot = await browserAgent.getPageSnapshot(this.browserProfileId!, url);
    }

    // 使用 AI 分析页面
    const analysisPrompt = step.details.analysisPrompt || `分析以下页面内容：

页面标题: ${snapshot.title}
页面URL: ${snapshot.url}
页面内容: ${snapshot.textContent.substring(0, 5000)}

请识别：
1. 页面类型（登录页、表单页、列表页、详情页等）
2. 主要功能区域
3. 可交互的元素（表单字段、按钮、链接）
4. 关键信息
5. 下一步建议`;

    const analysis = await this.aiProvider.chat(analysisPrompt, '', {
      temperature: 0.5,
      maxTokens: 2000,
    });

    return {
      step,
      success: true,
      output: {
        pageInfo: {
          url: snapshot.url,
          title: snapshot.title,
          elementCount: snapshot.elements.length,
        },
        analysis,
      },
      screenshot: snapshot.screenshot,
    };
  }

  /**
   * ========== 填写表单 ==========
   */
  private async executeFill(
    step: ExecutionStep,
    companyInfo?: Record<string, string>
  ): Promise<ExecutionResult['steps'][0]> {
    // 首先分析表单结构
    const snapshot = await browserAgent.getPageSnapshot(
      this.browserProfileId!,
      step.details.formUrl || 'current'
    );

    // 使用 AI 理解表单并决定如何填写
    const formAnalysisPrompt = `分析以下表单页面，提取字段并决定如何填写：

页面URL: ${snapshot.url}
页面标题: ${snapshot.title}
页面元素:
${snapshot.elements.map(el =>
  `- ${el.tag} [${el.id ? 'id=' + el.id : ''}${el.className ? ' class=' + el.className : ''}] text="${el.text?.substring(0, 50)}" placeholder="${el.attributes.placeholder || ''}"`
).join('\n')}

公司信息:
${companyInfo ? JSON.stringify(companyInfo, null, 2) : '未提供'}

请返回JSON格式的操作序列：
{
  "actions": [
    {
      "type": "click|type|select|wait_for_selector",
      "selector": "CSS选择器",
      "value": "要输入的值",
      "reason": "为什么执行这个操作"
    }
  ],
  "fields": {
    "字段名": "填写的值"
  }
}`;

    const formPlan = await this.aiProvider.chat(formAnalysisPrompt, '', {
      temperature: 0.3,
      maxTokens: 1500,
    });

    // 解析 AI 的填写计划
    let actions: Array<Record<string, unknown>> = [];
    try {
      const jsonMatch = formPlan.match(/```json\n?([\s\S]*?)\n?```|(\{[\s\S]*\})/);
      if (jsonMatch) {
        const plan = JSON.parse(jsonMatch[1] || jsonMatch[2]);
        actions = plan.actions || [];
      }
    } catch {
      logger.warn({ formPlan }, 'Failed to parse form plan');
    }

    // 执行填写操作
    if (actions.length > 0) {
      const result = await browserAgent.executeActions(this.browserProfileId!, actions, {
        screenshotEach: true,
      });

      return {
        step,
        success: result.success,
        output: { actionsExecuted: actions.length, fieldsFilled: actions.filter(a => a.type === 'type').length },
        screenshot: result.screenshot,
        error: result.error,
      };
    }

    return {
      step,
      success: false,
      error: 'AI 未能制定有效的填写计划',
      output: { rawPlan: formPlan },
    };
  }

  /**
   * ========== 提交表单 ==========
   */
  private async executeSubmit(step: ExecutionStep): Promise<ExecutionResult['steps'][0]> {
    const submitSelector = step.details.submitSelector || 'button[type="submit"], .submit, #submit, input[type="submit"]';

    // 截图确认当前状态
    const actions = [
      { type: 'screenshot' },
    ];

    // 如果有指定的提交按钮
    if (step.details.buttonText) {
      actions.push({
        type: 'click',
        selector: `button:has-text("${step.details.buttonText}"), input[value*="${step.details.buttonText}"]`,
      });
    } else {
      // 尝试常见提交按钮
      actions.push({
        type: 'click',
        selector: submitSelector,
      });
    }

    actions.push({ type: 'wait', value: 2000 });
    actions.push({ type: 'screenshot' });

    const result = await browserAgent.executeActions(this.browserProfileId!, actions);

    // 尝试提取提交结果
    const submitResult = await this.aiProvider.chat(
      `页面显示什么？是否提交成功？提取任何确认信息或错误消息。

      页面内容: ${result.extractedText || ''}`,
      '',
      { temperature: 0.3, maxTokens: 500 }
    );

    return {
      step,
      success: result.success,
      output: {
        confirmationText: submitResult,
        screenshot: result.screenshot,
      },
      screenshot: result.screenshot,
      error: result.error,
    };
  }

  /**
   * ========== 提取信息 ==========
   */
  private async executeExtract(step: ExecutionStep): Promise<ExecutionResult['steps'][0]> {
    const snapshot = await browserAgent.getPageSnapshot(
      this.browserProfileId!,
      step.details.url || 'current'
    );

    const extractPrompt = step.details.extractPrompt || `从以下页面提取关键信息：

页面URL: ${snapshot.url}
页面内容: ${snapshot.textContent.substring(0, 8000)}

提取：
1. 主要信息（如项目名称、状态、日期等）
2. 表格数据（如有）
3. 任何用户可能关心的内容

以简洁的格式返回`;

    const extracted = await this.aiProvider.chat(extractPrompt, '', {
      temperature: 0.3,
      maxTokens: 2000,
    });

    return {
      step,
      success: true,
      output: {
        extractedContent: extracted,
        pageInfo: {
          url: snapshot.url,
          title: snapshot.title,
        },
      },
      screenshot: snapshot.screenshot,
    };
  }

  /**
   * ========== 生成汇报 ==========
   */
  private async executeReport(step: ExecutionStep): Promise<ExecutionResult['steps'][0]> {
    const reportContent = step.details.content || '任务执行完成';

    const reportPrompt = `根据以下任务执行结果，生成简洁的中文汇报：

${reportContent}

汇报要求：
1. 简明扼要，适合App推送或短信阅读
2. 突出关键结果
3. 如有需要用户关注的事项，单独说明
4. 如有错误或问题，说明原因`;

    const report = await this.aiProvider.chat(reportPrompt, '', {
      temperature: 0.5,
      maxTokens: 1000,
    });

    return {
      step,
      success: true,
      output: {
        report,
        channels: step.details.channels || ['app'],
      },
    };
  }

  /**
   * ========== 通用步骤执行 ==========
   */
  private async executeStep(
    step: ExecutionStep,
    companyInfo?: Record<string, string>
  ): Promise<ExecutionResult['steps'][0]> {
    switch (step.type) {
      case 'navigate':
        return this.executeNavigate(step);
      case 'analyze':
        return this.executeAnalyze(step);
      case 'fill':
        return this.executeFill(step, companyInfo);
      case 'submit':
        return this.executeSubmit(step);
      case 'extract':
        return this.executeExtract(step);
      case 'report':
        return this.executeReport(step);
      default:
        return {
          step,
          success: false,
          error: `Unsupported step type: ${step.type}`,
          duration: 0,
        };
    }
  }

  /**
   * ========== 自我反思 ==========
   */
  private async reflect(
    failedStep: ExecutionStep,
    error: string | undefined,
    history: ExecutionResult['steps']
  ): Promise<string> {
    const historyText = history.map(s =>
      `${s.step.id}: ${s.success ? '成功' : '失败'}${s.error ? ' - ' + s.error : ''}`
    ).join('\n');

    const reflectionPrompt = `任务执行遇到问题，请反思并提出解决方案：

失败的步骤: ${failedStep.description}
错误信息: ${error || '未知错误'}

执行历史:
${historyText}

请分析：
1. 可能失败的原因
2. 可能的解决方案
3. 是否需要尝试不同的方法`;

    const reflection = await this.aiProvider.chat(reflectionPrompt, '', {
      temperature: 0.5,
      maxTokens: 500,
    });

    logger.info({ reflection }, 'Generated reflection');
    return reflection;
  }

  /**
   * ========== 策略调整 ==========
   */
  private async adaptStrategy(
    failedStep: ExecutionStep,
    reflection: string
  ): Promise<ExecutionStep | null> {
    // 根据反思结果调整策略
    if (reflection.includes('重试') || reflection.includes('retry')) {
      return { ...failedStep, id: `${failedStep.id}-retry` };
    }

    if (reflection.includes('选择器') || reflection.includes('selector')) {
      // 需要 AI 重新分析页面找正确的选择器
      return {
        ...failedStep,
        id: `${failedStep.id}-replan`,
        details: {
          ...failedStep.details,
          needAnalysis: true,
        },
      };
    }

    if (reflection.includes('登录') || reflection.includes('login')) {
      // 需要先登录
      return {
        id: `${failedStep.id}-login-first`,
        type: 'navigate',
        description: '先完成登录',
        details: {
          loginRequired: true,
          nextStep: failedStep,
        },
      };
    }

    return null;
  }

  /**
   * ========== 确保浏览器已初始化 ==========
   */
  private async ensureBrowserProfile(): Promise<void> {
    if (!this.browserProfileId) {
      this.browserProfileId = await browserAgent.createProfile({
        name: `nla-${Date.now()}`,
        viewport: { width: 1280, height: 900 },
      });
      logger.info({ profileId: this.browserProfileId }, 'Browser profile created');
    }
  }

  /**
   * ========== 编译结果 ==========
   */
  private compileResults(steps: ExecutionResult['steps']): unknown {
    return {
      totalSteps: steps.length,
      successfulSteps: steps.filter(s => s.success).length,
      failedSteps: steps.filter(s => !s.success).length,
      results: steps.filter(s => s.output).map(s => ({
        stepId: s.step.id,
        output: s.output,
      })),
    };
  }

  /**
   * 关闭浏览器
   */
  public async shutdown(): Promise<void> {
    if (this.browserProfileId) {
      await browserAgent.deleteProfile(this.browserProfileId);
      this.browserProfileId = null;
    }
    logger.info('NaturalLanguageAgent shutdown');
  }
}

export const naturalLanguageAgent = NaturalLanguageAgent.getInstance();
export default naturalLanguageAgent;
