import { projectRepository, projectNoteRepository, projectFileRepository, projectTemplateRepository } from '../../repositories';
import type { Project, ProjectNote, ProjectFile, ProjectTemplate, InsertProject, InsertProjectNote, InsertProjectFile, InsertProjectTemplate } from '@shared/schema';

export interface IProjectStorage {
  getProject(id: string): Promise<Project | undefined>;
  getProjects(status?: string): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, updates: Partial<InsertProject>): Promise<Project | undefined>;
  
  getProjectNotes(projectId: string): Promise<ProjectNote[]>;
  createProjectNote(note: InsertProjectNote): Promise<ProjectNote>;
  deleteProjectNote(id: string): Promise<boolean>;
  
  getProjectFiles(projectId: string): Promise<ProjectFile[]>;
  createProjectFile(file: InsertProjectFile): Promise<ProjectFile>;
  updateProjectFile(id: string, updates: Partial<InsertProjectFile>): Promise<ProjectFile | undefined>;
  deleteProjectFile(id: string): Promise<boolean>;
  
  getProjectTemplates(category?: string): Promise<ProjectTemplate[]>;
  getProjectTemplate(id: string): Promise<ProjectTemplate | undefined>;
  createProjectTemplate(template: InsertProjectTemplate): Promise<ProjectTemplate>;
  incrementTemplateUsage(id: string): Promise<ProjectTemplate | undefined>;
}

export class ProjectStorage implements IProjectStorage {
  async getProject(id: string): Promise<Project | undefined> {
    return await projectRepository.findById(id);
  }

  async getProjects(status?: string): Promise<Project[]> {
    return await projectRepository.getAllByStatus(status);
  }

  async createProject(project: InsertProject): Promise<Project> {
    return await projectRepository.create(project);
  }

  async updateProject(id: string, updates: Partial<InsertProject>): Promise<Project | undefined> {
    return await projectRepository.update(id, updates);
  }
  
  async getProjectNotes(projectId: string): Promise<ProjectNote[]> {
    return await projectNoteRepository.getByProjectId(projectId);
  }

  async createProjectNote(note: InsertProjectNote): Promise<ProjectNote> {
    return await projectNoteRepository.create(note);
  }

  async deleteProjectNote(id: string): Promise<boolean> {
    return await projectNoteRepository.delete(id);
  }
  
  async getProjectFiles(projectId: string): Promise<ProjectFile[]> {
    return await projectFileRepository.getByProjectId(projectId);
  }

  async createProjectFile(file: InsertProjectFile): Promise<ProjectFile> {
    return await projectFileRepository.create(file);
  }

  async updateProjectFile(id: string, updates: Partial<InsertProjectFile>): Promise<ProjectFile | undefined> {
    return await projectFileRepository.update(id, updates);
  }

  async deleteProjectFile(id: string): Promise<boolean> {
    return await projectFileRepository.delete(id);
  }
  
  async getProjectTemplates(category?: string): Promise<ProjectTemplate[]> {
    return await projectTemplateRepository.getByCategory(category);
  }

  async getProjectTemplate(id: string): Promise<ProjectTemplate | undefined> {
    return await projectTemplateRepository.findById(id);
  }

  async createProjectTemplate(template: InsertProjectTemplate): Promise<ProjectTemplate> {
    return await projectTemplateRepository.create(template);
  }

  async incrementTemplateUsage(id: string): Promise<ProjectTemplate | undefined> {
    return await projectTemplateRepository.incrementUsage(id);
  }
}

export const projectStorage = new ProjectStorage();
