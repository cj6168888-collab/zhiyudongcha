/**
 * PC Agent - 电脑端Agent核心编排器
 *
 * 整合所有PC端能力，统一提供接口给CrossDeviceAssistant调用
 *
 * @version 1.1.0
 * @date 2026-04-19
 */

import { createServiceLogger } from '../../lib/logger';
import { fileOrganizerService } from './FileOrganizerService';
import { officeAutomationService } from './OfficeAutomationService';
import { systemOperationService } from './SystemOperationService';
import { programmingAssistantService, SUPPORTED_LANGUAGES } from './ProgrammingAssistantService';
import { pcExecutorService } from '../mobile/PCExecutorService';

const logger = createServiceLogger('PCAgent');

// Agent任务类型
export type PCTaskType =
  | 'file_organize'
  | 'document_generate'
  | 'ppt_create'
  | 'system_optimize'
  | 'software_install'
  | 'software_uninstall'
  | 'code_create'
  | 'code_search'
  | 'project_open'
  | 'web_form_fill'
  | 'custom';

// 任务请求
export interface PCTaskRequest {
  type: PCTaskType;
  description: string;
  params: Record<string, unknown>;
  priority?: number;
}

// 任务结果
export interface PCTaskResult {
  success: boolean;
  type: PCTaskType;
  message: string;
  data?: unknown;
  details?: {
    files?: string[];
    filePath?: string;
    output?: string;
    error?: string;
  };
}

function extractConnectionTarget(description: string, params: Record<string, unknown>): { host: string; port: number } {
  const hostFromParams = typeof params.host === 'string' && params.host.trim()
    ? params.host.trim()
    : undefined;
  const portFromParams = typeof params.port === 'number'
    ? params.port
    : typeof params.port === 'string'
      ? Number.parseInt(params.port, 10)
      : undefined;
  const hostMatch = description.match(/(?:连接|连通|访问|ping|测试)\s*([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|localhost|127\.0\.0\.1|::1)/iu);
  const portMatch = description.match(/(?:端口|port)\s*(\d{1,5})/iu);

  return {
    host: hostFromParams || hostMatch?.[1] || '127.0.0.1',
    port: Number.isFinite(portFromParams) && portFromParams! > 0
      ? portFromParams!
      : portMatch?.[1]
        ? Number.parseInt(portMatch[1], 10)
        : 80,
  };
}

// PC端Agent
export class PCAgent {
  private static instance: PCAgent | null = null;

  private constructor() {
    logger.info('PCAgent initialized');
  }

  public static getInstance(): PCAgent {
    if (!PCAgent.instance) {
      PCAgent.instance = new PCAgent();
    }
    return PCAgent.instance;
  }

  /**
   * 执行PC端任务
   */
  public async executeTask(task: PCTaskRequest): Promise<PCTaskResult> {
    logger.info({ type: task.type, description: task.description }, 'Executing PC task');

    try {
      switch (task.type) {
        case 'file_organize':
          return await this.handleFileOrganize(task);
        case 'document_generate':
          return await this.handleDocumentGenerate(task);
        case 'ppt_create':
          return await this.handlePPTCreate(task);
        case 'system_optimize':
          return await this.handleSystemOptimize(task);
        case 'software_install':
          return await this.handleSoftwareInstall(task);
        case 'software_uninstall':
          return await this.handleSoftwareUninstall(task);
        case 'code_create':
          return await this.handleCodeCreate(task);
        case 'code_search':
          return await this.handleCodeSearch(task);
        case 'project_open':
          return await this.handleProjectOpen(task);
        case 'web_form_fill':
          return await this.handleWebFormFill(task);
        case 'custom':
        default:
          return await this.handleCustomTask(task);
      }
    } catch (error) {
      logger.error({ error, type: task.type }, 'PC task execution failed');
      return {
        success: false,
        type: task.type,
        message: `任务执行失败: ${error instanceof Error ? error.message : '未知错误'}`,
      };
    }
  }

  /**
   * 处理文件整理任务
   */
  private async handleFileOrganize(task: PCTaskRequest): Promise<PCTaskResult> {
    const { description, params } = task;

    // 查找科技局相关文件
    if (description.includes('科技局') || description.includes('申报')) {
      const basePath = params.path as string ||
        (process.platform === 'win32'
          ? `${process.env.USERPROFILE}\\Desktop`
          : `${process.env.HOME}/Desktop`);

      const files = await fileOrganizerService.findGovernmentFiles(basePath);

      return {
        success: true,
        type: 'file_organize',
        message: `找到 ${files.length} 个相关文件`,
        data: { files },
        details: {
          files: files.map(f => f.path),
        },
      };
    }

    // 查找项目文件
    if (description.includes('项目')) {
      const projectName = params.name as string || '未命名项目';
      const basePath = params.path as string ||
        (process.platform === 'win32'
          ? `${process.env.USERPROFILE}\\Desktop`
          : `${process.env.HOME}/Desktop`);

      const keywords = (params.keywords as string[]) || [];
      const files = await fileOrganizerService.findProjectFiles(basePath, projectName, keywords);

      return {
        success: true,
        type: 'file_organize',
        message: `找到 ${files.length} 个项目相关文件`,
        data: { files },
        details: {
          files: files.map(f => f.path),
        },
      };
    }

    // 整理桌面
    if (description.includes('整理桌面')) {
      const result = await fileOrganizerService.organizeDesktop({
        action: params.action as 'move' | 'copy' || 'move',
      });

      return {
        success: result.success,
        type: 'file_organize',
        message: `整理完成: ${result.organized} 个文件已整理`,
        details: {
          files: result.details.map(d => d.target),
        },
      };
    }

    // 归档
    if (description.includes('归档')) {
      const sourcePath = params.source as string;
      const archiveName = params.name as string || 'archive';
      const archiveFolder = params.target as string;

      if (!sourcePath || !archiveFolder) {
        return {
          success: false,
          type: 'file_organize',
          message: '缺少归档参数',
        };
      }

      const archivePath = await fileOrganizerService.createArchive(sourcePath, archiveName, archiveFolder);

      return {
        success: true,
        type: 'file_organize',
        message: `归档成功: ${archivePath}`,
        details: {
          files: [archivePath],
        },
      };
    }

    return {
      success: false,
      type: 'file_organize',
      message: '无法识别文件整理任务类型',
    };
  }

  /**
   * 处理文档生成任务
   */
  private async handleDocumentGenerate(task: PCTaskRequest): Promise<PCTaskResult> {
    const { description, params } = task;

    // 科技申报书
    if (description.includes('申报') || description.includes('科技局')) {
      const result = await officeAutomationService.generateDocument({
        templateId: 'sci-tech-application',
        title: params.title as string || '科技计划项目申报书',
        variables: {
          projectName: params.projectName || description.match(/项目[名称]*(.+?)(?:，|,|$)/)?.[1] || '待定',
          applicant: params.applicant || process.env.USER_NAME || '公司名称',
          contact: params.contact || '',
          phone: params.phone || '',
          budget: params.budget || 100,
          startDate: params.startDate || new Date().toISOString().split('T')[0],
          endDate: params.endDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          background: params.background || description,
          objective: params.objective || '实现技术创新',
          content: params.content || '开展关键技术研发',
          innovation: params.innovation || '具有自主知识产权',
          team: params.team || [],
          equipment: params.equipment || [],
          schedule: params.schedule || [],
        },
      });

      return {
        success: result.success,
        type: 'document_generate',
        message: result.success ? `文档生成成功: ${result.filePath}` : '文档生成失败',
        details: {
          filePath: result.filePath,
        },
      };
    }

    // 可行性报告
    if (description.includes('可行性') || description.includes('报告')) {
      const result = await officeAutomationService.generateDocument({
        templateId: 'feasibility-report',
        title: params.title as string || '项目可行性研究报告',
        variables: params,
      });

      return {
        success: result.success,
        type: 'document_generate',
        message: result.success ? `报告生成成功: ${result.filePath}` : '报告生成失败',
        details: {
          filePath: result.filePath,
        },
      };
    }

    // 合同
    if (description.includes('合同')) {
      const result = await officeAutomationService.generateDocument({
        templateId: 'contract',
        title: params.title as string || '项目合同',
        variables: params,
      });

      return {
        success: result.success,
        type: 'document_generate',
        message: result.success ? `合同生成成功: ${result.filePath}` : '合同生成失败',
        details: {
          filePath: result.filePath,
        },
      };
    }

    // 年度计划/总结
    if (description.includes('计划') || description.includes('总结')) {
      const templateId = description.includes('计划') ? 'annual-plan' : 'work-summary';
      const result = await officeAutomationService.generateDocument({
        templateId,
        title: params.title as string || (description.includes('计划') ? '年度工作计划' : '工作总结'),
        variables: params,
      });

      return {
        success: result.success,
        type: 'document_generate',
        message: result.success ? `文档生成成功: ${result.filePath}` : '文档生成失败',
        details: {
          filePath: result.filePath,
        },
      };
    }

    // 自定义文档
    const result = await officeAutomationService.generateDocument({
      title: params.title as string || description,
      variables: params,
    });

    return {
      success: result.success,
      type: 'document_generate',
      message: result.success ? `文档生成成功: ${result.filePath}` : '文档生成失败',
      details: {
        filePath: result.filePath,
      },
    };
  }

  /**
   * 处理PPT创建任务
   */
  private async handlePPTCreate(task: PCTaskRequest): Promise<PCTaskResult> {
    const { params } = task;

    const title = params.title as string || '演示文稿';
    const slides = params.slides as any[] || [
      {
        title: '封面',
        content: [title],
        layout: 'title',
      },
      {
        title: '目录',
        content: ['内容一', '内容二', '内容三'],
        layout: 'content',
      },
      {
        title: '内容一',
        content: ['要点1', '要点2', '要点3'],
        layout: 'content',
      },
    ];

    const result = await officeAutomationService.generatePPT(title, slides);

    return {
      success: result.success,
      type: 'ppt_create',
      message: result.success ? `PPT创建成功: ${result.filePath}` : 'PPT创建失败',
      details: {
        filePath: result.filePath,
      },
    };
  }

  /**
   * 处理系统优化任务
   */
  private async handleSystemOptimize(task: PCTaskRequest): Promise<PCTaskResult> {
    const { description, params } = task;

    const suggestions: string[] = [];

    if (/(网络|连接|连通|连通性|诊断|ping)/iu.test(description)) {
      const target = extractConnectionTarget(description, params);
      const result = await systemOperationService.testConnection(target.host, target.port);
      const message = result.reachable
        ? `PC 端连通性测试完成：${target.host} 可达，耗时约 ${result.latency ?? 0}ms`
        : `PC 端连通性测试完成：${target.host} 不可达`;

      return {
        success: result.reachable,
        type: 'system_optimize',
        message,
        data: {
          host: target.host,
          port: target.port,
          reachable: result.reachable,
          latency: result.latency,
        },
        details: {
          output: result.reachable
            ? `${target.host}:${target.port} reachable in ${result.latency ?? 0}ms`
            : result.error || 'Host unreachable',
        },
      };
    }

    if (description.includes('清理') || description.includes('优化')) {
      // 清理临时文件
      const tempResult = await systemOperationService.cleanTempFiles();
      suggestions.push(`清理临时文件: ${tempResult.cleaned} 个文件，释放 ${(tempResult.freed / 1024 / 1024).toFixed(2)} MB`);

      // 清理浏览器缓存
      const cacheResult = await systemOperationService.cleanBrowserCache();
      suggestions.push(`清理浏览器缓存: ${cacheResult.cleaned} 个文件，释放 ${(cacheResult.freed / 1024 / 1024).toFixed(2)} MB`);
    }

    // 获取系统信息
    const sysInfo = systemOperationService.getSystemInfo();
    suggestions.push(`当前内存使用率: ${sysInfo.memory.usagePercent}%`);

    // 获取优化建议
    const optSuggestions = systemOperationService.getOptimizationSuggestions();
    suggestions.push(...optSuggestions);

    return {
      success: true,
      type: 'system_optimize',
      message: '系统优化完成',
      data: {
        suggestions,
        systemInfo: sysInfo,
      },
    };
  }

  /**
   * 处理软件安装任务
   */
  private async handleSoftwareInstall(task: PCTaskRequest): Promise<PCTaskResult> {
    const { params } = task;
    const installerPath = params.path as string;

    if (!installerPath) {
      return {
        success: false,
        type: 'software_install',
        message: '请提供安装包路径',
      };
    }

    const result = await systemOperationService.installSoftware(installerPath);

    return {
      success: result.success,
      type: 'software_install',
      message: result.message,
    };
  }

  /**
   * 处理软件卸载任务
   */
  private async handleSoftwareUninstall(task: PCTaskRequest): Promise<PCTaskResult> {
    const { params } = task;
    const name = params.name as string;

    if (!name) {
      return {
        success: false,
        type: 'software_uninstall',
        message: '请提供软件名称',
      };
    }

    const result = await systemOperationService.uninstallSoftware(name);

    return {
      success: result.success,
      type: 'software_uninstall',
      message: result.message,
    };
  }

  /**
   * 处理代码创建任务
   */
  private async handleCodeCreate(task: PCTaskRequest): Promise<PCTaskResult> {
    const { params } = task;

    const language = params.language as string || 'javascript';
    const filePath = params.path as string;
    const template = params.template as string;

    if (!filePath) {
      return {
        success: false,
        type: 'code_create',
        message: '请提供文件路径',
      };
    }

    const success = await programmingAssistantService.createCodeFile(filePath, language, template);

    return {
      success,
      type: 'code_create',
      message: success ? `代码文件创建成功: ${filePath}` : '代码文件创建失败',
      details: {
        filePath,
      },
    };
  }

  /**
   * 处理代码搜索任务
   */
  private async handleCodeSearch(task: PCTaskRequest): Promise<PCTaskResult> {
    const { params } = task;

    const keyword = params.keyword as string || task.description;
    const projectPath = params.projectPath as string;

    if (!projectPath) {
      return {
        success: false,
        type: 'code_search',
        message: '请提供项目路径',
      };
    }

    const files = await programmingAssistantService.searchCodeFiles(projectPath, keyword, {
      extensions: params.extensions as string[] | undefined,
    });

    return {
      success: true,
      type: 'code_search',
      message: `找到 ${files.length} 个匹配文件`,
      details: {
        files,
      },
    };
  }

  /**
   * 处理项目打开任务
   */
  private async handleProjectOpen(task: PCTaskRequest): Promise<PCTaskResult> {
    const { params } = task;

    const projectPath = params.path as string;

    if (!projectPath) {
      return {
        success: false,
        type: 'project_open',
        message: '请提供项目路径',
      };
    }

    const success = await programmingAssistantService.openProject(projectPath);

    return {
      success,
      type: 'project_open',
      message: success ? `已在IDE中打开: ${projectPath}` : '打开项目失败',
      details: {
        filePath: projectPath,
      },
    };
  }

  /**
   * 处理网页表单填报任务
   */
  private async handleWebFormFill(task: PCTaskRequest): Promise<PCTaskResult> {
    const { params } = task;

    const url = params.url as string;
    const formData = params.formData as Record<string, string>;

    if (!url) {
      return {
        success: false,
        type: 'web_form_fill',
        message: '请提供表单URL',
      };
    }

    // 使用BrowserAgent填写表单
    try {
      const { browserAgent } = await import('../agent/BrowserAgent');

      const result = await browserAgent.fillForm(
        params.profileId as string || 'default',
        url,
        formData
      );

      return {
        success: result.success,
        type: 'web_form_fill',
        message: result.success ? '表单填写成功' : (result.error || '表单填写失败'),
        details: {
          output: result.extractedText || undefined,
        },
      };
    } catch (error) {
      logger.warn({ error }, 'BrowserAgent not available');
      return {
        success: false,
        type: 'web_form_fill',
        message: '表单自动填写功能暂不可用，请手动填写',
      };
    }
  }

  /**
   * 处理自定义任务
   */
  private async handleCustomTask(task: PCTaskRequest): Promise<PCTaskResult> {
    const { description } = task;

    // 智能分析描述，尝试匹配已知任务类型
    if (/(网络|连接|连通|连通性|诊断|ping)/iu.test(description)) {
      return this.handleSystemOptimize({ ...task, type: 'system_optimize' });
    }

    if (description.includes('桌面') || description.includes('文件')) {
      return this.handleFileOrganize({ ...task, type: 'file_organize' });
    }

    if (description.includes('文档') || description.includes('报告') || description.includes('合同')) {
      return this.handleDocumentGenerate(task);
    }

    if (description.includes('PPT') || description.includes('演示')) {
      return this.handlePPTCreate(task);
    }

    if (description.includes('优化') || description.includes('清理') || description.includes('清理')) {
      return this.handleSystemOptimize(task);
    }

    if (description.includes('代码') || description.includes('编程') || description.includes('程序')) {
      if (description.includes('打开') || description.includes('启动')) {
        return this.handleProjectOpen(task);
      }
      return this.handleCodeCreate(task);
    }

    return {
      success: false,
      type: 'custom',
      message: `无法理解任务: ${description}`,
    };
  }

  /**
   * 获取PC端能力列表
   */
  public getCapabilities(): {
    fileOrganize: string[];
    documentTemplates: string[];
    systemOperations: string[];
    programmingLanguages: string[];
  } {
    return {
      fileOrganize: [
        '扫描目录',
        '按类型分类',
        '按日期分类',
        '查找项目文件',
        '查找政府申报文件',
        '桌面整理',
        '文件归档',
      ],
      documentTemplates: officeAutomationService.getTemplates().map(t => t.name),
      systemOperations: [
        '获取系统信息',
        '安装软件',
        '卸载软件',
        '清理临时文件',
        '清理浏览器缓存',
        '查看进程',
        '结束进程',
        '测试网络连接',
        '打开系统设置',
      ],
      programmingLanguages: Object.keys(SUPPORTED_LANGUAGES || {}),
    };
  }
}

export const pcAgent = PCAgent.getInstance();
export default pcAgent;
