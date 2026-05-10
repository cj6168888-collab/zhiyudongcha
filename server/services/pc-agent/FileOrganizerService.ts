/**
 * 文件整理服务 - 电脑端Agent核心组件
 *
 * 功能：
 * - 扫描桌面、下载、文档等目录
 * - 按类型、日期、项目智能分类
 * - 归档整理、同步备份
 * - 查找特定文件
 *
 * @version 1.1.0
 * @date 2026-04-19
 */

import { createServiceLogger } from '../../lib/logger';
import * as fs from 'fs';
import * as path from 'path';
import { homedir, platform } from 'os';

const logger = createServiceLogger('FileOrganizer');

// 文件类型映射
const FILE_TYPE_MAP: Record<string, string[]> = {
  'document': ['.doc', '.docx', '.pdf', '.txt', '.rtf', '.odt', '.wps', '.md'],
  'spreadsheet': ['.xls', '.xlsx', '.csv', '.ods'],
  'presentation': ['.ppt', '.pptx', '.odp', '.key'],
  'image': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp', '.ico'],
  'video': ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm'],
  'audio': ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a'],
  'archive': ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2'],
  'code': ['.js', '.ts', '.py', '.java', '.cpp', '.c', '.h', '.cs', '.go', '.rs', '.php', '.rb', '.swift', '.kt'],
  'web': ['.html', '.css', '.scss', '.less', '.vue', '.jsx', '.tsx'],
  'data': ['.json', '.xml', '.yaml', '.yml', '.toml', '.ini', '.conf'],
  'executable': ['.exe', '.msi', '.dmg', '.app', '.deb', '.rpm', '.apk'],
  'design': ['.psd', '.ai', '.sketch', '.fig', '.xd', '.indd'],
};

export interface FileInfo {
  name: string;
  path: string;
  extension: string;
  type: string;
  size: number;
  createdAt: Date;
  modifiedAt: Date;
  isDirectory: boolean;
}

export interface OrganizeRule {
  id: string;
  name: string;
  sourcePattern: string | string[];
  targetFolder: string;
  action: 'move' | 'copy';
  enabled: boolean;
}

export interface OrganizationResult {
  success: boolean;
  organized: number;
  failed: number;
  details: Array<{
    file: string;
    action: string;
    target: string;
    error?: string;
  }>;
}

export class FileOrganizerService {
  private static instance: FileOrganizerService | null = null;
  private rules: Map<string, OrganizeRule> = new Map();
  private customFolders: string[] = [];

  private constructor() {
    this.initializeDefaultFolders();
    this.loadCustomRules();
  }

  public static getInstance(): FileOrganizerService {
    if (!FileOrganizerService.instance) {
      FileOrganizerService.instance = new FileOrganizerService();
    }
    return FileOrganizerService.instance;
  }

  /**
   * 初始化默认文件夹路径
   */
  private initializeDefaultFolders(): void {
    const homeDir = homedir();

    if (platform() === 'win32') {
      this.customFolders = [
        path.join(homeDir, 'Desktop'),
        path.join(homeDir, 'Downloads'),
        path.join(homeDir, 'Documents'),
        path.join(homeDir, 'Pictures'),
        path.join(homeDir, 'Videos'),
        path.join(homeDir, 'Music'),
      ];
    } else {
      this.customFolders = [
        path.join(homeDir, 'Desktop'),
        path.join(homeDir, 'Downloads'),
        path.join(homeDir, 'Documents'),
        path.join(homeDir, 'Pictures'),
        path.join(homeDir, 'Videos'),
        path.join(homeDir, 'Music'),
      ];
    }
  }

  /**
   * 加载自定义规则
   */
  private loadCustomRules(): void {
    // TODO: 从数据库或配置文件加载规则
  }

  /**
   * 扫描目录
   */
  public async scanDirectory(dirPath: string, recursive: boolean = false): Promise<FileInfo[]> {
    const files: FileInfo[] = [];

    try {
      await this.scanDirectoryRecursive(dirPath, files, recursive, 0, 3);
    } catch (error) {
      logger.error({ dirPath, error }, 'Failed to scan directory');
    }

    return files;
  }

  private async scanDirectoryRecursive(
    dirPath: string,
    files: FileInfo[],
    recursive: boolean,
    currentDepth: number,
    maxDepth: number
  ): Promise<void> {
    if (currentDepth > maxDepth) return;

    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        try {
          const stats = await fs.promises.stat(fullPath);
          const ext = path.extname(entry.name).toLowerCase();

          const fileInfo: FileInfo = {
            name: entry.name,
            path: fullPath,
            extension: ext,
            type: this.getFileType(ext),
            size: stats.size,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
            isDirectory: entry.isDirectory(),
          };

          files.push(fileInfo);

          if (recursive && entry.isDirectory() && !entry.name.startsWith('.')) {
            await this.scanDirectoryRecursive(fullPath, files, recursive, currentDepth + 1, maxDepth);
          }
        } catch (err) {
          logger.debug({ path: fullPath, error: err }, 'Failed to stat file');
        }
      }
    } catch (error) {
      logger.debug({ dirPath, error }, 'Failed to read directory');
    }
  }

  /**
   * 获取文件类型
   */
  public getFileType(extension: string): string {
    const ext = extension.toLowerCase();

    for (const [type, extensions] of Object.entries(FILE_TYPE_MAP)) {
      if (extensions.includes(ext)) {
        return type;
      }
    }

    return 'other';
  }

  /**
   * 按类型分类文件
   */
  public groupByType(files: FileInfo[]): Record<string, FileInfo[]> {
    const grouped: Record<string, FileInfo[]> = {};

    for (const file of files) {
      const type = file.isDirectory ? 'folder' : file.type;
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(file);
    }

    return grouped;
  }

  /**
   * 按日期分类文件
   */
  public groupByDate(files: FileInfo[]): Record<string, FileInfo[]> {
    const grouped: Record<string, FileInfo[]> = {};

    for (const file of files) {
      const date = new Date(file.modifiedAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(file);
    }

    return grouped;
  }

  /**
   * 整理桌面文件
   */
  public async organizeDesktop(options: {
    targetFolders?: Record<string, string[]>;
    action?: 'move' | 'copy';
    dryRun?: boolean;
  } = {}): Promise<OrganizationResult> {
    const desktopPath = path.join(homedir(), 'Desktop');
    const result: OrganizationResult = {
      success: true,
      organized: 0,
      failed: 0,
      details: [],
    };

    const targetFolders = options.targetFolders || this.getDefaultTargetFolders();
    const action = options.action || 'move';

    try {
      const files = await this.scanDirectory(desktopPath, false);

      for (const file of files) {
        if (file.isDirectory) continue;

        const targetFolder = this.findTargetFolder(file, targetFolders);
        if (!targetFolder) continue;

        const targetPath = path.join(targetFolder, file.name);

        try {
          if (options.dryRun) {
            result.details.push({
              file: file.name,
              action: action,
              target: targetPath,
            });
            result.organized++;
          } else {
            if (action === 'copy') {
              await fs.promises.copyFile(file.path, targetPath);
            } else {
              await fs.promises.rename(file.path, targetPath);
            }
            result.details.push({
              file: file.name,
              action: action,
              target: targetPath,
            });
            result.organized++;
          }
        } catch (error) {
          result.failed++;
          result.details.push({
            file: file.name,
            action: action,
            target: targetPath,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    } catch (error) {
      result.success = false;
      logger.error({ error }, 'Failed to organize desktop');
    }

    return result;
  }

  /**
   * 获取默认目标文件夹
   */
  private getDefaultTargetFolders(): Record<string, string[]> {
    const homeDir = homedir();
    return {
      'document': [path.join(homeDir, 'Documents')],
      'spreadsheet': [path.join(homeDir, 'Documents', '电子表格')],
      'presentation': [path.join(homeDir, 'Documents', '演示文稿')],
      'image': [path.join(homeDir, 'Pictures')],
      'video': [path.join(homeDir, 'Videos')],
      'audio': [path.join(homeDir, 'Music')],
      'archive': [path.join(homeDir, 'Documents', '压缩包')],
      'code': [path.join(homeDir, 'Documents', '代码')],
      'web': [path.join(homeDir, 'Documents', '代码')],
      'design': [path.join(homeDir, 'Documents', '设计')],
    };
  }

  /**
   * 查找目标文件夹
   */
  private findTargetFolder(file: FileInfo, targetFolders: Record<string, string[]>): string | null {
    const folder = targetFolders[file.type];
    if (!folder || folder.length === 0) return null;

    // 返回第一个存在的文件夹
    for (const dir of folder) {
      try {
        const stats = fs.statSync(dir);
        if (stats.isDirectory()) {
          return dir;
        }
      } catch {
        // 文件夹不存在，尝试创建
        try {
          fs.mkdirSync(dir, { recursive: true });
          return dir;
        } catch {
          continue;
        }
      }
    }

    return folder[0];
  }

  /**
   * 查找项目相关文件
   */
  public async findProjectFiles(
    basePath: string,
    projectName: string,
    keywords: string[] = []
  ): Promise<FileInfo[]> {
    const results: FileInfo[] = [];
    const files = await this.scanDirectory(basePath, true);

    for (const file of files) {
      // 匹配项目名称
      if (file.name.toLowerCase().includes(projectName.toLowerCase())) {
        results.push(file);
        continue;
      }

      // 匹配关键词
      for (const keyword of keywords) {
        if (file.name.toLowerCase().includes(keyword.toLowerCase())) {
          results.push(file);
          break;
        }
      }
    }

    return results;
  }

  /**
   * 查找科技局申报相关文件
   */
  public async findGovernmentFiles(basePath: string): Promise<FileInfo[]> {
    const keywords = [
      '科技局', '申报', '项目', '计划', '认定', '批复', '通知',
      '申报书', '可行性', '方案', '预算', '合同', '发票',
      '营业执照', '法人', '证书', '资质', '专利', '成果',
    ];

    const results: FileInfo[] = [];
    const files = await this.scanDirectory(basePath, true);

    for (const file of files) {
      for (const keyword of keywords) {
        if (file.name.includes(keyword)) {
          results.push(file);
          break;
        }
      }
    }

    return results;
  }

  /**
   * 创建归档
   */
  public async createArchive(
    sourcePath: string,
    archiveName: string,
    archiveFolder: string
  ): Promise<string> {
    const archivePath = path.join(archiveFolder, `${archiveName}.zip`);

    // 确保目标文件夹存在
    await fs.promises.mkdir(archiveFolder, { recursive: true });

    // TODO: 使用archiver库创建zip文件
    logger.info({ sourcePath, archivePath }, 'Creating archive');

    return archivePath;
  }

  /**
   * 获取文件统计
   */
  public async getFileStats(dirPath: string): Promise<{
    total: number;
    byType: Record<string, number>;
    totalSize: number;
    largestFiles: FileInfo[];
  }> {
    const files = await this.scanDirectory(dirPath, true);
    const byType: Record<string, number> = {};
    let totalSize = 0;

    for (const file of files) {
      if (!file.isDirectory) {
        const type = file.type;
        byType[type] = (byType[type] || 0) + 1;
        totalSize += file.size;
      }
    }

    const largestFiles = files
      .filter(f => !f.isDirectory)
      .sort((a, b) => b.size - a.size)
      .slice(0, 10);

    return {
      total: files.length,
      byType,
      totalSize,
      largestFiles,
    };
  }
}

export const fileOrganizerService = FileOrganizerService.getInstance();
export default fileOrganizerService;
