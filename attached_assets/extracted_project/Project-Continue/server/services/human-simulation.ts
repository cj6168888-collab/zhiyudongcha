/**
 * Project Unbound - Human-like Simulation (人类行为模拟)
 * 
 * 功能：
 * 1. 鼠标移动轨迹模拟 - 贝塞尔曲线、自然抖动
 * 2. 打字行为模拟 - 速度变化、错误纠正
 * 3. 时间延迟模拟 - 思考时间、反应时间
 * 4. 行为特征学习 - 从真实用户行为中学习
 * 
 * 目标：
 * - 规避自动化检测
 * - 模拟真实人类操作模式
 * - 支持多种行为档案配置
 */

// ==================== 类型定义 ====================

export interface Point {
  x: number;
  y: number;
}

export interface TimedPoint extends Point {
  timestamp: number;
}

export interface MovementProfile {
  name: string;
  speedFactor: number;        // 速度因子 (0.5-2.0)
  accuracyFactor: number;     // 精确度因子 (0.5-1.0)
  hesitationChance: number;   // 犹豫概率 (0-0.3)
  overshootChance: number;    // 过冲概率 (0-0.2)
  curveIntensity: number;     // 曲线强度 (0-1)
}

export interface TypingProfile {
  name: string;
  baseWpm: number;            // 基础打字速度 (字/分钟)
  wpmVariance: number;        // 速度变化范围
  errorRate: number;          // 错误率 (0-0.1)
  correctionDelay: number;    // 纠错延迟 (ms)
  burstLength: number;        // 连续输入长度
  pauseChance: number;        // 暂停概率
  pauseDuration: number;      // 暂停时长 (ms)
}

export interface DelayProfile {
  name: string;
  thinkingTime: { min: number; max: number };     // 思考时间
  reactionTime: { min: number; max: number };     // 反应时间
  readingSpeed: number;                           // 阅读速度 (字符/秒)
  decisionTime: { min: number; max: number };     // 决策时间
}

export interface BehaviorProfile {
  id: string;
  name: string;
  description: string;
  movement: MovementProfile;
  typing: TypingProfile;
  delay: DelayProfile;
}

export interface MovementPath {
  points: TimedPoint[];
  totalDuration: number;
}

export interface TypingSequence {
  actions: TypingAction[];
  totalDuration: number;
}

export interface TypingAction {
  type: 'key_down' | 'key_up' | 'backspace' | 'pause';
  char?: string;
  delay: number;
}

// ==================== 预设档案 ====================

const PROFILES: Record<string, BehaviorProfile> = {
  NORMAL: {
    id: 'NORMAL',
    name: '普通用户',
    description: '模拟普通用户的操作习惯',
    movement: {
      name: 'normal_movement',
      speedFactor: 1.0,
      accuracyFactor: 0.85,
      hesitationChance: 0.1,
      overshootChance: 0.05,
      curveIntensity: 0.5,
    },
    typing: {
      name: 'normal_typing',
      baseWpm: 40,
      wpmVariance: 15,
      errorRate: 0.02,
      correctionDelay: 200,
      burstLength: 5,
      pauseChance: 0.1,
      pauseDuration: 500,
    },
    delay: {
      name: 'normal_delay',
      thinkingTime: { min: 500, max: 2000 },
      reactionTime: { min: 150, max: 400 },
      readingSpeed: 15,
      decisionTime: { min: 300, max: 1000 },
    },
  },
  FAST: {
    id: 'FAST',
    name: '熟练用户',
    description: '模拟熟练用户的快速操作',
    movement: {
      name: 'fast_movement',
      speedFactor: 1.5,
      accuracyFactor: 0.9,
      hesitationChance: 0.02,
      overshootChance: 0.08,
      curveIntensity: 0.3,
    },
    typing: {
      name: 'fast_typing',
      baseWpm: 80,
      wpmVariance: 20,
      errorRate: 0.01,
      correctionDelay: 100,
      burstLength: 10,
      pauseChance: 0.05,
      pauseDuration: 200,
    },
    delay: {
      name: 'fast_delay',
      thinkingTime: { min: 200, max: 800 },
      reactionTime: { min: 100, max: 250 },
      readingSpeed: 25,
      decisionTime: { min: 100, max: 500 },
    },
  },
  SLOW: {
    id: 'SLOW',
    name: '谨慎用户',
    description: '模拟谨慎、缓慢的用户操作',
    movement: {
      name: 'slow_movement',
      speedFactor: 0.6,
      accuracyFactor: 0.95,
      hesitationChance: 0.2,
      overshootChance: 0.02,
      curveIntensity: 0.7,
    },
    typing: {
      name: 'slow_typing',
      baseWpm: 25,
      wpmVariance: 10,
      errorRate: 0.03,
      correctionDelay: 400,
      burstLength: 3,
      pauseChance: 0.2,
      pauseDuration: 1000,
    },
    delay: {
      name: 'slow_delay',
      thinkingTime: { min: 1000, max: 4000 },
      reactionTime: { min: 300, max: 600 },
      readingSpeed: 8,
      decisionTime: { min: 500, max: 2000 },
    },
  },
  STEALTH: {
    id: 'STEALTH',
    name: '隐蔽模式',
    description: '最大程度模拟真人，规避检测',
    movement: {
      name: 'stealth_movement',
      speedFactor: 0.9,
      accuracyFactor: 0.82,
      hesitationChance: 0.15,
      overshootChance: 0.1,
      curveIntensity: 0.8,
    },
    typing: {
      name: 'stealth_typing',
      baseWpm: 45,
      wpmVariance: 25,
      errorRate: 0.04,
      correctionDelay: 300,
      burstLength: 4,
      pauseChance: 0.15,
      pauseDuration: 800,
    },
    delay: {
      name: 'stealth_delay',
      thinkingTime: { min: 800, max: 3000 },
      reactionTime: { min: 200, max: 500 },
      readingSpeed: 12,
      decisionTime: { min: 400, max: 1500 },
    },
  },
};

// ==================== 数学工具 ====================

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function gaussianRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// 三次贝塞尔曲线
function cubicBezier(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;

  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  };
}

// ==================== 鼠标轨迹生成器 ====================

class MouseTrajectoryGenerator {
  private profile: MovementProfile;

  constructor(profile: MovementProfile) {
    this.profile = profile;
  }

  /**
   * 生成从起点到终点的自然鼠标移动轨迹
   */
  generatePath(from: Point, to: Point, baseDuration?: number): MovementPath {
    const distance = Math.sqrt(Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2));
    
    // 根据距离和速度因子计算时长
    const duration = baseDuration ?? this.calculateDuration(distance);
    
    // 生成控制点
    const controlPoints = this.generateControlPoints(from, to);
    
    // 生成路径点
    const points = this.samplePath(from, to, controlPoints, duration);
    
    // 添加抖动和噪声
    const noisyPoints = this.addNoise(points);
    
    // 可能添加过冲
    const finalPoints = this.maybeAddOvershoot(noisyPoints, to);
    
    return {
      points: finalPoints,
      totalDuration: finalPoints.length > 0 
        ? finalPoints[finalPoints.length - 1].timestamp - finalPoints[0].timestamp
        : 0,
    };
  }

  private calculateDuration(distance: number): number {
    // Fitts' Law 近似
    const baseDuration = 100 + distance * 2;
    const adjusted = baseDuration / this.profile.speedFactor;
    // 添加随机变化
    return adjusted * (0.8 + Math.random() * 0.4);
  }

  private generateControlPoints(from: Point, to: Point): Point[] {
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const distance = Math.sqrt(Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2));
    
    // 曲线偏移量
    const offset = distance * this.profile.curveIntensity * 0.3;
    
    // 随机偏移方向
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const perpAngle = angle + Math.PI / 2;
    const randomOffset = (Math.random() - 0.5) * 2 * offset;
    
    return [
      // 第一个控制点
      {
        x: lerp(from.x, midX, 0.3) + Math.cos(perpAngle) * randomOffset * 0.5,
        y: lerp(from.y, midY, 0.3) + Math.sin(perpAngle) * randomOffset * 0.5,
      },
      // 第二个控制点
      {
        x: lerp(from.x, midX, 0.7) + Math.cos(perpAngle) * randomOffset,
        y: lerp(from.y, midY, 0.7) + Math.sin(perpAngle) * randomOffset,
      },
    ];
  }

  private samplePath(from: Point, to: Point, controls: Point[], duration: number): TimedPoint[] {
    const points: TimedPoint[] = [];
    const startTime = Date.now();
    
    // 根据距离决定采样点数
    const distance = Math.sqrt(Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2));
    const numPoints = Math.max(10, Math.min(100, Math.floor(distance / 5)));
    
    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      
      // 使用缓动函数使速度更自然
      const easedT = this.easeInOutQuad(t);
      
      const point = cubicBezier(from, controls[0], controls[1], to, easedT);
      
      // 非线性时间插值 (开始和结束慢，中间快)
      const timeT = this.speedCurve(t);
      
      points.push({
        x: Math.round(point.x),
        y: Math.round(point.y),
        timestamp: startTime + duration * timeT,
      });
    }
    
    return points;
  }

  private easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  private speedCurve(t: number): number {
    // 模拟真实鼠标加速和减速
    if (t < 0.2) {
      return t * t * 2.5; // 加速阶段
    } else if (t > 0.8) {
      const x = 1 - t;
      return 1 - x * x * 2.5; // 减速阶段
    }
    return t; // 匀速阶段
  }

  private addNoise(points: TimedPoint[]): TimedPoint[] {
    const noiseAmount = (1 - this.profile.accuracyFactor) * 3;
    
    return points.map((point, i) => {
      // 端点不加噪声
      if (i === 0 || i === points.length - 1) {
        return point;
      }
      
      return {
        x: Math.round(point.x + gaussianRandom() * noiseAmount),
        y: Math.round(point.y + gaussianRandom() * noiseAmount),
        timestamp: point.timestamp,
      };
    });
  }

  private maybeAddOvershoot(points: TimedPoint[], target: Point): TimedPoint[] {
    if (Math.random() > this.profile.overshootChance || points.length < 3) {
      return points;
    }
    
    const lastPoint = points[points.length - 1];
    const overshootDistance = 5 + Math.random() * 15;
    const angle = Math.atan2(
      lastPoint.y - points[points.length - 2].y,
      lastPoint.x - points[points.length - 2].x
    );
    
    // 过冲点
    const overshootPoint: TimedPoint = {
      x: Math.round(target.x + Math.cos(angle) * overshootDistance),
      y: Math.round(target.y + Math.sin(angle) * overshootDistance),
      timestamp: lastPoint.timestamp + 30,
    };
    
    // 回到目标点
    const returnPoint: TimedPoint = {
      x: target.x,
      y: target.y,
      timestamp: overshootPoint.timestamp + 50 + Math.random() * 50,
    };
    
    return [...points.slice(0, -1), overshootPoint, returnPoint];
  }

  /**
   * 可能在移动中添加犹豫暂停
   */
  maybeAddHesitation(points: TimedPoint[]): TimedPoint[] {
    if (Math.random() > this.profile.hesitationChance || points.length < 5) {
      return points;
    }
    
    // 在中间某点添加暂停
    const hesitationIndex = Math.floor(points.length * (0.3 + Math.random() * 0.4));
    const hesitationDuration = 100 + Math.random() * 300;
    
    return points.map((point, i) => {
      if (i > hesitationIndex) {
        return {
          ...point,
          timestamp: point.timestamp + hesitationDuration,
        };
      }
      return point;
    });
  }
}

// ==================== 打字行为生成器 ====================

class TypingBehaviorGenerator {
  private profile: TypingProfile;
  
  // 键盘布局距离 (用于模拟错误)
  private keyboardLayout: Record<string, Point> = {
    'q': { x: 0, y: 0 }, 'w': { x: 1, y: 0 }, 'e': { x: 2, y: 0 }, 'r': { x: 3, y: 0 }, 't': { x: 4, y: 0 },
    'y': { x: 5, y: 0 }, 'u': { x: 6, y: 0 }, 'i': { x: 7, y: 0 }, 'o': { x: 8, y: 0 }, 'p': { x: 9, y: 0 },
    'a': { x: 0.3, y: 1 }, 's': { x: 1.3, y: 1 }, 'd': { x: 2.3, y: 1 }, 'f': { x: 3.3, y: 1 }, 'g': { x: 4.3, y: 1 },
    'h': { x: 5.3, y: 1 }, 'j': { x: 6.3, y: 1 }, 'k': { x: 7.3, y: 1 }, 'l': { x: 8.3, y: 1 },
    'z': { x: 0.6, y: 2 }, 'x': { x: 1.6, y: 2 }, 'c': { x: 2.6, y: 2 }, 'v': { x: 3.6, y: 2 }, 'b': { x: 4.6, y: 2 },
    'n': { x: 5.6, y: 2 }, 'm': { x: 6.6, y: 2 },
  };

  constructor(profile: TypingProfile) {
    this.profile = profile;
  }

  /**
   * 生成输入文本的打字序列
   */
  generateSequence(text: string): TypingSequence {
    const actions: TypingAction[] = [];
    let currentBurstLength = 0;
    let totalDuration = 0;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      // 是否在这个字符上犯错
      const makeError = Math.random() < this.profile.errorRate;
      
      if (makeError && this.keyboardLayout[char.toLowerCase()]) {
        // 输入错误字符
        const wrongChar = this.getNearbyKey(char.toLowerCase());
        const errorDelay = this.getCharDelay();
        
        actions.push({ type: 'key_down', char: wrongChar, delay: errorDelay });
        actions.push({ type: 'key_up', char: wrongChar, delay: 10 + Math.random() * 20 });
        totalDuration += errorDelay + 15;
        
        // 暂停意识到错误
        actions.push({ type: 'pause', delay: this.profile.correctionDelay * (0.5 + Math.random()) });
        totalDuration += this.profile.correctionDelay;
        
        // 删除错误字符
        actions.push({ type: 'backspace', delay: 50 + Math.random() * 50 });
        totalDuration += 75;
      }
      
      // 输入正确字符
      const delay = this.getCharDelay();
      actions.push({ type: 'key_down', char, delay });
      actions.push({ type: 'key_up', char, delay: 10 + Math.random() * 20 });
      totalDuration += delay + 15;
      
      currentBurstLength++;
      
      // 检查是否需要暂停
      if (currentBurstLength >= this.profile.burstLength && Math.random() < this.profile.pauseChance) {
        const pauseDuration = this.profile.pauseDuration * (0.5 + Math.random());
        actions.push({ type: 'pause', delay: pauseDuration });
        totalDuration += pauseDuration;
        currentBurstLength = 0;
      }
      
      // 在空格或标点后更可能暂停
      if ((char === ' ' || char === '.' || char === ',' || char === '。' || char === '，') && Math.random() < 0.3) {
        const pauseDuration = 100 + Math.random() * 200;
        actions.push({ type: 'pause', delay: pauseDuration });
        totalDuration += pauseDuration;
        currentBurstLength = 0;
      }
    }
    
    return { actions, totalDuration };
  }

  private getCharDelay(): number {
    // 基于 WPM 计算基础延迟 (1 word ≈ 5 chars)
    const baseDelay = 60000 / (this.profile.baseWpm * 5);
    const variance = baseDelay * (this.profile.wpmVariance / this.profile.baseWpm);
    return baseDelay + gaussianRandom() * variance;
  }

  private getNearbyKey(key: string): string {
    const pos = this.keyboardLayout[key];
    if (!pos) return key;
    
    // 找附近的键
    let nearestKey = key;
    let minDistance = Infinity;
    
    for (const [k, p] of Object.entries(this.keyboardLayout)) {
      if (k === key) continue;
      const dist = Math.sqrt(Math.pow(p.x - pos.x, 2) + Math.pow(p.y - pos.y, 2));
      if (dist < 1.5 && dist < minDistance) {
        minDistance = dist;
        nearestKey = k;
      }
    }
    
    return nearestKey;
  }
}

// ==================== 延迟生成器 ====================

class DelayGenerator {
  private profile: DelayProfile;

  constructor(profile: DelayProfile) {
    this.profile = profile;
  }

  /**
   * 生成思考时间
   */
  getThinkingTime(): number {
    return randomRange(this.profile.thinkingTime.min, this.profile.thinkingTime.max);
  }

  /**
   * 生成反应时间
   */
  getReactionTime(): number {
    return randomRange(this.profile.reactionTime.min, this.profile.reactionTime.max);
  }

  /**
   * 根据文本长度计算阅读时间
   */
  getReadingTime(text: string): number {
    const charCount = text.length;
    const baseTime = charCount / this.profile.readingSpeed * 1000;
    // 添加随机变化
    return baseTime * (0.8 + Math.random() * 0.4);
  }

  /**
   * 生成决策时间
   */
  getDecisionTime(): number {
    return randomRange(this.profile.decisionTime.min, this.profile.decisionTime.max);
  }

  /**
   * 根据场景生成适当延迟
   */
  getContextualDelay(context: 'before_click' | 'after_load' | 'reading' | 'decision', text?: string): number {
    switch (context) {
      case 'before_click':
        return this.getReactionTime();
      case 'after_load':
        return this.getThinkingTime();
      case 'reading':
        return text ? this.getReadingTime(text) : this.getThinkingTime();
      case 'decision':
        return this.getDecisionTime();
      default:
        return this.getThinkingTime();
    }
  }
}

// ==================== 主服务 ====================

class HumanSimulationService {
  private profiles: Map<string, BehaviorProfile> = new Map(Object.entries(PROFILES));
  private currentProfile: BehaviorProfile = PROFILES.NORMAL;
  private mouseGenerator: MouseTrajectoryGenerator;
  private typingGenerator: TypingBehaviorGenerator;
  private delayGenerator: DelayGenerator;

  constructor(profileId?: string) {
    this.setProfile(profileId ?? 'NORMAL');
    this.mouseGenerator = new MouseTrajectoryGenerator(this.currentProfile.movement);
    this.typingGenerator = new TypingBehaviorGenerator(this.currentProfile.typing);
    this.delayGenerator = new DelayGenerator(this.currentProfile.delay);
  }

  /**
   * 切换行为档案
   */
  setProfile(profileId: string): void {
    const profile = this.profiles.get(profileId);
    if (profile) {
      this.currentProfile = profile;
      this.mouseGenerator = new MouseTrajectoryGenerator(profile.movement);
      this.typingGenerator = new TypingBehaviorGenerator(profile.typing);
      this.delayGenerator = new DelayGenerator(profile.delay);
      console.log(`[HumanSimulation] Profile switched to: ${profile.name}`);
    }
  }

  /**
   * 获取所有可用档案
   */
  getProfiles(): BehaviorProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * 获取当前档案
   */
  getCurrentProfile(): BehaviorProfile {
    return this.currentProfile;
  }

  /**
   * 添加自定义档案
   */
  addProfile(profile: BehaviorProfile): void {
    this.profiles.set(profile.id, profile);
  }

  // ==================== 鼠标操作 ====================

  /**
   * 生成鼠标移动轨迹
   */
  generateMousePath(from: Point, to: Point, duration?: number): MovementPath {
    const path = this.mouseGenerator.generatePath(from, to, duration);
    return this.mouseGenerator.maybeAddHesitation(path.points).length > 0
      ? { ...path, points: this.mouseGenerator.maybeAddHesitation(path.points) }
      : path;
  }

  /**
   * 应用位置抖动
   */
  applyPositionJitter(point: Point): Point {
    const jitter = this.currentProfile.movement.accuracyFactor < 1
      ? (1 - this.currentProfile.movement.accuracyFactor) * 10
      : 0;
    
    return {
      x: Math.round(point.x + gaussianRandom() * jitter),
      y: Math.round(point.y + gaussianRandom() * jitter),
    };
  }

  // ==================== 打字操作 ====================

  /**
   * 生成打字序列
   */
  generateTypingSequence(text: string): TypingSequence {
    return this.typingGenerator.generateSequence(text);
  }

  /**
   * 获取打字延迟数组 (简化版)
   */
  getTypingDelays(text: string): number[] {
    const sequence = this.generateTypingSequence(text);
    const delays: number[] = [];
    
    for (const action of sequence.actions) {
      if (action.type === 'key_down' && action.char) {
        delays.push(action.delay);
      }
    }
    
    return delays;
  }

  // ==================== 延迟操作 ====================

  /**
   * 获取操作前延迟
   */
  getPreActionDelay(): number {
    return this.delayGenerator.getReactionTime();
  }

  /**
   * 获取场景化延迟
   */
  getContextualDelay(context: 'before_click' | 'after_load' | 'reading' | 'decision', text?: string): number {
    return this.delayGenerator.getContextualDelay(context, text);
  }

  /**
   * 等待随机延迟
   */
  async randomDelay(min: number = 100, max: number = 500): Promise<void> {
    const delay = randomRange(min, max);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // ==================== 工具方法 ====================

  /**
   * 模拟人类化的坐标点击
   */
  humanizeClick(target: Point): { point: Point; preDelay: number } {
    return {
      point: this.applyPositionJitter(target),
      preDelay: this.getPreActionDelay(),
    };
  }

  /**
   * 模拟人类化的文本输入
   */
  humanizeInput(text: string): { text: string; delays: number[]; totalTime: number } {
    const sequence = this.generateTypingSequence(text);
    return {
      text,
      delays: sequence.actions
        .filter(a => a.type === 'key_down')
        .map(a => a.delay),
      totalTime: sequence.totalDuration,
    };
  }

  /**
   * 执行带人类化延迟的操作
   */
  async executeWithHumanDelay<T>(
    action: () => Promise<T>,
    context: 'before_click' | 'after_load' | 'reading' | 'decision' = 'before_click'
  ): Promise<T> {
    const delay = this.getContextualDelay(context);
    await new Promise(resolve => setTimeout(resolve, delay));
    return action();
  }
}

// ==================== 导出 ====================

export const humanSimulation = new HumanSimulationService();
export { HumanSimulationService, MouseTrajectoryGenerator, TypingBehaviorGenerator, DelayGenerator };
export { PROFILES as BEHAVIOR_PROFILES };

export default humanSimulation;
