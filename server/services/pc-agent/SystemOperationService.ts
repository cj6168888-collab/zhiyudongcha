/**
 * 系统操作服务 - 电脑端Agent核心组件
 *
 * 功能：
 * - 安装/卸载软件
 * - 网络配置和管理
 * - 系统设置调整
 * - 性能优化
 * - 进程管理
 *
 * @version 1.1.0
 * @date 2026-04-19
 */

import { createServiceLogger } from '../../lib/logger';
import { exec, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { platform, hostname, cpus, totalmem, freemem, networkInterfaces, uptime } from 'os';

const execAsync = promisify(exec);

const logger = createServiceLogger('SystemOperation');

export interface SystemInfo {
  platform: string;
  hostname: string;
  osVersion: string;
  arch: string;
  cpu: {
    model: string;
    cores: number;
    speed: number;
  };
  memory: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
  };
  uptime: number;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
  status: string;
}

export interface NetworkInfo {
  interfaces: Array<{
    name: string;
    address: string;
    netmask: string;
    mac: string;
    type: string;
  }>;
  connections: Array<{
    protocol: string;
    localAddress: string;
    localPort: number;
    foreignAddress: string;
    foreignPort: number;
    state: string;
    pid: number;
  }>;
}

export interface SoftwareInfo {
  name: string;
  version: string;
  publisher: string;
  installDate: string;
  size: number;
}

export class SystemOperationService {
  private static instance: SystemOperationService | null = null;

  private constructor() {}

  public static getInstance(): SystemOperationService {
    if (!SystemOperationService.instance) {
      SystemOperationService.instance = new SystemOperationService();
    }
    return SystemOperationService.instance;
  }

  /**
   * 获取系统信息
   */
  public getSystemInfo(): SystemInfo {
    return {
      platform: platform(),
      hostname: hostname(),
      osVersion: this.getOSVersion(),
      arch: process.arch,
      cpu: {
        model: cpus()[0]?.model || 'Unknown',
        cores: cpus().length,
        speed: cpus()[0]?.speed || 0,
      },
      memory: {
        total: totalmem(),
        free: freemem(),
        used: totalmem() - freemem(),
        usagePercent: Math.round(((totalmem() - freemem()) / totalmem()) * 100),
      },
      uptime: uptime(),
    };
  }

  /**
   * 获取操作系统版本
   */
  private getOSVersion(): string {
    if (platform() === 'win32') {
      try {
        const result = execSync('ver', { encoding: 'utf-8' });
        return result.trim();
      } catch {
        return 'Windows (version unknown)';
      }
    } else if (platform() === 'darwin') {
      try {
        const result = execSync('sw_vers -productVersion', { encoding: 'utf-8' });
        return `macOS ${result.trim()}`;
      } catch {
        return 'macOS (version unknown)';
      }
    } else {
      try {
        const result = execSync('cat /etc/os-release | grep "PRETTY_NAME"', { encoding: 'utf-8' });
        const match = result.match(/PRETTY_NAME="([^"]+)"/);
        return match ? match[1] : 'Linux';
      } catch {
        return 'Linux';
      }
    }
  }

  /**
   * 获取进程列表
   */
  public async getProcessList(): Promise<ProcessInfo[]> {
    const processes: ProcessInfo[] = [];

    try {
      if (platform() === 'win32') {
        const { stdout } = await execAsync(
          'wmic process get ProcessId,Name,PercentProcessorTime,WorkingSetSize /format:csv',
          { encoding: 'utf-8' }
        );

        const lines = stdout.split('\n').filter(line => line.trim());
        for (const line of lines.slice(1)) {
          const parts = line.split(',');
          if (parts.length >= 5) {
            processes.push({
              pid: parseInt(parts[1]) || 0,
              name: parts[2] || 'Unknown',
              cpu: parseFloat(parts[3]) || 0,
              memory: Math.round((parseInt(parts[4]) || 0) / 1024 / 1024),
              status: 'Running',
            });
          }
        }
      } else {
        const { stdout } = await execAsync('ps aux --no-headers', { encoding: 'utf-8' });

        for (const line of stdout.split('\n')) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 11) {
            processes.push({
              pid: parseInt(parts[1]) || 0,
              name: parts[10] || parts[0] || 'Unknown',
              cpu: parseFloat(parts[2]) || 0,
              memory: Math.round((parseFloat(parts[5]) || 0) / 1024),
              status: parts[7] || 'Running',
            });
          }
        }
      }
    } catch (error) {
      logger.error({ error }, 'Failed to get process list');
    }

    return processes.slice(0, 100);
  }

  /**
   * 结束进程
   */
  public async killProcess(pid: number): Promise<boolean> {
    try {
      if (platform() === 'win32') {
        await execAsync(`taskkill /PID ${pid} /F`);
      } else {
        await execAsync(`kill -9 ${pid}`);
      }
      return true;
    } catch (error) {
      logger.error({ error, pid }, 'Failed to kill process');
      return false;
    }
  }

  /**
   * 获取网络信息
   */
  public async getNetworkInfo(): Promise<NetworkInfo> {
    const info: NetworkInfo = {
      interfaces: [],
      connections: [],
    };

    try {
      // 获取网络接口
    const interfaces = networkInterfaces();
      for (const [name, addrs] of Object.entries(interfaces)) {
        for (const addr of addrs) {
          if (addr.family === 'IPv4') {
            info.interfaces.push({
              name,
              address: addr.address,
              netmask: addr.netmask,
              mac: addr.mac,
              type: addr.internal ? 'Internal' : 'External',
            });
          }
        }
      }

      // 获取网络连接
      if (platform() === 'win32') {
        const { stdout } = await execAsync('netstat -ano', { encoding: 'utf-8' });
        const lines = stdout.split('\n');
        for (const line of lines.slice(4)) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 5) {
            const [local, foreign, state, pid] = parts;
            const [localAddr, localPort] = local.split(':');
            const [foreignAddr, foreignPort] = foreign.split(':');

            info.connections.push({
              protocol: parts[0],
              localAddress: localAddr,
              localPort: parseInt(localPort) || 0,
              foreignAddress: foreignAddr,
              foreignPort: parseInt(foreignPort) || 0,
              state,
              pid: parseInt(pid) || 0,
            });
          }
        }
      }
    } catch (error) {
      logger.error({ error }, 'Failed to get network info');
    }

    return info;
  }

  /**
   * 测试网络连接
   */
  public async testConnection(host: string, port: number = 80): Promise<{
    reachable: boolean;
    latency?: number;
    error?: string;
  }> {
    const start = Date.now();

    try {
      if (platform() === 'win32') {
        await execAsync(`ping -n 1 -w 1000 ${host}`);
      } else {
        await execAsync(`ping -c 1 -W 1 ${host}`);
      }

      return {
        reachable: true,
        latency: Date.now() - start,
      };
    } catch {
      return {
        reachable: false,
        error: 'Host unreachable',
      };
    }
  }

  /**
   * 获取已安装软件列表
   */
  public async getInstalledSoftware(): Promise<SoftwareInfo[]> {
    const software: SoftwareInfo[] = [];

    try {
      if (platform() === 'win32') {
        // 使用PowerShell获取已安装软件
        const { stdout } = await execAsync(
          `powershell -Command "Get-WmiObject -Class Win32_Product | Select-Object -Property Name,Version,Vendor,InstallDate | ConvertTo-Json"`,
          { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 }
        );

        const programs = JSON.parse(stdout);
        const list = Array.isArray(programs) ? programs : [programs];

        for (const prog of list) {
          if (prog.Name) {
            software.push({
              name: prog.Name,
              version: prog.Version || 'Unknown',
              publisher: prog.Vendor || 'Unknown',
              installDate: prog.InstallDate || 'Unknown',
              size: 0,
            });
          }
        }
      } else if (platform() === 'darwin') {
        const { stdout } = await execAsync('system_profiler SPApplicationsDataType -json', { encoding: 'utf-8' });
        const data = JSON.parse(stdout);

        for (const app of data.SPApplicationsDataType || []) {
          software.push({
            name: app._name,
            version: app.version || 'Unknown',
            publisher: app.obtained_from || 'Unknown',
            installDate: 'Unknown',
            size: 0,
          });
        }
      }
    } catch (error) {
      logger.error({ error }, 'Failed to get installed software');
    }

    return software;
  }

  /**
   * 安装软件
   */
  public async installSoftware(installerPath: string): Promise<{
    success: boolean;
    message: string;
  }> {
    logger.info({ installerPath }, 'Installing software');

    try {
      if (platform() === 'win32') {
        if (installerPath.endsWith('.msi')) {
          await execAsync(`msiexec /i "${installerPath}" /quiet /norestart`);
        } else if (installerPath.endsWith('.exe')) {
          await execAsync(`"${installerPath}" /S`);
        }
      } else if (platform() === 'darwin') {
        if (installerPath.endsWith('.dmg')) {
          await execAsync(`hdiutil attach "${installerPath}"`);
          await execAsync('cp -R /Volumes/*/*.app ~/Applications/');
          await execAsync('hdiutil detach /Volumes/*');
        }
      }

      return { success: true, message: '软件安装成功' };
    } catch (error) {
      logger.error({ error }, 'Failed to install software');
      return { success: false, message: '软件安装失败' };
    }
  }

  /**
   * 卸载软件
   */
  public async uninstallSoftware(name: string): Promise<{
    success: boolean;
    message: string;
  }> {
    logger.info({ name }, 'Uninstalling software');

    try {
      if (platform() === 'win32') {
        await execAsync(`powershell -Command "Get-WmiObject -Class Win32_Product | Where-Object {$_.Name -like '*${name}*'} | ForEach-Object {$_.Uninstall()}"`);
      } else if (platform() === 'darwin') {
        await execAsync(`rm -rf "/Applications/${name}.app"`);
      }

      return { success: true, message: '软件卸载成功' };
    } catch (error) {
      logger.error({ error }, 'Failed to uninstall software');
      return { success: false, message: '软件卸载失败' };
    }
  }

  /**
   * 清理临时文件
   */
  public async cleanTempFiles(): Promise<{
    cleaned: number;
    freed: number;
  }> {
    let cleaned = 0;
    let freed = 0;

    const tempDirs = platform() === 'win32'
      ? [process.env.TEMP || 'C:\\Windows\\Temp']
      : ['/tmp', '/var/tmp'];

    for (const tempDir of tempDirs) {
      try {
        const files = await fs.promises.readdir(tempDir);
        for (const file of files) {
          try {
            const filePath = path.join(tempDir, file);
            const stats = await fs.promises.stat(filePath);
            if (stats.isFile()) {
              await fs.promises.unlink(filePath);
              cleaned++;
              freed += stats.size;
            }
          } catch {
            // 忽略单个文件错误
          }
        }
      } catch {
        // 忽略目录错误
      }
    }

    logger.info({ cleaned, freed }, 'Temp files cleaned');
    return { cleaned, freed };
  }

  /**
   * 清理浏览器缓存
   */
  public async cleanBrowserCache(): Promise<{
    cleaned: number;
    freed: number;
  }> {
    let cleaned = 0;
    let freed = 0;

    const cacheDirs: Record<string, string[]> = {
      win32: [
        path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data', 'Default', 'Cache'),
        path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache'),
        path.join(process.env.APPDATA || '', 'Mozilla', 'Firefox', 'Profiles'),
      ],
      darwin: [
        path.join(process.env.HOME || '', 'Library', 'Caches', 'Google', 'Chrome'),
        path.join(process.env.HOME || '', 'Library', 'Caches', 'com.apple.Safari'),
      ],
      linux: [
        path.join(process.env.HOME || '', '.cache', 'google-chrome'),
        path.join(process.env.HOME || '', '.cache', 'mozilla'),
      ],
    };

    const dirs = cacheDirs[platform()] || [];

    for (const cacheDir of dirs) {
      try {
        if (fs.existsSync(cacheDir)) {
          const files = await fs.promises.readdir(cacheDir);
          for (const file of files) {
            try {
              const filePath = path.join(cacheDir, file);
              const stats = await fs.promises.stat(filePath);
              freed += stats.size;
              if (stats.isFile()) {
                await fs.promises.unlink(filePath);
                cleaned++;
              }
            } catch {
              // 忽略
            }
          }
        }
      } catch {
        // 忽略目录错误
      }
    }

    logger.info({ cleaned, freed }, 'Browser cache cleaned');
    return { cleaned, freed };
  }

  /**
   * 系统优化建议
   */
  public getOptimizationSuggestions(): string[] {
    const suggestions: string[] = [];
    const sysInfo = this.getSystemInfo();

    // 内存使用建议
    if (sysInfo.memory.usagePercent > 80) {
      suggestions.push('内存使用率较高，建议关闭不必要的后台程序');
    }

    // 启动项建议
    suggestions.push('建议使用任务管理器检查和优化启动项');

    // 磁盘空间建议
    suggestions.push('建议定期清理临时文件和浏览器缓存');

    return suggestions;
  }

  /**
   * 执行系统命令
   */
  public async runCommand(command: string): Promise<{
    success: boolean;
    stdout?: string;
    stderr?: string;
    error?: string;
  }> {
    try {
      if (platform() === 'win32') {
        const { stdout, stderr } = await execAsync(command, { encoding: 'utf-8' });
        return { success: true, stdout, stderr };
      } else {
        const { stdout, stderr } = await execAsync(command, { encoding: 'utf-8' });
        return { success: true, stdout, stderr };
      }
    } catch (error: unknown) {
      const execError = error as { stderr?: string; message?: string };
      return {
        success: false,
        stderr: execError.stderr,
        error: execError.message,
      };
    }
  }

  /**
   * 打开系统设置
   */
  public async openSettings(category: string): Promise<boolean> {
    try {
      if (platform() === 'win32') {
        const settingsMap: Record<string, string> = {
          'network': 'ms-settings:network',
          'wifi': 'ms-settings:network-wifi',
          'bluetooth': 'ms-settings:bluetooth',
          'display': 'ms-settings:display',
          'sound': 'ms-settings:sound',
          'apps': 'ms-settings:appsfeatures',
          'privacy': 'ms-settings:privacy',
          'update': 'ms-settings:windowsupdate',
          'firewall': 'ms-settings:windowsdefender',
          'storage': 'ms-settings:storagesense',
          'control': 'control',
          'programs': 'appwiz.cpl',
          'device-manager': 'devmgmt.msc',
          'services': 'services.msc',
          'task-manager': 'taskmgr',
        };

        const setting = settingsMap[category.toLowerCase()];
        if (setting) {
          await execAsync(`start ms-settings:${setting.replace('ms-settings:', '')}`);
          return true;
        }
      } else if (platform() === 'darwin') {
        const settingsMap: Record<string, string> = {
          'wifi': 'SystemPreferences --current-panel-by-id wireless',
          'bluetooth': 'SystemPreferences --current-panel-by-id bluetooth',
          'display': 'SystemPreferences --current-panel-by-id displays',
          'sound': 'SystemPreferences --current-panel-by-id sound',
          'network': 'SystemPreferences --current-panel-by-id network',
          'sharing': 'SystemPreferences --current-panel-by-id sharing',
        };

        const setting = settingsMap[category.toLowerCase()];
        if (setting) {
          await execAsync(`open -a "${setting}"`);
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error({ error, category }, 'Failed to open settings');
      return false;
    }
  }
}

export const systemOperationService = SystemOperationService.getInstance();
export default systemOperationService;
