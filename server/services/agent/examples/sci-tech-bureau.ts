/**
 * 科技局申报监控 - 完整示例
 *
 * 展示如何使用自主 Agent 系统完成：
 * 1. 整理桌面文件
 * 2. 找出项目相关文件归档
 * 3. 查找科技局申报资料
 * 4. 整理申报材料
 * 5. 上报给科技局
 * 6. 监控回复并通知
 */

import { autonomousAgent, browserAgent, governmentFormService } from './index';
import { createServiceLogger } from '../../lib/logger';
const logger = createServiceLogger('SciTechBureauExample');

/**
 * 创建科技局申报监控任务
 */
export async function createSciTechBureauMonitorTask(userId: string): Promise<string> {

  const taskId = await autonomousAgent.createTask({
    name: '科技局申报监控系统',
    description: '自动监控科技局网站申报状态，及时通知用户新回复',
    type: 'scheduled',
    schedule: '0 */4 * * *',  // 每4小时执行一次

    context: {
      userId,
      websiteName: '科技局申报系统',
      // 可以添加更多上下文信息
    },

    // 启用自我反思和自动升级
    enableReflection: true,
    autoUpgradeOnFailure: true,
    maxIterations: 15,

    steps: [
      // ===== 步骤1: 登录科技局网站 =====
      {
        id: 'login',
        name: '登录科技局网站',
        type: 'browser',
        config: {
          profileId: 'sci-tech-profile',
          actions: [
            { type: 'navigate', value: 'https://kjj.xxx.gov.cn/login', timeout: 30000 },
            { type: 'wait_for_selector', selector: '#username', timeout: 10000 },
            { type: 'type', selector: '#username', value: '{{credentials.username}}' },
            { type: 'type', selector: '#password', value: '{{credentials.password}}' },
            { type: 'click', selector: '#loginBtn' },
            { type: 'wait_for_navigation', options: { waitUntil: 'networkidle' }, timeout: 15000 },
          ]
        },
        maxRetries: 2,
        onSuccess: 'check-applications',
        onFailure: 'report-login-failed',
      },

      // ===== 步骤2: 检查申报列表 =====
      {
        id: 'check-applications',
        name: '检查申报项目列表',
        type: 'browser',
        config: {
          actions: [
            { type: 'navigate', value: 'https://kjj.xxx.gov.cn/my-projects', timeout: 30000 },
            { type: 'wait_for_selector', selector: '.project-list', timeout: 15000 },
          ]
        },
        onSuccess: 'extract-status',
      },

      // ===== 步骤3: AI 提取申报状态 =====
      {
        id: 'extract-status',
        name: 'AI提取申报状态',
        type: 'ai_analyze',
        config: {
          systemPrompt: `你是一个政府申报系统分析助手。分析页面内容，提取申报项目信息。

          返回JSON格式：
          {
            "projects": [
              {
                "name": "项目名称",
                "status": "待审核/已通过/已驳回/补充材料",
                "submitDate": "提交日期",
                "lastUpdate": "最后更新日期",
                "hasNewReply": true/false,
                "replySummary": "回复摘要（如果有）"
              }
            ],
            "totalCount": 数量
          }`,
          prompt: `请分析以下页面内容，提取所有申报项目的状态信息：

          {{lastPageContent}}`,
          outputFormat: 'json',
          temperature: 0.3,
        },
        onSuccess: 'analyze-changes',
      },

      // ===== 步骤4: AI 分析是否有新变化 =====
      {
        id: 'analyze-changes',
        name: '分析申报状态变化',
        type: 'ai_analyze',
        config: {
          systemPrompt: `你是一个智能分析助手。分析申报状态，找出需要关注的变化。`,
          prompt: `分析以下申报状态数据：

          当前申报状态：
          {{step_extract-status_result}}

          上次检查状态（如果有）：
          {{lastCheckResult}}

          找出：
          1. 有新回复/状态变化的项目
          2. 需要用户立即关注的重要事项
          3. 建议采取的行动

          返回JSON格式：
          {
            "newReplies": [
              {
                "projectName": "项目名",
                "previousStatus": "之前状态",
                "newStatus": "新状态",
                "urgency": "high/medium/low",
                "actionRequired": "需要的行动"
              }
            ],
            "importantAlerts": ["重要提醒1", "重要提醒2"],
            "summary": "总体情况摘要"
          }`,
          outputFormat: 'json',
        },
        onSuccess: 'check-email',
      },

      // ===== 步骤5: 检查相关邮件 =====
      {
        id: 'check-email',
        name: '检查相关邮件',
        type: 'email',
        config: {
          action: 'check_new',
        },
        onSuccess: 'generate-report',
      },

      // ===== 步骤6: AI 生成汇报 =====
      {
        id: 'generate-report',
        name: '生成汇报内容',
        type: 'ai_analyze',
        config: {
          systemPrompt: '你是一个专业的秘书助手，生成简洁清晰的中文汇报。',
          prompt: `基于以下信息生成汇报：

          申报状态变化：
          {{step_analyze-changes_result}}

          相关邮件：
          {{step_check-email_result}}

          请生成：
          1. 简明扼要的汇报标题
          2. 关键变化摘要（3句话以内）
          3. 每个需要关注项目的简短说明
          4. 建议采取的行动清单
          5. 相关邮件摘要（如有）

          格式要简洁，适合短信/App推送阅读。`,
          temperature: 0.5,
        },
        onSuccess: 'report-user',
      },

      // ===== 步骤7: 汇报给用户 =====
      {
        id: 'report-user',
        name: '汇报给用户',
        type: 'report',
        config: {
          title: '科技局申报状态更新',
          template: '{{step_generate-report_result}}',
          channels: ['app', 'email'],
        },
      },

      // ===== 失败处理: 登录失败 =====
      {
        id: 'report-login-failed',
        name: '登录失败汇报',
        type: 'report',
        config: {
          title: '科技局网站登录失败',
          template: '无法登录科技局申报系统，请检查账号密码或网站是否可访问。',
          channels: ['app', 'sms'],
        },
      },

      // ===== 条件判断: 是否有新变化 =====
      {
        id: 'check-if-changes',
        name: '判断是否有变化',
        type: 'condition',
        config: {
          condition: '{{step_analyze-changes_result.newReplies.length}} > 0',
        },
        onSuccess: 'report-user',
        onFailure: 'log-check-complete',
      },

      // ===== 日志记录 =====
      {
        id: 'log-check-complete',
        name: '记录检查完成',
        type: 'ai_analyze',
        config: {
          prompt: '记录本次检查完成，无新变化',
        },
      },
    ],

    createdBy: userId,
    tags: ['科技局', '申报监控', '自动化'],
  });

  logger.info({ taskId }, 'Sci-tech bureau monitor task created');
  return taskId;
}

/**
 * 创建桌面文件整理任务
 */
export async function createDesktopFileOrganizeTask(userId: string): Promise<string> {

  const taskId = await autonomousAgent.createTask({
    name: '桌面文件整理',
    description: '整理桌面文件，项目相关文件归档',
    type: 'one-time',

    context: {
      userId,
      desktopPath: 'C:\\Users\\' + process.env.USERNAME + '\\Desktop',
      projectKeywords: ['项目', '申报', '合同', '方案'],
    },

    enableReflection: true,
    autoUpgradeOnFailure: true,

    steps: [
      {
        id: 'scan-desktop',
        name: '扫描桌面文件',
        type: 'ai_analyze',
        config: {
          systemPrompt: '你是一个文件管理专家，分析桌面文件并制定整理方案。',
          prompt: `分析以下桌面文件列表，制定整理方案：

          文件列表：{{desktopFiles}}

          整理要求：
          1. 识别项目相关文件（包含项目、申报、合同等关键词）
          2. 识别科技局申报相关文件
          3. 识别临时文件（下载、缓存等）
          4. 制定分类归档方案

          返回JSON格式：
          {
            "projectFiles": ["文件路径1", "文件路径2"],
            "sciTechFiles": ["科技局相关文件"],
            "tempFiles": ["临时文件"],
            "archivePlan": {
              "项目资料": ["file1", "file2"],
              "科技局申报": ["file3"],
              "临时文件": ["file4"]
            },
            "totalFiles": 数量,
            "estimatedCleanupSize": "MB"
          }`,
          outputFormat: 'json',
        },
        onSuccess: 'execute-archive',
      },

      {
        id: 'execute-archive',
        name: '执行归档',
        type: 'browser',
        config: {
          // 实际应该调用文件系统操作，这里用浏览器模拟
          actions: [
            { type: 'navigate', value: 'file:///C:/Users/{{username}}/Desktop' },
          ]
        },
        onSuccess: 'generate-archive-report',
      },

      {
        id: 'generate-archive-report',
        name: '生成整理报告',
        type: 'ai_analyze',
        config: {
          prompt: `桌面文件整理完成，生成简要报告：

          整理结果：{{step_scan-desktop_result}}`,
        },
        onSuccess: 'report-organize-complete',
      },

      {
        id: 'report-organize-complete',
        name: '汇报整理结果',
        type: 'report',
        config: {
          title: '桌面文件整理完成',
          channels: ['app'],
        },
      },
    ],

    createdBy: userId,
    tags: ['文件整理', '自动化'],
  });

  logger.info({ taskId }, 'Desktop organize task created');
  return taskId;
}

/**
 * 创建完整的科技局申报流程任务
 */
export async function createFullApplicationTask(
  userId: string,
  websiteId: string,
  profileId: string,
  companyInfo: Record<string, unknown>,
  projectData: Record<string, unknown>
): Promise<string> {

  const taskId = await autonomousAgent.createTask({
    name: '科技局项目申报',
    description: '完成科技局项目申报全流程',
    type: 'one-time',

    context: {
      userId,
      websiteId,
      profileId,
      companyInfo,
      projectData,
    },

    enableReflection: true,
    autoUpgradeOnFailure: true,

    steps: [
      // 1. 登录网站
      {
        id: 'login-gov',
        name: '登录政府网站',
        type: 'browser',
        config: {
          actions: [
            { type: 'navigate', value: '{{loginUrl}}' },
            { type: 'wait_for_selector', selector: '#username' },
            { type: 'type', selector: '#username', value: '{{credentials.username}}' },
            { type: 'type', selector: '#password', value: '{{credentials.password}}' },
            { type: 'click', selector: '#loginBtn' },
          ]
        },
        onSuccess: 'prepare-docs',
      },

      // 2. 准备材料
      {
        id: 'prepare-docs',
        name: '整理申报材料',
        type: 'ai_analyze',
        config: {
          prompt: `根据以下项目信息，整理申报材料清单：

          公司信息：{{companyInfo}}
          项目信息：{{projectData}}

          返回所需材料清单：`,
        },
        onSuccess: 'upload-docs',
      },

      // 3. 上传材料
      {
        id: 'upload-docs',
        name: '上传申报材料',
        type: 'browser',
        config: {
          actions: [
            { type: 'navigate', value: '{{uploadUrl}}' },
          ]
        },
        onSuccess: 'fill-form',
      },

      // 4. 填写表单
      {
        id: 'fill-form',
        name: '填写申报表单',
        type: 'ai_decide',
        config: {
          options: ['use-company-info', 'ask-user', 'skip-field'],
          prompt: `根据以下信息决定如何填写表单字段：

          {{currentField}}
          {{companyInfo}}`,
        },
        onSuccess: 'submit-application',
      },

      // 5. 提交申报
      {
        id: 'submit-application',
        name: '提交申报',
        type: 'browser',
        config: {
          actions: [
            { type: 'click', selector: '#submitBtn' },
            { type: 'wait', value: 2000 },
            { type: 'screenshot' },
          ]
        },
        onSuccess: 'save-application-id',
      },

      // 6. 保存申报号
      {
        id: 'save-application-id',
        name: '保存申报号',
        type: 'ai_analyze',
        config: {
          prompt: '从页面内容中提取申报号或申请编号',
        },
        onSuccess: 'create-monitor-task',
      },

      // 7. 创建监控任务
      {
        id: 'create-monitor-task',
        name: '创建状态监控任务',
        type: 'ai_decide',
        config: {
          options: ['create-monitor', 'no-monitor'],
          prompt: '是否需要创建后续状态监控任务？',
        },
        onSuccess: 'final-report',
      },

      // 8. 最终汇报
      {
        id: 'final-report',
        name: '申报完成汇报',
        type: 'report',
        config: {
          title: '科技局申报提交成功',
          channels: ['app', 'email', 'sms'],
        },
      },
    ],

    createdBy: userId,
    tags: ['科技局', '申报', '自动化'],
  });

  logger.info({ taskId }, 'Full application task created');
  return taskId;
}

/**
 * 语音指令处理器
 * 将用户的语音指令转换为 Agent 任务
 */
export async function processVoiceCommand(
  text: string,
  userId: string
): Promise<{ taskId?: string; message: string }> {

  // 使用 AI 分析语音指令
  const response = await autonomousAgent.executeTask('voice-command-analyzer', {
    command: text,
    userId,
  });

  // 根据分析结果创建任务
  const intent = response.stepResults.get('parse-intent')?.output;

  if (intent?.type === 'sci-tech-monitor') {
    const taskId = await createSciTechBureauMonitorTask(userId);
    return {
      taskId,
      message: '好的，我已经创建了科技局申报监控任务，每4小时自动检查一次。有新回复会立即通知您。',
    };
  }

  if (intent?.type === 'desktop-organize') {
    const taskId = await createDesktopFileOrganizeTask(userId);
    return {
      taskId,
      message: '好的，正在整理您的桌面文件，请稍候...',
    };
  }

  if (intent?.type === 'full-application') {
    const taskId = await createFullApplicationTask(
      userId,
      intent.websiteId,
      intent.profileId,
      intent.companyInfo,
      intent.projectData
    );
    return {
      taskId,
      message: `好的，开始执行科技局项目申报。申报号：${intent.applicationId}。后续我会持续监控申报状态。`,
    };
  }

  return {
    message: '抱歉，我没能理解您的指令。请再说一遍，或者告诉我您想做什么？',
  };
}
