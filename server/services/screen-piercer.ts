/**
 * 屏幕穿透服务增强 - Phase 11.4
 * 
 * 基于PRD需求-24/25/26:
 * - OCR语义锚定：识别屏幕UI元素并建立语义锚点
 * - 坐标点击模拟：根据语义锚定执行精准点击
 * - UI自动化控制：基于视觉理解的自动化操作
 * 
 * 功能：
 * 1. 屏幕截图分析 - OCR + 视觉理解
 * 2. UI元素检测 - 按钮、输入框、链接识别
 * 3. 语义锚点管理 - 建立可靠的元素定位
 * 4. 动作执行 - 点击、输入、滚动等
 * 5. 操作记录回放 - 录制和回放UI操作
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('ScreenPiercer');

import { EventEmitter } from 'events';
import { getDatabase } from '../db';
import { auditLogs } from '@shared/schema';
import crypto from 'crypto';

// ============ 类型定义 ============

export interface ScreenRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UIElement {
  id: string;
  type: UIElementType;
  text: string;
  region: ScreenRegion;
  confidence: number;
  semanticLabel?: string;
  parentId?: string;
  children?: string[];
  attributes: Record<string, any>;
}

export type UIElementType = 
  | 'BUTTON'
  | 'INPUT'
  | 'LINK'
  | 'TEXT'
  | 'IMAGE'
  | 'ICON'
  | 'LIST'
  | 'TABLE'
  | 'MENU'
  | 'DIALOG'
  | 'UNKNOWN';

export interface SemanticAnchor {
  id: string;
  name: string;
  description: string;
  selector: AnchorSelector;
  lastMatch?: UIElement;
  reliability: number;
  usageCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface AnchorSelector {
  type: 'TEXT' | 'POSITION' | 'VISUAL' | 'COMPOSITE';
  textPattern?: string;
  positionHint?: ScreenRegion;
  visualHash?: string;
  compositeRules?: AnchorSelector[];
  tolerance?: number;
}

export interface ScreenCapture {
  id: string;
  timestamp: number;
  resolution: { width: number; height: number };
  elements: UIElement[];
  ocrText: string;
  metadata: Record<string, any>;
}

export interface UIAction {
  id: string;
  type: UIActionType;
  target: string;  // Anchor ID or coordinates
  parameters: Record<string, any>;
  timestamp: number;
  result: ActionResult;
}

export type UIActionType = 
  | 'CLICK'
  | 'DOUBLE_CLICK'
  | 'RIGHT_CLICK'
  | 'TYPE'
  | 'SCROLL'
  | 'DRAG'
  | 'HOVER'
  | 'WAIT'
  | 'SCREENSHOT';

export interface ActionResult {
  success: boolean;
  duration: number;
  error?: string;
  screenshot?: string;
  changedElements?: string[];
}

export interface ActionSequence {
  id: string;
  name: string;
  description: string;
  actions: UIAction[];
  variables: Record<string, any>;
  createdAt: number;
  lastRun?: number;
  successRate: number;
}

export interface VisualDiff {
  changedRegions: ScreenRegion[];
  addedElements: UIElement[];
  removedElements: UIElement[];
  modifiedElements: { before: UIElement; after: UIElement }[];
}

// ============ 日志函数 ============

function log(message: string) {
  const time = new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  logger.info(`${time} [ScreenPiercer] ${message}`);
}

// ============ 屏幕穿透服务类 ============

class ScreenPiercerService extends EventEmitter {
  private anchors: Map<string, SemanticAnchor> = new Map();
  private captures: ScreenCapture[] = [];
  private sequences: Map<string, ActionSequence> = new Map();
  private currentCapture: ScreenCapture | null = null;
  private maxCaptures = 100;

  constructor() {
    super();
    this.initializeDefaultAnchors();
    log('屏幕穿透服务已初始化 (Phase 11.4)');
  }

  private initializeDefaultAnchors(): void {
    // 预定义常见UI元素锚点
    const defaultAnchors: Omit<SemanticAnchor, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        name: '确认按钮',
        description: '通用确认/OK按钮',
        selector: { type: 'TEXT', textPattern: '(确认|确定|OK|Yes|Submit|提交)' },
        reliability: 0.8,
        usageCount: 0,
      },
      {
        name: '取消按钮',
        description: '通用取消按钮',
        selector: { type: 'TEXT', textPattern: '(取消|Cancel|No|关闭)' },
        reliability: 0.8,
        usageCount: 0,
      },
      {
        name: '搜索框',
        description: '搜索输入框',
        selector: { type: 'TEXT', textPattern: '(搜索|Search|查找)' },
        reliability: 0.7,
        usageCount: 0,
      },
    ];

    for (const anchor of defaultAnchors) {
      const id = `anchor_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      this.anchors.set(id, {
        ...anchor,
        id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    log(`已初始化 ${this.anchors.size} 个语义锚点`);
  }

  // ============ 屏幕分析 ============

  async analyzeScreen(imageData: string | Buffer): Promise<ScreenCapture> {
    const captureId = `capture_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    log(`开始屏幕分析: ${captureId}`);

    // 模拟OCR和UI元素检测
    const elements = await this.detectUIElements(imageData);
    const ocrText = await this.performOCR(imageData);

    const capture: ScreenCapture = {
      id: captureId,
      timestamp: Date.now(),
      resolution: { width: 1920, height: 1080 }, // 实际应从图像获取
      elements,
      ocrText,
      metadata: {
        elementCount: elements.length,
        hasButtons: elements.some(e => e.type === 'BUTTON'),
        hasInputs: elements.some(e => e.type === 'INPUT'),
      },
    };

    this.captures.push(capture);
    if (this.captures.length > this.maxCaptures) {
      this.captures.shift();
    }

    this.currentCapture = capture;
    this.emit('screen_analyzed', capture);

    log(`屏幕分析完成: ${elements.length} 个元素`);
    return capture;
  }

  private async detectUIElements(imageData: string | Buffer): Promise<UIElement[]> {
    const elements: UIElement[] = [];
    const apiKey = process.env.DASHSCOPE_API_KEY;

    if (!apiKey) {
      logger.warn('DASHSCOPE_API_KEY未配置，UI元素检测功能不可用');
      return elements;
    }

    try {
      const base64Image = Buffer.isBuffer(imageData) 
        ? imageData.toString('base64') 
        : imageData;

      const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen-vl-max',
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:image/png;base64,${base64Image}` }
              },
              {
                type: 'text',
                text: '请分析这张屏幕截图，识别所有可交互的UI元素（按钮、输入框、链接、复选框等）。以JSON数组格式返回，每个元素包含：type（BUTTON/INPUT/LINK/TEXT/CHECKBOX/DROPDOWN）、text（元素文本）、x、y（左上角坐标估计）、width、height（尺寸估计）。只返回JSON数组，不要其他文字。'
              }
            ]
          }],
          temperature: 0.1,
          max_tokens: 2000
        })
      });

      if (response.ok) {
        const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
        const content = data.choices?.[0]?.message?.content || '';
        
        try {
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const parsedElements = JSON.parse(jsonMatch[0]) as Array<{
              type?: string;
              text?: string;
              x?: number;
              y?: number;
              width?: number;
              height?: number;
            }>;
            for (const el of parsedElements) {
              elements.push({
                id: `elem_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
                type: (el.type as UIElementType) || 'TEXT',
                text: el.text || '',
                region: { 
                  x: el.x || 0, 
                  y: el.y || 0, 
                  width: el.width || 100, 
                  height: el.height || 30 
                },
                confidence: 0.85,
                attributes: {},
              });
            }
          }
        } catch (parseError) {
          logger.warn({ err: parseError }, 'UI元素解析失败');
        }
      }
    } catch (error) {
      logger.error({ err: error }, 'DashScope视觉分析失败');
    }

    return elements;
  }

  private async performOCR(imageData: string | Buffer): Promise<string> {
    const apiKey = process.env.DASHSCOPE_API_KEY;

    if (!apiKey) {
      logger.warn('DASHSCOPE_API_KEY未配置，OCR功能不可用');
      return '';
    }

    try {
      const base64Image = Buffer.isBuffer(imageData) 
        ? imageData.toString('base64') 
        : imageData;

      const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen-vl-max',
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:image/png;base64,${base64Image}` }
              },
              {
                type: 'text',
                text: '请提取这张图片中的所有可见文字内容，按从上到下、从左到右的顺序排列。只返回文字内容，不要其他描述。'
              }
            ]
          }],
          temperature: 0.1,
          max_tokens: 4000
        })
      });

      if (response.ok) {
        const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
        return data.choices?.[0]?.message?.content || '';
      }
    } catch (error) {
      logger.error({ err: error }, 'DashScope OCR失败');
    }

    return '';
  }

  // ============ 语义锚点管理 ============

  createAnchor(config: {
    name: string;
    description: string;
    selector: AnchorSelector;
  }): SemanticAnchor {
    const id = `anchor_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const anchor: SemanticAnchor = {
      id,
      name: config.name,
      description: config.description,
      selector: config.selector,
      reliability: 0.5,
      usageCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.anchors.set(id, anchor);
    this.emit('anchor_created', anchor);
    log(`创建锚点: ${config.name} (${id})`);

    return anchor;
  }

  findElement(anchorId: string, capture?: ScreenCapture): UIElement | null {
    const anchor = this.anchors.get(anchorId);
    if (!anchor) return null;

    const screen = capture || this.currentCapture;
    if (!screen) return null;

    // 根据选择器类型查找元素
    for (const element of screen.elements) {
      if (this.matchesSelector(element, anchor.selector)) {
        anchor.lastMatch = element;
        anchor.usageCount++;
        anchor.updatedAt = Date.now();
        return element;
      }
    }

    return null;
  }

  private matchesSelector(element: UIElement, selector: AnchorSelector): boolean {
    switch (selector.type) {
      case 'TEXT':
        if (selector.textPattern) {
          const regex = new RegExp(selector.textPattern, 'i');
          return regex.test(element.text);
        }
        return false;

      case 'POSITION':
        if (selector.positionHint) {
          const tolerance = selector.tolerance || 50;
          return Math.abs(element.region.x - selector.positionHint.x) <= tolerance &&
                 Math.abs(element.region.y - selector.positionHint.y) <= tolerance;
        }
        return false;

      case 'COMPOSITE':
        if (selector.compositeRules) {
          return selector.compositeRules.every(rule => this.matchesSelector(element, rule));
        }
        return false;

      default:
        return false;
    }
  }

  listAnchors(): SemanticAnchor[] {
    return Array.from(this.anchors.values());
  }

  getAnchor(id: string): SemanticAnchor | undefined {
    return this.anchors.get(id);
  }

  deleteAnchor(id: string): boolean {
    return this.anchors.delete(id);
  }

  // ============ 动作执行 ============

  async executeAction(action: Omit<UIAction, 'id' | 'timestamp' | 'result'>): Promise<UIAction> {
    const actionId = `action_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const startTime = Date.now();

    log(`执行动作: ${action.type} on ${action.target}`);

    try {
      // 解析目标
      let targetRegion: ScreenRegion | null = null;

      // 检查是否为锚点ID
      if (action.target.startsWith('anchor_')) {
        const element = this.findElement(action.target);
        if (element) {
          targetRegion = element.region;
        }
      } else if (action.target.includes(',')) {
        // 坐标格式: x,y
        const [x, y] = action.target.split(',').map(Number);
        targetRegion = { x, y, width: 1, height: 1 };
      }

      // 模拟动作执行
      const result: ActionResult = await this.simulateAction(action.type, targetRegion, action.parameters);

      const completedAction: UIAction = {
        id: actionId,
        type: action.type,
        target: action.target,
        parameters: action.parameters,
        timestamp: startTime,
        result: {
          ...result,
          duration: Date.now() - startTime,
        },
      };

      this.emit('action_executed', completedAction);
      return completedAction;

    } catch (error) {
      const failedAction: UIAction = {
        id: actionId,
        type: action.type,
        target: action.target,
        parameters: action.parameters,
        timestamp: startTime,
        result: {
          success: false,
          duration: Date.now() - startTime,
          error: error instanceof Error ? error.message : '未知错误',
        },
      };

      this.emit('action_failed', failedAction);
      return failedAction;
    }
  }

  private async simulateAction(
    type: UIActionType,
    region: ScreenRegion | null,
    params: Record<string, any>
  ): Promise<ActionResult> {
    // 模拟动作执行延迟
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

    switch (type) {
      case 'CLICK':
        if (!region) throw new Error('缺少目标区域');
        log(`模拟点击: (${region.x + region.width / 2}, ${region.y + region.height / 2})`);
        return { success: true, duration: 0 };

      case 'TYPE':
        const text = params.text || '';
        log(`模拟输入: "${text.substring(0, 20)}..."`);
        return { success: true, duration: text.length * 50 };

      case 'SCROLL':
        const direction = params.direction || 'down';
        const amount = params.amount || 100;
        log(`模拟滚动: ${direction} ${amount}px`);
        return { success: true, duration: 0 };

      case 'WAIT':
        const waitTime = params.duration || 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return { success: true, duration: waitTime };

      case 'SCREENSHOT':
        log('模拟截图');
        return { success: true, duration: 0, screenshot: 'mock_screenshot_base64' };

      default:
        return { success: true, duration: 0 };
    }
  }

  // ============ 操作序列 ============

  createSequence(config: {
    name: string;
    description: string;
    actions: Omit<UIAction, 'id' | 'timestamp' | 'result'>[];
    variables?: Record<string, any>;
  }): ActionSequence {
    const id = `seq_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const sequence: ActionSequence = {
      id,
      name: config.name,
      description: config.description,
      actions: config.actions.map((a, idx) => ({
        ...a,
        id: `${id}_action_${idx}`,
        timestamp: 0,
        result: { success: false, duration: 0 },
      })),
      variables: config.variables || {},
      createdAt: Date.now(),
      successRate: 0,
    };

    this.sequences.set(id, sequence);
    this.emit('sequence_created', sequence);
    log(`创建操作序列: ${config.name} (${id})`);

    return sequence;
  }

  async runSequence(sequenceId: string, variables?: Record<string, any>): Promise<{
    success: boolean;
    results: UIAction[];
    duration: number;
  }> {
    const sequence = this.sequences.get(sequenceId);
    if (!sequence) throw new Error(`序列不存在: ${sequenceId}`);

    const startTime = Date.now();
    const results: UIAction[] = [];
    let allSuccess = true;

    const mergedVars = { ...sequence.variables, ...variables };

    log(`运行操作序列: ${sequence.name}`);

    for (const action of sequence.actions) {
      // 变量替换
      let target = action.target;
      for (const [key, value] of Object.entries(mergedVars)) {
        target = target.replace(`\${${key}}`, String(value));
      }

      const result = await this.executeAction({
        type: action.type,
        target,
        parameters: action.parameters,
      });

      results.push(result);

      if (!result.result.success) {
        allSuccess = false;
        break;
      }
    }

    sequence.lastRun = Date.now();
    
    // 更新成功率
    const totalRuns = (sequence.successRate > 0 ? 1 / sequence.successRate : 0) + 1;
    sequence.successRate = allSuccess ? 
      (sequence.successRate * (totalRuns - 1) + 1) / totalRuns :
      (sequence.successRate * (totalRuns - 1)) / totalRuns;

    log(`序列执行完成: ${allSuccess ? '成功' : '失败'}`);

    return {
      success: allSuccess,
      results,
      duration: Date.now() - startTime,
    };
  }

  listSequences(): ActionSequence[] {
    return Array.from(this.sequences.values());
  }

  getSequence(id: string): ActionSequence | undefined {
    return this.sequences.get(id);
  }

  // ============ 视觉对比 ============

  compareCaptures(capture1: ScreenCapture, capture2: ScreenCapture): VisualDiff {
    const elements1 = new Map(capture1.elements.map(e => [e.id, e]));
    const elements2 = new Map(capture2.elements.map(e => [e.id, e]));

    const addedElements: UIElement[] = [];
    const removedElements: UIElement[] = [];
    const modifiedElements: { before: UIElement; after: UIElement }[] = [];

    // 查找新增和修改的元素
    for (const [id, elem2] of Array.from(elements2.entries())) {
      const elem1 = elements1.get(id);
      if (!elem1) {
        addedElements.push(elem2);
      } else if (this.elementChanged(elem1, elem2)) {
        modifiedElements.push({ before: elem1, after: elem2 });
      }
    }

    // 查找移除的元素
    for (const [id, elem1] of Array.from(elements1.entries())) {
      if (!elements2.has(id)) {
        removedElements.push(elem1);
      }
    }

    // 计算变化区域
    const changedRegions = [
      ...addedElements.map(e => e.region),
      ...modifiedElements.map(m => m.after.region),
    ];

    return {
      changedRegions,
      addedElements,
      removedElements,
      modifiedElements,
    };
  }

  private elementChanged(e1: UIElement, e2: UIElement): boolean {
    return e1.text !== e2.text ||
           e1.region.x !== e2.region.x ||
           e1.region.y !== e2.region.y ||
           e1.region.width !== e2.region.width ||
           e1.region.height !== e2.region.height;
  }

  // ============ 统计 ============

  getStats(): {
    anchorsCount: number;
    capturesCount: number;
    sequencesCount: number;
    hasCurrentCapture: boolean;
  } {
    return {
      anchorsCount: this.anchors.size,
      capturesCount: this.captures.length,
      sequencesCount: this.sequences.size,
      hasCurrentCapture: this.currentCapture !== null,
    };
  }

  getRecentCaptures(limit = 10): ScreenCapture[] {
    return this.captures.slice(-limit);
  }
}

export const screenPiercer = new ScreenPiercerService();
logger.info('[ScreenPiercer] 屏幕穿透服务 v1.0 已加载 (Phase 11.4)');
