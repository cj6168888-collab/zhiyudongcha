/**
 * AI 助手集成模块 - AIAssistantIntegration
 *
 * 将 OpenClaw 技能系统集成到 AI 对话中
 * 自动检测用户意图并调用相应技能
 *
 * @version 1.0.0
 * @date 2026-03-18
 */

import { getSkillEngine, type SkillResult } from './ai-skill-engine';

// 意图识别关键词
const intentKeywords: Record<string, string[]> = {
  openclaw_control: [
    '打开', '关闭', '截图', '截屏', '点击', '双击', '滚动',
    '最小化', '最大化', '全屏', '刷新', '保存', '复制', '粘贴',
    '切换标签', '新建标签', '关闭窗口', '输入', '打字'
  ],
  openclaw_app: [
    '启动', '运行', '打开应用', '关闭应用',
    '微信', '钉钉', '浏览器', '记事本', '计算器', '文件管理器'
  ],
  openclaw_task: [
    '执行任务', '运行任务', '开始任务', '停止任务',
    '定时任务', '自动化'
  ],
  openclaw_device: [
    '设备列表', '连接设备', '断开连接', '查看设备',
    '电脑状态', '屏幕'
  ]
};

/**
 * 意图检测结果
 */
export interface IntentDetectionResult {
  intent: string;
  confidence: number;
  matchedKeyword: string;
  skillId?: string;
  params?: Record<string, unknown>;
}

/**
 * AI 助手集成服务
 */
class AIAssistantIntegration {
  private static instance: AIAssistantIntegration;
  private enabled: boolean = true;

  private constructor() {}

  public static getInstance(): AIAssistantIntegration {
    if (!AIAssistantIntegration.instance) {
      AIAssistantIntegration.instance = new AIAssistantIntegration();
    }
    return AIAssistantIntegration.instance;
  }

  /**
   * 启用/禁用集成
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  /**
   * 检测用户消息意图
   */
  detectIntent(userMessage: string): IntentDetectionResult | null {
    if (!this.enabled) return null;

    const lowerMessage = userMessage.toLowerCase();

    // 检查每个意图类别
    for (const [intent, keywords] of Object.entries(intentKeywords)) {
      for (const keyword of keywords) {
        if (lowerMessage.includes(keyword.toLowerCase())) {
          // 尝试匹配技能
          const skillEngine = getSkillEngine();
          const fuzzyResults = skillEngine.fuzzyMatch(keyword);

          if (fuzzyResults.length > 0 && fuzzyResults[0].score > 50) {
            return {
              intent,
              confidence: fuzzyResults[0].score / 100,
              matchedKeyword: keyword,
              skillId: fuzzyResults[0].skill.id
            };
          }

          return {
            intent,
            confidence: 0.8,
            matchedKeyword: keyword
          };
        }
      }
    }

    return null;
  }

  /**
   * 处理用户消息
   * 如果检测到 OpenClaw 意图，执行相应技能
   * 返回处理结果和建议的回复
   */
  async processMessage(userMessage: string): Promise<{
    shouldExecute: boolean;
    intent: IntentDetectionResult | null;
    skillResult?: SkillResult;
    suggestedResponse?: string;
  }> {
    const intent = this.detectIntent(userMessage);

    if (!intent || !intent.skillId) {
      return {
        shouldExecute: false,
        intent
      };
    }

    // 执行匹配的技能
    const skillEngine = getSkillEngine();
    const skill = skillEngine.getAllSkills().find(s => s.id === intent.skillId);

    if (!skill) {
      return {
        shouldExecute: false,
        intent,
        suggestedResponse: '抱歉，我没有找到匹配的操作技能。'
      };
    }

    // 从消息中提取参数
    const params = this.extractParams(userMessage, skill.patterns);

    try {
      const result = await skill.execute(params);

      // 生成建议回复
      const suggestedResponse = this.generateResponse(intent, result);

      return {
        shouldExecute: true,
        intent,
        skillResult: result,
        suggestedResponse
      };
    } catch (error) {
      return {
        shouldExecute: true,
        intent,
        skillResult: {
          success: false,
          error: error instanceof Error ? error.message : '执行失败',
          duration: 0
        },
        suggestedResponse: '执行过程中出现错误，请稍后重试。'
      };
    }
  }

  /**
   * 从用户消息中提取参数
   */
  private extractParams(message: string, patterns: string[]): Record<string, unknown> {
    const params: Record<string, unknown> = {};
    const lowerMessage = message.toLowerCase();

    // 从模式中提取参数模板
    for (const pattern of patterns) {
      const paramMatches = pattern.match(/\{(\w+)\}/g);
      if (!paramMatches) continue;

      for (const match of paramMatches) {
        const paramName = match.replace(/[{}]/g, '');

        // 尝试从消息中提取参数值
        // 例如: "打开微信" -> {app: "微信"}
        const patternsToTry = [
          new RegExp(`打开.?(.+)`),
          new RegExp(`运行.?(.+)`),
          new RegExp(`输入(.+)`),
          new RegExp(`点击.?(\\d+)[,\\s]+(\\d+)`),
        ];

        for (const regex of patternsToTry) {
          const msgMatch = lowerMessage.match(regex);
          if (msgMatch && msgMatch[1]) {
            if (paramName === 'app') {
              params.app = msgMatch[1].trim();
            } else if (paramName === 'text') {
              params.text = msgMatch[1].trim();
            } else if (paramName === 'x' || paramName === 'y') {
              const nums = msgMatch[1].match(/\d+/g);
              if (nums && nums.length >= 2) {
                params.x = parseInt(nums[0]);
                params.y = parseInt(nums[1]);
              }
            }
          }
        }
      }
    }

    return params;
  }

  /**
   * 生成建议回复
   */
  private generateResponse(intent: IntentDetectionResult, result: SkillResult): string {
    if (result.success) {
      const actionResponses: Record<string, string> = {
        'screenshot': '截图已完成',
        'open_app': '应用已打开',
        'close_window': '窗口已关闭',
        'type_text': '文本已输入',
        'hotkey': '快捷键已执行',
        'run_task': '任务已开始执行',
        'click': '点击操作已完成',
        'double_click': '双击操作已完成',
        'scroll': '滚动已完成',
        'minimize_window': '窗口已最小化',
        'maximize_window': '窗口已最大化',
        'refresh': '页面已刷新',
        'save': '已保存',
        'select_all': '已全选',
        'switch_tab': '已切换标签页'
      };

      return actionResponses[intent.skillId || ''] || '操作已完成';
    } else {
      return result.error || '操作执行失败';
    }
  }

  /**
   * 获取可用的 OpenClaw 技能列表（用于展示给用户）
   */
  getAvailableSkills() {
    const skillEngine = getSkillEngine();
    const skills = skillEngine.getAllSkills();

    return skills.map(skill => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      category: skill.category,
      examplePhrases: skill.patterns.slice(0, 3).map(p => p.replace(/[{}]/g, ''))
    }));
  }
}

// 导出单例
export const aiAssistantIntegration = AIAssistantIntegration.getInstance();
export default aiAssistantIntegration;

// 重新导出 SkillResult 类型以供其他模块使用
export type { SkillResult } from './ai-skill-engine';
