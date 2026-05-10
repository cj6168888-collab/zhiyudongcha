import type { Express } from "express";
import type { IStorage } from "../../storage";
import { createServiceLogger } from '../../lib/logger';
import { requireAuth, requireMaster } from "../../middleware/auth";
import { z } from "zod";
import { projectService } from "../../services/ProjectService";

const logger = createServiceLogger('ProjectSWOT');

const smartCreateSchema = z.object({
  input: z.string(),
  files: z.array(z.object({
    name: z.string(),
    content: z.string(),
    type: z.string(),
  })).optional(),
  previousProject: z.unknown().optional(),
  feedback: z.string().optional(),
});

export function registerProjectSwotRoutes(app: Express, storage: IStorage): void {
  app.post("/api/projects/:id/generate-swot", requireAuth, async (req, res) => {
    try {
      const projectId = req.params.id;
      const project = await projectService.getProject(projectId);

      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const apiKey = process.env.DASHSCOPE_API_KEY;
      if (!apiKey) {
        return res.status(400).json({
          error: "AI功能未配置",
          message: "缺少DASHSCOPE_API_KEY，无法使用AI生成SWOT分析"
        });
      }

      const files = await projectService.getProjectFiles(projectId);
      const fileContext = files.map(f => `- ${f.fileName}: ${f.aiAnalysis || '无分析'}`).join('\n');

      const prompt = `请为以下项目生成详细的SWOT分析：

项目名称：${project.title}
项目描述：${project.description || '无描述'}
项目类别：${project.category}
当前状态：${project.status}
优先级：${project.priority}/10

已具备条件：
${project.currentConditions?.join('\n') || '无'}

欠缺条件：
${project.missingConditions?.join('\n') || '无'}

${files.length > 0 ? `相关文件分析：\n${fileContext}` : ''}

请按照以下JSON格式返回SWOT分析结果，每项至少3条具体分析：
{
  "strengths": ["优势1", "优势2", "优势3"],
  "weaknesses": ["劣势1", "劣势2", "劣势3"],
  "opportunities": ["机会1", "机会2", "机会3"],
  "threats": ["威胁1", "威胁2", "威胁3"]
}

只返回JSON，不要其他文字。`;

      const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen-turbo',
          messages: [
            { role: 'system', content: '你是一个专业的项目管理和战略分析专家。请根据项目信息提供准确、专业的SWOT分析。返回纯JSON格式。' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 2000,
        }),
      });

      const data = await response.json() as unknown;
      const content = data.choices?.[0]?.message?.content || '';

      let swotAnalysis;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          swotAnalysis = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found');
        }
      } catch (parseError) {
        logger.error({ content }, '[SWOT] Failed to parse AI response');
        return res.status(500).json({
          error: "AI响应解析失败",
          message: "无法解析AI生成的SWOT分析结果"
        });
      }

      const validSwot = {
        strengths: Array.isArray(swotAnalysis.strengths) ? swotAnalysis.strengths : [],
        weaknesses: Array.isArray(swotAnalysis.weaknesses) ? swotAnalysis.weaknesses : [],
        opportunities: Array.isArray(swotAnalysis.opportunities) ? swotAnalysis.opportunities : [],
        threats: Array.isArray(swotAnalysis.threats) ? swotAnalysis.threats : [],
      };

      const updatedProject = await projectService.updateProject(projectId, {
        swotAnalysis: validSwot
      });

      return res.json({
        success: true,
        swotAnalysis: validSwot,
        project: updatedProject,
      });
    } catch (error) {
      logger.error({ err: error }, '[SWOT] Generation error');
      return res.status(500).json({ error: "Failed to generate SWOT analysis" });
    }
  });

  app.post("/api/projects/smart-create", requireMaster, async (req, res) => {
    try {
      const parsed = smartCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "参数验证失败" });
      }

      const { input, files, previousProject, feedback } = parsed.data;

      const apiKey = process.env.DASHSCOPE_API_KEY;
      if (!apiKey) {
        return res.status(400).json({
          error: "AI功能未配置",
          message: "缺少DASHSCOPE_API_KEY，无法使用AI推理"
        });
      }

      const fileContext = files && files.length > 0
        ? `\n\n用户上传的资料：\n${files.map(f => `【${f.name}】\n${f.content.substring(0, 3000)}`).join('\n\n')}`
        : '';

      const previousContext = previousProject
        ? `\n\n之前生成的项目方案：\n${JSON.stringify(previousProject, null, 2)}\n\n用户反馈：${feedback || '请优化'}`
        : '';

      const prompt = `你是一个专业的项目规划师。请根据用户的想法和资料，生成一个完整的项目方案。

用户输入：${input || '请根据资料分析'}
${fileContext}
${previousContext}

请按照以下JSON格式返回项目方案，确保每个字段都有实质内容：
{
  "title": "项目名称（简洁明确）",
  "description": "项目描述（100-200字，概述项目背景、目标、价值）",
  "category": "分类（BUSINESS/TECHNOLOGY/RESEARCH/PERSONAL之一）",
  "priority": 优先级数字（1-10，1最紧急）,
  "objectives": ["目标1", "目标2", "目标3"],
  "currentConditions": ["已具备的条件1", "已具备的条件2"],
  "missingConditions": ["缺失的条件1", "缺失的条件2"],
  "swotAnalysis": {
    "strengths": ["优势1", "优势2"],
    "weaknesses": ["劣势1", "劣势2"],
    "opportunities": ["机会1", "机会2"],
    "threats": ["威胁1", "威胁2"]
  },
  "aiReasoning": "你的推理过程简述（为什么这样规划）"
}

只返回JSON，不要其他文字。`;

      const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen-plus',
          messages: [
            { role: 'system', content: '你是一个专业的项目规划师和战略分析专家。请根据用户需求生成完整的项目方案。返回纯JSON格式。' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 3000,
        }),
      });

      const data = await response.json() as unknown;
      const content = data.choices?.[0]?.message?.content || '';

      let project;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          project = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found');
        }
      } catch (parseError) {
        logger.error({ content }, '[SmartCreate] Failed to parse AI response');
        return res.status(500).json({
          error: "AI响应解析失败",
          message: "无法解析AI生成的项目方案，请重试"
        });
      }

      const validProject = {
        title: project.title || '新项目',
        description: project.description || '',
        category: ['BUSINESS', 'TECHNOLOGY', 'RESEARCH', 'PERSONAL'].includes(project.category)
          ? project.category : 'BUSINESS',
        priority: typeof project.priority === 'number' ? Math.min(10, Math.max(1, project.priority)) : 5,
        objectives: Array.isArray(project.objectives) ? project.objectives : [],
        currentConditions: Array.isArray(project.currentConditions) ? project.currentConditions : [],
        missingConditions: Array.isArray(project.missingConditions) ? project.missingConditions : [],
        swotAnalysis: project.swotAnalysis || null,
        aiReasoning: project.aiReasoning || '',
      };

      const savedProject = await projectService.createProject({
        title: validProject.title,
        description: validProject.description,
        category: validProject.category,
        priority: validProject.priority,
        currentConditions: validProject.currentConditions,
        missingConditions: validProject.missingConditions,
        swotAnalysis: validProject.swotAnalysis,
      });

      logger.info({ projectId: savedProject.id, title: savedProject.title }, '[SmartCreate] Project saved');

      return res.json({
        success: true,
        project: validProject,
        savedProject: savedProject,
        message: '项目已自动创建并保存到数据库',
      });
    } catch (error) {
      logger.error({ err: error }, '[SmartCreate] Error');
      return res.status(500).json({ error: "智能创建失败" });
    }
  });

  logger.info('[ProjectSWOT] Routes registered');
}
