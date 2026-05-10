/**
 * PC Agent API 路由
 * 提供PC端操作接口
 */

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { pcAgent } from '../services/pc-agent/PCAgent';
import { fileOrganizerService } from '../services/pc-agent/FileOrganizerService';
import { officeAutomationService } from '../services/pc-agent/OfficeAutomationService';
import { systemOperationService } from '../services/pc-agent/SystemOperationService';
import { programmingAssistantService } from '../services/pc-agent/ProgrammingAssistantService';
import { createServiceLogger } from '../lib/logger';

const router = Router();
const logger = createServiceLogger('PCAgentAPI');

// 验证中间件
const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// ============================================
// 文件整理接口
// ============================================

/**
 * 扫描目录
 * POST /api/pc-agent/files/scan
 */
router.post('/files/scan',
  body('path').isString().notEmpty(),
  body('recursive').optional().isBoolean(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const { path, recursive = false } = req.body;
      const files = await fileOrganizerService.scanDirectory(path, recursive);
      res.json({ success: true, data: files, total: files.length });
    } catch (error) {
      logger.error({ error }, 'Failed to scan directory');
      res.status(500).json({ success: false, error: '扫描失败' });
    }
  }
);

/**
 * 查找政府申报文件
 * POST /api/pc-agent/files/government
 */
router.post('/files/government',
  body('path').optional().isString(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const basePath = req.body.path ||
        (process.platform === 'win32'
          ? `${process.env.USERPROFILE}\\Desktop`
          : `${process.env.HOME}/Desktop`);
      const files = await fileOrganizerService.findGovernmentFiles(basePath);
      res.json({ success: true, data: files, total: files.length });
    } catch (error) {
      logger.error({ error }, 'Failed to find government files');
      res.status(500).json({ success: false, error: '查找失败' });
    }
  }
);

/**
 * 查找项目文件
 * POST /api/pc-agent/files/project
 */
router.post('/files/project',
  body('path').optional().isString(),
  body('name').isString().notEmpty(),
  body('keywords').optional().isArray(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const basePath = req.body.path ||
        (process.platform === 'win32'
          ? `${process.env.USERPROFILE}\\Desktop`
          : `${process.env.HOME}/Desktop`);
      const files = await fileOrganizerService.findProjectFiles(
        basePath,
        req.body.name,
        req.body.keywords || []
      );
      res.json({ success: true, data: files, total: files.length });
    } catch (error) {
      logger.error({ error }, 'Failed to find project files');
      res.status(500).json({ success: false, error: '查找失败' });
    }
  }
);

/**
 * 整理桌面
 * POST /api/pc-agent/files/organize
 */
router.post('/files/organize',
  body('action').optional().isIn(['move', 'copy']),
  body('dryRun').optional().isBoolean(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const result = await fileOrganizerService.organizeDesktop({
        action: req.body.action || 'move',
        dryRun: req.body.dryRun || false,
      });
      res.json({ success: result.success, data: result });
    } catch (error) {
      logger.error({ error }, 'Failed to organize desktop');
      res.status(500).json({ success: false, error: '整理失败' });
    }
  }
);

/**
 * 获取文件统计
 * POST /api/pc-agent/files/stats
 */
router.post('/files/stats',
  body('path').isString().notEmpty(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const stats = await fileOrganizerService.getFileStats(req.body.path);
      res.json({ success: true, data: stats });
    } catch (error) {
      logger.error({ error }, 'Failed to get file stats');
      res.status(500).json({ success: false, error: '获取统计失败' });
    }
  }
);

// ============================================
// 文档生成接口
// ============================================

/**
 * 获取文档模板列表
 * GET /api/pc-agent/documents/templates
 */
router.get('/documents/templates', async (req: Request, res: Response) => {
  try {
    const templates = officeAutomationService.getTemplates();
    res.json({ success: true, data: templates });
  } catch (error) {
    logger.error({ error }, 'Failed to get templates');
    res.status(500).json({ success: false, error: '获取模板失败' });
  }
});

/**
 * 生成文档
 * POST /api/pc-agent/documents/generate
 */
router.post('/documents/generate',
  body('templateId').optional().isString(),
  body('title').optional().isString(),
  body('variables').isObject(),
  body('format').optional().isIn(['docx', 'pdf', 'html', 'md']),
  body('style').optional().isIn(['formal', 'simple', 'modern']),
  validate,
  async (req: Request, res: Response) => {
    try {
      const result = await officeAutomationService.generateDocument({
        templateId: req.body.templateId,
        title: req.body.title,
        variables: req.body.variables,
        format: req.body.format || 'md',
        style: req.body.style || 'formal',
      });
      res.json({ success: result.success, data: result });
    } catch (error) {
      logger.error({ error }, 'Failed to generate document');
      res.status(500).json({ success: false, error: '文档生成失败' });
    }
  }
);

/**
 * 格式化文档
 * POST /api/pc-agent/documents/format
 */
router.post('/documents/format',
  body('filePath').isString().notEmpty(),
  body('options').optional().isObject(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const result = await officeAutomationService.formatDocument(
        req.body.filePath,
        req.body.options || {}
      );
      res.json({ success: result.success, data: result });
    } catch (error) {
      logger.error({ error }, 'Failed to format document');
      res.status(500).json({ success: false, error: '文档格式化失败' });
    }
  }
);

/**
 * 生成PPT
 * POST /api/pc-agent/documents/ppt
 */
router.post('/documents/ppt',
  body('title').isString().notEmpty(),
  body('slides').isArray(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const result = await officeAutomationService.generatePPT(
        req.body.title,
        req.body.slides
      );
      res.json({ success: result.success, data: result });
    } catch (error) {
      logger.error({ error }, 'Failed to generate PPT');
      res.status(500).json({ success: false, error: 'PPT生成失败' });
    }
  }
);

/**
 * 打开文档
 * POST /api/pc-agent/documents/open
 */
router.post('/documents/open',
  body('filePath').isString().notEmpty(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const success = await officeAutomationService.openDocument(req.body.filePath);
      res.json({ success, message: success ? '文档已打开' : '打开失败' });
    } catch (error) {
      logger.error({ error }, 'Failed to open document');
      res.status(500).json({ success: false, error: '打开文档失败' });
    }
  }
);

// ============================================
// 系统操作接口
// ============================================

/**
 * 获取系统信息
 * GET /api/pc-agent/system/info
 */
router.get('/system/info', async (req: Request, res: Response) => {
  try {
    const info = systemOperationService.getSystemInfo();
    res.json({ success: true, data: info });
  } catch (error) {
    logger.error({ error }, 'Failed to get system info');
    res.status(500).json({ success: false, error: '获取系统信息失败' });
  }
});

/**
 * 获取进程列表
 * GET /api/pc-agent/system/processes
 */
router.get('/system/processes', async (req: Request, res: Response) => {
  try {
    const processes = await systemOperationService.getProcessList();
    res.json({ success: true, data: processes });
  } catch (error) {
    logger.error({ error }, 'Failed to get processes');
    res.status(500).json({ success: false, error: '获取进程失败' });
  }
});

/**
 * 结束进程
 * POST /api/pc-agent/system/processes/kill
 */
router.post('/system/processes/kill',
  body('pid').isInt({ min: 1 }),
  validate,
  async (req: Request, res: Response) => {
    try {
      const success = await systemOperationService.killProcess(req.body.pid);
      res.json({ success, message: success ? '进程已结束' : '结束进程失败' });
    } catch (error) {
      logger.error({ error }, 'Failed to kill process');
      res.status(500).json({ success: false, error: '结束进程失败' });
    }
  }
);

/**
 * 获取网络信息
 * GET /api/pc-agent/system/network
 */
router.get('/system/network', async (req: Request, res: Response) => {
  try {
    const info = await systemOperationService.getNetworkInfo();
    res.json({ success: true, data: info });
  } catch (error) {
    logger.error({ error }, 'Failed to get network info');
    res.status(500).json({ success: false, error: '获取网络信息失败' });
  }
});

/**
 * 测试网络连接
 * POST /api/pc-agent/system/network/test
 */
router.post('/system/network/test',
  body('host').isString().notEmpty(),
  body('port').optional().isInt({ min: 1, max: 65535 }),
  validate,
  async (req: Request, res: Response) => {
    try {
      const result = await systemOperationService.testConnection(
        req.body.host,
        req.body.port || 80
      );
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ error }, 'Failed to test connection');
      res.status(500).json({ success: false, error: '网络测试失败' });
    }
  }
);

/**
 * 获取已安装软件列表
 * GET /api/pc-agent/system/software
 */
router.get('/system/software', async (req: Request, res: Response) => {
  try {
    const software = await systemOperationService.getInstalledSoftware();
    res.json({ success: true, data: software, total: software.length });
  } catch (error) {
    logger.error({ error }, 'Failed to get software list');
    res.status(500).json({ success: false, error: '获取软件列表失败' });
  }
});

/**
 * 安装软件
 * POST /api/pc-agent/system/software/install
 */
router.post('/system/software/install',
  body('path').isString().notEmpty(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const result = await systemOperationService.installSoftware(req.body.path);
      res.json({ success: result.success, message: result.message });
    } catch (error) {
      logger.error({ error }, 'Failed to install software');
      res.status(500).json({ success: false, error: '安装失败' });
    }
  }
);

/**
 * 卸载软件
 * POST /api/pc-agent/system/software/uninstall
 */
router.post('/system/software/uninstall',
  body('name').isString().notEmpty(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const result = await systemOperationService.uninstallSoftware(req.body.name);
      res.json({ success: result.success, message: result.message });
    } catch (error) {
      logger.error({ error }, 'Failed to uninstall software');
      res.status(500).json({ success: false, error: '卸载失败' });
    }
  }
);

/**
 * 清理临时文件
 * POST /api/pc-agent/system/clean/temp
 */
router.post('/system/clean/temp', async (req: Request, res: Response) => {
  try {
    const result = await systemOperationService.cleanTempFiles();
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error }, 'Failed to clean temp files');
    res.status(500).json({ success: false, error: '清理失败' });
  }
});

/**
 * 清理浏览器缓存
 * POST /api/pc-agent/system/clean/cache
 */
router.post('/system/clean/cache', async (req: Request, res: Response) => {
  try {
    const result = await systemOperationService.cleanBrowserCache();
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error }, 'Failed to clean browser cache');
    res.status(500).json({ success: false, error: '清理失败' });
  }
});

/**
 * 获取优化建议
 * GET /api/pc-agent/system/optimize/suggestions
 */
router.get('/system/optimize/suggestions', async (req: Request, res: Response) => {
  try {
    const suggestions = systemOperationService.getOptimizationSuggestions();
    res.json({ success: true, data: suggestions });
  } catch (error) {
    logger.error({ error }, 'Failed to get suggestions');
    res.status(500).json({ success: false, error: '获取建议失败' });
  }
});

/**
 * 打开系统设置
 * POST /api/pc-agent/system/settings/open
 */
router.post('/system/settings/open',
  body('category').isString().notEmpty(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const success = await systemOperationService.openSettings(req.body.category);
      res.json({ success, message: success ? '设置已打开' : '打开失败' });
    } catch (error) {
      logger.error({ error }, 'Failed to open settings');
      res.status(500).json({ success: false, error: '打开设置失败' });
    }
  }
);

/**
 * 执行命令
 * POST /api/pc-agent/system/command
 */
router.post('/system/command',
  body('command').isString().notEmpty(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const result = await systemOperationService.runCommand(req.body.command);
      res.json({ success: result.success, data: result });
    } catch (error) {
      logger.error({ error }, 'Failed to run command');
      res.status(500).json({ success: false, error: '命令执行失败' });
    }
  }
);

// ============================================
// 编程辅助接口
// ============================================

/**
 * 打开文件
 * POST /api/pc-agent/code/open
 */
router.post('/code/open',
  body('filePath').isString().notEmpty(),
  body('line').optional().isInt({ min: 1 }),
  validate,
  async (req: Request, res: Response) => {
    try {
      const success = await programmingAssistantService.openFile(
        req.body.filePath,
        req.body.line
      );
      res.json({ success, message: success ? '文件已打开' : '打开失败' });
    } catch (error) {
      logger.error({ error }, 'Failed to open file');
      res.status(500).json({ success: false, error: '打开文件失败' });
    }
  }
);

/**
 * 打开项目
 * POST /api/pc-agent/code/project
 */
router.post('/code/project',
  body('path').isString().notEmpty(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const success = await programmingAssistantService.openProject(req.body.path);
      res.json({ success, message: success ? '项目已打开' : '打开失败' });
    } catch (error) {
      logger.error({ error }, 'Failed to open project');
      res.status(500).json({ success: false, error: '打开项目失败' });
    }
  }
);

/**
 * 打开终端
 * POST /api/pc-agent/code/terminal
 */
router.post('/code/terminal',
  body('cwd').optional().isString(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const success = await programmingAssistantService.openTerminal(req.body.cwd);
      res.json({ success, message: success ? '终端已打开' : '打开失败' });
    } catch (error) {
      logger.error({ error }, 'Failed to open terminal');
      res.status(500).json({ success: false, error: '打开终端失败' });
    }
  }
);

/**
 * 创建代码文件
 * POST /api/pc-agent/code/create
 */
router.post('/code/create',
  body('filePath').isString().notEmpty(),
  body('language').isString().notEmpty(),
  body('template').optional().isString(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const success = await programmingAssistantService.createCodeFile(
        req.body.filePath,
        req.body.language,
        req.body.template
      );
      res.json({ success, message: success ? '代码文件已创建' : '创建失败' });
    } catch (error) {
      logger.error({ error }, 'Failed to create code file');
      res.status(500).json({ success: false, error: '创建代码文件失败' });
    }
  }
);

/**
 * 读取项目结构
 * POST /api/pc-agent/code/project/structure
 */
router.post('/code/project/structure',
  body('path').isString().notEmpty(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const info = await programmingAssistantService.readProjectStructure(req.body.path);
      res.json({ success: true, data: info });
    } catch (error) {
      logger.error({ error }, 'Failed to read project structure');
      res.status(500).json({ success: false, error: '读取项目结构失败' });
    }
  }
);

/**
 * 搜索代码文件
 * POST /api/pc-agent/code/search
 */
router.post('/code/search',
  body('projectPath').isString().notEmpty(),
  body('keyword').isString().notEmpty(),
  body('extensions').optional().isArray(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const files = await programmingAssistantService.searchCodeFiles(
        req.body.projectPath,
        req.body.keyword,
        { extensions: req.body.extensions }
      );
      res.json({ success: true, data: files, total: files.length });
    } catch (error) {
      logger.error({ error }, 'Failed to search code');
      res.status(500).json({ success: false, error: '搜索失败' });
    }
  }
);

/**
 * 读取代码文件
 * POST /api/pc-agent/code/read
 */
router.post('/code/read',
  body('filePath').isString().notEmpty(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const result = await programmingAssistantService.readCodeFile(req.body.filePath);
      if (result) {
        res.json({ success: true, data: result });
      } else {
        res.status(404).json({ success: false, error: '文件不存在' });
      }
    } catch (error) {
      logger.error({ error }, 'Failed to read code file');
      res.status(500).json({ success: false, error: '读取文件失败' });
    }
  }
);

/**
 * 获取Git状态
 * POST /api/pc-agent/code/git/status
 */
router.post('/code/git/status',
  body('projectPath').isString().notEmpty(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const status = await programmingAssistantService.getGitStatus(req.body.projectPath);
      res.json({ success: true, data: status });
    } catch (error) {
      logger.error({ error }, 'Failed to get git status');
      res.status(500).json({ success: false, error: '获取Git状态失败' });
    }
  }
);

/**
 * 创建项目
 * POST /api/pc-agent/code/project/create
 */
router.post('/code/project/create',
  body('name').isString().notEmpty(),
  body('language').isString().notEmpty(),
  body('framework').optional().isString(),
  body('location').optional().isString(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const result = await programmingAssistantService.createProject(
        req.body.name,
        req.body.language,
        {
          framework: req.body.framework,
          location: req.body.location,
        }
      );
      res.json({ success: result.success, data: result });
    } catch (error) {
      logger.error({ error }, 'Failed to create project');
      res.status(500).json({ success: false, error: '创建项目失败' });
    }
  }
);

// ============================================
// 统一任务执行接口
// ============================================

/**
 * 执行PC端任务
 * POST /api/pc-agent/execute
 */
router.post('/execute',
  body('type').isString().notEmpty(),
  body('description').isString().notEmpty(),
  body('params').optional().isObject(),
  body('priority').optional().isInt({ min: 0, max: 10 }),
  validate,
  async (req: Request, res: Response) => {
    try {
      const result = await pcAgent.executeTask({
        type: req.body.type,
        description: req.body.description,
        params: req.body.params || {},
        priority: req.body.priority || 0,
      });
      res.json({ success: result.success, data: result });
    } catch (error) {
      logger.error({ error }, 'Failed to execute PC task');
      res.status(500).json({ success: false, error: '任务执行失败' });
    }
  }
);

/**
 * 获取PC端能力列表
 * GET /api/pc-agent/capabilities
 */
router.get('/capabilities', async (req: Request, res: Response) => {
  try {
    const capabilities = pcAgent.getCapabilities();
    res.json({ success: true, data: capabilities });
  } catch (error) {
    logger.error({ error }, 'Failed to get capabilities');
    res.status(500).json({ success: false, error: '获取能力列表失败' });
  }
});

export default router;
