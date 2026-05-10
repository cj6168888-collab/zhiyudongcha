/**
 * DeviceRegistry - 设备注册服务
 *
 * 功能：
 * - 设备注册与发现
 * - 程序列表管理
 * - 设备能力上报
 */

import { createServiceLogger } from '../../lib/logger';
const logger = createServiceLogger('DeviceRegistry');

import {
  Device, DeviceType, DeviceStatus, DeviceCapabilities, DeviceResources,
  InstalledProgram, ProgramAction
} from '../cloud/CloudHub';
import { cloudHub } from '../cloud/CloudHub';
import { randomUUID } from 'crypto';

// ============ 程序数据库 ============

/**
 * 已知程序的预定义信息
 * 这些信息帮助小星理解程序能做什么
 */
export const KNOWN_PROGRAMS: Record<string, {
  name: string;
  category: InstalledProgram['category'];
  description: string;
  actions: Omit<ProgramAction, 'id'>[];
}> = {
  // ========== 移动端程序 ==========
  'com.tencent.mm': {
    name: '微信',
    category: 'social',
    description: '微信是中国最流行的社交和支付应用',
    actions: [
      { name: '打开微信', description: '启动微信应用', invocation: { type: 'intent', value: 'weixin://' } },
      { name: '发送消息', description: '给指定联系人发送消息', invocation: { type: 'intent', value: 'weixin://app' }, parameters: [
        { name: 'contact', type: 'string', required: true, description: '联系人名称' },
        { name: 'message', type: 'string', required: true, description: '消息内容' },
      ]},
      { name: '查看朋友圈', description: '打开朋友圈', invocation: { type: 'intent', value: 'weixin://timeline' } },
      { name: '微信支付', description: '打开微信支付', invocation: { type: 'intent', value: 'weixin://pay' } },
      { name: '充值话费', description: '通过微信充值手机话费', invocation: { type: 'intent', value: 'weixin://updatablebill' } },
    ],
  },
  'com.alibaba.android.rimet': {
    name: '钉钉',
    category: 'work',
    description: '阿里巴巴的企业通讯和办公平台',
    actions: [
      { name: '打开钉钉', description: '启动钉钉', invocation: { type: 'intent', value: 'dingtalk://' } },
      { name: '发消息', description: '发送工作消息', invocation: { type: 'intent', value: 'dingtalk://dingtalkclient/action/im' } },
      { name: '创建日程', description: '创建工作日程', invocation: { type: 'intent', value: 'dingtalk://dingtalkclient/action/schedule' } },
      { name: '视频会议', description: '发起视频会议', invocation: { type: 'intent', value: 'dingtalk://dingtalkclient/action/videomeeting' } },
    ],
  },
  'com.tencent.qq': {
    name: 'QQ',
    category: 'social',
    description: '腾讯的即时通讯应用',
    actions: [
      { name: '打开QQ', description: '启动QQ', invocation: { type: 'intent', value: 'mqqapi://' } },
      { name: '发送消息', description: '发送QQ消息', invocation: { type: 'intent', value: 'mqqapi://im/chat' } },
    ],
  },
  'com.shanling.music': {
    name: '网易云音乐',
    category: 'media',
    description: '在线音乐播放应用',
    actions: [
      { name: '打开音乐', description: '启动网易云音乐', invocation: { type: 'intent', value: 'orpheus://' } },
      { name: '播放音乐', description: '播放音乐', invocation: { type: 'intent', value: 'orpheus://player/play' } },
      { name: '播放歌单', description: '播放指定歌单', invocation: { type: 'intent', value: 'orpheus://playlist' }, parameters: [
        { name: 'playlistId', type: 'string', required: true, description: '歌单ID' },
      ]},
    ],
  },
  'com.ss.android.ugc.aweme': {
    name: '抖音',
    category: 'media',
    description: '短视频分享平台',
    actions: [
      { name: '打开抖音', description: '启动抖音', invocation: { type: 'intent', value: 'snssdk1128://' } },
      { name: '拍摄视频', description: '打开相机拍摄', invocation: { type: 'intent', value: 'snssdk1128://camera' } },
    ],
  },
  'com.taobao.taobao4android': {
    name: '淘宝',
    category: 'other',
    description: '阿里巴巴的电商平台',
    actions: [
      { name: '打开淘宝', description: '启动淘宝', invocation: { type: 'intent', value: 'taobao://' } },
      { name: '搜索商品', description: '搜索商品', invocation: { type: 'intent', value: 'taobao://search' }, parameters: [
        { name: 'keyword', type: 'string', required: true, description: '搜索关键词' },
      ]},
      { name: '我的订单', description: '查看订单', invocation: { type: 'intent', value: 'taobao://container/orders' } },
    ],
  },
  'com.autonavi.minimap': {
    name: '高德地图',
    category: 'tool',
    description: '阿里巴巴的导航和地图应用',
    actions: [
      { name: '打开地图', description: '启动高德地图', invocation: { type: 'intent', value: 'amapuri://' } },
      { name: '导航', description: '开始导航', invocation: { type: 'intent', value: 'amapuri://route/plan' }, parameters: [
        { name: 'dname', type: 'string', required: true, description: '目的地名称' },
        { name: 'dlat', type: 'number', required: false, description: '目的地纬度' },
        { name: 'dlng', type: 'number', required: false, description: '目的地经度' },
      ]},
      { name: '搜索地点', description: '搜索地点', invocation: { type: 'intent', value: 'amapuri://search' }, parameters: [
        { name: 'query', type: 'string', required: true, description: '搜索关键词' },
      ]},
    ],
  },
  'com.tencent.map': {
    name: '腾讯地图',
    category: 'tool',
    description: '腾讯的导航和地图应用',
    actions: [
      { name: '打开地图', description: '启动腾讯地图', invocation: { type: 'intent', value: 'qqmap://' } },
      { name: '导航', description: '开始导航', invocation: { type: 'intent', value: 'qqmap://map/routeplan' } },
    ],
  },
  'com.baidu.BaiduMap': {
    name: '百度地图',
    category: 'tool',
    description: '百度的导航和地图应用',
    actions: [
      { name: '打开地图', description: '启动百度地图', invocation: { type: 'intent', value: 'baidumap://' } },
      { name: '导航', description: '开始导航', invocation: { type: 'intent', value: 'baidumap://map/routeplan' } },
    ],
  },

  // ========== 桌面端程序 (通过程序名匹配) ==========
  'WeChat': {
    name: '微信',
    category: 'social',
    description: 'Windows版微信',
    actions: [
      { name: '打开微信', description: '启动微信', invocation: { type: 'command', value: 'start wechat' } },
      { name: '发送消息', description: '通过微信发送消息', invocation: { type: 'command', value: 'wechat-send' }, parameters: [
        { name: 'contact', type: 'string', required: true, description: '联系人' },
        { name: 'message', type: 'string', required: true, description: '消息内容' },
      ]},
    ],
  },
  'DingTalk': {
    name: '钉钉',
    category: 'work',
    description: 'Windows版钉钉',
    actions: [
      { name: '打开钉钉', description: '启动钉钉', invocation: { type: 'command', value: 'start DingTalk' } },
      { name: '发送消息', description: '发送工作消息', invocation: { type: 'command', value: 'dingtalk-send' } },
      { name: '发起会议', description: '发起视频会议', invocation: { type: 'command', value: 'dingtalk-meeting' } },
    ],
  },
  'Code': {
    name: 'VSCode',
    category: 'work',
    description: '微软的代码编辑器，用于编程开发',
    actions: [
      { name: '打开VSCode', description: '启动VSCode', invocation: { type: 'command', value: 'code' } },
      { name: '打开文件夹', description: '打开指定文件夹', invocation: { type: 'command', value: 'code' }, parameters: [
        { name: 'path', type: 'string', required: true, description: '文件夹路径' },
      ]},
      { name: '打开文件', description: '打开指定文件', invocation: { type: 'command', value: 'code' }, parameters: [
        { name: 'file', type: 'string', required: true, description: '文件路径' },
      ]},
      { name: '新建文件', description: '创建新文件', invocation: { type: 'command', value: 'code --new-window' } },
      { name: '运行代码', description: '运行当前文件', invocation: { type: 'shortcut', value: 'Ctrl+Alt+N' } },
    ],
  },
  'WINWORD': {
    name: 'Word',
    category: 'work',
    description: '微软文档编辑器',
    actions: [
      { name: '打开Word', description: '启动Word', invocation: { type: 'command', value: 'start winword' } },
      { name: '新建文档', description: '创建新文档', invocation: { type: 'command', value: 'winword-new' } },
      { name: '打开文档', description: '打开文档', invocation: { type: 'command', value: 'winword-open' }, parameters: [
        { name: 'path', type: 'string', required: true, description: '文档路径' },
      ]},
    ],
  },
  'EXCEL': {
    name: 'Excel',
    category: 'work',
    description: '微软表格编辑器',
    actions: [
      { name: '打开Excel', description: '启动Excel', invocation: { type: 'command', value: 'start excel' } },
      { name: '新建表格', description: '创建新表格', invocation: { type: 'command', value: 'excel-new' } },
      { name: '打开表格', description: '打开表格文件', invocation: { type: 'command', value: 'excel-open' }, parameters: [
        { name: 'path', type: 'string', required: true, description: '文件路径' },
      ]},
    ],
  },
  'POWERPNT': {
    name: 'PowerPoint',
    category: 'work',
    description: '微软幻灯片编辑器',
    actions: [
      { name: '打开PPT', description: '启动PowerPoint', invocation: { type: 'command', value: 'start powerpnt' } },
      { name: '新建幻灯片', description: '创建新幻灯片', invocation: { type: 'command', value: 'ppt-new' } },
    ],
  },
  'notepad': {
    name: '记事本',
    category: 'tool',
    description: 'Windows自带文本编辑器',
    actions: [
      { name: '打开记事本', description: '启动记事本', invocation: { type: 'command', value: 'notepad' } },
      { name: '编辑文件', description: '用记事本打开文件', invocation: { type: 'command', value: 'notepad' }, parameters: [
        { name: 'path', type: 'string', required: true, description: '文件路径' },
      ]},
    ],
  },
  'chrome': {
    name: 'Chrome浏览器',
    category: 'tool',
    description: 'Google Chrome浏览器',
    actions: [
      { name: '打开浏览器', description: '启动Chrome', invocation: { type: 'command', value: 'start chrome' } },
      { name: '打开网址', description: '打开指定网址', invocation: { type: 'command', value: 'chrome-url' }, parameters: [
        { name: 'url', type: 'string', required: true, description: '网址' },
      ]},
      { name: '新建标签', description: '打开新标签页', invocation: { type: 'command', value: 'chrome-newtab' } },
    ],
  },
  'msedge': {
    name: 'Edge浏览器',
    category: 'tool',
    description: 'Microsoft Edge浏览器',
    actions: [
      { name: '打开浏览器', description: '启动Edge', invocation: { type: 'command', value: 'start msedge' } },
      { name: '打开网址', description: '打开指定网址', invocation: { type: 'command', value: 'edge-url' }, parameters: [
        { name: 'url', type: 'string', required: true, description: '网址' },
      ]},
    ],
  },
  'Explorer': {
    name: '文件资源管理器',
    category: 'system',
    description: 'Windows文件管理器',
    actions: [
      { name: '打开文件管理器', description: '打开资源管理器', invocation: { type: 'command', value: 'explorer' } },
      { name: '打开文件夹', description: '打开指定文件夹', invocation: { type: 'command', value: 'explorer' }, parameters: [
        { name: 'path', type: 'string', required: true, description: '文件夹路径' },
      ]},
      { name: '搜索文件', description: '搜索文件', invocation: { type: 'command', value: 'explorer-search' }, parameters: [
        { name: 'keyword', type: 'string', required: true, description: '搜索关键词' },
      ]},
    ],
  },
  'cmd': {
    name: '命令提示符',
    category: 'system',
    description: 'Windows命令行工具',
    actions: [
      { name: '打开命令行', description: '启动命令提示符', invocation: { type: 'command', value: 'cmd' } },
      { name: '执行命令', description: '执行CMD命令', invocation: { type: 'command', value: 'cmd-exec' }, parameters: [
        { name: 'command', type: 'string', required: true, description: '要执行的命令' },
      ]},
    ],
  },
  'powershell': {
    name: 'PowerShell',
    category: 'system',
    description: 'Windows PowerShell工具',
    actions: [
      { name: '打开PowerShell', description: '启动PowerShell', invocation: { type: 'command', value: 'powershell' } },
      { name: '执行脚本', description: '执行PowerShell脚本', invocation: { type: 'command', value: 'pwsh-exec' }, parameters: [
        { name: 'script', type: 'string', required: true, description: '脚本内容' },
      ]},
    ],
  },
};

// ============ 设备注册器 ============

class DeviceRegistry {
  private static instance: DeviceRegistry | null = null;

  private constructor() {}

  public static getInstance(): DeviceRegistry {
    if (!DeviceRegistry.instance) {
      DeviceRegistry.instance = new DeviceRegistry();
    }
    return DeviceRegistry.instance;
  }

  /**
   * 创建设备信息
   */
  public createDevice(params: {
    name: string;
    type: DeviceType;
    owner: string;
    os: string;
    osVersion: string;
    model?: string;
  }): Device {
    const device: Device = {
      id: `device_${randomUUID().slice(0, 8)}`,
      name: params.name,
      type: params.type,
      status: DeviceStatus.OFFLINE,
      connection: {
        protocol: 'websocket',
        endpoint: '',
        lastHeartbeat: new Date(),
      },
      capabilities: this.getDefaultCapabilities(params.type),
      resources: this.getDefaultResources(),
      programs: [],
      metadata: {
        os: params.os,
        osVersion: params.osVersion,
        model: params.model,
        owner: params.owner,
        tags: [],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return device;
  }

  /**
   * 获取默认能力
   */
  private getDefaultCapabilities(type: DeviceType): DeviceCapabilities {
    const base: DeviceCapabilities = {
      input: { voice: false, text: true, camera: false, fingerprint: false, face: false },
      output: { screen: true, speaker: false, vibration: false, led: false },
      sensors: { gps: false, accelerometer: false, gyroscope: false, nfc: false, bluetooth: false, wifi: true },
      execution: { canExecuteCommand: true, canControlOther: false, canAutomate: true },
      network: { hasInternet: true, localNetwork: true, mobileData: false },
      permissions: { admin: false, root: false },
    };

    switch (type) {
      case DeviceType.PHONE:
        return {
          input: { voice: true, text: true, camera: true, fingerprint: true, face: true },
          output: { screen: true, speaker: true, vibration: true, led: true },
          sensors: { gps: true, accelerometer: true, gyroscope: true, nfc: true, bluetooth: true, wifi: true },
          execution: { canExecuteCommand: true, canControlOther: false, canAutomate: true },
          network: { hasInternet: true, localNetwork: true, mobileData: true },
          permissions: { admin: false, root: false },
        };

      case DeviceType.DESKTOP:
        return {
          input: { voice: false, text: true, camera: false, fingerprint: false, face: false },
          output: { screen: true, speaker: true, vibration: false, led: false },
          sensors: { gps: false, accelerometer: false, gyroscope: false, nfc: false, bluetooth: true, wifi: true },
          execution: { canExecuteCommand: true, canControlOther: true, canAutomate: true, screenSize: { width: 1920, height: 1080 } },
          network: { hasInternet: true, localNetwork: true, mobileData: false },
          permissions: { admin: true, root: false },
        };

      case DeviceType.TABLET:
        return {
          input: { voice: true, text: true, camera: true, fingerprint: true, face: false },
          output: { screen: true, speaker: true, vibration: true, led: false },
          sensors: { gps: true, accelerometer: true, gyroscope: true, nfc: false, bluetooth: true, wifi: true },
          execution: { canExecuteCommand: true, canControlOther: false, canAutomate: true },
          network: { hasInternet: true, localNetwork: true, mobileData: true },
          permissions: { admin: false, root: false },
        };

      case DeviceType.WATCH:
        return {
          input: { voice: true, text: false, camera: false, fingerprint: false, face: true },
          output: { screen: true, speaker: true, vibration: true, led: false },
          sensors: { gps: true, accelerometer: true, gyroscope: true, nfc: true, bluetooth: true, wifi: false },
          execution: { canExecuteCommand: false, canControlOther: false, canAutomate: false },
          network: { hasInternet: false, localNetwork: false, mobileData: true },
          permissions: { admin: false, root: false },
        };

      default:
        return base;
    }
  }

  /**
   * 获取默认资源状态
   */
  private getDefaultResources(): DeviceResources {
    return {
      cpu: 0,
      memory: { used: 0, total: 0 },
      storage: { used: 0, total: 0 },
      battery: undefined,
      network: { type: 'wifi' },
    };
  }

  /**
   * 注册设备到云端
   */
  public registerDevice(device: Device): void {
    cloudHub.registerDevice(device);
    logger.info({ deviceId: device.id, name: device.name, type: device.type }, 'Device registered');
  }

  /**
   * 解析程序列表
   *
   * 将设备上报的程序列表与已知程序匹配
   */
  public parsePrograms(programs: Array<{
    packageName: string;
    name: string;
    version: string;
    enabled: boolean;
  }>): InstalledProgram[] {
    return programs.map(p => {
      // 查找预定义信息
      const known = KNOWN_PROGRAMS[p.packageName] || KNOWN_PROGRAMS[p.name];

      return {
        id: p.packageName || p.name,
        name: known?.name || p.name,
        packageName: p.packageName,
        version: p.version,
        category: known?.category || 'other',
        description: known?.description || `未知应用：${p.name}`,
        actions: known?.actions.map((a, i) => ({
          id: `${p.packageName}_${i}`,
          ...a,
        })) || [],
        enabled: p.enabled,
        installedAt: new Date(),
      };
    });
  }

  /**
   * 查找程序
   */
  public findProgram(deviceId: string, query: string): InstalledProgram | null {
    const device = cloudHub.getDevice(deviceId);
    if (!device) return null;

    const queryLower = query.toLowerCase();

    // 精确匹配
    for (const program of device.programs) {
      if (program.packageName.toLowerCase() === queryLower ||
          program.name.toLowerCase() === queryLower) {
        return program;
      }
    }

    // 模糊匹配
    for (const program of device.programs) {
      if (program.name.toLowerCase().includes(queryLower) ||
          program.packageName.toLowerCase().includes(queryLower) ||
          program.description.toLowerCase().includes(queryLower)) {
        return program;
      }
    }

    return null;
  }

  /**
   * 查找可执行动作
   */
  public findAction(deviceId: string, programQuery: string, actionQuery: string): {
    program: InstalledProgram;
    action: ProgramAction;
  } | null {
    const program = this.findProgram(deviceId, programQuery);
    if (!program) return null;

    const actionQueryLower = actionQuery.toLowerCase();

    for (const action of program.actions) {
      if (action.name.toLowerCase().includes(actionQueryLower) ||
          action.description.toLowerCase().includes(actionQueryLower)) {
        return { program, action };
      }
    }

    return null;
  }

  /**
   * 搜索程序
   */
  public searchPrograms(deviceId: string, query: string): InstalledProgram[] {
    const device = cloudHub.getDevice(deviceId);
    if (!device) return [];

    const queryLower = query.toLowerCase();
    const results: InstalledProgram[] = [];

    for (const program of device.programs) {
      if (program.name.toLowerCase().includes(queryLower) ||
          program.description.toLowerCase().includes(queryLower) ||
          program.category.toLowerCase().includes(queryLower) ||
          program.actions.some(a =>
            a.name.toLowerCase().includes(queryLower) ||
            a.description.toLowerCase().includes(queryLower)
          )) {
        results.push(program);
      }
    }

    return results;
  }

  /**
   * 生成设备能力描述
   *
   * 小星需要知道设备能做什么
   */
  public generateCapabilityDescription(device: Device): string {
    const parts: string[] = [];

    // 基础信息
    parts.push(`【${device.name}】(${device.type})`);
    parts.push(`系统：${device.metadata.os} ${device.metadata.osVersion}`);

    // 输入输出
    const inputs = [];
    if (device.capabilities.input.voice) inputs.push('语音');
    if (device.capabilities.input.camera) inputs.push('拍照');
    if (device.capabilities.input.text) inputs.push('文字');
    if (inputs.length) parts.push(`输入：${inputs.join('、')}`);

    const outputs = [];
    if (device.capabilities.output.screen) outputs.push('屏幕');
    if (device.capabilities.output.speaker) outputs.push('声音');
    if (device.capabilities.output.vibration) outputs.push('震动');
    if (outputs.length) parts.push(`输出：${outputs.join('、')}`);

    // 传感器
    const sensors = [];
    if (device.capabilities.sensors.gps) sensors.push('GPS定位');
    if (device.capabilities.sensors.bluetooth) sensors.push('蓝牙');
    if (device.capabilities.sensors.nfc) sensors.push('NFC');
    if (sensors.length) parts.push(`传感器：${sensors.join('、')}`);

    // 程序列表
    parts.push(`\n已安装 ${device.programs.length} 个应用：`);

    // 按分类展示
    const byCategory = this.groupByCategory(device.programs);
    for (const [category, programs] of Object.entries(byCategory)) {
      const programNames = programs.map(p => p.name).slice(0, 10);
      const suffix = programs.length > 10 ? `等${programs.length}个` : '';
      parts.push(`• ${category}：${programNames.join('、')}${suffix}`);
    }

    // 常用操作
    parts.push(`\n可用操作示例：`);

    for (const program of device.programs.slice(0, 5)) {
      for (const action of program.actions.slice(0, 2)) {
        parts.push(`• ${program.name}：${action.name}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * 按分类分组
   */
  private groupByCategory(programs: InstalledProgram[]): Record<string, InstalledProgram[]> {
    const groups: Record<string, InstalledProgram[]> = {};

    for (const program of programs) {
      const category = this.getCategoryName(program.category);
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(program);
    }

    return groups;
  }

  /**
   * 获取分类中文名
   */
  private getCategoryName(category: InstalledProgram['category']): string {
    const names: Record<string, string> = {
      social: '社交',
      work: '办公',
      tool: '工具',
      media: '娱乐',
      system: '系统',
      game: '游戏',
      other: '其他',
    };
    return names[category] || '其他';
  }

  /**
   * 扩展程序知识
   *
   * 当遇到未知程序时，学习并记住它
   */
  public learnProgram(program: InstalledProgram): void {
    // 添加到知识库
    cloudHub.addKnowledge({
      category: 'program',
      title: program.name,
      content: program.description,
      tags: [program.category, program.name, ...program.actions.map(a => a.name)],
      relatesTo: { program: program.id },
      confidence: 0.5,
      usage: { timesUsed: 0, successRate: 1.0 },
    });

    logger.info({ program: program.name }, 'Learned new program');
  }
}

// 导出
export const deviceRegistry = DeviceRegistry.getInstance();
export default deviceRegistry;
