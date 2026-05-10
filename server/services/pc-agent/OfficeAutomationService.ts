/**
 * 办公自动化服务 - 电脑端Agent核心组件
 *
 * 功能：
 * - PPT制作和编辑
 * - 文档排版和格式化
 * - 文书生成（报告、合同、方案等）
 * - 资料查找和整理
 * - 上网填报自动化
 *
 * @version 1.1.0
 * @date 2026-04-19
 */

import { createServiceLogger } from '../../lib/logger';
import { cozeAPI } from '../../lib/coze-api';
import { exec, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

const logger = createServiceLogger('OfficeAutomation');

// 文档模板类型
export interface DocumentTemplate {
  id: string;
  name: string;
  type: 'report' | 'contract' | 'proposal' | 'plan' | 'summary' | 'custom';
  category: string;
  variables: TemplateVariable[];
  content: string;
}

export interface TemplateVariable {
  name: string;
  type: 'text' | 'number' | 'date' | 'table' | 'list';
  required: boolean;
  description: string;
}

// 生成选项
export interface GenerateOptions {
  templateId?: string;
  title?: string;
  variables: Record<string, unknown>;
  format?: 'docx' | 'pdf' | 'html' | 'md';
  style?: 'formal' | 'simple' | 'modern';
}

// 生成结果
export interface GenerationResult {
  success: boolean;
  filePath?: string;
  content?: string;
  error?: string;
}

// PPT相关
export interface PPTSlide {
  title: string;
  content: string[];
  layout: 'title' | 'content' | 'two-column' | 'image';
  notes?: string;
}

export class OfficeAutomationService {
  private static instance: OfficeAutomationService | null = null;
  private templates: Map<string, DocumentTemplate> = new Map();
  private officePath: string = '';

  private constructor() {
    this.initializeTemplates();
    this.detectOfficePath();
  }

  public static getInstance(): OfficeAutomationService {
    if (!OfficeAutomationService.instance) {
      OfficeAutomationService.instance = new OfficeAutomationService();
    }
    return OfficeAutomationService.instance;
  }

  /**
   * 初始化文档模板
   */
  private initializeTemplates(): void {
    // 科技申报书模板
    this.templates.set('sci-tech-application', {
      id: 'sci-tech-application',
      name: '科技计划项目申报书',
      type: 'report',
      category: 'government',
      variables: [
        { name: 'projectName', type: 'text', required: true, description: '项目名称' },
        { name: 'applicant', type: 'text', required: true, description: '申报单位' },
        { name: 'contact', type: 'text', required: true, description: '联系人' },
        { name: 'phone', type: 'text', required: true, description: '联系电话' },
        { name: 'budget', type: 'number', required: true, description: '预算金额(万元)' },
        { name: 'startDate', type: 'date', required: true, description: '开始日期' },
        { name: 'endDate', type: 'date', required: true, description: '结束日期' },
        { name: 'background', type: 'text', required: true, description: '项目背景' },
        { name: 'objective', type: 'text', required: true, description: '项目目标' },
        { name: 'content', type: 'text', required: true, description: '主要研究内容' },
        { name: 'innovation', type: 'text', required: true, description: '创新点' },
        { name: 'team', type: 'list', required: true, description: '项目团队' },
        { name: 'equipment', type: 'list', required: false, description: '现有条件' },
        { name: 'schedule', type: 'table', required: true, description: '实施进度' },
      ],
      content: '',
    });

    // 项目可行性报告模板
    this.templates.set('feasibility-report', {
      id: 'feasibility-report',
      name: '项目可行性研究报告',
      type: 'report',
      category: 'project',
      variables: [
        { name: 'projectName', type: 'text', required: true, description: '项目名称' },
        { name: 'company', type: 'text', required: true, description: '编制单位' },
        { name: 'date', type: 'date', required: true, description: '编制日期' },
        { name: 'executiveSummary', type: 'text', required: true, description: '摘要' },
        { name: 'background', type: 'text', required: true, description: '项目背景' },
        { name: 'marketAnalysis', type: 'text', required: true, description: '市场分析' },
        { name: 'technicalSolution', type: 'text', required: true, description: '技术方案' },
        { name: 'investmentPlan', type: 'text', required: true, description: '投资计划' },
        { name: 'financialAnalysis', type: 'text', required: true, description: '财务分析' },
        { name: 'riskAnalysis', type: 'text', required: false, description: '风险分析' },
        { name: 'conclusion', type: 'text', required: true, description: '结论与建议' },
      ],
      content: '',
    });

    // 合同模板
    this.templates.set('contract', {
      id: 'contract',
      name: '项目合同',
      type: 'contract',
      category: 'legal',
      variables: [
        { name: 'partyA', type: 'text', required: true, description: '甲方' },
        { name: 'partyB', type: 'text', required: true, description: '乙方' },
        { name: 'contractNo', type: 'text', required: true, description: '合同编号' },
        { name: 'signDate', type: 'date', required: true, description: '签订日期' },
        { name: 'projectName', type: 'text', required: true, description: '项目名称' },
        { name: 'amount', type: 'number', required: true, description: '合同金额' },
        { name: 'paymentTerms', type: 'text', required: true, description: '付款方式' },
        { name: 'deliveryDate', type: 'date', required: true, description: '交付日期' },
        { name: 'terms', type: 'list', required: true, description: '主要条款' },
      ],
      content: '',
    });

    // 年度工作计划模板
    this.templates.set('annual-plan', {
      id: 'annual-plan',
      name: '年度工作计划',
      type: 'plan',
      category: 'management',
      variables: [
        { name: 'department', type: 'text', required: true, description: '部门名称' },
        { name: 'year', type: 'number', required: true, description: '年度' },
        { name: 'leader', type: 'text', required: true, description: '负责人' },
        { name: 'goals', type: 'list', required: true, description: '年度目标' },
        { name: 'keyTasks', type: 'table', required: true, description: '重点任务' },
        { name: 'timeline', type: 'table', required: true, description: '时间安排' },
        { name: 'budget', type: 'number', required: false, description: '预算(万元)' },
      ],
      content: '',
    });

    // 工作总结模板
    this.templates.set('work-summary', {
      id: 'work-summary',
      name: '工作总结',
      type: 'summary',
      category: 'management',
      variables: [
        { name: 'period', type: 'text', required: true, description: '总结周期' },
        { name: 'department', type: 'text', required: true, description: '部门/个人' },
        { name: 'summary', type: 'text', required: true, description: '工作概述' },
        { name: 'achievements', type: 'list', required: true, description: '主要成绩' },
        { name: 'problems', type: 'list', required: false, description: '存在问题' },
        { name: 'nextPlan', type: 'text', required: true, description: '下步计划' },
      ],
      content: '',
    });
  }

  /**
   * 检测Office安装路径
   */
  private detectOfficePath(): void {
    if (process.platform === 'win32') {
      const possiblePaths = [
        'C:\\Program Files\\Microsoft Office',
        'C:\\Program Files (x86)\\Microsoft Office',
        'C:\\Program Files\\WPS',
        'C:\\Users\\' + process.env.USERNAME + '\\AppData\\Local\\Kingsoft\\WPS',
      ];

      for (const officePath of possiblePaths) {
        if (fs.existsSync(officePath)) {
          this.officePath = officePath;
          break;
        }
      }
    }
  }

  /**
   * 获取所有模板
   */
  public getTemplates(): DocumentTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * 获取模板
   */
  public getTemplate(templateId: string): DocumentTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * 生成文档
   */
  public async generateDocument(options: GenerateOptions): Promise<GenerationResult> {
    const { templateId, title, variables, format = 'docx', style = 'formal' } = options;

    logger.info({ templateId, title, format }, 'Generating document');

    try {
      // 1. 获取模板
      let template: DocumentTemplate | undefined;
      if (templateId) {
        template = this.templates.get(templateId);
      }

      // 2. 使用Coze AI生成内容
      let content = '';
      if (template) {
        content = await this.generateFromTemplate(template, variables);
      } else if (title) {
        content = await this.generateFreeForm(title, variables, style);
      } else {
        return { success: false, error: '请提供模板ID或标题' };
      }

      // 3. 保存文件
      const filePath = await this.saveDocument(content, title || template?.name || 'document', format);

      return { success: true, filePath, content };

    } catch (error) {
      logger.error({ error }, 'Failed to generate document');
      return { success: false, error: error instanceof Error ? error.message : '生成失败' };
    }
  }

  /**
   * 从模板生成
   */
  private async generateFromTemplate(template: DocumentTemplate, variables: Record<string, unknown>): Promise<string> {
    // 构建提示词
    let prompt = `请根据以下模板生成一份专业的${template.name}：\n\n`;

    for (const variable of template.variables) {
      const value = variables[variable.name];
      prompt += `【${variable.description}】: ${value || '(请填写)'}\n`;
    }

    prompt += `\n请生成完整的文档内容，使用专业正式的语言。`;

    // 调用Coze AI
    try {
      const result = await cozeAPI.chat(prompt);

      if (result.success && result.data?.response) {
        return result.data.response;
      }
      return this.generateFallbackContent(template, variables);
    } catch (error) {
      logger.error({ error }, 'Coze API failed, using fallback');
      return this.generateFallbackContent(template, variables);
    }
  }

  /**
   * 自由形式生成
   */
  private async generateFreeForm(title: string, variables: Record<string, unknown>, style: string): Promise<string> {
    let prompt = `请撰写一篇关于"${title}"的文档。\n\n`;

    if (variables.description) {
      prompt += `详细要求：${variables.description}\n`;
    }

    if (variables.length) {
      prompt += `篇幅要求：约${variables.length}字\n`;
    }

    const styleMap: Record<string, string> = {
      'formal': '请使用专业正式的语言，适合正式场合使用。',
      'simple': '请使用简洁明了的语言。',
      'modern': '请使用现代时尚的语言风格。',
    };

    prompt += styleMap[style] || '';

    try {
      const result = await cozeAPI.chat(prompt);

      if (result.success && result.data?.response) {
        return result.data.response;
      }
      return `关于"${title}"的文档\n\n${variables.description || ''}`;
    } catch (error) {
      logger.error({ error }, 'Coze API failed');
      return `关于"${title}"的文档\n\n${variables.description || ''}`;
    }
  }

  /**
   * 降级内容生成
   */
  private generateFallbackContent(template: DocumentTemplate, variables: Record<string, unknown>): string {
    let content = `# ${variables.projectName || template.name}\n\n`;

    for (const variable of template.variables) {
      const value = variables[variable.name];
      if (value) {
        content += `## ${variable.description}\n\n${value}\n\n`;
      }
    }

    return content;
  }

  /**
   * 保存文档
   */
  private async saveDocument(content: string, filename: string, format: string): Promise<string> {
    const documentsPath = path.join(process.env.USERPROFILE || process.env.HOME || '', 'Documents');
    const outputDir = path.join(documentsPath, '小星生成');

    // 确保目录存在
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filePath = path.join(outputDir, `${filename}_${Date.now()}.${format}`);

    if (format === 'md' || format === 'html') {
      fs.writeFileSync(filePath, content, 'utf-8');
    } else {
      // 其他格式需要转换
      const mdPath = filePath.replace(/\.[^.]+$/, '.md');
      fs.writeFileSync(mdPath, content, 'utf-8');
      return mdPath;
    }

    return filePath;
  }

  /**
   * 格式化文档排版
   */
  public async formatDocument(filePath: string, options: {
    font?: string;
    fontSize?: number;
    lineSpacing?: number;
    margins?: { top: number; bottom: number; left: number; right: number };
  } = {}): Promise<GenerationResult> {
    logger.info({ filePath, options }, 'Formatting document');

    try {
      // 调用Coze API进行文档排版优化
      const content = fs.readFileSync(filePath, 'utf-8');

      const prompt = `请优化以下文档的排版和格式，使其更加规范美观。保持内容不变，只优化格式：\n\n${content}`;

      const result = await cozeAPI.chat(prompt);

      let formatted = content;
      if (result.success && result.data?.response) {
        formatted = result.data.response;
      }

      fs.writeFileSync(filePath, formatted, 'utf-8');

      return { success: true, filePath, content: formatted };

    } catch (error) {
      logger.error({ error }, 'Failed to format document');
      return { success: false, error: '排版失败' };
    }
  }

  /**
   * 生成PPT
   */
  public async generatePPT(title: string, slides: PPTSlide[]): Promise<GenerationResult> {
    logger.info({ title, slideCount: slides.length }, 'Generating PPT');

    try {
      // 使用Python生成PPT
      const pythonScript = `
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)

for slide_data in ${JSON.stringify(slides)}:
    slide = prs.slides.add_slide(prs.slide_layouts[6])  # 空白布局

    # 添加标题
    title_shape = slide.shapes.add_textbox(Inches(0.5), Inches(0.5), Inches(12), Inches(1))
    title_frame = title_shape.text_frame
    title_frame.text = slide_data.get('title', '')
    title_frame.paragraphs[0].font.size = Pt(44)
    title_frame.paragraphs[0].font.bold = True

    # 添加内容
    content_shape = slide.shapes.add_textbox(Inches(0.5), Inches(2), Inches(12), Inches(5))
    content_frame = content_shape.text_frame
    for item in slide_data.get('content', []):
        p = content_frame.add_paragraph()
        p.text = f'• {item}'
        p.level = 0

prs.save('${title.replace(/'/g, "''")}.pptx')
print('PPT created successfully')
`;

      // 保存Python脚本
      const scriptPath = path.join(require('os').tmpdir(), 'generate_ppt.py');
      fs.writeFileSync(scriptPath, pythonScript);

      // 执行Python脚本
      try {
        await execAsync(`python "${scriptPath}"`, { cwd: path.join(process.env.USERPROFILE || process.env.HOME || '', 'Documents') });
        fs.unlinkSync(scriptPath);
      } catch (execError) {
        logger.warn({ error: execError }, 'Python not available, creating markdown instead');

        // 降级为Markdown格式
        let mdContent = `# ${title}\n\n`;
        for (const slide of slides) {
          mdContent += `## ${slide.title}\n\n`;
          for (const item of slide.content) {
            mdContent += `- ${item}\n`;
          }
          mdContent += '\n---\n\n';
        }

        const mdPath = path.join(process.env.USERPROFILE || process.env.HOME || '', 'Documents', `${title}.md`);
        fs.writeFileSync(mdPath, mdContent);

        return { success: true, filePath: mdPath, content: mdContent };
      }

      const pptPath = path.join(process.env.USERPROFILE || process.env.HOME || '', 'Documents', `${title}.pptx`);
      return { success: true, filePath: pptPath };

    } catch (error) {
      logger.error({ error }, 'Failed to generate PPT');
      return { success: false, error: 'PPT生成失败' };
    }
  }

  /**
   * 打开Office文档
   */
  public async openDocument(filePath: string): Promise<boolean> {
    try {
      if (process.platform === 'win32') {
        await execAsync(`start "" "${filePath}"`);
      } else if (process.platform === 'darwin') {
        await execAsync(`open "${filePath}"`);
      } else {
        await execAsync(`xdg-open "${filePath}"`);
      }
      return true;
    } catch (error) {
      logger.error({ error }, 'Failed to open document');
      return false;
    }
  }

  /**
   * 转换文档格式
   */
  public async convertDocument(sourcePath: string, targetFormat: string): Promise<string> {
    // TODO: 实现文档格式转换
    logger.info({ sourcePath, targetFormat }, 'Converting document');

    // 简单的Markdown到HTML转换
    if (targetFormat === 'html' && sourcePath.endsWith('.md')) {
      const mdContent = fs.readFileSync(sourcePath, 'utf-8');
      const html = this.markdownToHtml(mdContent);
      const htmlPath = sourcePath.replace('.md', '.html');
      fs.writeFileSync(htmlPath, html);
      return htmlPath;
    }

    throw new Error('Unsupported conversion');
  }

  /**
   * Markdown转HTML
   */
  private markdownToHtml(md: string): string {
    let html = md
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/^- (.*$)/gim, '<li>$1</li>')
      .replace(/\n/gim, '<br/>');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Document</title>
  <style>
    body { font-family: "Microsoft YaHei", Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1, h2, h3 { color: #333; }
    li { margin-left: 20px; }
  </style>
</head>
<body>${html}</body>
</html>`;
  }
}

export const officeAutomationService = OfficeAutomationService.getInstance();
export default officeAutomationService;
