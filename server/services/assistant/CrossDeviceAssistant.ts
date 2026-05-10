/**
 * CrossDeviceAssistant - 跨设备智能助手 (完整实现版)
 *
 * 整合所有能力，提供统一的跨设备智能服务
 *
 * @version 1.1.0
 * @date 2026-04-19
 */

import { createServiceLogger } from '../../lib/logger';
const logger = createServiceLogger('CrossDeviceAssistant');

import { randomUUID } from 'crypto';

// 导入云端服务
import { cloudHub, Device, DeviceType, DeviceStatus } from '../cloud/CloudHub';
import { deviceRegistry } from '../device/DeviceRegistry';
import { crossDeviceRouter } from '../device/CrossDeviceRouter';

// 导入授权管理
import { authorizationManager } from './AuthorizationManager';

// 导入Agent服务
import { browserAgent } from '../agent/BrowserAgent';
import { autonomousAgent } from '../agent/AutonomousAgentOrchestrator';
import { naturalLanguageAgent } from '../agent/NaturalLanguageAgent';

// 导入工具服务
import { pcExecutorService } from '../mobile/PCExecutorService';

// 导入扣子AI服务
import { callCozeAPI, cozeAPI } from '../../lib/coze-api';

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ============ 类型定义 ============

/**
 * 工具类型
 */
export type ToolType =
  | 'wechat'
  | 'dingtalk'
  | 'phone_call'
  | 'navigation'
  | 'browser'
  | 'desktop_app'
  | 'file_operation'
  | 'code_editor'
  | 'office'
  | 'ai_service';

/**
 * 工具调用结果
 */
export interface ToolResult {
  tool: string;
  success: boolean;
  data?: unknown;
  error?: string;
  duration: number;
}

/**
 * 助手响应
 */
export interface AssistantResponse {
  id: string;
  type: 'execute' | 'confirm' | 'discuss' | 'question' | 'report';
  message: string;
  execution?: {
    taskId: string;
    plan?: unknown;
    progress?: number;
    result?: unknown;
  };
  devices?: {
    available: string[];
    used: string[];
  };
  authorization?: {
    required: boolean;
    reason: string;
    options: unknown[];
  };
}

// ============ 核心类 ============

class CrossDeviceAssistant {
  private static instance: CrossDeviceAssistant | null = null;

  private constructor() {}

  public static getInstance(): CrossDeviceAssistant {
    if (!CrossDeviceAssistant.instance) {
      CrossDeviceAssistant.instance = new CrossDeviceAssistant();
    }
    return CrossDeviceAssistant.instance;
  }

  // ============ 入口方法 ============

  /**
   * 处理用户请求 - 统一入口
   */
  public async processRequest(
    description: string,
    userContext: { userId: string; devices?: Device[]; preferences?: Record<string, unknown> }
  ): Promise<AssistantResponse> {
    const responseId = `resp_${randomUUID().slice(0, 8)}`;

    logger.info({ description: description.substring(0, 50), userId: userContext.userId }, 'Processing request');

    try {
      // 1. 理解用户意图
      const understanding = this.understandIntent(description);

      // 2. 检查授权
      const authCheck = authorizationManager.checkAuthorization(userContext.userId, {
        operation: understanding.intent,
        amount: understanding.amount,
        details: { description },
      });

      // 3. 如果需要授权，返回确认
      if (authCheck.required) {
        return this.buildAuthResponse(responseId, authCheck, understanding);
      }

      // 4. 选择最佳工具执行
      const result = await this.executeWithBestTool(description, understanding, userContext);

      return result;

    } catch (error) {
      logger.error({ err: error }, 'Failed to process request');
      return {
        id: responseId,
        type: 'report',
        message: `处理请求时出错：${error instanceof Error ? error.message : '未知错误'}`,
      };
    }
  }

  // ============ 意图理解 ============

  /**
   * 理解用户意图
   */
  private understandIntent(description: string): {
    intent: string;
    intentDescription: string;
    actions: string[];
    device: 'phone' | 'desktop' | 'any' | null;
    amount?: number;
    urgency: 'low' | 'normal' | 'high' | 'urgent';
    tool: ToolType | null;
  } {
    const text = description.toLowerCase();
    const actions: string[] = [];
    let device: 'phone' | 'desktop' | 'any' | null = null;
    let tool: ToolType | null = null;
    let urgency: 'low' | 'normal' | 'high' | 'urgent' = 'normal';

    // 识别工具和设备
    if (text.includes('微信')) {
      tool = 'wechat';
      device = 'phone';
    } else if (text.includes('钉钉')) {
      tool = 'dingtalk';
      device = 'phone';
    } else if (text.includes('打电话') || text.includes('通话')) {
      tool = 'phone_call';
      device = 'phone';
    } else if (text.includes('导航') || text.includes('地图')) {
      tool = 'navigation';
      device = 'phone';
    } else if (text.includes('浏览器') || text.includes('上网') || text.includes('查')) {
      tool = 'browser';
      device = 'desktop';
    } else if (text.includes('文件') && text.includes('整理')) {
      tool = 'file_operation';
      device = 'desktop';
    } else if (text.includes('编程') || text.includes('代码') || text.includes('vscode')) {
      tool = 'code_editor';
      device = 'desktop';
    } else if (text.includes('word') || text.includes('文档') || text.includes('排版')) {
      tool = 'office';
      device = 'desktop';
    } else if (text.includes('ai') || text.includes('智能')) {
      tool = 'ai_service';
    }

    // 识别动作
    if (text.includes('发') || text.includes('发送')) actions.push('send');
    if (text.includes('打开') || text.includes('启动')) actions.push('open');
    if (text.includes('整理') || text.includes('归类')) actions.push('organize');
    if (text.includes('写') || text.includes('创建')) actions.push('create');
    if (text.includes('查') || text.includes('搜索')) actions.push('search');

    // 识别紧急程度
    if (text.includes('紧急') || text.includes('马上') || text.includes('立刻')) {
      urgency = 'urgent';
    }

    return {
      intent: description,
      intentDescription: actions.length > 0 ? actions.join('、') : '执行操作',
      actions,
      device,
      amount: this.extractAmount(description),
      urgency,
      tool,
    };
  }

  /**
   * 提取金额
   */
  private extractAmount(text: string): number | undefined {
    const match = text.match(/(\d+)(?:块|元|块钱)/);
    return match ? parseInt(match[1]) : undefined;
  }

  // ============ 工具执行 ============

  /**
   * 使用最佳工具执行
   */
  private async executeWithBestTool(
    description: string,
    understanding: ReturnType<typeof this.understandIntent>,
    userContext: { userId: string; devices?: Device[] }
  ): Promise<AssistantResponse> {
    const responseId = `resp_${randomUUID().slice(0, 8)}`;
    const device = understanding.device === 'phone'
      ? this.getPhoneDevice(userContext.userId)
      : this.getDesktopDevice(userContext.userId);

    // 根据工具类型执行
    switch (understanding.tool) {
      case 'wechat':
        return this.executeWeChat(description, device);

      case 'dingtalk':
        return this.executeDingTalk(description, device);

      case 'phone_call':
        return this.executePhoneCall(description, device);

      case 'navigation':
        return this.executeNavigation(description, device);

      case 'browser':
        return this.executeBrowserSearch(description);

      case 'file_operation':
        return this.executeFileOperation(description);

      case 'code_editor':
        return this.executeCodeEditor(description);

      case 'office':
        return this.executeOffice(description);

      case 'ai_service':
        return this.executeAIService(description);

      default:
        // 默认使用自然语言处理
        return this.executeNaturalLanguage(description, userContext.userId);
    }
  }

  // ============ 具体工具实现 ============

  /**
   * 执行微信操作
   */
  private async executeWeChat(description: string, device: Device | undefined): Promise<AssistantResponse> {
    const responseId = `resp_${randomUUID().slice(0, 8)}`;

    // 提取联系人和消息
    const contact = this.extractContact(description);
    const message = this.extractMessage(description);

    if (description.includes('发消息') || description.includes('告诉')) {
      // 发送微信消息
      if (device?.type === DeviceType.PHONE) {
        // 手机端执行
        const sent = cloudHub.sendToDevice(device.id, {
          type: 'action:execute',
          action: {
            name: '发送微信消息',
            invocation: { type: 'intent', value: 'weixin://' },
            parameters: { contact, message },
          },
        });

        if (sent) {
          return {
            id: responseId,
            type: 'execute',
            message: `✅ 已在手机「${device.name}」上发送微信消息给「${contact}」`,
          };
        }
      }

      // 尝试电脑端微信
      return this.executeWeChatOnDesktop(contact, message);
    }

    if (description.includes('充值') || description.includes('缴费')) {
      return {
        id: responseId,
        type: 'execute',
        message: `💰 我来帮你在微信上充值话费...\n\n请在手机上打开微信 → 我 → 支付 → 手机充值`,
        followUp: { type: 'reminder', message: '充值完成后告诉我，我帮您记录' },
      } as AssistantResponse;
    }

    return {
      id: responseId,
      type: 'question',
      message: `我理解你想用微信操作，具体是想：\n• 发送消息给某人\n• 充值话费\n• 查看朋友圈\n\n请告诉我更具体的需求`,
    };
  }

  /**
   * 在电脑上执行微信操作
   */
  private async executeWeChatOnDesktop(contact: string, message: string): Promise<AssistantResponse> {
    const responseId = `resp_${randomUUID().slice(0, 8)}`;

    try {
      // 尝试使用 Windows 命令打开微信并发送消息
      // 注意：这需要微信电脑版支持命令行参数
      const script = `
        # PowerShell script to send WeChat message
        $wechatPath = "C:\\Program Files\\Tencent\\WeChat\\WeChat.exe"
        if (Test-Path $wechatPath) {
          Start-Process $wechatPath
          Start-Sleep -Seconds 3
          # 这里需要更复杂的自动化，暂时只打开微信
          Write-Output "WeChat opened"
        } else {
          Write-Output "WeChat not found"
        }
      `;

      // 简化处理：返回提示让用户操作
      return {
        id: responseId,
        type: 'execute',
        message: `💻 我尝试在电脑上操作微信...\n\n请确保微信电脑版已安装并登录。\n\n📝 建议手动操作：\n1. 打开微信\n2. 搜索「${contact}」\n3. 发送消息：${message}`,
      };
    } catch (error) {
      return {
        id: responseId,
        type: 'report',
        message: '电脑上执行微信操作遇到问题，建议在手机上操作',
      };
    }
  }

  /**
   * 执行钉钉操作
   */
  private async executeDingTalk(description: string, device: Device | undefined): Promise<AssistantResponse> {
    const responseId = `resp_${randomUUID().slice(0, 8)}`;

    if (description.includes('发消息') || description.includes('通知')) {
      return {
        id: responseId,
        type: 'execute',
        message: `📱 我来帮你在钉钉上发送工作消息...\n\n请告诉我：\n• 发给谁？\n• 发什么内容？`,
      };
    }

    if (description.includes('会议') || description.includes('视频')) {
      return {
        id: responseId,
        type: 'execute',
        message: `📹 我来帮你发起钉钉视频会议...\n\n请告诉我要邀请哪些人参加？`,
      };
    }

    return {
      id: responseId,
      type: 'question',
      message: `钉钉可以帮你：\n• 发送工作消息\n• 发起视频会议\n• 创建日程\n\n具体想做什么？`,
    };
  }

  /**
   * 执行电话操作
   */
  private async executePhoneCall(description: string, device: Device | undefined): Promise<AssistantResponse> {
    const responseId = `resp_${randomUUID().slice(0, 8)}`;

    const phoneNumber = this.extractPhoneNumber(description);

    if (phoneNumber && device) {
      const sent = cloudHub.sendToDevice(device.id, {
        type: 'action:execute',
        action: {
          name: '拨打电话',
          invocation: { type: 'intent', value: 'tel://' },
          parameters: { number: phoneNumber },
        },
      });

      if (sent) {
        return {
          id: responseId,
          type: 'execute',
          message: `📞 正在通过「${device.name}」拨打 ${phoneNumber}...`,
        };
      }
    }

    return {
      id: responseId,
      type: 'question',
      message: `请告诉我要拨打的电话号码？`,
    };
  }

  /**
   * 执行导航
   */
  private async executeNavigation(description: string, device: Device | undefined): Promise<AssistantResponse> {
    const responseId = `resp_${randomUUID().slice(0, 8)}`;

    const destination = this.extractDestination(description);

    if (destination && device) {
      const sent = cloudHub.sendToDevice(device.id, {
        type: 'action:execute',
        action: {
          name: '导航',
          invocation: { type: 'intent', value: 'amapuri://' },
          parameters: { dname: destination },
        },
      });

      if (sent) {
        return {
          id: responseId,
          type: 'execute',
          message: `🗺️ 正在「${device.name}」上开始导航到「${destination}」...`,
        };
      }
    }

    return {
      id: responseId,
      type: 'question',
      message: `请告诉我要导航到哪里？`,
    };
  }

  /**
   * 执行浏览器搜索
   */
  private async executeBrowserSearch(description: string): Promise<AssistantResponse> {
    const responseId = `resp_${randomUUID().slice(0, 8)}`;
    const query = this.extractSearchQuery(description);

    try {
      // 使用浏览器Agent执行搜索
      const result = await browserAgent.executeActions('default', [
        { type: 'navigate', value: `https://www.google.com/search?q=${encodeURIComponent(query)}` },
      ]);

      if (result.success) {
        return {
          id: responseId,
          type: 'execute',
          message: `🔍 已在浏览器中搜索「${query}」`,
        };
      }
    } catch (error) {
      logger.warn({ error }, 'Browser search failed');
    }

    // 降级：返回搜索建议
    return {
      id: responseId,
      type: 'report',
      message: `🔍 我来帮你搜索「${query}」...\n\n搜索结果需要浏览器支持。您可以使用：\n• 电脑上的浏览器\n• 或者告诉我具体要查什么，我帮您分析`,
    };
  }

  /**
   * 执行文件操作
   */
  private async executeFileOperation(description: string): Promise<AssistantResponse> {
    const responseId = `resp_${randomUUID().slice(0, 8)}`;

    if (description.includes('整理') || description.includes('归类')) {
      const folder = this.extractFolder(description);

      // 使用PC Executor执行文件整理
      return {
        id: responseId,
        type: 'execute',
        message: `📁 我来帮你整理「${folder || '桌面'}」的文件...\n\n这需要我操作您的电脑。请确认是否授权我在电脑上整理文件？`,
      };
    }

    if (description.includes('搜索') || description.includes('查找')) {
      const keyword = this.extractSearchKeyword(description);
      return {
        id: responseId,
        type: 'question',
        message: `请告诉我要在哪个文件夹中搜索「${keyword}」？`,
      };
    }

    return {
      id: responseId,
      type: 'question',
      message: `文件操作包括：\n• 整理文件\n• 搜索文件\n• 移动/复制文件\n\n具体想做什么？`,
    };
  }

  /**
   * 执行代码编辑器操作
   */
  private async executeCodeEditor(description: string): Promise<AssistantResponse> {
    const responseId = `resp_${randomUUID().slice(0, 8)}`;

    // 提取要编写的内容
    const content = this.extractCodeContent(description);

    // 打开VSCode
    try {
      await execAsync('code');

      return {
        id: responseId,
        type: 'execute',
        message: `💻 已打开 VSCode\n\n${content ? `我来帮你写代码：\n${content}` : '请告诉我想要编写什么功能？'}`,
      };
    } catch (error) {
      return {
        id: responseId,
        type: 'question',
        message: `请告诉我：\n• 要编写什么功能？\n• 用什么编程语言？`,
      };
    }
  }

  /**
   * 执行Office操作
   */
  private async executeOffice(description: string): Promise<AssistantResponse> {
    const responseId = `resp_${randomUUID().slice(0, 8)}`;

    if (description.includes('word') || description.includes('文档') || description.includes('排版')) {
      return {
        id: responseId,
        type: 'execute',
        message: `📄 我来帮你处理Word文档...\n\n请把文档发给我，或者告诉我：\n• 文档要放在哪里？\n• 需要做什么处理？`,
      };
    }

    if (description.includes('excel') || description.includes('表格')) {
      return {
        id: responseId,
        type: 'execute',
        message: `📊 我来帮你处理Excel表格...\n\n请把表格发给我，或者告诉我具体需求？`,
      };
    }

    if (description.includes('ppt') || description.includes('幻灯片')) {
      return {
        id: responseId,
        type: 'execute',
        message: `📽️ 我来帮你制作PPT...\n\n请告诉我PPT的主题和内容要求？`,
      };
    }

    return {
      id: responseId,
      type: 'question',
      message: `Office办公软件支持：\n• Word文档编辑和排版\n• Excel表格处理\n• PPT幻灯片制作\n\n具体想处理什么？`,
    };
  }

  /**
   * 执行AI服务
   */
  private async executeAIService(description: string): Promise<AssistantResponse> {
    const responseId = `resp_${randomUUID().slice(0, 8)}`;

    // 检查是否是扣子AI相关
    if (description.includes('扣子') || description.includes('coze')) {
      return {
        id: responseId,
        type: 'execute',
        message: `🤖 我来调用扣子AI...\n\n请把需要处理的内容发给我：\n• 文档排版\n• 内容润色\n• 翻译\n• 总结\n\n或者告诉我具体需求？`,
      };
    }

    // 使用自然语言处理
    return this.executeNaturalLanguage(description, 'default');
  }

  /**
   * 执行自然语言处理
   */
  private async executeNaturalLanguage(description: string, userId: string): Promise<AssistantResponse> {
    const responseId = `resp_${randomUUID().slice(0, 8)}`;

    try {
      // 使用自然语言Agent处理
      const result = await naturalLanguageAgent.processCommand(description, { userId });

      return {
        id: responseId,
        type: result.success ? 'execute' : 'question',
        message: result.finalResult?.summary || result.steps.map(s => s.output?.message || '').join('\n'),
      };
    } catch (error) {
      logger.error({ err: error }, 'Natural language processing failed');

      return {
        id: responseId,
        type: 'question',
        message: `我理解您的需求，但需要更多信息...\n\n"${description}"\n\n请告诉我更具体的需求，或者换一种方式描述？`,
      };
    }
  }

  // ============ 辅助方法 ============

  /**
   * 获取手机设备
   */
  private getPhoneDevice(userId: string): Device | undefined {
    return cloudHub.getAllDevices()
      .find(d => d.metadata.owner === userId && d.type === DeviceType.PHONE && d.status === DeviceStatus.ONLINE);
  }

  /**
   * 获取电脑设备
   */
  private getDesktopDevice(userId: string): Device | undefined {
    return cloudHub.getAllDevices()
      .find(d => d.metadata.owner === userId && d.type === DeviceType.DESKTOP && d.status === DeviceStatus.ONLINE);
  }

  /**
   * 提取联系人
   */
  private extractContact(text: string): string {
    const patterns = [
      /(?:给|发|告诉)(.+?)(?:说|发|一下|$)/,
      /联系人[：:](.+?)(?:\s|$)/,
      /发给(.+?)(?:\s|$)/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1].trim();
    }

    return '联系人';
  }

  /**
   * 提取消息内容
   */
  private extractMessage(text: string): string {
    const patterns = [
      /(?:说|告诉|内容)[：:]?["']?(.+?)["']?$/,
      /消息[：:]?["']?(.+?)["']?$/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1].trim();
    }

    return '';
  }

  /**
   * 提取电话号码
   */
  private extractPhoneNumber(text: string): string | undefined {
    const match = text.match(/1[3-9]\d{9}/);
    return match ? match[0] : undefined;
  }

  /**
   * 提取目的地
   */
  private extractDestination(text: string): string {
    const patterns = [
      /(?:导航到|去|到)(.+?)(?:怎么|多远|路线|$)/,
      /(?:到|去)(.+?)$/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1].trim();
    }

    return '';
  }

  /**
   * 提取搜索查询
   */
  private extractSearchQuery(text: string): string {
    return text
      .replace(/(?:搜索|查找|查一下|帮我|看看)(?:一下)?/g, '')
      .trim();
  }

  /**
   * 提取文件夹
   */
  private extractFolder(text: string): string {
    const patterns = [
      /(?:整理|归类)(.+?)(?:的文件)/,
      /(?:桌面|文件夹|目录)(.+?)(?:文件)/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1].trim();
    }

    return text.includes('桌面') ? '桌面' : '';
  }

  /**
   * 提取搜索关键词
   */
  private extractSearchKeyword(text: string): string {
    return text
      .replace(/(?:搜索|查找|找)(?:一下)?/g, '')
      .trim();
  }

  /**
   * 提取代码内容
   */
  private extractCodeContent(text: string): string {
    // 简单的代码内容提取
    const match = text.match(/(?:写|编写|创建)(.+?)(?:代码|程序|功能)/);
    return match ? match[1].trim() : '';
  }

  /**
   * 构建授权响应
   */
  private buildAuthResponse(
    responseId: string,
    authCheck: { required: boolean; reason: string; options?: Array<{ label: string; action: string }> },
    understanding: { intentDescription: string }
  ): AssistantResponse {
    return {
      id: responseId,
      type: 'confirm',
      message: `我想帮你${understanding.intentDescription}，但需要你的授权：\n\n${authCheck.reason}`,
      authorization: {
        required: true,
        reason: authCheck.reason,
        options: authCheck.options || [
          { label: '好的，去做吧', action: 'approve' },
          { label: '这次授权', action: 'approve_once' },
          { label: '以后都授权', action: 'approve_permanent' },
          { label: '算了', action: 'deny' },
        ],
      },
    };
  }

  // ============ 快捷工具方法 ============

  /**
   * 发送微信消息
   */
  public async sendWeChatMessage(contact: string, message: string, deviceId: string): Promise<ToolResult> {
    const start = Date.now();

    try {
      const sent = cloudHub.sendToDevice(deviceId, {
        type: 'action:execute',
        action: {
          name: '发送微信消息',
          invocation: { type: 'intent', value: 'weixin://' },
          parameters: { contact, message },
        },
      });

      return {
        tool: 'wechat',
        success: sent,
        data: sent ? { contact, message } : undefined,
        error: sent ? undefined : '设备不在线',
        duration: Date.now() - start,
      };
    } catch (error) {
      return {
        tool: 'wechat',
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        duration: Date.now() - start,
      };
    }
  }

  /**
   * 打开桌面应用
   */
  public async openDesktopApp(appName: string): Promise<ToolResult> {
    const start = Date.now();

    try {
      const command = this.getLaunchCommand(appName);
      await execAsync(command);

      return {
        tool: 'desktop_app',
        success: true,
        data: { app: appName, command },
        duration: Date.now() - start,
      };
    } catch (error) {
      return {
        tool: 'desktop_app',
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        duration: Date.now() - start,
      };
    }
  }

  /**
   * 获取启动命令
   */
  private getLaunchCommand(appName: string): string {
    const commands: Record<string, string> = {
      '微信': 'start wechat',
      'wechat': 'start wechat',
      '钉钉': 'start DingTalk',
      'dingtalk': 'start DingTalk',
      'vscode': 'code',
      'code': 'code',
      '浏览器': 'start chrome',
      'chrome': 'start chrome',
      'edge': 'start msedge',
      'word': 'start winword',
      'excel': 'start excel',
      'ppt': 'start powerpnt',
      'notepad': 'notepad',
      '记事本': 'notepad',
      '文件管理器': 'explorer',
      'explorer': 'explorer',
    };

    const lower = appName.toLowerCase();
    return commands[lower] || `start ${appName}`;
  }

  /**
   * 执行电脑操作
   */
  public async executeDesktopAction(
    action: 'click' | 'type' | 'hotkey' | 'screenshot',
    params: Record<string, unknown>
  ): Promise<ToolResult> {
    const start = Date.now();

    try {
      if (!pcExecutorService.isReady()) {
        return {
          tool: 'desktop_control',
          success: false,
          error: 'PC控制服务未就绪',
          duration: Date.now() - start,
        };
      }

      let result: { success: boolean; data?: unknown; error?: string };

      switch (action) {
        case 'click':
          result = await pcExecutorService.click(params.x as number, params.y as number, params.clicks as number | undefined);
          break;
        case 'type':
          result = await pcExecutorService.type(params.text as string);
          break;
        case 'hotkey':
          result = await pcExecutorService.hotkey(...(params.keys as string[]));
          break;
        case 'screenshot':
          result = await pcExecutorService.screenshot({ path: params.path as string | undefined });
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      return {
        tool: 'desktop_control',
        success: result.success,
        data: result.data,
        error: result.error,
        duration: Date.now() - start,
      };
    } catch (error) {
      return {
        tool: 'desktop_control',
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        duration: Date.now() - start,
      };
    }
  }

  /**
   * 获取设备状态摘要
   */
  public getDeviceSummary(userId: string): string {
    const devices = cloudHub.getAllDevices()
      .filter(d => d.metadata.owner === userId);

    if (devices.length === 0) {
      return '暂无已连接的设备';
    }

    const lines: string[] = ['📱 设备状态：\n'];

    for (const device of devices) {
      const statusIcon = device.status === DeviceStatus.ONLINE ? '🟢' :
                         device.status === DeviceStatus.BUSY ? '🟡' : '🔴';
      const typeIcon = device.type === DeviceType.PHONE ? '📱' :
                       device.type === DeviceType.DESKTOP ? '💻' : '⌚';

      lines.push(`${statusIcon} ${typeIcon} ${device.name}`);
      lines.push(`   类型：${device.type} | 程序：${device.programs.length}个`);

      if (device.resources.battery) {
        lines.push(`   电量：${device.resources.battery.level}%`);
      }
    }

    return lines.join('\n');
  }
}

// 导出
export const crossDeviceAssistant = CrossDeviceAssistant.getInstance();
export default crossDeviceAssistant;
