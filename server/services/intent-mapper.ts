/**
 * Z5 Intent-to-Coordinate Mapper
 * 将小智的意图识别结果映射为手机屏幕点击坐标
 */

export interface ScreenCoordinate {
  x: number;
  y: number;
  action: 'tap' | 'long_press' | 'swipe' | 'double_tap';
  duration?: number;
  swipeEnd?: { x: number; y: number };
}

export interface IntentMapping {
  intent: string;
  keywords: string[];
  coordinate: ScreenCoordinate;
  description: string;
  app?: string;
  context?: string;
}

export interface MappingResult {
  success: boolean;
  intent: string;
  coordinate: ScreenCoordinate | null;
  confidence: number;
  description: string;
  alternativeIntents?: string[];
}

export interface DeviceProfile {
  id: string;
  name: string;
  screenWidth: number;
  screenHeight: number;
  density: number;
  app: string;
}

const DEFAULT_DEVICE: DeviceProfile = {
  id: 'default',
  name: '通用手机',
  screenWidth: 1080,
  screenHeight: 2400,
  density: 2.75,
  app: 'general',
};

const INTENT_MAPPINGS: IntentMapping[] = [
  {
    intent: 'send',
    keywords: ['发送', '发', '送出', '提交', '发出去', '发消息'],
    coordinate: { x: 90, y: 500, action: 'tap' },
    description: '点击发送按钮',
    app: 'wechat',
  },
  {
    intent: 'confirm',
    keywords: ['确认', '确定', '同意', '是的', '好的', 'OK', '可以'],
    coordinate: { x: 75, y: 85, action: 'tap' },
    description: '点击确认按钮',
  },
  {
    intent: 'cancel',
    keywords: ['取消', '返回', '不要', '算了', '关闭'],
    coordinate: { x: 25, y: 85, action: 'tap' },
    description: '点击取消按钮',
  },
  {
    intent: 'back',
    keywords: ['返回', '后退', '上一页', '回去'],
    coordinate: { x: 5, y: 5, action: 'tap' },
    description: '点击返回键',
  },
  {
    intent: 'home',
    keywords: ['回主页', '首页', '主界面', '桌面'],
    coordinate: { x: 50, y: 98, action: 'tap' },
    description: '返回主屏幕',
  },
  {
    intent: 'scroll_down',
    keywords: ['向下', '下滑', '往下看', '下一页', '继续看'],
    coordinate: { x: 50, y: 70, action: 'swipe', swipeEnd: { x: 50, y: 30 } },
    description: '向下滑动',
  },
  {
    intent: 'scroll_up',
    keywords: ['向上', '上滑', '往上看', '回顶部'],
    coordinate: { x: 50, y: 30, action: 'swipe', swipeEnd: { x: 50, y: 70 } },
    description: '向上滑动',
  },
  {
    intent: 'search',
    keywords: ['搜索', '查找', '找', '搜一下'],
    coordinate: { x: 50, y: 8, action: 'tap' },
    description: '点击搜索框',
  },
  {
    intent: 'menu',
    keywords: ['菜单', '更多', '设置', '选项'],
    coordinate: { x: 95, y: 5, action: 'tap' },
    description: '打开菜单',
  },
  {
    intent: 'share',
    keywords: ['分享', '转发', '发给别人'],
    coordinate: { x: 85, y: 5, action: 'tap' },
    description: '点击分享按钮',
  },
  {
    intent: 'like',
    keywords: ['点赞', '喜欢', '赞一下', '爱心'],
    coordinate: { x: 15, y: 80, action: 'tap' },
    description: '点击点赞按钮',
  },
  {
    intent: 'comment',
    keywords: ['评论', '留言', '回复'],
    coordinate: { x: 50, y: 80, action: 'tap' },
    description: '点击评论按钮',
  },
  {
    intent: 'next',
    keywords: ['下一个', '下一条', '下一张', '继续'],
    coordinate: { x: 80, y: 50, action: 'swipe', swipeEnd: { x: 20, y: 50 } },
    description: '切换到下一个',
  },
  {
    intent: 'previous',
    keywords: ['上一个', '上一条', '上一张', '返回上个'],
    coordinate: { x: 20, y: 50, action: 'swipe', swipeEnd: { x: 80, y: 50 } },
    description: '切换到上一个',
  },
  {
    intent: 'play',
    keywords: ['播放', '开始', '继续播放'],
    coordinate: { x: 50, y: 50, action: 'tap' },
    description: '播放/暂停',
  },
  {
    intent: 'pause',
    keywords: ['暂停', '停止', '停一下'],
    coordinate: { x: 50, y: 50, action: 'tap' },
    description: '播放/暂停',
  },
  {
    intent: 'refresh',
    keywords: ['刷新', '更新', '重新加载'],
    coordinate: { x: 50, y: 20, action: 'swipe', swipeEnd: { x: 50, y: 60 } },
    description: '下拉刷新',
  },
  {
    intent: 'delete',
    keywords: ['删除', '移除', '清除', '去掉'],
    coordinate: { x: 90, y: 50, action: 'long_press', duration: 500 },
    description: '长按删除',
  },
  {
    intent: 'select_all',
    keywords: ['全选', '选择全部', '都选上'],
    coordinate: { x: 10, y: 10, action: 'tap' },
    description: '全选',
  },
  {
    intent: 'copy',
    keywords: ['复制', '拷贝'],
    coordinate: { x: 50, y: 50, action: 'long_press', duration: 300 },
    description: '长按复制',
  },
  {
    intent: 'paste',
    keywords: ['粘贴', '贴上'],
    coordinate: { x: 50, y: 50, action: 'long_press', duration: 300 },
    description: '长按粘贴',
  },
  {
    intent: 'voice_input',
    keywords: ['语音输入', '说话', '语音'],
    coordinate: { x: 50, y: 92, action: 'long_press', duration: 0 },
    description: '长按语音输入',
  },
  {
    intent: 'camera',
    keywords: ['拍照', '相机', '拍一张'],
    coordinate: { x: 50, y: 95, action: 'tap' },
    description: '打开相机',
  },
  {
    intent: 'gallery',
    keywords: ['相册', '图片', '照片'],
    coordinate: { x: 10, y: 90, action: 'tap' },
    description: '打开相册',
  },
];

const APP_SPECIFIC_MAPPINGS: Record<string, IntentMapping[]> = {
  wechat: [
    {
      intent: 'send',
      keywords: ['发送', '发', '送出'],
      coordinate: { x: 95, y: 93, action: 'tap' },
      description: '微信发送消息',
      app: 'wechat',
    },
    {
      intent: 'voice_message',
      keywords: ['语音', '发语音', '说话'],
      coordinate: { x: 10, y: 93, action: 'long_press', duration: 0 },
      description: '长按录制语音',
      app: 'wechat',
    },
    {
      intent: 'moments',
      keywords: ['朋友圈', '发朋友圈'],
      coordinate: { x: 75, y: 98, action: 'tap' },
      description: '进入朋友圈',
      app: 'wechat',
    },
  ],
  alipay: [
    {
      intent: 'scan',
      keywords: ['扫一扫', '扫码', '扫描'],
      coordinate: { x: 25, y: 30, action: 'tap' },
      description: '支付宝扫一扫',
      app: 'alipay',
    },
    {
      intent: 'pay',
      keywords: ['付款', '支付', '付钱'],
      coordinate: { x: 50, y: 30, action: 'tap' },
      description: '支付宝付款码',
      app: 'alipay',
    },
  ],
  douyin: [
    {
      intent: 'like',
      keywords: ['点赞', '喜欢', '双击'],
      coordinate: { x: 50, y: 50, action: 'double_tap' },
      description: '抖音双击点赞',
      app: 'douyin',
    },
    {
      intent: 'next_video',
      keywords: ['下一个', '下一条', '刷'],
      coordinate: { x: 50, y: 70, action: 'swipe', swipeEnd: { x: 50, y: 30 } },
      description: '抖音下一个视频',
      app: 'douyin',
    },
  ],
};

const customMappings: Map<string, IntentMapping[]> = new Map();

function calculateSimilarity(text: string, keyword: string): number {
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  
  if (lowerText === lowerKeyword) return 1.0;
  if (lowerText.includes(lowerKeyword)) return 0.9;
  if (lowerKeyword.includes(lowerText)) return 0.8;
  
  let matches = 0;
  for (const char of lowerKeyword) {
    if (lowerText.includes(char)) matches++;
  }
  return matches / lowerKeyword.length * 0.5;
}

function convertToAbsoluteCoordinates(
  percentCoord: ScreenCoordinate,
  device: DeviceProfile
): ScreenCoordinate {
  const absX = Math.round((percentCoord.x / 100) * device.screenWidth);
  const absY = Math.round((percentCoord.y / 100) * device.screenHeight);
  
  const result: ScreenCoordinate = {
    x: absX,
    y: absY,
    action: percentCoord.action,
    duration: percentCoord.duration,
  };
  
  if (percentCoord.swipeEnd) {
    result.swipeEnd = {
      x: Math.round((percentCoord.swipeEnd.x / 100) * device.screenWidth),
      y: Math.round((percentCoord.swipeEnd.y / 100) * device.screenHeight),
    };
  }
  
  return result;
}

export function mapIntentToCoordinate(
  text: string,
  options: {
    app?: string;
    device?: DeviceProfile;
    useAbsoluteCoords?: boolean;
  } = {}
): MappingResult {
  const { app, device = DEFAULT_DEVICE, useAbsoluteCoords = true } = options;
  
  let allMappings = [...INTENT_MAPPINGS];
  
  if (app && APP_SPECIFIC_MAPPINGS[app]) {
    allMappings = [...APP_SPECIFIC_MAPPINGS[app], ...allMappings];
  }
  
  const customList = customMappings.get(app || 'default');
  if (customList) {
    allMappings = [...customList, ...allMappings];
  }
  
  let bestMatch: { mapping: IntentMapping; score: number } | null = null;
  const alternatives: string[] = [];
  
  for (const mapping of allMappings) {
    for (const keyword of mapping.keywords) {
      const score = calculateSimilarity(text, keyword);
      
      if (score > 0.5) {
        alternatives.push(mapping.intent);
      }
      
      if (score > 0.7 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { mapping, score };
      }
    }
  }
  
  if (!bestMatch) {
    return {
      success: false,
      intent: 'unknown',
      coordinate: null,
      confidence: 0,
      description: '无法识别该意图，请尝试更明确的指令',
      alternativeIntents: Array.from(new Set(alternatives)).slice(0, 5),
    };
  }
  
  const coordinate = useAbsoluteCoords
    ? convertToAbsoluteCoordinates(bestMatch.mapping.coordinate, device)
    : bestMatch.mapping.coordinate;
  
  return {
    success: true,
    intent: bestMatch.mapping.intent,
    coordinate,
    confidence: bestMatch.score,
    description: bestMatch.mapping.description,
    alternativeIntents: Array.from(new Set(alternatives.filter(a => a !== bestMatch!.mapping.intent))).slice(0, 3),
  };
}

export function addCustomMapping(
  app: string,
  mapping: IntentMapping
): void {
  const list = customMappings.get(app) || [];
  list.push(mapping);
  customMappings.set(app, list);
}

export function removeCustomMapping(
  app: string,
  intent: string
): boolean {
  const list = customMappings.get(app);
  if (!list) return false;
  
  const index = list.findIndex(m => m.intent === intent);
  if (index === -1) return false;
  
  list.splice(index, 1);
  return true;
}

export function getAvailableIntents(app?: string): string[] {
  let mappings = [...INTENT_MAPPINGS];
  
  if (app && APP_SPECIFIC_MAPPINGS[app]) {
    mappings = [...APP_SPECIFIC_MAPPINGS[app], ...mappings];
  }
  
  const customList = customMappings.get(app || 'default');
  if (customList) {
    mappings = [...customList, ...mappings];
  }
  
  return Array.from(new Set(mappings.map(m => m.intent)));
}

export function getAllMappings(app?: string): IntentMapping[] {
  let mappings = [...INTENT_MAPPINGS];
  
  if (app && APP_SPECIFIC_MAPPINGS[app]) {
    mappings = [...APP_SPECIFIC_MAPPINGS[app], ...mappings];
  }
  
  return mappings;
}

export function generateADBCommand(result: MappingResult): string | null {
  if (!result.success || !result.coordinate) return null;
  
  const { x, y, action, duration, swipeEnd } = result.coordinate;
  
  switch (action) {
    case 'tap':
      return `adb shell input tap ${x} ${y}`;
    case 'long_press':
      return `adb shell input swipe ${x} ${y} ${x} ${y} ${duration || 500}`;
    case 'double_tap':
      return `adb shell input tap ${x} ${y} && sleep 0.1 && adb shell input tap ${x} ${y}`;
    case 'swipe':
      if (swipeEnd) {
        return `adb shell input swipe ${x} ${y} ${swipeEnd.x} ${swipeEnd.y} 300`;
      }
      return null;
    default:
      return null;
  }
}

export function batchMapIntents(
  texts: string[],
  options: {
    app?: string;
    device?: DeviceProfile;
    useAbsoluteCoords?: boolean;
  } = {}
): MappingResult[] {
  return texts.map(text => mapIntentToCoordinate(text, options));
}

export interface AutomationScript {
  name: string;
  steps: Array<{
    description: string;
    intent: string;
    delay?: number;
  }>;
}

export function generateAutomationSequence(
  script: AutomationScript,
  options: {
    app?: string;
    device?: DeviceProfile;
  } = {}
): Array<{ step: number; result: MappingResult; adbCommand: string | null; delay: number }> {
  return script.steps.map((step, index) => {
    const result = mapIntentToCoordinate(step.intent, { ...options, useAbsoluteCoords: true });
    return {
      step: index + 1,
      result,
      adbCommand: generateADBCommand(result),
      delay: step.delay || 500,
    };
  });
}
