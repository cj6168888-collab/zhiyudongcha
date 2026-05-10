/**
 * Z5 Mock-Op Layer - 动作转换器
 * 
 * 功能：
 * 1. 解析Z4决策大脑输出的动作指令
 * 2. 将指令转换为屏幕操作（点击、滑动、输入等）
 * 3. 通过WebSocket下发到客户端执行器
 * 4. 支持Web/Android/PC多端执行
 */

export type ActionType = 
  | 'CLICK'      // 点击
  | 'LONG_PRESS' // 长按
  | 'SWIPE'      // 滑动
  | 'INPUT'      // 输入文本
  | 'SCROLL'     // 滚动
  | 'BACK'       // 返回
  | 'HOME'       // 主页
  | 'WAIT'       // 等待
  | 'SCREENSHOT' // 截图
  | 'OCR_FIND'   // OCR查找文字
  | 'ELEMENT_FIND'; // 查找元素

export interface ScreenAction {
  id: string;
  type: ActionType;
  target: string;
  params?: ActionParams;
  priority: 'HIGH' | 'NORMAL' | 'LOW';
  timeout: number;
  retryCount: number;
  createdAt: number;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled';
  result?: ActionResult;
}

export interface ActionParams {
  x?: number;
  y?: number;
  text?: string;
  direction?: 'up' | 'down' | 'left' | 'right';
  distance?: number;
  duration?: number;
  confidence?: number;
  selector?: string;
  fuzzyMatch?: boolean;
}

export interface ActionResult {
  success: boolean;
  coordinates?: { x: number; y: number };
  matchedText?: string;
  confidence?: number;
  screenshot?: string;
  error?: string;
  executedAt: number;
  duration: number;
}

export interface ExecutorCapabilities {
  platform: 'web' | 'android' | 'ios' | 'windows' | 'macos' | 'linux';
  accessibilityEnabled: boolean;
  ocrEnabled: boolean;
  screenWidth: number;
  screenHeight: number;
  features: string[];
}

const ACTION_PATTERN = /\[(CLICK|LONG_PRESS|SWIPE|INPUT|SCROLL|BACK|HOME|WAIT|SCREENSHOT|OCR_FIND|ELEMENT_FIND):\s*(.+?)\]/gi;

const COMMON_TEXT_MAPPINGS: Record<string, string[]> = {
  '确认': ['确认', '确定', 'OK', 'Confirm', '好的', '是', 'Yes'],
  '取消': ['取消', 'Cancel', '否', 'No', '关闭', 'Close'],
  '发送': ['发送', 'Send', '提交', 'Submit', '确认发送'],
  '同意': ['同意', 'Agree', '接受', 'Accept', '我同意'],
  '下一步': ['下一步', 'Next', '继续', 'Continue', '下一个'],
  '完成': ['完成', 'Done', 'Finish', '结束', '确认完成'],
  '返回': ['返回', 'Back', '上一步', '后退'],
  '删除': ['删除', 'Delete', '移除', 'Remove', '清除'],
  '保存': ['保存', 'Save', '存储', '确认保存'],
  '支付': ['支付', 'Pay', '付款', '确认支付', '立即支付'],
  '登录': ['登录', 'Login', 'Sign in', '确认登录'],
  '注册': ['注册', 'Register', 'Sign up', '立即注册'],
};

export function parseActionFromText(text: string): ScreenAction[] {
  const actions: ScreenAction[] = [];
  let match;
  
  while ((match = ACTION_PATTERN.exec(text)) !== null) {
    const actionType = match[1].toUpperCase() as ActionType;
    const target = match[2].trim();
    
    const action: ScreenAction = {
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: actionType,
      target,
      params: parseActionParams(actionType, target),
      priority: determinePriority(actionType, target),
      timeout: determineTimeout(actionType),
      retryCount: 0,
      createdAt: Date.now(),
      status: 'pending',
    };
    
    actions.push(action);
  }
  
  return actions;
}

function parseActionParams(type: ActionType, target: string): ActionParams {
  const params: ActionParams = {
    fuzzyMatch: true,
    confidence: 0.8,
  };
  
  if (type === 'INPUT') {
    params.text = target;
  }
  
  if (type === 'SWIPE' || type === 'SCROLL') {
    const directions = ['up', 'down', 'left', 'right'];
    for (const dir of directions) {
      if (target.toLowerCase().includes(dir)) {
        params.direction = dir as any;
        break;
      }
    }
    params.distance = 300;
    params.duration = 300;
  }
  
  if (type === 'WAIT') {
    const timeMatch = target.match(/(\d+)/);
    params.duration = timeMatch ? parseInt(timeMatch[1]) * 1000 : 2000;
  }
  
  const coordMatch = target.match(/\((\d+),\s*(\d+)\)/);
  if (coordMatch) {
    params.x = parseInt(coordMatch[1]);
    params.y = parseInt(coordMatch[2]);
  }
  
  return params;
}

function determinePriority(type: ActionType, target: string): 'HIGH' | 'NORMAL' | 'LOW' {
  const highPriorityKeywords = ['支付', '转账', '确认支付', '立即支付', '删除', '同意'];
  const lowPriorityKeywords = ['返回', '关闭', '取消'];
  
  for (const keyword of highPriorityKeywords) {
    if (target.includes(keyword)) return 'HIGH';
  }
  
  for (const keyword of lowPriorityKeywords) {
    if (target.includes(keyword)) return 'LOW';
  }
  
  return 'NORMAL';
}

function determineTimeout(type: ActionType): number {
  switch (type) {
    case 'OCR_FIND':
    case 'ELEMENT_FIND':
      return 10000;
    case 'SCREENSHOT':
      return 5000;
    case 'WAIT':
      return 60000;
    default:
      return 5000;
  }
}

export function expandTextVariants(text: string): string[] {
  const variants: string[] = [text];
  
  for (const [key, synonyms] of Object.entries(COMMON_TEXT_MAPPINGS)) {
    if (text.includes(key)) {
      for (const synonym of synonyms) {
        if (synonym !== text && !variants.includes(synonym)) {
          variants.push(synonym);
        }
      }
    }
  }
  
  return variants;
}

export interface MockOpSession {
  sessionId: string;
  userId: string;
  deviceId: string;
  capabilities: ExecutorCapabilities;
  pendingActions: ScreenAction[];
  executedActions: ScreenAction[];
  connected: boolean;
  lastHeartbeat: number;
}

const activeSessions: Map<string, MockOpSession> = new Map();

export function createSession(
  userId: string,
  deviceId: string,
  capabilities: ExecutorCapabilities
): MockOpSession {
  const sessionId = `mockop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const session: MockOpSession = {
    sessionId,
    userId,
    deviceId,
    capabilities,
    pendingActions: [],
    executedActions: [],
    connected: true,
    lastHeartbeat: Date.now(),
  };
  
  activeSessions.set(sessionId, session);
  
  console.log(`[MockOp] Session created: ${sessionId} for device ${deviceId}`);
  
  return session;
}

export function getSession(sessionId: string): MockOpSession | undefined {
  return activeSessions.get(sessionId);
}

export function getUserSessions(userId: string): MockOpSession[] {
  return Array.from(activeSessions.values()).filter(s => s.userId === userId);
}

export function updateSessionHeartbeat(sessionId: string): boolean {
  const session = activeSessions.get(sessionId);
  if (session) {
    session.lastHeartbeat = Date.now();
    session.connected = true;
    return true;
  }
  return false;
}

export function closeSession(sessionId: string): boolean {
  const session = activeSessions.get(sessionId);
  if (session) {
    session.connected = false;
    activeSessions.delete(sessionId);
    console.log(`[MockOp] Session closed: ${sessionId}`);
    return true;
  }
  return false;
}

export function queueAction(sessionId: string, action: ScreenAction): boolean {
  const session = activeSessions.get(sessionId);
  if (!session || !session.connected) {
    console.error(`[MockOp] Cannot queue action: session ${sessionId} not found or disconnected`);
    return false;
  }
  
  session.pendingActions.push(action);
  console.log(`[MockOp] Action queued: ${action.type} -> ${action.target}`);
  return true;
}

export function getNextAction(sessionId: string): ScreenAction | null {
  const session = activeSessions.get(sessionId);
  if (!session || session.pendingActions.length === 0) {
    return null;
  }
  
  session.pendingActions.sort((a, b) => {
    const priorityOrder = { HIGH: 0, NORMAL: 1, LOW: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
  
  const action = session.pendingActions.shift()!;
  action.status = 'executing';
  
  return action;
}

export function completeAction(
  sessionId: string,
  actionId: string,
  result: ActionResult
): boolean {
  const session = activeSessions.get(sessionId);
  if (!session) return false;
  
  const actionIndex = session.pendingActions.findIndex(a => a.id === actionId);
  if (actionIndex >= 0) {
    const action = session.pendingActions.splice(actionIndex, 1)[0];
    action.status = result.success ? 'completed' : 'failed';
    action.result = result;
    session.executedActions.push(action);
    
    console.log(`[MockOp] Action ${result.success ? 'completed' : 'failed'}: ${action.type} -> ${action.target}`);
    return true;
  }
  
  return false;
}

export interface PermissionGuide {
  platform: string;
  steps: string[];
  settingsPath: string;
  requiredPermissions: string[];
}

export function getAccessibilityGuide(platform: string): PermissionGuide {
  const guides: Record<string, PermissionGuide> = {
    android: {
      platform: 'Android',
      steps: [
        '打开手机"设置"应用',
        '找到"无障碍"或"辅助功能"选项',
        '选择"已安装的服务"或"无障碍服务"',
        '找到"小智助手"并开启',
        '确认授权弹窗，点击"允许"',
        '返回应用，功能即可正常使用',
      ],
      settingsPath: 'android.settings.ACCESSIBILITY_SETTINGS',
      requiredPermissions: [
        'android.permission.BIND_ACCESSIBILITY_SERVICE',
        'android.permission.SYSTEM_ALERT_WINDOW',
      ],
    },
    ios: {
      platform: 'iOS',
      steps: [
        '打开"设置"应用',
        '进入"辅助功能"',
        '选择"触控" -> "辅助触控"',
        '开启辅助触控功能',
        '注意：iOS限制较多，部分功能可能受限',
      ],
      settingsPath: 'App-Prefs:root=ACCESSIBILITY',
      requiredPermissions: ['辅助触控权限'],
    },
    windows: {
      platform: 'Windows',
      steps: [
        '以管理员身份运行小智助手',
        '在系统托盘中找到小智图标',
        '右键点击选择"启用自动化控制"',
        '确认UAC权限弹窗',
        '功能即可正常使用',
      ],
      settingsPath: 'ms-settings:easeofaccess',
      requiredPermissions: ['管理员权限', 'UI自动化权限'],
    },
    macos: {
      platform: 'macOS',
      steps: [
        '打开"系统偏好设置"',
        '进入"安全性与隐私" -> "隐私"',
        '选择"辅助功能"',
        '点击锁图标并输入密码',
        '勾选"小智助手"应用',
        '重启应用使权限生效',
      ],
      settingsPath: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
      requiredPermissions: ['辅助功能权限', '屏幕录制权限'],
    },
    web: {
      platform: 'Web浏览器',
      steps: [
        'Web端自动化功能已内置',
        '无需额外权限配置',
        '可直接操作当前页面元素',
        '如需跨页面操作，请使用桌面客户端',
      ],
      settingsPath: '',
      requiredPermissions: [],
    },
  };
  
  return guides[platform.toLowerCase()] || guides.web;
}

export function checkCapabilities(
  capabilities: ExecutorCapabilities,
  requiredAction: ActionType
): { capable: boolean; reason?: string; guide?: PermissionGuide } {
  if (!capabilities.accessibilityEnabled) {
    if (['CLICK', 'LONG_PRESS', 'SWIPE', 'INPUT'].includes(requiredAction)) {
      return {
        capable: false,
        reason: '需要开启辅助功能权限才能执行此操作',
        guide: getAccessibilityGuide(capabilities.platform),
      };
    }
  }
  
  if (!capabilities.ocrEnabled && requiredAction === 'OCR_FIND') {
    return {
      capable: false,
      reason: 'OCR功能未启用，无法进行文字识别定位',
    };
  }
  
  return { capable: true };
}

export function generateWebClickScript(target: string, fuzzyMatch: boolean = true): string {
  const variants = expandTextVariants(target);
  const variantsJson = JSON.stringify(variants);
  
  return `
(function() {
  const targets = ${variantsJson};
  const fuzzy = ${fuzzyMatch};
  
  function findElement(text) {
    const selectors = [
      'button', 'a', 'input[type="submit"]', 'input[type="button"]',
      '[role="button"]', '[onclick]', '.btn', '.button'
    ];
    
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        const content = el.textContent?.trim() || el.value || el.getAttribute('aria-label') || '';
        if (fuzzy) {
          if (content.includes(text) || text.includes(content)) {
            return el;
          }
        } else {
          if (content === text) {
            return el;
          }
        }
      }
    }
    
    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
      const content = el.textContent?.trim() || '';
      if (content === text && el.offsetWidth > 0 && el.offsetHeight > 0) {
        return el;
      }
    }
    
    return null;
  }
  
  for (const target of targets) {
    const element = findElement(target);
    if (element) {
      const rect = element.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      
      element.click();
      
      return {
        success: true,
        matchedText: target,
        coordinates: { x: Math.round(x), y: Math.round(y) },
        element: element.tagName.toLowerCase()
      };
    }
  }
  
  return {
    success: false,
    error: '未找到目标元素: ' + targets.join(', ')
  };
})();
`;
}

export function generateAndroidAccessibilityAction(action: ScreenAction): object {
  return {
    actionType: action.type,
    target: action.target,
    variants: expandTextVariants(action.target),
    params: action.params,
    script: {
      findByText: true,
      findByContentDescription: true,
      findByViewId: false,
      scrollToFind: true,
      maxScrollAttempts: 3,
    },
  };
}

export function generatePyAutoGUIScript(action: ScreenAction): string {
  const params = action.params || {};
  
  switch (action.type) {
    case 'CLICK':
      if (params.x !== undefined && params.y !== undefined) {
        return `pyautogui.click(${params.x}, ${params.y})`;
      }
      return `
import pyautogui
import pytesseract
from PIL import Image

screenshot = pyautogui.screenshot()
text_data = pytesseract.image_to_data(screenshot, lang='chi_sim+eng', output_type=pytesseract.Output.DICT)

targets = ${JSON.stringify(expandTextVariants(action.target))}
for i, text in enumerate(text_data['text']):
    for target in targets:
        if target in text or text in target:
            x = text_data['left'][i] + text_data['width'][i] // 2
            y = text_data['top'][i] + text_data['height'][i] // 2
            pyautogui.click(x, y)
            print(f"Clicked: {target} at ({x}, {y})")
            break
`;
    
    case 'INPUT':
      return `pyautogui.typewrite('${params.text}', interval=0.05)`;
    
    case 'SWIPE':
      const dir = params.direction || 'down';
      const dist = params.distance || 300;
      const moves: Record<string, string> = {
        up: `pyautogui.scroll(${dist})`,
        down: `pyautogui.scroll(-${dist})`,
        left: `pyautogui.hscroll(-${dist})`,
        right: `pyautogui.hscroll(${dist})`,
      };
      return moves[dir] || moves.down;
    
    case 'SCREENSHOT':
      return `pyautogui.screenshot('screenshot_${Date.now()}.png')`;
    
    default:
      return `# Unsupported action: ${action.type}`;
  }
}

export interface ActionDispatchResult {
  dispatched: boolean;
  sessionId?: string;
  actionId?: string;
  message: string;
  guide?: PermissionGuide;
}

export function dispatchAction(
  userId: string,
  actionText: string
): ActionDispatchResult {
  const actions = parseActionFromText(actionText);
  
  if (actions.length === 0) {
    return {
      dispatched: false,
      message: '未识别到有效的操作指令',
    };
  }
  
  const sessions = getUserSessions(userId);
  const activeSessions = sessions.filter(s => s.connected);
  
  if (activeSessions.length === 0) {
    return {
      dispatched: false,
      message: '当前无可用的执行设备。请在手机或电脑上启动小智客户端，并确保已开启辅助功能权限。',
      guide: getAccessibilityGuide('android'),
    };
  }
  
  const session = activeSessions[0];
  
  for (const action of actions) {
    const capCheck = checkCapabilities(session.capabilities, action.type);
    if (!capCheck.capable) {
      return {
        dispatched: false,
        message: capCheck.reason!,
        guide: capCheck.guide,
      };
    }
    
    queueAction(session.sessionId, action);
  }
  
  return {
    dispatched: true,
    sessionId: session.sessionId,
    actionId: actions[0].id,
    message: `已派发 ${actions.length} 个操作指令到设备 ${session.deviceId}`,
  };
}

export function getSessionStats(): {
  totalSessions: number;
  activeCount: number;
  pendingActions: number;
  completedActions: number;
} {
  let pendingActions = 0;
  let completedActions = 0;
  let activeCount = 0;
  
  Array.from(activeSessions.values()).forEach(session => {
    if (session.connected) activeCount++;
    pendingActions += session.pendingActions.length;
    completedActions += session.executedActions.length;
  });
  
  return {
    totalSessions: activeSessions.size,
    activeCount,
    pendingActions,
    completedActions,
  };
}
