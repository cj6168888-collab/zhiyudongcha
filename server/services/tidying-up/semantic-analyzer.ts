import { createServiceLogger } from '../../lib/logger';
const logger = createServiceLogger('SemanticAnalyzer');

import type { FileMetadata, SemanticAnalysis, FileCategory, ArchiveSuggestion } from './types';
import { classifyFile } from './classification-rules';

interface ProjectContext {
  projectName: string;
  keywords: string[];
  relatedPaths: string[];
}

export class SemanticAnalyzer {
  private dashscopeApiKey: string | undefined;
  private knownProjects: ProjectContext[] = [];
  
  constructor() {
    this.dashscopeApiKey = process.env.DASHSCOPE_API_KEY;
  }
  
  async analyzeFile(file: FileMetadata, content?: string): Promise<SemanticAnalysis> {
    const category = classifyFile(file);
    const pathParts = file.filePath.split(/[\/\\]/);
    
    let projectName = this.detectProjectFromPath(pathParts);
    let keywords = this.extractKeywordsFromPath(pathParts);
    let importance: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
    let archiveSuggestion: ArchiveSuggestion | undefined;
    
    const now = new Date();
    const daysSinceAccess = Math.floor((now.getTime() - file.accessedAt.getTime()) / (24 * 60 * 60 * 1000));
    
    if (daysSinceAccess > 90) {
      archiveSuggestion = {
        action: category === 'TEMP' ? 'DELETE' : 'ARCHIVE',
        reason: `${daysSinceAccess}天未访问`,
        daysSinceAccess,
        targetPath: `Archive/${category}`,
      };
    }
    
    if (category === 'CONTRACT' || category === 'INVOICE') {
      importance = 'HIGH';
    } else if (category === 'TEMP') {
      importance = 'LOW';
    }
    
    if (content && this.dashscopeApiKey) {
      try {
        const aiAnalysis = await this.analyzeWithAI(file, content);
        if (aiAnalysis) {
          projectName = aiAnalysis.projectName || projectName;
          const aiKeywords = aiAnalysis.keywords || [];
          const combinedKeywords = [...keywords, ...aiKeywords];
          keywords = combinedKeywords.filter((kw, idx) => combinedKeywords.indexOf(kw) === idx);
          importance = aiAnalysis.importance || importance;
        }
      } catch (error) {
        logger.error({ error }, 'AI analysis failed');
      }
    }
    
    return {
      projectName,
      category,
      suggestedName: undefined,
      confidence: content ? 0.9 : 0.7,
      keywords,
      importance,
      archiveSuggestion,
    };
  }
  
  private detectProjectFromPath(pathParts: string[]): string | undefined {
    const projectIndicators = ['project', 'projects', '项目', 'workspace', 'work'];
    
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i].toLowerCase();
      if (projectIndicators.some(ind => part.includes(ind))) {
        if (i + 1 < pathParts.length) {
          return pathParts[i + 1];
        }
      }
    }
    
    for (const project of this.knownProjects) {
      if (pathParts.some(p => project.keywords.some(k => p.toLowerCase().includes(k)))) {
        return project.projectName;
      }
    }
    
    return undefined;
  }
  
  private extractKeywordsFromPath(pathParts: string[]): string[] {
    const keywords: string[] = [];
    const stopWords = ['desktop', 'documents', 'downloads', 'users', 'home', '桌面', '文档', '下载', 'the', 'a', 'an'];
    
    for (const part of pathParts) {
      const cleaned = part.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, '');
      if (cleaned.length > 2 && !stopWords.includes(cleaned)) {
        keywords.push(cleaned);
      }
    }
    
    return keywords.slice(-5);
  }
  
  private async analyzeWithAI(file: FileMetadata, content: string): Promise<Partial<SemanticAnalysis> | null> {
    if (!this.dashscopeApiKey) return null;
    
    try {
      const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.dashscopeApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen-turbo',
          messages: [
            {
              role: 'system',
              content: `你是文件分析专家。分析文件内容，返回JSON格式：
{
  "projectName": "项目名称(如能识别)",
  "keywords": ["关键词1", "关键词2"],
  "importance": "HIGH/MEDIUM/LOW",
  "summary": "一句话摘要"
}
只返回JSON，不要其他文字。`,
            },
            {
              role: 'user',
              content: `文件名: ${file.fileName}
路径: ${file.filePath}
内容摘要: ${content.slice(0, 1000)}`,
            },
          ],
          max_tokens: 200,
          temperature: 0.3,
        }),
      });
      
      if (!response.ok) return null;
      
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content?.trim();
      
      if (text) {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
    } catch (error) {
      logger.error({ error }, 'AI analysis error');
    }
    
    return null;
  }
  
  async batchAnalyze(files: FileMetadata[]): Promise<Map<string, SemanticAnalysis>> {
    const results = new Map<string, SemanticAnalysis>();
    
    for (const file of files) {
      const analysis = await this.analyzeFile(file);
      results.set(file.filePath, analysis);
    }
    
    return results;
  }
  
  registerProject(project: ProjectContext): void {
    const existing = this.knownProjects.findIndex(p => p.projectName === project.projectName);
    if (existing >= 0) {
      this.knownProjects[existing] = project;
    } else {
      this.knownProjects.push(project);
    }
  }
  
  findRelatedFiles(files: FileMetadata[], targetFile: FileMetadata): FileMetadata[] {
    const targetKeywords = this.extractKeywordsFromPath(targetFile.filePath.split(/[\/\\]/));
    
    return files.filter(f => {
      if (f.filePath === targetFile.filePath) return false;
      
      const fileKeywords = this.extractKeywordsFromPath(f.filePath.split(/[\/\\]/));
      const overlap = targetKeywords.filter(k => fileKeywords.includes(k));
      return overlap.length >= 2;
    });
  }
  
  groupByProject(files: FileMetadata[]): Map<string, FileMetadata[]> {
    const groups = new Map<string, FileMetadata[]>();
    
    for (const file of files) {
      const pathParts = file.filePath.split(/[\/\\]/);
      const project = this.detectProjectFromPath(pathParts) || 'unassigned';
      
      const existing = groups.get(project) || [];
      existing.push(file);
      groups.set(project, existing);
    }
    
    return groups;
  }
}

export const semanticAnalyzer = new SemanticAnalyzer();
