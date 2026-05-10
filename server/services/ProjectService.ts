import { createServiceLogger } from '../lib/logger';
import { projectStorage } from '../storage/domains';
import type { Project, InsertProject, ProjectNote, InsertProjectNote, ProjectFile, InsertProjectFile, ProjectTemplate, InsertProjectTemplate } from '@shared/schema';

const logger = createServiceLogger('ProjectService');

export class ProjectService {
  /**
   * 获取所有项目（可筛选状态）
   */
  async getProjects(status?: string): Promise<Project[]> {
    return await projectStorage.getProjects(status);
  }

  /**
   * 获取单个项目
   */
  async getProject(id: string): Promise<Project | undefined> {
    return await projectStorage.getProject(id);
  }

  /**
   * 创建新项目
   */
  async createProject(projectData: InsertProject): Promise<Project> {
    const project = await projectStorage.createProject(projectData);
    logger.info({ projectId: project.id, projectTitle: project.title }, '项目创建成功');
    return project;
  }

  /**
   * 更新项目
   */
  async updateProject(id: string, updates: Partial<InsertProject>): Promise<Project | undefined> {
    const project = await projectStorage.updateProject(id, updates);
    if (project) {
      logger.debug({ projectId: id }, '项目更新成功');
    }
    return project;
  }

  /**
   * 更新项目状态
   */
  async updateProjectStatus(id: string, status: string): Promise<Project | undefined> {
    const project = await projectStorage.updateProject(id, { status });
    if (project) {
      logger.info({ projectId: id, status }, '项目状态更新成功');
    }
    return project;
  }

  /**
   * 获取项目笔记
   */
  async getProjectNotes(projectId: string): Promise<ProjectNote[]> {
    return await projectStorage.getProjectNotes(projectId);
  }

  /**
   * 创建项目笔记
   */
  async createProjectNote(noteData: InsertProjectNote): Promise<ProjectNote> {
    const note = await projectStorage.createProjectNote(noteData);
    logger.debug({ noteId: note.id, projectId: note.projectId }, '项目笔记创建成功');
    return note;
  }

  /**
   * 删除项目笔记
   */
  async deleteProjectNote(id: string): Promise<boolean> {
    const success = await projectStorage.deleteProjectNote(id);
    logger.debug({ noteId: id }, success ? '项目笔记删除成功' : '项目笔记删除失败');
    return success;
  }

  /**
   * 获取项目文件
   */
  async getProjectFiles(projectId: string): Promise<ProjectFile[]> {
    return await projectStorage.getProjectFiles(projectId);
  }

  /**
   * 创建项目文件
   */
  async createProjectFile(fileData: InsertProjectFile): Promise<ProjectFile> {
    const file = await projectStorage.createProjectFile(fileData);
    logger.debug({ fileId: file.id, projectId: file.projectId, fileName: file.fileName }, '项目文件创建成功');
    return file;
  }

  /**
   * 更新项目文件
   */
  async updateProjectFile(id: string, updates: Partial<InsertProjectFile>): Promise<ProjectFile | undefined> {
    const file = await projectStorage.updateProjectFile(id, updates);
    if (file) {
      logger.debug({ fileId: id }, '项目文件更新成功');
    }
    return file;
  }

  /**
   * 删除项目文件
   */
  async deleteProjectFile(id: string): Promise<boolean> {
    const success = await projectStorage.deleteProjectFile(id);
    logger.debug({ fileId: id }, success ? '项目文件删除成功' : '项目文件删除失败');
    return success;
  }

  /**
   * 获取项目模板
   */
  async getProjectTemplates(category?: string): Promise<ProjectTemplate[]> {
    return await projectStorage.getProjectTemplates(category);
  }

  /**
   * 获取单个项目模板
   */
  async getProjectTemplate(id: string): Promise<ProjectTemplate | undefined> {
    return await projectStorage.getProjectTemplate(id);
  }

  /**
   * 创建项目模板
   */
  async createProjectTemplate(templateData: InsertProjectTemplate): Promise<ProjectTemplate> {
    const template = await projectStorage.createProjectTemplate(templateData);
    logger.info({ templateId: template.id, templateName: template.name }, '项目模板创建成功');
    return template;
  }

  /**
   * 增加模板使用次数
   */
  async incrementTemplateUsage(id: string): Promise<ProjectTemplate | undefined> {
    const template = await projectStorage.incrementTemplateUsage(id);
    if (template) {
      logger.debug({ templateId: id, usageCount: template.usageCount }, '模板使用次数增加');
    }
    return template;
  }
}

export const projectService = new ProjectService();