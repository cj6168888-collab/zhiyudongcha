/**
 * PC执行器服务 - 企业级实现
 * 提供PC端自动化执行能力，使用PyAutoGUI进行鼠标键盘控制
 * 支持Windows、macOS、Linux平台
 *
 * @version 3.0.0
 * @author 架构组
 * @date 2026-03-03
 *
 * 企业级特性：
 * - 真实单例模式
 * - 异步初始化
 * - 完善错误处理
 * - 资源清理
 * - 健康检查
 */

import { createServiceLogger } from '../../lib/logger';
import { spawn, execSync } from 'child_process';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';

const logger = createServiceLogger('PCExecutor');

/**
 * PyAutoGUI动作类型
 */
interface PyAutoGUIAction {
  type: 'click' | 'double_click' | 'right_click' | 'move_to' | 'drag_to' |
        'type' | 'press' | 'hotkey' | 'screenshot' | 'locate' | 'scroll' |
        'alert' | 'confirm' | 'prompt';
  params: Record<string, unknown>;
}

/**
 * 执行选项
 */
interface ExecuteOptions {
  timeout?: number;
  captureScreen?: boolean;
}

/**
 * 截图结果
 */
interface ScreenshotResult {
  path: string;
  width: number;
  height: number;
  data?: string;
}

/**
 * 定位结果
 */
interface LocateResult {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Python环境信息
 */
interface PythonEnvironment {
  version: string;
  path: string;
  executable: string;
  hasPyAutoGUI: boolean;
}

/**
 * 默认执行选项
 */
const DEFAULT_OPTIONS: ExecuteOptions = {
  timeout: 30000,
  captureScreen: false,
};

/**
 * PyAutoGUI Python脚本
 */
const PYAUTOGUI_SCRIPT = `
import pyautogui
import sys
import json
import base64
from PIL import Image
import io

pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0.1

def execute_action(action):
    result = {"success": False, "data": None, "error": None}

    try:
        action_type = action.get("type")
        params = action.get("params", {})

        if action_type == "click":
            x = params.get("x")
            y = params.get("y")
            if x is not None and y is not None:
                pyautogui.click(x, y, clicks=params.get("clicks", 1), button=params.get("button", "left"))
                result["success"] = True
                result["data"] = {"x": x, "y": y}
            else:
                pyautogui.click()
                result["success"] = True

        elif action_type == "double_click":
            x = params.get("x")
            y = params.get("y")
            if x is not None and y is not None:
                pyautogui.doubleClick(x, y)
                result["success"] = True
            else:
                pyautogui.doubleClick()
                result["success"] = True

        elif action_type == "right_click":
            x = params.get("x")
            y = params.get("y")
            if x is not None and y is not None:
                pyautogui.rightClick(x, y)
                result["success"] = True
            else:
                pyautogui.rightClick()
                result["success"] = True

        elif action_type == "move_to":
            x = params.get("x", 0)
            y = params.get("y", 0)
            duration = params.get("duration", 0)
            pyautogui.moveTo(x, y, duration=duration)
            result["success"] = True
            result["data"] = {"x": x, "y": y}

        elif action_type == "drag_to":
            start_x = params.get("start_x")
            start_y = params.get("start_y")
            end_x = params.get("end_x")
            end_y = params.get("end_y")
            duration = params.get("duration", 0.5)
            if start_x is not None and start_y is not None:
                pyautogui.moveTo(start_x, start_y)
            pyautogui.dragTo(end_x, end_y, duration=duration, button=params.get("button", "left"))
            result["success"] = True
            result["data"] = {"end_x": end_x, "end_y": end_y}

        elif action_type == "type":
            text = params.get("text", "")
            interval = params.get("interval", 0.05)
            pyautogui.write(text, interval=interval)
            result["success"] = True
            result["data"] = {"text_length": len(text)}

        elif action_type == "press":
            keys = params.get("keys", [])
            if isinstance(keys, str):
                keys = [keys]
            for key in keys:
                pyautogui.press(key)
            result["success"] = True
            result["data"] = {"keys": keys}

        elif action_type == "hotkey":
            keys = params.get("keys", [])
            if isinstance(keys, str):
                keys = [keys]
            pyautogui.hotkey(*keys)
            result["success"] = True
            result["data"] = {"keys": keys}

        elif action_type == "screenshot":
            path = params.get("path")
            region = params.get("region")

            if region:
                img = pyautogui.screenshot(region=region)
            else:
                img = pyautogui.screenshot()

            if path:
                img.save(path)
                result["success"] = True
                result["data"] = {"path": path, "width": img.width, "height": img.height}
            else:
                buffered = io.BytesIO()
                img.save(buffered, format="PNG")
                img_bytes = buffered.getvalue()
                img_base64 = base64.b64encode(img_bytes).decode()
                result["success"] = True
                result["data"] = {"width": img.width, "height": img.height, "data": img_base64}

        elif action_type == "locate":
            needle = params.get("needle")

            if needle and needle.startswith("text:"):
                result["error"] = "Text recognition requires pytesseract"
            elif needle:
                location = pyautogui.locateOnScreen(needle, confidence=params.get("confidence", 0.9))
                if location:
                    result["success"] = True
                    result["data"] = {
                        "x": location.left,
                        "y": location.top,
                        "width": location.width,
                        "height": location.height
                    }
                else:
                    result["error"] = "Target not found on screen"
            else:
                result["error"] = "Needle parameter required"

        elif action_type == "scroll":
            clicks = params.get("clicks", 3)
            x = params.get("x")
            y = params.get("y")
            if x is not None and y is not None:
                pyautogui.scroll(clicks, x=x, y=y)
            else:
                pyautogui.scroll(clicks)
            result["success"] = True
            result["data"] = {"clicks": clicks}

        elif action_type == "alert":
            text = params.get("text", "")
            title = params.get("title", "Alert")
            button = params.get("button", "OK")
            pyautogui.alert(text=text, title=title, button=button)
            result["success"] = True

        elif action_type == "confirm":
            text = params.get("text", "")
            title = params.get("title", "Confirm")
            buttons = params.get("buttons", ["OK", "Cancel"])
            result["success"] = True
            result["data"] = {"button": pyautogui.confirm(text=text, title=title, buttons=buttons)}

        elif action_type == "prompt":
            text = params.get("text", "")
            title = params.get("title", "Input")
            default_ = params.get("default", "")
            result["success"] = True
            result["data"] = {"text": pyautogui.prompt(text=text, title=title, default=default_)}

        else:
            result["error"] = f"Unknown action type: {action_type}"

    except Exception as e:
        result["error"] = str(e)

    return result

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--action", required=True)
    args = parser.parse_args()

    action = json.loads(args.action)
    result = execute_action(action)
    print(json.dumps(result))
`;

/**
 * PC执行器服务 - 单例模式
 */
export class PCExecutorService {
  private static instance: PCExecutorService | null = null;
  private static initializationCount = 0;

  private scriptPath: string;
  private pythonEnvironment: PythonEnvironment | null = null;
  private initializationPromise: Promise<void> | null = null;
  private initialized = false;
  private checkInterval: NodeJS.Timeout | null = null;

  /**
   * 私有构造函数 - 防止外部实例化
   */
  private constructor() {
    PCExecutorService.initializationCount++;

    this.scriptPath = join(tmpdir(), 'xiaozhi_pyautogui.py');

    if (PCExecutorService.initializationCount > 1) {
      logger.warn(
        {
          count: PCExecutorService.initializationCount,
          stackTrace: new Error().stack
        },
        'PCExecutorService instantiated multiple times - this indicates a code smell'
      );
    }

    logger.info(
      { instanceId: this.getInstanceId() },
      'PCExecutorService instance created'
    );
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): PCExecutorService {
    if (!PCExecutorService.instance) {
      PCExecutorService.instance = new PCExecutorService();
      logger.info(
        {
          initializationCount: PCExecutorService.initializationCount,
          timestamp: new Date().toISOString()
        },
        'PCExecutorService singleton instance initialized'
      );
    }
    return PCExecutorService.instance;
  }

  /**
   * 获取Python版本 - ✅ 修复递归Bug
   *
   * @returns Python版本字符串或null
   */
  public getPythonVersion(): string | null {
    // ✅ 直接返回属性，不再递归调用
    return this.pythonEnvironment?.version ?? null;
  }

  /**
   * 获取Python完整环境信息
   */
  public getPythonEnvironment(): PythonEnvironment | null {
    return this.pythonEnvironment;
  }

  /**
   * 检查是否已初始化
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 检查服务是否可用
   */
  public isReady(): boolean {
    return this.initialized && this.pythonEnvironment !== null && this.pythonEnvironment.hasPyAutoGUI;
  }

  /**
   * 异步初始化服务 - 幂等操作
   */
  public async initialize(): Promise<void> {
    // 如果已经初始化，直接返回
    if (this.initialized) {
      logger.debug('PCExecutorService already initialized, skipping');
      return;
    }

    // 如果正在初始化，等待完成
    if (this.initializationPromise) {
      logger.debug('PCExecutorService initialization in progress, waiting...');
      return this.initializationPromise;
    }

    // 开始初始化
    this.initializationPromise = this.performInitialization();

    try {
      await this.initializationPromise;
    } catch (error) {
      // 初始化失败，清除Promise以便重试
      this.initializationPromise = null;
      throw error;
    }
  }

  /**
   * 执行初始化逻辑
   */
  private async performInitialization(): Promise<void> {
    logger.info('Starting PCExecutorService initialization...');
    const startTime = Date.now();

    try {
      // 1. 创建脚本文件
      await this.createScriptFile();

      // 2. 检测Python环境
      await this.detectPythonEnvironment();

      // 3. 验证PyAutoGUI安装
      if (this.pythonEnvironment) {
        await this.validatePyAutoGUI();
      }

      // 4. 启动健康检查
      this.startHealthCheck();

      this.initialized = true;

      const duration = Date.now() - startTime;
      logger.info(
        {
          pythonVersion: this.pythonEnvironment?.version,
          pythonPath: this.pythonEnvironment?.path,
          hasPyAutoGUI: this.pythonEnvironment?.hasPyAutoGUI,
          duration,
          initialized: this.initialized
        },
        'PCExecutorService initialized successfully'
      );

    } catch (error) {
      logger.error(
        { error, duration: Date.now() - startTime },
        'PCExecutorService initialization failed'
      );

      // Python/PyAutoGUI不是必需的，只是警告
      logger.warn(
        'Python/PyAutoGUI environment not available, PC automation will be disabled'
      );

      // 标记为已初始化（但Python不可用）
      this.initialized = true;
    }
  }

  /**
   * 创建PyAutoGUI脚本文件
   */
  private async createScriptFile(): Promise<void> {
    try {
      const scriptDir = dirname(this.scriptPath);

      if (!existsSync(scriptDir)) {
        mkdirSync(scriptDir, { recursive: true });
      }

      writeFileSync(this.scriptPath, PYAUTOGUI_SCRIPT, 'utf-8');

      logger.debug(
        { scriptPath: this.scriptPath },
        'PyAutoGUI script file created'
      );
    } catch (error) {
      logger.error({ error, scriptPath: this.scriptPath }, 'Failed to create script file');
      throw error;
    }
  }

  /**
   * 检测Python环境
   */
  private async detectPythonEnvironment(): Promise<void> {
    if (process.env.PC_EXECUTOR_SKIP_PYTHON_DETECT === 'true') {
      this.pythonEnvironment = null;
      logger.debug('Python environment detection skipped');
      return;
    }

    const pythonCommands = ['python3', 'python', 'py'];

    for (const cmd of pythonCommands) {
      try {
        // 获取Python版本
        const versionOutput = execSync(`${cmd} --version`, {
          encoding: 'utf-8',
          timeout: 5000
        });

        const versionMatch = versionOutput.match(/Python (\d+\.\d+\.\d+)/i);

        if (versionMatch) {
          // 获取Python可执行文件路径
          const pathOutput = execSync(`${cmd} -c "import sys; print(sys.executable)"`, {
            encoding: 'utf-8',
            timeout: 5000
          });

          this.pythonEnvironment = {
            version: versionMatch[1],
            path: pathOutput.trim(),
            executable: cmd,
            hasPyAutoGUI: false
          };

          logger.info(
            {
              command: cmd,
              version: this.pythonEnvironment.version,
              path: this.pythonEnvironment.path
            },
            'Python environment detected'
          );

          return;
        }
      } catch (error) {
        // 继续尝试下一个命令
        logger.debug({ command: cmd, error }, 'Python command not available');
      }
    }

    logger.warn('No Python environment found');
  }

  /**
   * 验证PyAutoGUI安装
   */
  private async validatePyAutoGUI(): Promise<void> {
    if (!this.pythonEnvironment) {
      return;
    }

    try {
      const checkScript = 'import pyautogui; print("OK")';
      const output = execSync(
        `${this.pythonEnvironment.executable} -c "${checkScript}"`,
        {
          encoding: 'utf-8',
          timeout: 5000
        }
      );

      if (output.trim() === 'OK') {
        this.pythonEnvironment.hasPyAutoGUI = true;
        logger.info('PyAutoGUI is installed and available');
      }
    } catch (error) {
      logger.warn('PyAutoGUI is not installed');
      this.pythonEnvironment.hasPyAutoGUI = false;
    }
  }

  /**
   * 启动健康检查
   */
  private startHealthCheck(): void {
    this.checkInterval = setInterval(() => {
      if (!this.isReady()) {
        logger.debug('PCExecutorService not ready, attempting re-initialization');
        this.performInitialization().catch(err => {
          logger.debug({ err }, 'Re-initialization failed');
        });
      }
    }, 60000); // 每分钟检查一次
  }

  /**
   * 执行PyAutoGUI动作
   */
  async execute(action: PyAutoGUIAction, options: ExecuteOptions = {}): Promise<{
    success: boolean;
    data?: unknown;
    error?: string;
  }> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    if (!this.isReady()) {
      return {
        success: false,
        error: 'PC Executor not available - Python or PyAutoGUI not installed',
      };
    }

    return new Promise((resolve) => {
      const startTime = Date.now();

      const child = spawn(this.pythonEnvironment!.executable, [this.scriptPath, '--action', JSON.stringify(action)], {
        timeout: opts.timeout,
        shell: false,
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (error) => {
        logger.error({ error, action: action.type }, 'PC Executor error');
        resolve({
          success: false,
          error: error.message,
        });
      });

      child.on('close', (code) => {
        const duration = Date.now() - startTime;

        if (code !== 0) {
          logger.error({ code, stderr, duration }, 'PC Executor process failed');
          resolve({
            success: false,
            error: stderr || `Process exited with code ${code}`,
          });
          return;
        }

        try {
          const result = JSON.parse(stdout.trim());
          logger.info({ action: action.type, success: result.success, duration }, 'PC Executor action completed');
          resolve(result);
        } catch (parseError) {
          logger.error({ parseError, stdout }, 'Failed to parse PC Executor output');
          resolve({
            success: false,
            error: 'Failed to parse output',
          });
        }
      });

      setTimeout(() => {
        child.kill();
        resolve({
          success: false,
          error: 'Action timeout',
        });
      }, opts.timeout);
    });
  }

  /**
   * 点击操作
   */
  async click(x: number, y: number, clicks: number = 1, button: 'left' | 'right' | 'middle' = 'left'): Promise<{
    success: boolean;
    data?: { x: number; y: number };
    error?: string;
  }> {
    return this.execute({
      type: 'click',
      params: { x, y, clicks, button },
    }) as Promise<{ success: boolean; data?: { x: number; y: number }; error?: string }>;
  }

  /**
   * 双击操作
   */
  async doubleClick(x?: number, y?: number): Promise<{ success: boolean; error?: string }> {
    return this.execute({
      type: 'double_click',
      params: { x, y },
    });
  }

  /**
   * 右键点击操作
   */
  async rightClick(x?: number, y?: number): Promise<{ success: boolean; error?: string }> {
    return this.execute({
      type: 'right_click',
      params: { x, y },
    });
  }

  /**
   * 移动鼠标
   */
  async moveTo(x: number, y: number, duration: number = 0): Promise<{
    success: boolean;
    data?: { x: number; y: number };
    error?: string;
  }> {
    return this.execute({
      type: 'move_to',
      params: { x, y, duration },
    }) as Promise<{ success: boolean; data?: { x: number; y: number }; error?: string }>;
  }

  /**
   * 拖拽操作
   */
  async dragTo(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    duration: number = 0.5
  ): Promise<{ success: boolean; error?: string }> {
    return this.execute({
      type: 'drag_to',
      params: { start_x: startX, start_y: startY, end_x: endX, end_y: endY, duration },
    });
  }

  /**
   * 输入文本
   */
  async type(text: string, interval: number = 0.05): Promise<{
    success: boolean;
    data?: { text_length: number };
    error?: string;
  }> {
    return this.execute({
      type: 'type',
      params: { text, interval },
    }) as Promise<{ success: boolean; data?: { text_length: number }; error?: string }>;
  }

  /**
   * 按键操作
   */
  async press(keys: string | string[]): Promise<{ success: boolean; error?: string }> {
    return this.execute({
      type: 'press',
      params: { keys },
    });
  }

  /**
   * 快捷键操作
   */
  async hotkey(...keys: string[]): Promise<{ success: boolean; error?: string }> {
    return this.execute({
      type: 'hotkey',
      params: { keys },
    });
  }

  /**
   * 截图操作
   */
  async screenshot(options: { path?: string; region?: [number, number, number, number] } = {}): Promise<{
    success: boolean;
    data?: ScreenshotResult;
    error?: string;
  }> {
    return this.execute({
      type: 'screenshot',
      params: {
        path: options.path,
        region: options.region,
      },
    }) as Promise<{ success: boolean; data?: ScreenshotResult; error?: string }>;
  }

  /**
   * 图像定位
   */
  async locateOnScreen(imagePath: string, confidence: number = 0.9): Promise<{
    success: boolean;
    data?: LocateResult;
    error?: string;
  }> {
    return this.execute({
      type: 'locate',
      params: { needle: imagePath, confidence },
    }) as Promise<{ success: boolean; data?: LocateResult; error?: string }>;
  }

  /**
   * 滚动操作
   */
  async scroll(clicks: number = 3, x?: number, y?: number): Promise<{
    success: boolean;
    data?: { clicks: number };
    error?: string;
  }> {
    return this.execute({
      type: 'scroll',
      params: { clicks, x, y },
    }) as Promise<{ success: boolean; data?: { clicks: number }; error?: string }>;
  }

  /**
   * 弹窗提示
   */
  async alert(text: string, title: string = 'Alert'): Promise<{ success: boolean; error?: string }> {
    return this.execute({
      type: 'alert',
      params: { text, title },
    });
  }

  /**
   * 确认对话框
   */
  async confirm(text: string, title: string = 'Confirm', buttons: string[] = ['OK', 'Cancel']): Promise<{
    success: boolean;
    data?: { button: string };
    error?: string;
  }> {
    return this.execute({
      type: 'confirm',
      params: { text, title, buttons },
    }) as Promise<{ success: boolean; data?: { button: string }; error?: string }>;
  }

  /**
   * 输入对话框
   */
  async prompt(text: string, title: string = 'Input', defaultText: string = ''): Promise<{
    success: boolean;
    data?: { text: string | null };
    error?: string;
  }> {
    return this.execute({
      type: 'prompt',
      params: { text, title, default: defaultText },
    }) as Promise<{ success: boolean; data?: { text: string | null }; error?: string }>;
  }

  /**
   * 健康检查
   */
  public async healthCheck(): Promise<{
    status: 'ok' | 'degraded' | 'error';
    details: Record<string, unknown>;
  }> {
    const details = {
      initialized: this.initialized,
      pythonAvailable: this.pythonEnvironment !== null,
      pythonVersion: this.pythonEnvironment?.version ?? null,
      pythonPath: this.pythonEnvironment?.path ?? null,
      hasPyAutoGUI: this.pythonEnvironment?.hasPyAutoGUI ?? false,
      instanceCount: PCExecutorService.initializationCount,
      instanceId: this.getInstanceId(),
      scriptPath: this.scriptPath
    };

    let status: 'ok' | 'degraded' | 'error';

    if (!this.initialized) {
      status = 'error';
    } else if (!this.pythonEnvironment || !this.pythonEnvironment.hasPyAutoGUI) {
      status = 'degraded';
    } else {
      status = 'ok';
    }

    return { status, details };
  }

  /**
   * 获取实例ID
   */
  private getInstanceId(): string {
    return `PCExecutor_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * 重置单例 - 仅用于测试
   */
  public static resetInstance(): void {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('resetInstance can only be called in test environment');
    }

    if (PCExecutorService.instance) {
      PCExecutorService.instance.destroy();
      logger.warn('Resetting PCExecutorService singleton instance');
    }

    PCExecutorService.instance = null;
    PCExecutorService.initializationCount = 0;
  }

  /**
   * 清理资源
   */
  public destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    try {
      if (existsSync(this.scriptPath)) {
        unlinkSync(this.scriptPath);
      }
    } catch (error) {
      logger.debug({ error }, 'Failed to delete script file during cleanup');
    }

    this.pythonEnvironment = null;
    this.initialized = false;
    this.initializationPromise = null;

    logger.info('PCExecutorService destroyed');
  }
}

// 导出单例获取函数
export const getPCExecutor = (): PCExecutorService => {
  return PCExecutorService.getInstance();
};

// 默认导出（向后兼容）
export const pcExecutorService = PCExecutorService.getInstance();
export default PCExecutorService;
