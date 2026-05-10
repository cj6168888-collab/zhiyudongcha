import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../storage/domains', () => ({
  projectStorage: {
    getProjects: vi.fn(),
    getProject: vi.fn(),
    createProject: vi.fn(),
    updateProject: vi.fn(),
    getProjectNotes: vi.fn(),
    createProjectNote: vi.fn(),
    deleteProjectNote: vi.fn(),
    getProjectFiles: vi.fn(),
    createProjectFile: vi.fn(),
    updateProjectFile: vi.fn(),
    deleteProjectFile: vi.fn(),
    getProjectTemplates: vi.fn(),
    getProjectTemplate: vi.fn(),
    createProjectTemplate: vi.fn(),
    incrementTemplateUsage: vi.fn(),
  },
}));

vi.mock('../../../lib/logger', () => ({
  createServiceLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { ProjectService } from '../../../services/ProjectService';
import { projectStorage } from '../../../storage/domains';

const baseProject = {
  id: 'project-1',
  title: 'R1 发布',
  status: 'active',
  description: '发布闭环',
};

const baseNote = {
  id: 'note-1',
  projectId: 'project-1',
  content: '今天完成测试覆盖',
};

const baseFile = {
  id: 'file-1',
  projectId: 'project-1',
  fileName: 'release-plan.md',
};

const baseTemplate = {
  id: 'template-1',
  name: '发布模板',
  category: 'release',
  usageCount: 3,
};

describe('ProjectService', () => {
  let service: ProjectService;

  beforeEach(() => {
    service = new ProjectService();
    vi.clearAllMocks();

    vi.mocked(projectStorage.getProjects).mockResolvedValue([baseProject] as any);
    vi.mocked(projectStorage.getProject).mockResolvedValue(baseProject as any);
    vi.mocked(projectStorage.createProject).mockResolvedValue(baseProject as any);
    vi.mocked(projectStorage.updateProject).mockResolvedValue(baseProject as any);
    vi.mocked(projectStorage.getProjectNotes).mockResolvedValue([baseNote] as any);
    vi.mocked(projectStorage.createProjectNote).mockResolvedValue(baseNote as any);
    vi.mocked(projectStorage.deleteProjectNote).mockResolvedValue(true);
    vi.mocked(projectStorage.getProjectFiles).mockResolvedValue([baseFile] as any);
    vi.mocked(projectStorage.createProjectFile).mockResolvedValue(baseFile as any);
    vi.mocked(projectStorage.updateProjectFile).mockResolvedValue(baseFile as any);
    vi.mocked(projectStorage.deleteProjectFile).mockResolvedValue(true);
    vi.mocked(projectStorage.getProjectTemplates).mockResolvedValue([baseTemplate] as any);
    vi.mocked(projectStorage.getProjectTemplate).mockResolvedValue(baseTemplate as any);
    vi.mocked(projectStorage.createProjectTemplate).mockResolvedValue(baseTemplate as any);
    vi.mocked(projectStorage.incrementTemplateUsage).mockResolvedValue(baseTemplate as any);
  });

  it('delegates project list, detail, and create operations to project storage', async () => {
    await expect(service.getProjects('active')).resolves.toEqual([baseProject]);
    await expect(service.getProject('project-1')).resolves.toEqual(baseProject);
    await expect(
      service.createProject({ title: 'R1 发布', description: '发布闭环' } as any),
    ).resolves.toEqual(baseProject);

    expect(projectStorage.getProjects).toHaveBeenCalledWith('active');
    expect(projectStorage.getProject).toHaveBeenCalledWith('project-1');
    expect(projectStorage.createProject).toHaveBeenCalledWith({
      title: 'R1 发布',
      description: '发布闭环',
    });
  });

  it('updates projects and returns undefined for missing update targets', async () => {
    await expect(service.updateProject('project-1', { title: 'R2 发布' } as any)).resolves.toEqual(
      baseProject,
    );
    expect(projectStorage.updateProject).toHaveBeenCalledWith('project-1', { title: 'R2 发布' });

    vi.mocked(projectStorage.updateProject).mockResolvedValueOnce(undefined);
    await expect(service.updateProject('missing', { title: '不存在' } as any)).resolves.toBeUndefined();
  });

  it('updates project status through the same storage update path', async () => {
    await expect(service.updateProjectStatus('project-1', 'completed')).resolves.toEqual(baseProject);
    expect(projectStorage.updateProject).toHaveBeenCalledWith('project-1', {
      status: 'completed',
    });

    vi.mocked(projectStorage.updateProject).mockResolvedValueOnce(undefined);
    await expect(service.updateProjectStatus('missing', 'blocked')).resolves.toBeUndefined();
  });

  it('manages project notes through storage', async () => {
    await expect(service.getProjectNotes('project-1')).resolves.toEqual([baseNote]);
    await expect(service.createProjectNote({ projectId: 'project-1', content: '今天完成测试覆盖' } as any)).resolves.toEqual(
      baseNote,
    );
    await expect(service.deleteProjectNote('note-1')).resolves.toBe(true);

    expect(projectStorage.getProjectNotes).toHaveBeenCalledWith('project-1');
    expect(projectStorage.createProjectNote).toHaveBeenCalledWith({
      projectId: 'project-1',
      content: '今天完成测试覆盖',
    });
    expect(projectStorage.deleteProjectNote).toHaveBeenCalledWith('note-1');
  });

  it('manages project files and missing file updates', async () => {
    await expect(service.getProjectFiles('project-1')).resolves.toEqual([baseFile]);
    await expect(service.createProjectFile({ projectId: 'project-1', fileName: 'release-plan.md' } as any)).resolves.toEqual(
      baseFile,
    );
    await expect(service.updateProjectFile('file-1', { fileName: 'release-plan-v2.md' } as any)).resolves.toEqual(
      baseFile,
    );
    await expect(service.deleteProjectFile('file-1')).resolves.toBe(true);

    vi.mocked(projectStorage.updateProjectFile).mockResolvedValueOnce(undefined);
    await expect(service.updateProjectFile('missing', { fileName: 'missing.md' } as any)).resolves.toBeUndefined();

    expect(projectStorage.getProjectFiles).toHaveBeenCalledWith('project-1');
    expect(projectStorage.createProjectFile).toHaveBeenCalledWith({
      projectId: 'project-1',
      fileName: 'release-plan.md',
    });
    expect(projectStorage.updateProjectFile).toHaveBeenCalledWith('file-1', {
      fileName: 'release-plan-v2.md',
    });
    expect(projectStorage.deleteProjectFile).toHaveBeenCalledWith('file-1');
  });

  it('manages templates and handles missing usage increments', async () => {
    await expect(service.getProjectTemplates('release')).resolves.toEqual([baseTemplate]);
    await expect(service.getProjectTemplate('template-1')).resolves.toEqual(baseTemplate);
    await expect(service.createProjectTemplate({ name: '发布模板', category: 'release' } as any)).resolves.toEqual(
      baseTemplate,
    );
    await expect(service.incrementTemplateUsage('template-1')).resolves.toEqual(baseTemplate);

    vi.mocked(projectStorage.incrementTemplateUsage).mockResolvedValueOnce(undefined);
    await expect(service.incrementTemplateUsage('missing')).resolves.toBeUndefined();

    expect(projectStorage.getProjectTemplates).toHaveBeenCalledWith('release');
    expect(projectStorage.getProjectTemplate).toHaveBeenCalledWith('template-1');
    expect(projectStorage.createProjectTemplate).toHaveBeenCalledWith({
      name: '发布模板',
      category: 'release',
    });
    expect(projectStorage.incrementTemplateUsage).toHaveBeenCalledWith('template-1');
  });
});
