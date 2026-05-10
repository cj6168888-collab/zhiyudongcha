/**
 * AI 技能引擎 - AISkillEngine
 *
 * 深度整合 OpenClaw 能力到 AI 助手系统
 * 实现自然语言控制 PC 和任务自动化
 *
 * @version 1.0.0
 * @date 2026-03-18
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiRequest } from '@/lib/queryClient';

// ============================================
// 类型定义
// ============================================

// 设备类型
export interface PCDeviceInfo {
  id: string;
  name: string;
  platform: 'WINDOWS' | 'MACOS' | 'LINUX';
  osVersion: string;
  capabilities: {
    screenCapture: boolean;
    mouseControl: boolean;
    keyboardControl: boolean;
    fileSystem: boolean;
    clipboard: boolean;
    notifications: boolean;
    maxResolution: { width: number; height: number };
  };
  status: 'OFFLINE' | 'ONLINE' | 'BUSY' | 'ERROR';
  lastSeen: number;
}

// 任务类型
export interface TaskDefinition {
  id: string;
  name: string;
  description?: string;
  trigger: {
    type: 'CRON' | 'HEARTBEAT' | 'MANUAL' | 'WEBHOOK';
    config: Record<string, unknown>;
  };
  actions: TaskAction[];
  status: 'ACTIVE' | 'PAUSED' | 'ERROR';
  createdAt: number;
  updatedAt: number;
}

export interface TaskAction {
  id?: string;
  deviceId: string;
  deviceType: 'PC' | 'ANDROID' | 'IOS' | 'SERVER';
  actionType: string;
  params?: Record<string, unknown>;
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
}

// 技能定义
export interface Skill {
  id: string;
  name: string;
  description: string;
  patterns: string[];  // 自然语言匹配模式
  category: 'control' | 'automation' | 'file' | 'system';
  execute: (params?: Record<string, unknown>) => Promise<SkillResult>;
}

// 技能执行结果
export interface SkillResult {
  success: boolean;
  data?: unknown;
  error?: string;
  duration: number;
}

// 控制命令
export interface ControlCommand {
  type: 'MOUSE' | 'KEYBOARD' | 'SCREENSHOT' | 'FILE' | 'APP' | 'SYSTEM';
  action: string;
  params?: Record<string, unknown>;
}

// API 响应类型
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// 技能引擎类
// ============================================

class AISkillEngineImpl {
  private skills: Map<string, Skill> = new Map();
  private openClawStore: OpenClawState | null = null;

  constructor() {
    this.registerBuiltInSkills();
  }

  // 注册内置技能
  private registerBuiltInSkills() {
    // 截图技能
    this.registerSkill({
      id: 'screenshot',
      name: '截图',
      description: '截取当前电脑屏幕',
      patterns: ['截图', '截屏', 'capture screen', 'screen shot', '截个图'],
      category: 'control',
      execute: async () => {
        return await this.executeOpenClawAction({
          type: 'SCREENSHOT',
          action: 'CAPTURE',
        });
      }
    });

    // 打开应用技能
    this.registerSkill({
      id: 'open_app',
      name: '打开应用',
      description: '在电脑上打开应用程序',
      patterns: ['打开{app}', '启动{app}', 'open {app}', '运行{app}'],
      category: 'control',
      execute: async (params) => {
        const appName = params?.app as string;
        if (!appName) {
          return { success: false, error: '请指定应用名称', duration: 0 };
        }
        return await this.executeOpenClawAction({
          type: 'APP',
          action: 'OPEN',
          params: { appName }
        });
      }
    });

    // 鼠标点击技能
    this.registerSkill({
      id: 'click',
      name: '鼠标点击',
      description: '在指定位置点击鼠标',
      patterns: ['点击{x},{y}', 'click {x},{y}', '点击位置{x},{y}'],
      category: 'control',
      execute: async (params) => {
        const x = params?.x as number;
        const y = params?.y as number;

        if (x === undefined || y === undefined) {
          return { success: false, error: '请指定点击位置', duration: 0 };
        }

        return await this.executeOpenClawAction({
          type: 'MOUSE',
          action: 'CLICK',
          params: { x, y }
        });
      }
    });

    // 双击技能
    this.registerSkill({
      id: 'double_click',
      name: '鼠标双击',
      description: '在指定位置双击鼠标',
      patterns: ['双击{x},{y}', '双击位置{x},{y}', 'double click'],
      category: 'control',
      execute: async (params) => {
        const x = params?.x as number;
        const y = params?.y as number;

        if (x === undefined || y === undefined) {
          return { success: false, error: '请指定点击位置', duration: 0 };
        }

        return await this.executeOpenClawAction({
          type: 'MOUSE',
          action: 'DOUBLE_CLICK',
          params: { x, y }
        });
      }
    });

    // 滚动技能
    this.registerSkill({
      id: 'scroll',
      name: '鼠标滚动',
      description: '滚动屏幕',
      patterns: ['滚动{direction}', '向上滚动', '向下滚动', 'scroll {direction}'],
      category: 'control',
      execute: async (params) => {
        const direction = (params?.direction as string) || 'down';

        return await this.executeOpenClawAction({
          type: 'MOUSE',
          action: 'SCROLL',
          params: { direction, clicks: 3 }
        });
      }
    });

    // 关闭窗口技能 (Alt+F4)
    this.registerSkill({
      id: 'close_window',
      name: '关闭窗口',
      description: '关闭当前窗口',
      patterns: ['关闭窗口', '关闭', 'close window', '关掉', 'alt f4'],
      category: 'control',
      execute: async () => {
        return await this.executeOpenClawAction({
          type: 'KEYBOARD',
          action: 'HOTKEY',
          params: { keys: ['alt', 'f4'] }
        });
      }
    });

    // 最小化窗口技能
    this.registerSkill({
      id: 'minimize_window',
      name: '最小化窗口',
      description: '最小化当前窗口',
      patterns: ['最小化', 'minimize', '最小化窗口'],
      category: 'control',
      execute: async () => {
        return await this.executeOpenClawAction({
          type: 'KEYBOARD',
          action: 'HOTKEY',
          params: { keys: ['win', 'down'] }
        });
      }
    });

    // 最大化窗口技能
    this.registerSkill({
      id: 'maximize_window',
      name: '最大化窗口',
      description: '最大化当前窗口',
      patterns: ['最大化', 'maximize', '最大化窗口', '全屏'],
      category: 'control',
      execute: async () => {
        return await this.executeOpenClawAction({
          type: 'KEYBOARD',
          action: 'HOTKEY',
          params: { keys: ['win', 'up'] }
        });
      }
    });

    // 切换标签页技能
    this.registerSkill({
      id: 'switch_tab',
      name: '切换标签页',
      description: '切换浏览器标签页',
      patterns: ['切换标签', '下一个标签', '上一个标签', 'next tab', 'switch tab'],
      category: 'control',
      execute: async (params) => {
        const direction = params?.direction as string || 'next';
        const keys = direction === 'next' ? ['ctrl', 'tab'] : ['ctrl', 'shift', 'tab'];

        return await this.executeOpenClawAction({
          type: 'KEYBOARD',
          action: 'HOTKEY',
          params: { keys }
        });
      }
    });

    // 刷新页面技能
    this.registerSkill({
      id: 'refresh',
      name: '刷新页面',
      description: '刷新当前页面',
      patterns: ['刷新', '刷新页面', 'refresh', 'reload', 'f5'],
      category: 'control',
      execute: async () => {
        return await this.executeOpenClawAction({
          type: 'KEYBOARD',
          action: 'HOTKEY',
          params: { keys: ['f5'] }
        });
      }
    });

    // 保存技能
    this.registerSkill({
      id: 'save',
      name: '保存',
      description: '保存当前内容',
      patterns: ['保存', 'save', 'ctrl s'],
      category: 'control',
      execute: async () => {
        return await this.executeOpenClawAction({
          type: 'KEYBOARD',
          action: 'HOTKEY',
          params: { keys: ['ctrl', 's'] }
        });
      }
    });

    // 全选技能
    this.registerSkill({
      id: 'select_all',
      name: '全选',
      description: '选中所有内容',
      patterns: ['全选', 'select all', 'ctrl a'],
      category: 'control',
      execute: async () => {
        return await this.executeOpenClawAction({
          type: 'KEYBOARD',
          action: 'HOTKEY',
          params: { keys: ['ctrl', 'a'] }
        });
      }
    });

    // 复制粘贴技能
    this.registerSkill({
      id: 'copy_paste',
      name: '复制粘贴',
      description: '复制并粘贴',
      patterns: ['复制粘贴', 'copy paste', 'ctrl c v'],
      category: 'control',
      execute: async () => {
        return await this.executeOpenClawAction({
          type: 'KEYBOARD',
          action: 'HOTKEY',
          params: { keys: ['ctrl', 'c', 'ctrl', 'v'] }
        });
      }
    });

    // ========== 企业级技能 ==========

    // Excel 操作技能
    this.registerSkill({
      id: 'excel_new',
      name: '新建Excel',
      description: '新建一个Excel工作簿',
      patterns: ['新建Excel', '新建表格', 'new excel', '打开Excel'],
      category: 'system',
      execute: async () => {
        return await this.executeOpenClawAction({
          type: 'APP',
          action: 'OPEN',
          params: { appName: 'excel' }
        });
      }
    });

    this.registerSkill({
      id: 'excel_save',
      name: '保存Excel',
      description: '保存当前Excel文件',
      patterns: ['保存Excel', '保存表格', 'save excel'],
      category: 'system',
      execute: async () => {
        // 先 Ctrl+S 保存，然后等待
        const result = await this.executeOpenClawAction({
          type: 'KEYBOARD',
          action: 'HOTKEY',
          params: { keys: ['ctrl', 's'] }
        });
        return result;
      }
    });

    this.registerSkill({
      id: 'excel_new_sheet',
      name: '新建工作表',
      description: '在当前Excel中新建一个工作表',
      patterns: ['新建工作表', '新建sheet', 'new sheet'],
      category: 'system',
      execute: async () => {
        // Shift+F11 新建工作表
        return await this.executeOpenClawAction({
          type: 'KEYBOARD',
          action: 'HOTKEY',
          params: { keys: ['shift', 'f11'] }
        });
      }
    });

    this.registerSkill({
      id: 'excel_autosum',
      name: '自动求和',
      description: '对选中的单元格进行自动求和',
      patterns: ['自动求和', '求和', 'autosum', 'sum'],
      category: 'system',
      execute: async () => {
        // Alt+= 自动求和
        return await this.executeOpenClawAction({
          type: 'KEYBOARD',
          action: 'HOTKEY',
          params: { keys: ['alt', '='] }
        });
      }
    });

    this.registerSkill({
      id: 'excel_format_bold',
      name: 'Excel粗体',
      description: '将选中内容设为粗体',
      patterns: ['Excel粗体', '加粗', 'bold'],
      category: 'system',
      execute: async () => {
        return await this.executeOpenClawAction({
          type: 'KEYBOARD',
          action: 'HOTKEY',
          params: { keys: ['ctrl', 'b'] }
        });
      }
    });

    // Word 操作技能
    this.registerSkill({
      id: 'word_new',
      name: '新建Word',
      description: '新建一个Word文档',
      patterns: ['新建Word', '新建文档', 'new word', '打开Word'],
      category: 'system',
      execute: async () => {
        return await this.executeOpenClawAction({
          type: 'APP',
          action: 'OPEN',
          params: { appName: 'word' }
        });
      }
    });

    this.registerSkill({
      id: 'word_save',
      name: '保存Word',
      description: '保存当前Word文档',
      patterns: ['保存Word', '保存文档', 'save word'],
      category: 'system',
      execute: async () => {
        return await this.executeOpenClawAction({
          type: 'KEYBOARD',
          action: 'HOTKEY',
          params: { keys: ['ctrl', 's'] }
        });
      }
    });

    // 邮件处理技能
    this.registerSkill({
      id: 'email_new',
      name: '写邮件',
      description: '打开邮件客户端写新邮件',
      patterns: ['写邮件', '发邮件', 'new email', '写邮件'],
      category: 'system',
      execute: async () => {
        return await this.executeOpenClawAction({
          type: 'APP',
          action: 'OPEN',
          params: { appName: 'outlook' }
        });
      }
    });

    this.registerSkill({
      id: 'email_send',
      name: '发送邮件',
      description: '发送当前编辑的邮件',
      patterns: ['发送邮件', '发送', 'send email'],
      category: 'system',
      execute: async () => {
        // Ctrl+Enter 发送邮件
        return await this.executeOpenClawAction({
          type: 'KEYBOARD',
          action: 'HOTKEY',
          params: { keys: ['ctrl', 'enter'] }
        });
      }
    });

    this.registerSkill({
      id: 'email_reply',
      name: '回复邮件',
      description: '回复当前邮件',
      patterns: ['回复邮件', '回复', 'reply'],
      category: 'system',
      execute: async () => {
        // Ctrl+R 回复
        return await this.executeOpenClawAction({
          type: 'KEYBOARD',
          action: 'HOTKEY',
          params: { keys: ['ctrl', 'r'] }
        });
      }
    });

    this.registerSkill({
      id: 'email_forward',
      name: '转发邮件',
      description: '转发当前邮件',
      patterns: ['转发邮件', '转发', 'forward'],
      category: 'system',
      execute: async () => {
        // Ctrl+F 转发
        return await this.executeOpenClawAction({
          type: 'KEYBOARD',
          action: 'HOTKEY',
          params: { keys: ['ctrl', 'f'] }
        });
      }
    });

    // 浏览器控制技能
    this.registerSkill({
      id: 'browser_new_tab',
      name: '新建标签页',
      description: '在浏览器中新建标签页',
      patterns: ['新建标签', 'new tab', '打开新标签'],
      category: 'control',
      execute: async () => {
        return await this.executeOpenClawAction({
          type: 'KEYBOARD',
          action: 'HOTKEY',
          params: { keys: ['ctrl', 't'] }
        });
      }
    });

    this.registerSkill({
      id: 'browser_close_tab',
      name: '关闭标签页',
      description: '关闭当前浏览器标签页',
      patterns: ['关闭标签', 'close tab', '关闭当前标签'],
      category: 'control',
      execute: async () => {
        return await this.executeOpenClawAction({
          type: 'KEYBOARD',
          action: 'HOTKEY',
          params: { keys: ['ctrl', 'w'] }
        });
      }
    });

    this.registerSkill({
      id: 'browser_reopen_tab',
      name: '重新打开标签',
      description: '重新打开刚关闭的标签页',
      patterns: ['恢复标签', 'reopen tab', '撤销关闭'],
      category: 'control',
      execute: async () => {
        return await this.executeOpenClawAction({
          type: 'KEYBOARD',
          action: 'HOTKEY',
          params: { keys: ['ctrl', 'shift', 't'] }
        });
      }
    });

    this.registerSkill({
      id: 'browser_new_window',
      name: '新建窗口',
      description: '打开新的浏览器窗口',
      patterns: ['新建窗口', 'new window', '打开新窗口'],
      category: 'control',
      execute: async () => {
        return await this.executeOpenClawAction({
          type: 'KEYBOARD',
          action: 'HOTKEY',
          params: { keys: ['ctrl', 'n'] }
        });
      }
    });

    this.registerSkill({
      id: 'browser_fullscreen',
      name: '浏览器全屏',
      description: '浏览器全屏显示',
      patterns: ['浏览器全屏', '网页全屏', 'F11'],
      category: 'control',
      execute: async () => {
        return await this.executeOpenClawAction({
          type: 'KEYBOARD',
          action: 'PRESS',
          params: { key: 'f11' }
        });
      }
    });

    this.registerSkill({
      id: 'browser_bookmark',
      name: '添加书签',
      description: '将当前页面添加到书签',
      patterns: ['添加书签', '收藏', 'bookmark'],
      category: 'control',
      execute: async () => {
        return await this.executeOpenClawAction({
          type: 'KEYBOARD',
          action: 'HOTKEY',
          params: { keys: ['ctrl', 'd'] }
        });
      }
    });

    // 文件管理技能
    this.registerSkill({
      id: 'file_explorer',
      name: '打开文件管理器',
      description: '打开Windows文件资源管理器',
      patterns: ['打开文件管理器', '打开此电脑', 'file explorer', '我的电脑'],
      category: 'system',
      execute: async () => {
        return await this.executeOpenClawAction({
          type: 'APP',
          action: 'OPEN',
          params: { appName: 'explorer' }
        });
      }
    });

    this.registerSkill({
      id: 'file_new_folder',
      name: '新建文件夹',
      description: '在当前位置新建文件夹',
      patterns: ['新建文件夹', 'new folder', '创建文件夹'],
      category: 'system',
      execute: async () => {
        // Ctrl+Shift+N 新建文件夹
        return await this.executeOpenClawAction({
          type: 'KEYBOARD',
          action: 'HOTKEY',
          params: { keys: ['ctrl', 'shift', 'n'] }
        });
      }
    });

    this.registerSkill({
      id: 'file_rename',
      name: '重命名',
      description: '重命名选中的文件或文件夹',
      patterns: ['重命名', 'rename', '改名'],
      category: 'system',
      execute: async () => {
        // F2 重命名
        return await this.executeOpenClawAction({
          type: 'KEYBOARD',
          action: 'PRESS',
          params: { key: 'f2' }
        });
      }
    });

    this.registerSkill({
      id: 'file_delete',
      name: '删除文件',
      description: '删除选中的文件（到回收站）',
      patterns: ['删除', '删除文件', 'delete'],
      category: 'system',
      execute: async () => {
        // Delete 键删除
        return await this.executeOpenClawAction({
          type: 'KEYBOARD',
          action: 'PRESS',
          params: { key: 'delete' }
        });
      }
    });

    this.registerSkill({
      id: 'file_properties',
      name: '查看属性',
      description: '查看文件或文件夹属性',
      patterns: ['属性', 'properties', '查看属性'],
      category: 'system',
      execute: async () => {
        // Alt+Enter 查看属性
        return await this.executeOpenClawAction({
          type: 'KEYBOARD',
          action: 'HOTKEY',
          params: { keys: ['alt', 'enter'] }
        });
      }
    });

    // 电源管理技能
    this.registerSkill({
      id: 'system_lock',
      name: '锁定电脑',
      description: '锁定计算机',
      patterns: ['锁定电脑', '锁屏', 'lock', '锁定'],
      category: 'system',
      execute: async () => {
        // Win+L 锁定
        return await this.executeOpenClawAction({
          type: 'KEYBOARD',
          action: 'HOTKEY',
          params: { keys: ['win', 'l'] }
        });
      }
    });

    this.registerSkill({
      id: 'system_sleep',
      name: '睡眠',
      description: '让计算机进入睡眠状态',
      patterns: ['睡眠', 'sleep', '待机'],
      category: 'system',
      execute: async () => {
        // Win+X 然后 U 然后 S (简化版直接用电源按钮)
        return await this.executeOpenClawAction({
          type: 'APP',
          action: 'SYSTEM',
          params: { action: 'sleep' }
        });
      }
    });

    this.registerSkill({
      id: 'system_shutdown',
      name: '关机',
      description: '关闭计算机',
      patterns: ['关机', 'shutdown', '关闭电脑'],
      category: 'system',
      execute: async () => {
        return await this.executeOpenClawAction({
          type: 'APP',
          action: 'SYSTEM',
          params: { action: 'shutdown' }
        });
      }
    });

    this.registerSkill({
      id: 'system_restart',
      name: '重启',
      description: '重新启动计算机',
      patterns: ['重启', 'restart', '重新启动'],
      category: 'system',
      execute: async () => {
        return await this.executeOpenClawAction({
          type: 'APP',
          action: 'SYSTEM',
          params: { action: 'restart' }
        });
      }
    });

    // 音量控制技能
    this.registerSkill({
      id: 'volume_up',
      name: '增加音量',
      description: '增加系统音量',
      patterns: ['增加音量', '音量加', 'volume up', '大声点'],
      category: 'system',
      execute: async () => {
        return await this.executeOpenClawAction({
          type: 'KEYBOARD',
          action: 'PRESS',
          params: { key: 'volumeup' }
        });
      }
    });

    this.registerSkill({
      id: 'volume_down',
      name: '减小音量',
      description: '减小系统音量',
      patterns: ['减小音量', '音量减', 'volume down', '小声点'],
      category: 'system',
      execute: async () => {
        return await this.executeOpenClawAction({
          type: 'KEYBOARD',
          action: 'PRESS',
          params: { key: 'volumedown' }
        });
      }
    });

    this.registerSkill({
      id: 'volume_mute',
      name: '静音',
      description: '切换静音状态',
      patterns: ['静音', 'mute', '关闭声音'],
      category: 'system',
      execute: async () => {
        return await this.executeOpenClawAction({
          type: 'KEYBOARD',
          action: 'PRESS',
          params: { key: 'volumemute' }
        });
      }
    });

    // 截图技能增强
    this.registerSkill({
      id: 'screenshot_region',
      name: '区域截图',
      description: '截取屏幕选定区域',
      patterns: ['区域截图', '截取区域', 'region screenshot'],
      category: 'control',
      execute: async () => {
        // Win+Shift+S 区域截图
        return await this.executeOpenClawAction({
          type: 'KEYBOARD',
          action: 'HOTKEY',
          params: { keys: ['win', 'shift', 's'] }
        });
      }
    });

    // 剪贴板技能
    this.registerSkill({
      id: 'clipboard_copy',
      name: '复制',
      description: '复制选中内容',
      patterns: ['复制', 'copy', 'ctrl c'],
      category: 'control',
      execute: async () => {
        return await this.executeOpenClawAction({
          type: 'KEYBOARD',
          action: 'HOTKEY',
          params: { keys: ['ctrl', 'c'] }
        });
      }
    });

    this.registerSkill({
      id: 'clipboard_paste',
      name: '粘贴',
      description: '粘贴剪贴板内容',
      patterns: ['粘贴', 'paste', 'ctrl v'],
      category: 'control',
      execute: async () => {
        return await this.executeOpenClawAction({
          type: 'KEYBOARD',
          action: 'HOTKEY',
          params: { keys: ['ctrl', 'v'] }
        });
      }
    });

    this.registerSkill({
      id: 'clipboard_cut',
      name: '剪切',
      description: '剪切选中内容',
      patterns: ['剪切', 'cut', 'ctrl x'],
      category: 'control',
      execute: async () => {
        return await this.executeOpenClawAction({
          type: 'KEYBOARD',
          action: 'HOTKEY',
          params: { keys: ['ctrl', 'x'] }
        });
      }
    });

    // 发送文本技能
    this.registerSkill({
      id: 'type_text',
      name: '输入文本',
      description: '在焦点位置输入文本',
      patterns: ['输入{text}', '打字{text}', 'type {text}'],
      category: 'control',
      execute: async (params) => {
        const text = params?.text as string;
        if (!text) {
          return { success: false, error: '请指定要输入的文本', duration: 0 };
        }
        return await this.executeOpenClawAction({
          type: 'KEYBOARD',
          action: 'TYPE',
          params: { text }
        });
      }
    });

    // 执行快捷键技能
    this.registerSkill({
      id: 'hotkey',
      name: '快捷键',
      description: '执行键盘快捷键',
      patterns: ['按{keys}', '快捷键{keys}', 'press {keys}'],
      category: 'control',
      execute: async (params) => {
        const keys = params?.keys;
        if (!keys) {
          return { success: false, error: '请指定快捷键', duration: 0 };
        }
        const keysArray = Array.isArray(keys) ? keys : (keys as string).split('+');
        return await this.executeOpenClawAction({
          type: 'KEYBOARD',
          action: 'HOTKEY',
          params: { keys: keysArray }
        });
      }
    });

    // 执行任务技能
    this.registerSkill({
      id: 'run_task',
      name: '执行任务',
      description: '执行已保存的自动化任务',
      patterns: ['执行任务{task}', '运行任务{task}', 'run task {task}', '执行{task}'],
      category: 'automation',
      execute: async (params) => {
        const taskName = params?.task as string;
        if (!taskName) {
          return { success: false, error: '请指定任务名称', duration: 0 };
        }

        try {
          // 先获取任务列表找到匹配的任务
          const res = await apiRequest('GET', '/api/tasks');
          const json = await res.json() as ApiResponse<TaskDefinition[]>;

          if (!json.success || !json.data) {
            return { success: false, error: '获取任务列表失败', duration: 0 };
          }

          const task = json.data.find(t =>
            t.name.toLowerCase().includes(taskName.toLowerCase())
          );

          if (!task) {
            return { success: false, error: `未找到任务: ${taskName}`, duration: 0 };
          }

          // 执行任务
          const execRes = await apiRequest('POST', `/api/tasks/${task.id}/execute`);
          const execJson = await execRes.json() as ApiResponse<unknown>;

          return {
            success: execJson.success,
            data: execJson.data,
            error: execJson.error,
            duration: 0
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : '执行任务失败',
            duration: 0
          };
        }
      }
    });

    // 获取设备列表技能
    this.registerSkill({
      id: 'list_devices',
      name: '设备列表',
      description: '查看可控制的电脑设备',
      patterns: ['设备列表', '有哪些电脑', 'list devices', '查看设备'],
      category: 'control',
      execute: async () => {
        try {
          const res = await apiRequest('GET', '/api/remote/devices');
          const json = await res.json() as ApiResponse<PCDeviceInfo[]>;

          return {
            success: json.success,
            data: json.data || [],
            error: json.error,
            duration: 0
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : '获取设备列表失败',
            duration: 0
          };
        }
      }
    });

    // 鼠标点击技能
    this.registerSkill({
      id: 'click',
      name: '鼠标点击',
      description: '在指定位置点击鼠标',
      patterns: ['点击{x},{y}', 'click {x},{y}', '点击位置{x},{y}'],
      category: 'control',
      execute: async (params) => {
        const x = params?.x as number;
        const y = params?.y as number;

        if (x === undefined || y === undefined) {
          return { success: false, error: '请指定点击位置', duration: 0 };
        }

        return await this.executeOpenClawAction({
          type: 'MOUSE',
          action: 'CLICK',
          params: { x, y }
        });
      }
    });
  }

  // 注册技能
  registerSkill(skill: Skill) {
    this.skills.set(skill.id, skill);
  }

  // 移除技能
  unregisterSkill(skillId: string) {
    this.skills.delete(skillId);
  }

  // 获取所有技能
  getAllSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  // 搜索技能
  searchSkills(query: string): Skill[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllSkills().filter(skill =>
      skill.name.toLowerCase().includes(lowerQuery) ||
      skill.description.toLowerCase().includes(lowerQuery) ||
      skill.patterns.some(p => p.toLowerCase().includes(lowerQuery))
    );
  }

  // 模糊匹配技能
  fuzzyMatch(input: string): { skill: Skill; score: number }[] {
    const results: { skill: Skill; score: number }[] = [];
    const lowerInput = input.toLowerCase().replace(/\s+/g, '');

    for (const skill of this.skills.values()) {
      let score = 0;

      // 精确匹配名称
      if (skill.name.toLowerCase() === lowerInput) {
        score = 100;
      } else if (skill.name.toLowerCase().includes(lowerInput)) {
        score = 80;
      }

      // 描述匹配
      if (score === 0 && skill.description.toLowerCase().includes(lowerInput)) {
        score = 60;
      }

      // 模式匹配
      for (const pattern of skill.patterns) {
        const cleanPattern = pattern.toLowerCase().replace(/[{}]/g, '').replace(/\s+/g, '');
        if (cleanPattern === lowerInput) {
          score = 90;
          break;
        } else if (cleanPattern.includes(lowerInput)) {
          score = Math.max(score, 70);
        }
      }

      if (score > 0) {
        results.push({ skill, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  // 按类别获取技能
  getSkillsByCategory(category: Skill['category']): Skill[] {
    return this.getAllSkills().filter(s => s.category === category);
  }

  // 解析用户输入，提取技能和参数
  parseInstruction(input: string): { skill: Skill | null; params: Record<string, unknown> } {
    const lowerInput = input.toLowerCase();

    for (const skill of this.skills.values()) {
      for (const pattern of skill.patterns) {
        // 处理带参数的模板
        if (pattern.includes('{')) {
          const regex = pattern
            .replace('{', '(?<')
            .replace('}', '>.*?)')
            .replace(/[?]/g, '\\?');

          const match = lowerInput.match(regex);
          if (match) {
            // 提取参数
            const params: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(match.groups || {})) {
              params[key] = value;
            }
            return { skill, params };
          }
        }

        // 简单匹配
        if (lowerInput.includes(pattern.toLowerCase().replace(/[{}]/g, ''))) {
          return { skill, params: {} };
        }
      }
    }

    return { skill: null, params: {} };
  }

  // 执行 OpenClaw 操作
  private async executeOpenClawAction(command: ControlCommand): Promise<SkillResult> {
    const startTime = Date.now();

    try {
      // 获取第一个在线设备
      const devicesRes = await apiRequest('GET', '/api/remote/devices');
      const devicesJson = await devicesRes.json() as ApiResponse<PCDeviceInfo[]>;

      if (!devicesJson.success || !devicesJson.data || devicesJson.data.length === 0) {
        return { success: false, error: '没有可用的设备', duration: Date.now() - startTime };
      }

      const device = devicesJson.data.find(d => d.status === 'ONLINE') || devicesJson.data[0];

      // 发送控制命令
      const controlRes = await apiRequest(
        'POST',
        `/api/remote/control/${device.id}`,
        command
      );
      const controlJson = await controlRes.json() as ApiResponse<unknown>;

      return {
        success: controlJson.success,
        data: controlJson.data,
        error: controlJson.error,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '操作失败',
        duration: Date.now() - startTime
      };
    }
  }

  // 处理自然语言指令
  async processInstruction(input: string): Promise<SkillResult> {
    const { skill, params } = this.parseInstruction(input);

    if (!skill) {
      // 尝试通用处理
      return await this.handleGenericCommand(input);
    }

    return await skill.execute(params);
  }

  // 处理通用命令
  private async handleGenericCommand(input: string): Promise<SkillResult> {
    const lowerInput = input.toLowerCase();

    // 截图
    if (lowerInput.includes('截') || lowerInput.includes('capture')) {
      return await this.executeOpenClawAction({
        type: 'SCREENSHOT',
        action: 'CAPTURE'
      });
    }

    // 打开应用
    const openMatch = lowerInput.match(/打开?(.+)/);
    if (openMatch) {
      return await this.executeOpenClawAction({
        type: 'APP',
        action: 'OPEN',
        params: { appName: openMatch[1].trim() }
      });
    }

    return {
      success: false,
      error: '无法理解的指令，请尝试更具体的描述',
      duration: 0
    };
  }
}

// 单例实例
let skillEngineInstance: AISkillEngineImpl | null = null;

export function getSkillEngine(): AISkillEngineImpl {
  if (!skillEngineInstance) {
    skillEngineInstance = new AISkillEngineImpl();
  }
  return skillEngineInstance;
}

// ============================================
// Zustand Store - 状态管理
// ============================================

interface OpenClawState {
  // 设备状态
  devices: PCDeviceInfo[];
  activeDevice: PCDeviceInfo | null;

  // 任务状态
  tasks: TaskDefinition[];
  enabledTasks: TaskDefinition[];

  // 连接状态
  isConnected: boolean;
  isConnecting: boolean;
  lastError: string | null;

  // 技能状态
  registeredSkills: Skill[];

  // Actions
  fetchDevices: () => Promise<void>;
  fetchTasks: () => Promise<void>;
  connectToDevice: (deviceId: string) => Promise<void>;
  disconnect: () => void;
  executeControl: (command: ControlCommand) => Promise<SkillResult>;
  executeSkill: (skillId: string, params?: Record<string, unknown>) => Promise<SkillResult>;
  processVoiceCommand: (text: string) => Promise<SkillResult>;
  registerCustomSkill: (skill: Skill) => void;
}

export const useOpenClawStore = create<OpenClawState>()(
  persist(
    (set, get) => ({
      devices: [],
      activeDevice: null,
      tasks: [],
      enabledTasks: [],
      isConnected: false,
      isConnecting: false,
      lastError: null,
      registeredSkills: [],

  fetchDevices: async () => {
    try {
      set({ isConnecting: true, lastError: null });

      const res = await apiRequest('GET', '/api/remote/devices');
      const json = await res.json() as ApiResponse<PCDeviceInfo[]>;

      if (json.success && json.data) {
        const onlineDevices = json.data.filter(d => d.status === 'ONLINE');
        set({
          devices: json.data,
          activeDevice: onlineDevices[0] || json.data[0] || null,
          isConnected: json.data.some(d => d.status === 'ONLINE'),
          isConnecting: false
        });
      } else {
        set({
          lastError: json.error || '获取设备列表失败',
          isConnecting: false
        });
      }
    } catch (error) {
      set({
        lastError: error instanceof Error ? error.message : '网络错误',
        isConnecting: false
      });
    }
  },

  fetchTasks: async () => {
    try {
      const res = await apiRequest('GET', '/api/tasks');
      const json = await res.json() as ApiResponse<TaskDefinition[]>;

      if (json.success && json.data) {
        set({
          tasks: json.data,
          enabledTasks: json.data.filter(t => t.status === 'ACTIVE')
        });
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    }
  },

  connectToDevice: async (deviceId: string) => {
    const { devices } = get();
    const device = devices.find(d => d.id === deviceId);

    if (device) {
      set({ activeDevice: device, isConnected: device.status === 'ONLINE' });
    }
  },

  disconnect: () => {
    set({ activeDevice: null, isConnected: false });
  },

  executeControl: async (command: ControlCommand) => {
    const { activeDevice } = get();

    if (!activeDevice) {
      return { success: false, error: '没有选中的设备', duration: 0 };
    }

    try {
      const res = await apiRequest(
        'POST',
        `/api/remote/control/${activeDevice.id}`,
        command
      );
      const json = await res.json() as ApiResponse<unknown>;

      return {
        success: json.success,
        data: json.data,
        error: json.error,
        duration: 0
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '操作失败',
        duration: 0
      };
    }
  },

  executeSkill: async (skillId: string, params?: Record<string, unknown>) => {
    const skill = getSkillEngine().getAllSkills().find(s => s.id === skillId);

    if (!skill) {
      return { success: false, error: `技能不存在: ${skillId}`, duration: 0 };
    }

    return await skill.execute(params);
  },

  processVoiceCommand: async (text: string) => {
    const skillEngine = getSkillEngine();
    return await skillEngine.processInstruction(text);
  },

  registerCustomSkill: (skill: Skill) => {
    getSkillEngine().registerSkill(skill);
    set(state => ({
      registeredSkills: [...state.registeredSkills, skill]
    }));
  }
}),

  {
    name: 'openclaw-storage',
    storage: createJSONStorage(() => localStorage),
    partialize: (state: OpenClawState) => ({
      activeDevice: state.activeDevice,
      registeredSkills: state.registeredSkills,
    }),
  }
));

// ============================================
// Hook 导出
// ============================================

export { AISkillEngineImpl };
export default useOpenClawStore;
