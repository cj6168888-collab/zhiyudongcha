/**
 * 编程辅助服务 - 电脑端Agent核心组件
 *
 * 功能：
 * - 理解用户编程意图
 * - 读取开发文档
 * - 操作编程软件（VSCode、IDE等）
 * - 代码生成和补全
 * - 项目管理
 *
 * @version 1.1.0
 * @date 2026-04-19
 */

import { createServiceLogger } from '../../lib/logger';
import { exec, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { homedir, platform } from 'os';

const execAsync = promisify(exec);

const logger = createServiceLogger('ProgrammingAssistant');

// 支持的编程语言
export const SUPPORTED_LANGUAGES = {
  javascript: { ext: ['.js', '.jsx'], mode: 'javascript' },
  typescript: { ext: ['.ts', '.tsx'], mode: 'typescript' },
  python: { ext: ['.py'], mode: 'python' },
  java: { ext: ['.java'], mode: 'java' },
  csharp: { ext: ['.cs'], mode: 'csharp' },
  cpp: { ext: ['.cpp', '.cc', '.cxx', '.h', '.hpp'], mode: 'cpp' },
  go: { ext: ['.go'], mode: 'go' },
  rust: { ext: ['.rs'], mode: 'rust' },
  php: { ext: ['.php'], mode: 'php' },
  ruby: { ext: ['.rb'], mode: 'ruby' },
  swift: { ext: ['.swift'], mode: 'swift' },
  kotlin: { ext: ['.kt', '.kts'], mode: 'kotlin' },
  sql: { ext: ['.sql'], mode: 'sql' },
  html: { ext: ['.html', '.htm'], mode: 'html' },
  css: { ext: ['.css', '.scss', '.less'], mode: 'css' },
  json: { ext: ['.json'], mode: 'json' },
  yaml: { ext: ['.yaml', '.yml'], mode: 'yaml' },
  markdown: { ext: ['.md'], mode: 'markdown' },
};

// IDE配置
export interface IDEConfig {
  name: string;
  command: string;
  args: string[];
  extensions: string[];
  workspaceConfig: string;
}

const IDE_CONFIGS: Record<string, IDEConfig> = {
  vscode: {
    name: 'Visual Studio Code',
    command: platform() === 'win32' ? 'code.cmd' : 'code',
    args: ['--goto'],
    extensions: ['.vscode'],
    workspaceConfig: '.vscode/settings.json',
  },
  intellij: {
    name: 'IntelliJ IDEA',
    command: platform() === 'win32' ? 'idea64.exe' : 'idea',
    args: [],
    extensions: ['.idea'],
    workspaceConfig: '.idea/workspace.xml',
  },
  pycharm: {
    name: 'PyCharm',
    command: platform() === 'win32' ? 'pycharm64.exe' : 'pycharm',
    args: [],
    extensions: ['.idea'],
    workspaceConfig: '.idea/workspace.xml',
  },
  webstorm: {
    name: 'WebStorm',
    command: platform() === 'win32' ? 'webstorm64.exe' : 'webstorm',
    args: [],
    extensions: ['.idea'],
    workspaceConfig: '.idea/workspace.xml',
  },
  eclipse: {
    name: 'Eclipse',
    command: platform() === 'win32' ? 'eclipse.exe' : 'eclipse',
    args: [],
    extensions: ['.project', '.classpath'],
    workspaceConfig: '.settings',
  },
  sublime: {
    name: 'Sublime Text',
    command: platform() === 'win32' ? 'sublime_text.exe' : 'subl',
    args: [],
    extensions: [],
    workspaceConfig: '.sublime-project',
  },
};

export interface CodeSnippet {
  language: string;
  code: string;
  description: string;
  filePath?: string;
}

export interface ProjectInfo {
  name: string;
  path: string;
  language: string;
  framework?: string;
  files: string[];
  dependencies?: string[];
}

export class ProgrammingAssistantService {
  private static instance: ProgrammingAssistantService | null = null;
  private currentIDE: string = 'vscode';
  private projectCache: Map<string, ProjectInfo> = new Map();

  private constructor() {
    this.detectIDE();
  }

  public static getInstance(): ProgrammingAssistantService {
    if (!ProgrammingAssistantService.instance) {
      ProgrammingAssistantService.instance = new ProgrammingAssistantService();
    }
    return ProgrammingAssistantService.instance;
  }

  /**
   * 检测已安装的IDE
   */
  private detectIDE(): void {
    // 检测VS Code
    if (platform() === 'win32') {
      this.checkIDE('code.cmd', 'vscode').then(has => {
        if (has) this.currentIDE = 'vscode';
      });
    } else {
      this.checkIDE('code', 'vscode').then(has => {
        if (has) this.currentIDE = 'vscode';
      });
    }
  }

  private async checkIDE(command: string, name: string): Promise<boolean> {
    try {
      await execAsync(`which ${command} || where ${command}`);
      logger.info(`Found IDE: ${name}`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 打开文件
   */
  public async openFile(filePath: string, line?: number): Promise<boolean> {
    try {
      const ide = IDE_CONFIGS[this.currentIDE];
      let command = ide.command;
      let args = [...ide.args];

      if (line) {
        args.push(`${filePath}:${line}`);
      } else {
        args.push(filePath);
      }

      if (platform() === 'win32') {
        spawn('cmd', ['/c', 'start', '', command, ...args], { detached: true });
      } else {
        spawn(command, args, { detached: true });
      }

      logger.info({ filePath, line }, 'Opening file in IDE');
      return true;
    } catch (error) {
      logger.error({ error, filePath }, 'Failed to open file');
      return false;
    }
  }

  /**
   * 打开文件夹/项目
   */
  public async openProject(projectPath: string): Promise<boolean> {
    try {
      const ide = IDE_CONFIGS[this.currentIDE];
      const command = ide.command;

      if (platform() === 'win32') {
        await execAsync(`start "" "${command}" "${projectPath}"`);
      } else {
        spawn(command, [projectPath], { detached: true });
      }

      logger.info({ projectPath }, 'Opening project in IDE');
      return true;
    } catch (error) {
      logger.error({ error, projectPath }, 'Failed to open project');
      return false;
    }
  }

  /**
   * 打开终端
   */
  public async openTerminal(cwd?: string): Promise<boolean> {
    try {
      const dir = cwd || process.cwd();

      if (platform() === 'win32') {
        spawn('cmd', ['/c', 'start', 'cmd', '/k', `cd /d "${dir}"`], { detached: true });
      } else if (platform() === 'darwin') {
        spawn('open', ['-a', 'Terminal', dir], { detached: true });
      } else {
        spawn('x-terminal-emulator', [], { cwd: dir, detached: true });
      }

      logger.info({ cwd: dir }, 'Opening terminal');
      return true;
    } catch (error) {
      logger.error({ error }, 'Failed to open terminal');
      return false;
    }
  }

  /**
   * 创建代码文件
   */
  public async createCodeFile(
    filePath: string,
    language: string,
    template?: string
  ): Promise<boolean> {
    try {
      // 确保目录存在
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // 生成代码模板
      const code = template || this.generateTemplate(language, path.basename(filePath));
      fs.writeFileSync(filePath, code, 'utf-8');

      logger.info({ filePath, language }, 'Code file created');

      // 自动打开文件
      await this.openFile(filePath);

      return true;
    } catch (error) {
      logger.error({ error, filePath }, 'Failed to create code file');
      return false;
    }
  }

  /**
   * 生成代码模板
   */
  private generateTemplate(language: string, filename: string): string {
    const templates: Record<string, () => string> = {
      javascript: () => `/**
 * ${filename}
 * Created by 小星
 */

function main() {
  console.log('Hello, World!');
}

main();
`,
      typescript: () => `/**
 * ${filename}
 * Created by 小星
 */

interface Props {
  name: string;
}

function main(): void {
  console.log('Hello, World!');
}

main();
`,
      python: () => `# ${filename}
# Created by 小星

def main():
    print("Hello, World!")

if __name__ == "__main__":
    main()
`,
      java: () => `/**
 * ${filename}
 * Created by 小星
 */

public class ${path.basename(filename, '.java')} {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}
`,
      html: () => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${path.basename(filename, '.html')}</title>
</head>
<body>
    <h1>Hello, World!</h1>
</body>
</html>
`,
      css: () => `/**
 * ${filename}
 * Created by 小星
 */

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}
`,
      json: () => `{
  "name": "project",
  "version": "1.0.0",
  "description": "Created by 小星",
  "main": "index.js"
}
`,
    };

    return templates[language]?.() || `// ${filename}\n// Created by 小星\n`;
  }

  /**
   * 读取项目结构
   */
  public async readProjectStructure(projectPath: string): Promise<ProjectInfo> {
    try {
      // 检查缓存
      const cached = this.projectCache.get(projectPath);
      if (cached) return cached;

      const files: string[] = [];
      const language = this.detectProjectLanguage(projectPath);

      await this.scanDirectory(projectPath, files, 0, 5);

      const projectInfo: ProjectInfo = {
        name: path.basename(projectPath),
        path: projectPath,
        language,
        framework: this.detectFramework(projectPath, files),
        files: files.slice(0, 100), // 限制返回数量
      };

      // 读取依赖
      if (language === 'javascript' || language === 'typescript') {
        const packageJson = path.join(projectPath, 'package.json');
        if (fs.existsSync(packageJson)) {
          try {
            const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf-8'));
            projectInfo.dependencies = [
              ...Object.keys(pkg.dependencies || {}),
              ...Object.keys(pkg.devDependencies || {}),
            ];
          } catch {
            // 忽略解析错误
          }
        }
      }

      this.projectCache.set(projectPath, projectInfo);
      return projectInfo;
    } catch (error) {
      logger.error({ error, projectPath }, 'Failed to read project structure');
      throw error;
    }
  }

  /**
   * 扫描目录
   */
  private async scanDirectory(dir: string, files: string[], depth: number, maxDepth: number): Promise<void> {
    if (depth > maxDepth) return;

    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        // 跳过隐藏文件和常见忽略目录
        if (entry.name.startsWith('.') ||
            ['node_modules', 'dist', 'build', 'target', '__pycache__'].includes(entry.name)) {
          continue;
        }

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await this.scanDirectory(fullPath, files, depth + 1, maxDepth);
        } else {
          files.push(fullPath);
        }
      }
    } catch {
      // 忽略权限错误
    }
  }

  /**
   * 检测项目语言
   */
  private detectProjectLanguage(projectPath: string): string {
    const extensionCounts: Record<string, number> = {};

    const checkExtensions = (dir: string, depth: number) => {
      if (depth > 3) return;

      try {
        const entries = fs.readdirSync(dir);

        for (const entry of entries) {
          if (entry.startsWith('.')) continue;
          if (['node_modules', 'dist', 'build'].includes(entry)) continue;

          const fullPath = path.join(dir, entry);
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            checkExtensions(fullPath, depth + 1);
          } else {
            const ext = path.extname(entry);
            if (ext) {
              extensionCounts[ext] = (extensionCounts[ext] || 0) + 1;
            }
          }
        }
      } catch {
        // 忽略
      }
    };

    checkExtensions(projectPath, 0);

    // 统计
    const langMap: Record<string, string> = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.cs': 'csharp',
      '.go': 'go',
      '.rs': 'rust',
      '.rb': 'ruby',
      '.swift': 'swift',
      '.kt': 'kotlin',
    };

    let maxCount = 0;
    let detectedLang = 'unknown';

    for (const [ext, count] of Object.entries(extensionCounts)) {
      if (count > maxCount) {
        maxCount = count;
        detectedLang = langMap[ext] || ext;
      }
    }

    return detectedLang;
  }

  /**
   * 检测项目框架
   */
  private detectFramework(projectPath: string, files: string[]): string | undefined {
    const packageJson = path.join(projectPath, 'package.json');
    if (fs.existsSync(packageJson)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf-8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };

        if (deps.react) return 'React';
        if (deps.vue) return 'Vue';
        if (deps.angular) return 'Angular';
        if (deps.next) return 'Next.js';
        if (deps.nuxt) return 'Nuxt';
        if (deps.express) return 'Express';
        if (deps.fastify) return 'Fastify';
        if (deps.nest) return 'NestJS';
      } catch {
        // 忽略
      }
    }

    const pyproject = path.join(projectPath, 'pyproject.toml');
    const requirements = path.join(projectPath, 'requirements.txt');

    if (fs.existsSync(pyproject) || fs.existsSync(requirements)) {
      try {
        const content = fs.readFileSync(fs.existsSync(pyproject) ? pyproject : requirements, 'utf-8');
        if (content.includes('fastapi')) return 'FastAPI';
        if (content.includes('django')) return 'Django';
        if (content.includes('flask')) return 'Flask';
      } catch {
        // 忽略
      }
    }

    return undefined;
  }

  /**
   * 搜索代码文件
   */
  public async searchCodeFiles(
    projectPath: string,
    keyword: string,
    options: {
      extensions?: string[];
      caseSensitive?: boolean;
      wholeWord?: boolean;
    } = {}
  ): Promise<string[]> {
    const results: string[] = [];
    const { extensions, caseSensitive = false, wholeWord = false } = options;

    try {
      await this.searchInDirectory(
        projectPath,
        keyword,
        results,
        { extensions, caseSensitive, wholeWord },
        0,
        5
      );
    } catch (error) {
      logger.error({ error, keyword }, 'Failed to search code');
    }

    return results;
  }

  private async searchInDirectory(
    dir: string,
    keyword: string,
    results: string[],
    options: {
      extensions?: string[];
      caseSensitive?: boolean;
      wholeWord?: boolean;
    },
    depth: number,
    maxDepth: number
  ): Promise<void> {
    if (depth > maxDepth) return;

    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        if (['node_modules', 'dist', 'build', 'target'].includes(entry.name)) continue;

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await this.searchInDirectory(fullPath, keyword, results, options, depth + 1, maxDepth);
        } else {
          // 检查扩展名
          if (options.extensions) {
            const ext = path.extname(entry.name);
            if (!options.extensions.includes(ext)) continue;
          }

          // 搜索内容
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const searchKeyword = options.caseSensitive ? keyword : keyword.toLowerCase();
            const searchContent = options.caseSensitive ? content : content.toLowerCase();

            if (options.wholeWord) {
              const regex = new RegExp(`\\b${searchKeyword}\\b`, 'g');
              if (regex.test(searchContent)) {
                results.push(fullPath);
              }
            } else {
              if (searchContent.includes(searchKeyword)) {
                results.push(fullPath);
              }
            }
          } catch {
            // 忽略二进制文件等
          }
        }
      }
    } catch {
      // 忽略
    }
  }

  /**
   * 读取代码文件
   */
  public async readCodeFile(filePath: string): Promise<{
    content: string;
    language: string;
    lines: number;
  } | null> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const ext = path.extname(filePath);

      const langMap: Record<string, string> = {};
      for (const [lang, config] of Object.entries(SUPPORTED_LANGUAGES)) {
        if (config.ext.includes(ext)) {
          return {
            content,
            language: lang,
            lines: content.split('\n').length,
          };
        }
      }

      return {
        content,
        language: 'text',
        lines: content.split('\n').length,
      };
    } catch (error) {
      logger.error({ error, filePath }, 'Failed to read code file');
      return null;
    }
  }

  /**
   * 获取开发文档目录
   */
  public async getDevDocsPath(): Promise<string[]> {
    const docsPaths: string[] = [];
    const homeDir = homedir();

    // 常见开发文档位置
    const possiblePaths = [
      path.join(homeDir, 'Documents', '开发文档'),
      path.join(homeDir, 'Documents', 'DevDocs'),
      path.join(homeDir, 'Documents', 'API'),
      path.join(homeDir, 'Documents', '项目文档'),
      path.join(homeDir, 'Desktop', '开发文档'),
    ];

    for (const docPath of possiblePaths) {
      if (fs.existsSync(docPath)) {
        docsPaths.push(docPath);
      }
    }

    return docsPaths;
  }

  /**
   * 搜索开发文档
   */
  public async searchDevDocs(keyword: string): Promise<Array<{
    title: string;
    path: string;
    preview: string;
  }>> {
    const results: Array<{ title: string; path: string; preview: string }> = [];
    const docsPaths = await this.getDevDocsPath();

    for (const docPath of docsPaths) {
      await this.searchInDirectory(
        docPath,
        keyword,
        [],
        { extensions: ['.md', '.txt', '.doc', '.docx', '.pdf'] },
        0,
        3
      );
    }

    // TODO: 实现更智能的文档搜索
    return results;
  }

  /**
   * 运行Git命令
   */
  public async runGitCommand(cwd: string, args: string[]): Promise<{
    success: boolean;
    output: string;
    error?: string;
  }> {
    try {
      const { stdout, stderr } = await execAsync(`git ${args.join(' ')}`, { cwd, encoding: 'utf-8' });
      return { success: true, output: stdout + stderr };
    } catch (error: unknown) {
      const gitError = error as { stderr?: string; message?: string };
      return {
        success: false,
        output: '',
        error: gitError.stderr || gitError.message,
      };
    }
  }

  /**
   * 获取Git状态
   */
  public async getGitStatus(projectPath: string): Promise<{
    branch: string;
    changes: string[];
    staged: string[];
    untracked: string[];
  } | null> {
    try {
      const result = await this.runGitCommand(projectPath, ['status', '--porcelain']);

      if (!result.success) return null;

      const lines = result.output.split('\n').filter(Boolean);
      const changes: string[] = [];
      const staged: string[] = [];
      const untracked: string[] = [];

      for (const line of lines) {
        const status = line.substring(0, 2);
        const file = line.substring(3);

        if (status.includes('?')) {
          untracked.push(file);
        } else if (status.startsWith(' ')) {
          changes.push(file);
        } else {
          staged.push(file);
        }
      }

      const branchResult = await this.runGitCommand(projectPath, ['branch', '--show-current']);
      const branch = branchResult.success ? branchResult.output.trim() : 'unknown';

      return { branch, changes, staged, untracked };
    } catch {
      return null;
    }
  }

  /**
   * 创建项目
   */
  public async createProject(
    name: string,
    language: string,
    options: {
      framework?: string;
      template?: string;
      location?: string;
    } = {}
  ): Promise<{
    success: boolean;
    path?: string;
    error?: string;
  }> {
    const location = options.location || path.join(homedir(), 'Projects');
    const projectPath = path.join(location, name);

    try {
      // 创建项目目录
      if (!fs.existsSync(projectPath)) {
        fs.mkdirSync(projectPath, { recursive: true });
      }

      // 根据语言和框架创建项目
      switch (language) {
        case 'javascript':
        case 'typescript':
          await this.createJSProject(projectPath, options.framework);
          break;
        case 'python':
          await this.createPythonProject(projectPath, options.framework);
          break;
        case 'java':
          await this.createJavaProject(projectPath);
          break;
      }

      // 打开项目
      await this.openProject(projectPath);

      return { success: true, path: projectPath };
    } catch (error) {
      logger.error({ error, name }, 'Failed to create project');
      return { success: false, error: '项目创建失败' };
    }
  }

  private async createJSProject(projectPath: string, framework?: string): Promise<void> {
    const packageJson: Record<string, unknown> = {
      name: path.basename(projectPath),
      version: '1.0.0',
      description: 'Created by 小星',
      main: 'index.js',
      scripts: {
        start: 'node index.js',
        dev: framework === 'react' ? 'vite' : framework === 'vue' ? 'vite' : 'nodemon',
      },
    };

    if (framework) {
      packageJson.dependencies = { [framework]: '^latest' };
    }

    fs.writeFileSync(
      path.join(projectPath, 'package.json'),
      JSON.stringify(packageJson, null, 2),
      'utf-8'
    );

    // 创建入口文件
    const ext = framework === 'typescript' ? 'ts' : 'js';
    const mainFile = path.join(projectPath, `index.${ext}`);
    fs.writeFileSync(mainFile, this.generateTemplate('javascript', `index.${ext}`), 'utf-8');
  }

  private async createPythonProject(projectPath: string, framework?: string): Promise<void> {
    fs.writeFileSync(
      path.join(projectPath, 'requirements.txt'),
      framework ? `${framework}\n` : '# Requirements\n',
      'utf-8'
    );

    fs.writeFileSync(
      path.join(projectPath, 'main.py'),
      this.generateTemplate('python', 'main.py'),
      'utf-8'
    );
  }

  private async createJavaProject(projectPath: string): Promise<void> {
    const className = path.basename(projectPath);
    fs.writeFileSync(
      path.join(projectPath, `${className}.java`),
      this.generateTemplate('java', `${className}.java`),
      'utf-8'
    );

    fs.writeFileSync(
      path.join(projectPath, 'README.md'),
      `# ${className}\n\nCreated by 小星\n`,
      'utf-8'
    );
  }
}

export const programmingAssistantService = ProgrammingAssistantService.getInstance();
export default programmingAssistantService;
