import { createServiceLogger } from '../../lib/logger';
import type { ProjectData, ProjectInsight } from './types';

const logger = createServiceLogger('ProjectAI');

export async function analyzeFileWithAI(content: string, fileName: string): Promise<string> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    return "AI分析功能未配置（缺少DASHSCOPE_API_KEY）";
  }

  try {
    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen-turbo',
        messages: [
          { role: 'system', content: '你是一个专业的文档分析助手。请分析以下文档内容，提取关键信息，识别风险点和机会点，并给出建议。回复使用中文。' },
          { role: 'user', content: `文件名: ${fileName}\n\n内容:\n${content.substring(0, 8000)}` }
        ],
        max_tokens: 2000,
      }),
    });

    const data = await response.json() as unknown;
    return data.choices?.[0]?.message?.content || '分析失败';
  } catch (error) {
    logger.error({ err: error }, '[AI Analysis] Error');
    return '分析过程中出现错误';
  }
}

export async function generateProjectInsights(projects: ProjectData[]): Promise<ProjectInsight[]> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  const insights: ProjectInsight[] = [];

  const pendingReview = projects.filter(p => p.status === 'PENDING_REVIEW');
  if (pendingReview.length > 0) {
    insights.push({
      type: 'action',
      title: `${pendingReview.length}个项目待审批`,
      content: `有${pendingReview.length}个项目等待您的审批决策，请尽快处理以免延误进度。`,
      priority: 'high',
    });
  }

  const onHold = projects.filter(p => p.status === 'ON_HOLD');
  if (onHold.length > 0) {
    insights.push({
      type: 'warning',
      title: `${onHold.length}个项目处于暂缓状态`,
      content: `暂缓项目可能存在阻碍因素，建议检查并制定恢复计划。`,
      priority: 'medium',
    });
  }

  const criticalProjects = projects.filter(p => {
    const priority = typeof p.priority === 'number' ? p.priority : 5;
    return priority <= 2;
  });
  if (criticalProjects.length > 0) {
    insights.push({
      type: 'info',
      title: `${criticalProjects.length}个紧急优先级项目`,
      content: `当前有${criticalProjects.length}个紧急项目需要重点关注。`,
      priority: 'high',
    });
  }

  if (apiKey && projects.length > 0) {
    try {
      const projectSummary = projects.slice(0, 10).map(p =>
        `- ${p.title || p.name || '未命名项目'} (状态: ${p.status || '未知'}, 优先级: ${p.priority || 5})`
      ).join('\n');

      const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen-turbo',
          messages: [
            {
              role: 'system',
              content: '你是一个项目管理AI助手。根据项目列表，提供1-2条简短的战略洞察和建议。每条建议不超过50字。直接给出建议，不要使用编号或前缀。用JSON数组格式返回，每个对象包含title和content字段。'
            },
            { role: 'user', content: `当前项目列表:\n${projectSummary}` }
          ],
          max_tokens: 500,
        }),
      });

      const data = await response.json() as unknown;
      const aiContent = data.choices?.[0]?.message?.content;

      if (aiContent) {
        try {
          const parsed = JSON.parse(aiContent);
          if (Array.isArray(parsed)) {
            for (const item of parsed.slice(0, 2)) {
              insights.push({
                type: 'opportunity',
                title: item.title || '战略建议',
                content: item.content || item.title,
                priority: 'medium',
              });
            }
          }
        } catch {
          insights.push({
            type: 'opportunity',
            title: 'AI战略洞察',
            content: aiContent.substring(0, 200),
            priority: 'medium',
          });
        }
      }
    } catch (error) {
      logger.error({ err: error }, '[AI Insights] Error');
    }
  }

  if (insights.length === 0) {
    insights.push({
      type: 'info',
      title: '项目状态正常',
      content: '当前所有项目运行正常，暂无需要特别关注的事项。',
      priority: 'low',
    });
  }

  return insights;
}
