/**
 * Z5 Screen Monitor Service - 屏幕监控服务
 * 
 * 功能：
 * 1. 接收定时屏幕文本/截图输入
 * 2. 检测内容变化
 * 3. 自动触发AI分析（识别合同、文档等）
 * 4. 主动推送洞察给用户
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('ScreenMonitor');

import { chatWithDashScope, type ChatMessage } from './dashscope';

// 屏幕状态缓存
interface ScreenState {
  lastContent: string;
  lastUpdateTime: number;
  contentHash: string;
  analysisInProgress: boolean;
  lastAnalysis: ScreenAnalysis | null;
  changeCount: number;
}

interface ScreenAnalysis {
  type: 'contract' | 'document' | 'chat' | 'payment' | 'form' | 'financial' | 'unknown';
  summary: string;
  keyPoints: string[];
  warnings: string[];
  suggestions: string[];
  confidence: number;
  timestamp: number;
  requiresAlert: boolean;
  alertLevel: 'info' | 'warning' | 'critical';
}

interface ScreenUpdate {
  content: string;
  source: 'ocr' | 'accessibility' | 'manual';
  appContext?: string;
  timestamp?: number;
}

interface MonitorConfig {
  autoAnalyze: boolean;
  minChangeThreshold: number;  // 最小变化阈值（字符数）
  analysisDelay: number;       // 内容稳定后多久触发分析（ms）
  sniffingInterval: number;    // Vision Sniffing 截屏间隔（ms）
  contractKeywords: string[];
  paymentKeywords: string[];
  financialKeywords: string[]; // 财报关键词
  alertKeywords: string[];     // 需要主动预警的关键词
}

// 默认配置
const defaultConfig: MonitorConfig = {
  autoAnalyze: true,
  minChangeThreshold: 50,
  analysisDelay: 2000,
  sniffingInterval: 2000,  // 每2000ms自动截屏
  contractKeywords: [
    '合同', '协议', '甲方', '乙方', '签字', '盖章', 
    '有效期', '违约', '条款', '责任', '权利', '义务',
    '金额', '付款', '交付', '保密', '知识产权', '争议解决'
  ],
  paymentKeywords: [
    '支付', '转账', '付款', '收款', '金额', '账户',
    '银行卡', '微信支付', '支付宝', '确认支付'
  ],
  financialKeywords: [
    '财报', '财务报表', '资产负债', '利润表', '现金流量',
    '营收', '净利润', '毛利率', '市盈率', 'PE', 'ROE',
    '应收账款', '存货', '负债率', '季报', '年报',
    '审计报告', '会计准则', '坏账', '减值', '商誉'
  ],
  alertKeywords: [
    '合同', '财报', '转账', '签字', '确认支付', '大额',
    '违约', '赔偿', '授权', '密码', '银行卡', '验证码'
  ],
};

// 每个设备/会话的屏幕状态
const screenStates: Map<string, ScreenState> = new Map();
let config: MonitorConfig = { ...defaultConfig };

// 分析延迟定时器
const analysisTimers: Map<string, NodeJS.Timeout> = new Map();

// 监听器回调
type AnalysisCallback = (sessionId: string, analysis: ScreenAnalysis) => void;
const analysisListeners: Set<AnalysisCallback> = new Set();

/**
 * 计算内容哈希（简单版本）
 */
function computeHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

/**
 * 计算两个字符串的变化程度
 */
function computeChangeLevel(oldContent: string, newContent: string): number {
  if (!oldContent) return newContent.length;
  if (!newContent) return oldContent.length;
  
  // 简单计算：不同字符数
  const oldSet = new Set(oldContent.split(''));
  const newSet = new Set(newContent.split(''));
  
  let changes = 0;
  newSet.forEach(char => {
    if (!oldSet.has(char)) changes++;
  });
  oldSet.forEach(char => {
    if (!newSet.has(char)) changes++;
  });
  
  return changes + Math.abs(oldContent.length - newContent.length);
}

/**
 * 检测内容类型
 */
function detectContentType(content: string): ScreenAnalysis['type'] {
  const lowerContent = content.toLowerCase();
  
  // 合同检测
  const contractScore = config.contractKeywords.filter(kw => 
    content.includes(kw)
  ).length;
  
  if (contractScore >= 3) return 'contract';
  
  // 财报检测
  const financialScore = config.financialKeywords.filter(kw => 
    content.includes(kw) || lowerContent.includes(kw.toLowerCase())
  ).length;
  
  if (financialScore >= 3) return 'financial';
  
  // 支付检测
  const paymentScore = config.paymentKeywords.filter(kw => 
    content.includes(kw)
  ).length;
  
  if (paymentScore >= 2) return 'payment';
  
  // 聊天检测
  if (content.includes('发送') || content.includes('输入消息') || 
      lowerContent.includes('chat') || content.includes('聊天')) {
    return 'chat';
  }
  
  // 表单检测
  if (content.includes('提交') || content.includes('填写') || 
      content.includes('请输入')) {
    return 'form';
  }
  
  // 文档检测
  if (content.length > 500) return 'document';
  
  return 'unknown';
}

/**
 * 检测是否需要主动预警
 */
function checkRequiresAlert(content: string, type: ScreenAnalysis['type']): { requires: boolean; level: 'info' | 'warning' | 'critical' } {
  // 高优先级类型直接触发
  if (type === 'contract' || type === 'payment' || type === 'financial') {
    // 检测严重程度
    const criticalKeywords = ['签字', '确认支付', '转账', '授权', '密码', '银行卡'];
    const hasCritical = criticalKeywords.some(kw => content.includes(kw));
    
    if (hasCritical) {
      return { requires: true, level: 'critical' };
    }
    
    return { requires: true, level: 'warning' };
  }
  
  // 检查是否包含警报关键词
  const alertCount = config.alertKeywords.filter(kw => content.includes(kw)).length;
  
  if (alertCount >= 3) {
    return { requires: true, level: 'warning' };
  }
  
  if (alertCount >= 1) {
    return { requires: true, level: 'info' };
  }
  
  return { requires: false, level: 'info' };
}

/**
 * 提取关键信息点
 */
function extractKeyPoints(content: string, type: ScreenAnalysis['type']): string[] {
  const points: string[] = [];
  
  if (type === 'contract') {
    const amountMatch = content.match(/(?:金额|价格|费用)[：:]\s*[￥¥]?(\d+(?:,\d{3})*(?:\.\d{2})?)/g);
    if (amountMatch) {
      points.push(...amountMatch.map(m => `[标的] ${m}`));
    }
    
    const dateMatch = content.match(/(?:有效期|期限|日期)[：:]\s*\d{4}[-/年]\d{1,2}[-/月]\d{1,2}/g);
    if (dateMatch) {
      points.push(...dateMatch.map(m => `[时限] ${m}`));
    }
    
    const partyMatch = content.match(/(?:甲方|乙方)[：:]\s*[^\n,，]{2,20}/g);
    if (partyMatch) {
      points.push(...partyMatch.map(m => `[主体] ${m}`));
    }
  }
  
  if (type === 'payment') {
    const payMatch = content.match(/[￥¥]?\d+(?:,\d{3})*(?:\.\d{2})?(?:元)?/g);
    if (payMatch) {
      points.push(`[金额] ${payMatch[0]}`);
    }
    
    const receiverMatch = content.match(/(?:收款方|收款人|商户)[：:]\s*[^\n]{2,30}/);
    if (receiverMatch) {
      points.push(`[对手方] ${receiverMatch[0]}`);
    }
  }
  
  if (type === 'financial') {
    const revenueMatch = content.match(/(?:营收|收入|营业收入)[：:]\s*[￥¥]?[\d,\.]+(?:亿|万|元)?/g);
    if (revenueMatch) {
      points.push(...revenueMatch.slice(0, 2).map(m => `[营收] ${m}`));
    }
    
    const profitMatch = content.match(/(?:净利润|利润|盈利)[：:]\s*[￥¥-]?[\d,\.]+(?:亿|万|元)?/g);
    if (profitMatch) {
      points.push(...profitMatch.slice(0, 2).map(m => `[利润] ${m}`));
    }
    
    const ratioMatch = content.match(/(?:毛利率|净利率|负债率|ROE|PE)[：:]\s*[\d\.]+%?/g);
    if (ratioMatch) {
      points.push(...ratioMatch.slice(0, 2).map(m => `[指标] ${m}`));
    }
    
    const periodMatch = content.match(/(?:20\d{2}年|Q[1-4]|第[一二三四]季度|年报|季报)/g);
    if (periodMatch) {
      points.push(`[周期] ${periodMatch[0]}`);
    }
  }
  
  return points.slice(0, 6);
}

/**
 * 检测潜在风险
 */
function detectWarnings(content: string, type: ScreenAnalysis['type']): string[] {
  const warnings: string[] = [];
  
  if (type === 'contract') {
    if (content.includes('不可撤销')) {
      warnings.push('[风险] 不可撤销条款 - 一旦签署无退路，需确认是否有对等保障');
    }
    if (content.includes('自动续期') || content.includes('自动续约')) {
      warnings.push('[风险] 自动续期机制 - 对方可能在你遗忘时锁定长期利益');
    }
    if (content.includes('违约金') || content.includes('赔偿')) {
      warnings.push('[风险] 违约赔偿条款 - 核实金额是否对等，警惕单方面高额惩罚');
    }
    if (content.includes('独家') || content.includes('排他')) {
      warnings.push('[风险] 排他性条款 - 会限制你的选择权和议价能力');
    }
    if (content.includes('无条件') || content.includes('不限')) {
      warnings.push('[风险] 无限制条款 - 对方可能据此无限扩大权利边界');
    }
  }
  
  if (type === 'payment') {
    const amountMatch = content.match(/[￥¥]?(\d+(?:,\d{3})*(?:\.\d{2})?)/);
    if (amountMatch) {
      const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
      if (amount >= 10000) {
        warnings.push(`[警戒] 大额转账 ¥${amount.toLocaleString()} - 核实对方身份，保留转账凭证`);
      }
    }
    
    if (content.includes('个人') && content.includes('转账')) {
      warnings.push('[警戒] 个人账户收款 - 企业交易走私人账户，可能是规避监管或诈骗');
    }
  }
  
  if (type === 'financial') {
    if (content.includes('亏损') || content.includes('净利润-') || content.includes('利润下滑')) {
      warnings.push('[风险] 财务亏损信号 - 需核查亏损原因和持续性');
    }
    if (content.includes('商誉减值') || content.includes('资产减值')) {
      warnings.push('[风险] 资产减值 - 可能存在前期收购溢价过高或资产质量恶化');
    }
    if (content.includes('应收账款') && content.includes('增加')) {
      warnings.push('[风险] 应收账款增加 - 警惕坏账风险和资金回笼压力');
    }
    if (content.includes('负债率') && content.match(/负债率[：:]\s*(\d+)%?/)) {
      const rateMatch = content.match(/负债率[：:]\s*(\d+)/);
      if (rateMatch && parseInt(rateMatch[1]) > 70) {
        warnings.push(`[风险] 高负债率 ${rateMatch[1]}% - 偿债压力大，财务杠杆风险`);
      }
    }
    if (content.includes('审计意见') && (content.includes('保留') || content.includes('否定') || content.includes('无法表示'))) {
      warnings.push('[风险] 审计问题 - 非标准审计意见，财务数据可信度存疑');
    }
  }
  
  return warnings;
}

/**
 * 生成建议
 */
function generateSuggestions(content: string, type: ScreenAnalysis['type'], warnings: string[]): string[] {
  const suggestions: string[] = [];
  
  if (type === 'contract') {
    if (warnings.length > 0) {
      suggestions.push('[战术] 逐条核对风险条款，必要时要求对方修改或添加保护性条款');
    }
    if (!content.includes('争议解决') && !content.includes('仲裁')) {
      suggestions.push('[盲区] 缺少争议解决机制 - 建议补充仲裁或管辖法院条款，占据主场优势');
    }
    suggestions.push('[行动] 可让小智逐条拆解分析，识别隐藏陷阱');
  }
  
  if (type === 'payment') {
    suggestions.push('[行动] 付款前二次确认收款方工商信息，截图留证');
    if (warnings.length > 0) {
      suggestions.push('[战术] 暂缓支付，先通过其他渠道核实对方身份和交易真实性');
    }
  }
  
  if (type === 'financial') {
    suggestions.push('[行动] 对比历史同期数据，评估趋势是否健康');
    if (warnings.length > 0) {
      suggestions.push('[战术] 深入分析警示项，必要时参考同行业数据横向对比');
    }
    suggestions.push('[盲区] 关注表外负债和关联交易披露情况');
  }
  
  return suggestions.slice(0, 3);
}

/**
 * 执行AI深度分析
 */
async function performDeepAnalysis(
  content: string, 
  type: ScreenAnalysis['type']
): Promise<string> {
  const prompts: Record<ScreenAnalysis['type'], string> = {
    contract: `分析这份合同的博弈格局：识别对手的核心诉求、隐藏陷阱、不对等条款。给出谈判策略和风险对冲方案。\n\n${content.slice(0, 2000)}`,
    payment: `评估这笔支付的安全性：核实收款方身份可信度、金额合理性、是否存在诈骗特征。给出执行建议。\n\n${content.slice(0, 1000)}`,
    financial: `分析这份财务报表/财报的关键指标：识别盈利能力、偿债能力、成长性。重点关注异常数据、会计处理变更、关联交易。给出投资决策建议。\n\n${content.slice(0, 2000)}`,
    document: `提炼文档核心信息，识别关键决策点和潜在风险：\n\n${content.slice(0, 2000)}`,
    chat: `分析对话中各方的真实意图和博弈态势：\n\n${content.slice(0, 1000)}`,
    form: `评估表单要求的信息敏感度，识别可能的数据风险：\n\n${content.slice(0, 1000)}`,
    unknown: `快速扫描内容，提取战略价值信息：\n\n${content.slice(0, 1000)}`,
  };
  
  try {
    const history: ChatMessage[] = [];
    const command = await chatWithDashScope(history, prompts[type]);
    return command.message || '正在推演中...';
  } catch (error) {
    return '深度分析模块暂时离线，基础扫描数据已记录。';
  }
}

/**
 * 分析屏幕内容
 */
async function analyzeScreen(sessionId: string, content: string): Promise<ScreenAnalysis> {
  const type = detectContentType(content);
  const keyPoints = extractKeyPoints(content, type);
  const warnings = detectWarnings(content, type);
  const suggestions = generateSuggestions(content, type, warnings);
  
  let summary = '';
  switch (type) {
    case 'contract':
      summary = `[合同分析] ${content.length}字，${keyPoints.length}个关键变量`;
      if (warnings.length > 0) {
        summary += `，${warnings.length}处风险点需关注`;
      }
      break;
    case 'payment':
      summary = `[支付确认]`;
      if (warnings.length > 0) {
        summary += ` 存在${warnings.length}项警戒信号`;
      } else {
        summary += ` 初步扫描未见异常`;
      }
      break;
    case 'financial':
      summary = `[财报分析] ${keyPoints.length}项核心指标`;
      if (warnings.length > 0) {
        summary += `，${warnings.length}处风险信号`;
      }
      break;
    case 'document':
      summary = `[文档扫描] ${content.length}字已载入`;
      break;
    case 'chat':
      summary = `[对话监控] 已捕获通讯内容`;
      break;
    case 'form':
      summary = `[表单检测] 数据采集页面`;
      break;
    default:
      summary = `[屏幕更新] 内容已同步`;
  }
  
  const alertCheck = checkRequiresAlert(content, type);
  
  const analysis: ScreenAnalysis = {
    type,
    summary,
    keyPoints,
    warnings,
    suggestions,
    confidence: type === 'unknown' ? 0.3 : 0.8,
    timestamp: Date.now(),
    requiresAlert: alertCheck.requires,
    alertLevel: alertCheck.level,
  };
  
  return analysis;
}

/**
 * 更新屏幕内容
 */
export async function updateScreenContent(
  sessionId: string, 
  update: ScreenUpdate
): Promise<{ changed: boolean; analysis: ScreenAnalysis | null }> {
  const now = Date.now();
  const currentState = screenStates.get(sessionId);
  
  const newHash = computeHash(update.content);
  
  // 检查是否有变化
  if (currentState && currentState.contentHash === newHash) {
    return { changed: false, analysis: currentState.lastAnalysis };
  }
  
  // 计算变化程度
  const changeLevel = currentState 
    ? computeChangeLevel(currentState.lastContent, update.content)
    : update.content.length;
  
  // 更新状态
  const newState: ScreenState = {
    lastContent: update.content,
    lastUpdateTime: now,
    contentHash: newHash,
    analysisInProgress: false,
    lastAnalysis: currentState?.lastAnalysis || null,
    changeCount: (currentState?.changeCount || 0) + 1,
  };
  
  screenStates.set(sessionId, newState);
  
  // 如果变化足够大且开启自动分析
  if (config.autoAnalyze && changeLevel >= config.minChangeThreshold) {
    // 清除之前的延迟定时器
    const existingTimer = analysisTimers.get(sessionId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // 设置新的延迟分析（等待内容稳定）
    const timer = setTimeout(async () => {
      const state = screenStates.get(sessionId);
      if (state && !state.analysisInProgress) {
        state.analysisInProgress = true;
        
        try {
          const analysis = await analyzeScreen(sessionId, state.lastContent);
          state.lastAnalysis = analysis;
          state.analysisInProgress = false;
          
          // 通知监听器
          analysisListeners.forEach(listener => {
            listener(sessionId, analysis);
          });
        } catch (error) {
          state.analysisInProgress = false;
          logger.error({ err: error }, 'Analysis error');
        }
      }
      
      analysisTimers.delete(sessionId);
    }, config.analysisDelay);
    
    analysisTimers.set(sessionId, timer);
  }
  
  // 如果变化不大，直接返回快速分析
  if (changeLevel < config.minChangeThreshold) {
    return { changed: true, analysis: currentState?.lastAnalysis || null };
  }
  
  // 返回立即分析结果（简化版）
  const quickAnalysis = await analyzeScreen(sessionId, update.content);
  newState.lastAnalysis = quickAnalysis;
  
  return { changed: true, analysis: quickAnalysis };
}

/**
 * 获取当前屏幕状态
 */
export function getScreenState(sessionId: string): ScreenState | null {
  return screenStates.get(sessionId) || null;
}

/**
 * 强制触发分析
 */
export async function forceAnalyze(sessionId: string): Promise<ScreenAnalysis | null> {
  const state = screenStates.get(sessionId);
  if (!state || !state.lastContent) {
    return null;
  }
  
  const analysis = await analyzeScreen(sessionId, state.lastContent);
  state.lastAnalysis = analysis;
  
  // 通知监听器
  analysisListeners.forEach(listener => {
    listener(sessionId, analysis);
  });
  
  return analysis;
}

/**
 * 深度分析（使用AI）
 */
export async function deepAnalyze(sessionId: string): Promise<string> {
  const state = screenStates.get(sessionId);
  if (!state || !state.lastContent) {
    return '爸爸，屏幕数据未同步。需先通过/api/screen/update上报屏幕内容。';
  }
  
  const type = detectContentType(state.lastContent);
  return await performDeepAnalysis(state.lastContent, type);
}

/**
 * 添加分析完成监听器
 */
export function addAnalysisListener(callback: AnalysisCallback): void {
  analysisListeners.add(callback);
}

/**
 * 移除分析监听器
 */
export function removeAnalysisListener(callback: AnalysisCallback): void {
  analysisListeners.delete(callback);
}

/**
 * 更新配置
 */
export function updateMonitorConfig(newConfig: Partial<MonitorConfig>): MonitorConfig {
  config = { ...config, ...newConfig };
  return config;
}

/**
 * 获取当前配置
 */
export function getMonitorConfig(): MonitorConfig {
  return { ...config };
}

/**
 * 清除会话
 */
export function clearSession(sessionId: string): void {
  screenStates.delete(sessionId);
  const timer = analysisTimers.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    analysisTimers.delete(sessionId);
  }
}

/**
 * 获取所有活跃会话
 */
export function getActiveSessions(): string[] {
  return Array.from(screenStates.keys());
}

/**
 * 获取监控统计
 */
export function getMonitorStats(): {
  activeSessions: number;
  totalUpdates: number;
  config: MonitorConfig;
} {
  let totalUpdates = 0;
  screenStates.forEach(state => {
    totalUpdates += state.changeCount;
  });
  
  return {
    activeSessions: screenStates.size,
    totalUpdates,
    config,
  };
}

// ==================== Vision Sniffing 模块 ====================

interface VisionSniffingState {
  active: boolean;
  intervalTimer: NodeJS.Timeout | null;
  lastCaptureTime: number;
  captureCount: number;
}

// Z3 耳语流预警回调
type AlertCallback = (sessionId: string, alert: {
  level: 'info' | 'warning' | 'critical';
  type: ScreenAnalysis['type'];
  summary: string;
  warnings: string[];
  timestamp: number;
}) => void;

const visionSniffingStates: Map<string, VisionSniffingState> = new Map();
const alertCallbacks: Set<AlertCallback> = new Set();

/**
 * 启动 Vision Sniffing 自动截屏循环
 * 每隔 sniffingInterval(默认2000ms) 请求客户端上报屏幕内容
 */
export function startVisionSniffing(
  sessionId: string,
  captureCallback: () => Promise<string>
): void {
  // 清除已有状态
  stopVisionSniffing(sessionId);
  
  const sniffingState: VisionSniffingState = {
    active: true,
    intervalTimer: null,
    lastCaptureTime: Date.now(),
    captureCount: 0,
  };
  
  const sniffingLoop = async () => {
    if (!sniffingState.active) return;
    
    try {
      const content = await captureCallback();
      sniffingState.lastCaptureTime = Date.now();
      sniffingState.captureCount++;
      
      if (content && content.length > 0) {
        const result = await updateScreenContent(sessionId, {
          content,
          source: 'ocr',
          timestamp: Date.now(),
        });
        
        // 如果需要主动预警，触发Z3耳语流
        if (result.analysis?.requiresAlert) {
          triggerZ3Alert(sessionId, result.analysis);
        }
      }
    } catch (error) {
      logger.error({ err: error }, 'Vision Sniffing capture error');
    }
  };
  
  // 立即执行一次
  sniffingLoop();
  
  // 设置循环定时器
  sniffingState.intervalTimer = setInterval(sniffingLoop, config.sniffingInterval);
  
  visionSniffingStates.set(sessionId, sniffingState);
  logger.info(`[Vision Sniffing] Started for session ${sessionId}, interval: ${config.sniffingInterval}ms`);
}

/**
 * 停止 Vision Sniffing
 */
export function stopVisionSniffing(sessionId: string): void {
  const state = visionSniffingStates.get(sessionId);
  if (state) {
    state.active = false;
    if (state.intervalTimer) {
      clearInterval(state.intervalTimer);
      state.intervalTimer = null;
    }
    visionSniffingStates.delete(sessionId);
    logger.info(`[Vision Sniffing] Stopped for session ${sessionId}`);
  }
}

/**
 * 检查 Vision Sniffing 状态
 */
export function getVisionSniffingStatus(sessionId: string): {
  active: boolean;
  captureCount: number;
  lastCaptureTime: number;
  interval: number;
} {
  const state = visionSniffingStates.get(sessionId);
  return {
    active: state?.active ?? false,
    captureCount: state?.captureCount ?? 0,
    lastCaptureTime: state?.lastCaptureTime ?? 0,
    interval: config.sniffingInterval,
  };
}

/**
 * 触发 Z3 耳语流预警
 * 当检测到合同/财报/转账界面时主动通知用户
 */
function triggerZ3Alert(sessionId: string, analysis: ScreenAnalysis): void {
  const alert = {
    level: analysis.alertLevel,
    type: analysis.type,
    summary: analysis.summary,
    warnings: analysis.warnings,
    timestamp: Date.now(),
  };
  
  logger.info(`[Z3 Whisper] Alert triggered for ${sessionId}: ${analysis.alertLevel} - ${analysis.type}`);
  
  // 通知所有注册的回调
  alertCallbacks.forEach(callback => {
    try {
      callback(sessionId, alert);
    } catch (error) {
      logger.error({ err: error }, 'Z3 Whisper alert callback error');
    }
  });
}

/**
 * 注册 Z3 耳语流预警回调
 */
export function addAlertCallback(callback: AlertCallback): void {
  alertCallbacks.add(callback);
}

/**
 * 移除 Z3 耳语流预警回调
 */
export function removeAlertCallback(callback: AlertCallback): void {
  alertCallbacks.delete(callback);
}

/**
 * 手动触发预警检查
 */
export async function checkAndAlert(sessionId: string): Promise<boolean> {
  const state = screenStates.get(sessionId);
  if (!state || !state.lastAnalysis) {
    return false;
  }
  
  if (state.lastAnalysis.requiresAlert) {
    triggerZ3Alert(sessionId, state.lastAnalysis);
    return true;
  }
  
  return false;
}

/**
 * 获取 Vision Sniffing 全局状态
 */
export function getVisionSniffingStats(): {
  activeSessions: number;
  totalCaptures: number;
  sniffingInterval: number;
} {
  let totalCaptures = 0;
  visionSniffingStates.forEach(state => {
    totalCaptures += state.captureCount;
  });
  
  return {
    activeSessions: visionSniffingStates.size,
    totalCaptures,
    sniffingInterval: config.sniffingInterval,
  };
}

// 导出类型
export type { ScreenAnalysis, ScreenUpdate, MonitorConfig, AlertCallback };
