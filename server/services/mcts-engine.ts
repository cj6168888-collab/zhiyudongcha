/**
 * MCTS蒙特卡洛博弈推演引擎 - Phase 11.1
 * 
 * 基于PRD需求-08: 离线推演引擎
 * "主人休息期间，服务器端需提取当日交互数据，进行10,000次以上模拟博弈演练"
 * 
 * 功能：
 * 1. MCTS (Monte Carlo Tree Search) 核心算法
 * 2. 商业博弈场景建模
 * 3. 策略路径评估与优化
 * 4. 最优决策推荐生成
 * 5. 梦境演化集成
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('MctsEngine');

import { EventEmitter } from 'events';
import { getDatabase } from '../db';
import { auditLogs, dreamLogs } from '@shared/schema';
import { chatWithDashScope, type ChatMessage } from './dashscope';

// ============ 类型定义 ============

export interface GameState {
  id: string;
  scenario: string;
  context: Record<string, any>;
  currentPlayer: 'MASTER' | 'OPPONENT';
  variables: Map<string, number>;
  history: GameAction[];
  terminal: boolean;
  outcome?: GameOutcome;
}

export interface GameAction {
  id: string;
  player: 'MASTER' | 'OPPONENT';
  type: ActionType;
  description: string;
  parameters: Record<string, any>;
  timestamp: number;
}

export type ActionType = 
  | 'NEGOTIATE'      // 谈判
  | 'CONCEDE'        // 让步
  | 'PRESSURE'       // 施压
  | 'DELAY'          // 拖延
  | 'ALLIANCE'       // 结盟
  | 'REVEAL_INFO'    // 信息披露
  | 'HIDE_INFO'      // 信息隐藏
  | 'LEGAL_THREAT'   // 法律威胁
  | 'WALK_AWAY'      // 退出
  | 'ACCEPT'         // 接受
  | 'COUNTER_OFFER'; // 反报价

export interface GameOutcome {
  winner: 'MASTER' | 'OPPONENT' | 'DRAW';
  masterScore: number;
  opponentScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  keyFactors: string[];
}

export interface MCTSNode {
  id: string;
  state: GameState;
  parent: MCTSNode | null;
  children: MCTSNode[];
  action: GameAction | null;
  visits: number;
  totalReward: number;
  uctValue: number;
  unexploredActions: GameAction[];
}

export interface SimulationConfig {
  maxIterations: number;
  explorationConstant: number;
  maxDepth: number;
  timeoutMs: number;
  parallelSimulations: number;
}

export interface SimulationResult {
  bestAction: GameAction | null;
  bestPath: GameAction[];
  winProbability: number;
  expectedValue: number;
  riskAssessment: RiskAssessment;
  iterations: number;
  durationMs: number;
  insights: string[];
}

export interface RiskAssessment {
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  factors: RiskFactor[];
  mitigations: string[];
}

export interface RiskFactor {
  name: string;
  probability: number;
  impact: number;
  description: string;
}

export interface BusinessScenario {
  id: string;
  name: string;
  type: ScenarioType;
  description: string;
  stakeholders: Stakeholder[];
  objectives: Objective[];
  constraints: Constraint[];
  initialState: Partial<GameState>;
}

export type ScenarioType = 
  | 'CONTRACT_NEGOTIATION'
  | 'PRICE_BARGAINING'
  | 'PARTNERSHIP_FORMATION'
  | 'CONFLICT_RESOLUTION'
  | 'RESOURCE_ALLOCATION'
  | 'TALENT_ACQUISITION';

export interface Stakeholder {
  id: string;
  name: string;
  role: 'MASTER' | 'OPPONENT' | 'NEUTRAL';
  interests: string[];
  leverage: number;
  riskTolerance: number;
}

export interface Objective {
  id: string;
  description: string;
  weight: number;
  threshold: number;
  metric: string;
}

export interface Constraint {
  id: string;
  type: 'LEGAL' | 'FINANCIAL' | 'TIME' | 'RESOURCE';
  description: string;
  severity: 'SOFT' | 'HARD';
}

// ============ 日志函数 ============

function log(message: string) {
  const time = new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  logger.info(`${time} [MCTS] ${message}`);
}

// ============ MCTS引擎类 ============

class MCTSEngine extends EventEmitter {
  private config: SimulationConfig;
  private isRunning = false;
  private totalSimulations = 0;
  private scenarios: Map<string, BusinessScenario> = new Map();
  private simulationHistory: SimulationResult[] = [];

  constructor() {
    super();
    this.config = {
      maxIterations: 10000,
      explorationConstant: 1.41421356, // sqrt(2)
      maxDepth: 20,
      timeoutMs: 300000, // 5分钟
      parallelSimulations: 4,
    };
    this.initializeDefaultScenarios();
    log('MCTS博弈推演引擎已初始化 (Phase 11.1)');
  }

  private initializeDefaultScenarios(): void {
    // 合同谈判场景
    this.registerScenario({
      id: 'contract_negotiation',
      name: '合同谈判博弈',
      type: 'CONTRACT_NEGOTIATION',
      description: '商业合同条款谈判，寻求最优解释权和利益保护',
      stakeholders: [
        { id: 'master', name: '主人', role: 'MASTER', interests: ['利益最大化', '风险最小化'], leverage: 0.6, riskTolerance: 0.3 },
        { id: 'opponent', name: '对方', role: 'OPPONENT', interests: ['成本控制', '快速成交'], leverage: 0.5, riskTolerance: 0.5 },
      ],
      objectives: [
        { id: 'profit', description: '利润最大化', weight: 0.4, threshold: 0.7, metric: 'profit_margin' },
        { id: 'risk', description: '风险控制', weight: 0.3, threshold: 0.2, metric: 'risk_exposure' },
        { id: 'terms', description: '有利条款', weight: 0.3, threshold: 0.6, metric: 'favorable_terms' },
      ],
      constraints: [
        { id: 'legal', type: 'LEGAL', description: '合规底线', severity: 'HARD' },
        { id: 'time', type: 'TIME', description: '谈判时限', severity: 'SOFT' },
      ],
      initialState: {
        scenario: 'contract_negotiation',
        currentPlayer: 'MASTER',
        terminal: false,
      },
    });

    // 价格谈判场景
    this.registerScenario({
      id: 'price_bargaining',
      name: '价格博弈',
      type: 'PRICE_BARGAINING',
      description: '采购或销售价格谈判',
      stakeholders: [
        { id: 'master', name: '主人', role: 'MASTER', interests: ['价格优势'], leverage: 0.5, riskTolerance: 0.4 },
        { id: 'opponent', name: '对方', role: 'OPPONENT', interests: ['利润保护'], leverage: 0.5, riskTolerance: 0.4 },
      ],
      objectives: [
        { id: 'price', description: '价格目标', weight: 0.6, threshold: 0.8, metric: 'price_advantage' },
        { id: 'relation', description: '关系维护', weight: 0.4, threshold: 0.5, metric: 'relationship_score' },
      ],
      constraints: [
        { id: 'budget', type: 'FINANCIAL', description: '预算限制', severity: 'HARD' },
      ],
      initialState: {
        scenario: 'price_bargaining',
        currentPlayer: 'MASTER',
        terminal: false,
      },
    });

    log(`已注册 ${this.scenarios.size} 个博弈场景`);
  }

  registerScenario(scenario: BusinessScenario): void {
    this.scenarios.set(scenario.id, scenario);
    this.emit('scenario_registered', scenario.id);
  }

  getScenario(id: string): BusinessScenario | undefined {
    return this.scenarios.get(id);
  }

  listScenarios(): BusinessScenario[] {
    return Array.from(this.scenarios.values());
  }

  // ============ 核心MCTS算法 ============

  async runSimulation(
    scenarioId: string,
    context: Record<string, any> = {},
    customConfig?: Partial<SimulationConfig>
  ): Promise<SimulationResult> {
    const config = { ...this.config, ...customConfig };
    const scenario = this.scenarios.get(scenarioId);
    
    if (!scenario) {
      throw new Error(`场景不存在: ${scenarioId}`);
    }

    if (this.isRunning) {
      throw new Error('推演引擎正在运行中');
    }

    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      log(`开始MCTS推演: ${scenario.name} (${config.maxIterations}次迭代)`);
      this.emit('simulation_started', { scenarioId, config });

      // 初始化根节点
      const initialState = this.createInitialState(scenario, context);
      const rootNode = this.createNode(initialState, null, null);

      let iteration = 0;
      const deadline = startTime + config.timeoutMs;

      // MCTS主循环
      while (iteration < config.maxIterations && Date.now() < deadline) {
        // 1. 选择 (Selection)
        const selectedNode = this.select(rootNode);
        
        // 2. 扩展 (Expansion)
        const expandedNode = this.expand(selectedNode);
        
        // 3. 模拟 (Simulation/Rollout)
        const reward = await this.simulate(expandedNode, config.maxDepth);
        
        // 4. 反向传播 (Backpropagation)
        this.backpropagate(expandedNode, reward);

        iteration++;
        
        // 每1000次发送进度
        if (iteration % 1000 === 0) {
          log(`推演进度: ${iteration}/${config.maxIterations}`);
          this.emit('simulation_progress', { iteration, total: config.maxIterations });
        }
      }

      // 提取最佳路径
      const bestPath = this.extractBestPath(rootNode);
      const bestAction = bestPath[0] || null;
      
      // 计算统计数据
      const winProbability = this.calculateWinProbability(rootNode);
      const expectedValue = rootNode.visits > 0 ? rootNode.totalReward / rootNode.visits : 0;

      // 风险评估
      const riskAssessment = await this.assessRisk(rootNode, scenario);

      // 生成洞察
      const insights = await this.generateInsights(rootNode, scenario, bestPath);

      const result: SimulationResult = {
        bestAction,
        bestPath,
        winProbability,
        expectedValue,
        riskAssessment,
        iterations: iteration,
        durationMs: Date.now() - startTime,
        insights,
      };

      this.simulationHistory.push(result);
      this.totalSimulations++;

      log(`推演完成: ${iteration}次迭代, 耗时${result.durationMs}ms, 胜率${(winProbability * 100).toFixed(1)}%`);
      this.emit('simulation_completed', result);

      // 记录审计日志
      await this.logSimulation(scenario, result);

      return result;

    } finally {
      this.isRunning = false;
    }
  }

  private createInitialState(scenario: BusinessScenario, context: Record<string, any>): GameState {
    return {
      id: `state_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      scenario: scenario.id,
      context,
      currentPlayer: 'MASTER',
      variables: new Map([
        ['master_score', 0],
        ['opponent_score', 0],
        ['turn', 0],
        ['tension', 0.5],
        ['trust', 0.5],
      ]),
      history: [],
      terminal: false,
    };
  }

  private createNode(state: GameState, parent: MCTSNode | null, action: GameAction | null): MCTSNode {
    return {
      id: `node_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      state,
      parent,
      children: [],
      action,
      visits: 0,
      totalReward: 0,
      uctValue: Infinity,
      unexploredActions: this.getAvailableActions(state),
    };
  }

  private getAvailableActions(state: GameState): GameAction[] {
    if (state.terminal) return [];

    const actions: GameAction[] = [];
    const actionTypes: ActionType[] = [
      'NEGOTIATE', 'CONCEDE', 'PRESSURE', 'DELAY',
      'REVEAL_INFO', 'HIDE_INFO', 'COUNTER_OFFER',
    ];

    // 根据游戏状态生成可用动作
    const tension = state.variables.get('tension') || 0.5;
    const turn = state.variables.get('turn') || 0;

    for (const type of actionTypes) {
      // 根据紧张度和回合过滤某些动作
      if (type === 'WALK_AWAY' && turn < 3) continue;
      if (type === 'LEGAL_THREAT' && tension < 0.7) continue;
      if (type === 'ACCEPT' && turn < 2) continue;

      actions.push({
        id: `action_${type}_${Math.random().toString(36).substring(2, 6)}`,
        player: state.currentPlayer,
        type,
        description: this.getActionDescription(type),
        parameters: this.getActionParameters(type, state),
        timestamp: Date.now(),
      });
    }

    return actions;
  }

  private getActionDescription(type: ActionType): string {
    const descriptions: Record<ActionType, string> = {
      'NEGOTIATE': '进行谈判，寻求共识',
      'CONCEDE': '做出让步，换取对方妥协',
      'PRESSURE': '施加压力，强化谈判地位',
      'DELAY': '拖延策略，等待更好时机',
      'ALLIANCE': '寻求第三方支持',
      'REVEAL_INFO': '披露信息，展示诚意',
      'HIDE_INFO': '隐藏信息，保持优势',
      'LEGAL_THREAT': '法律威胁，提高对方成本',
      'WALK_AWAY': '退出谈判',
      'ACCEPT': '接受当前条件',
      'COUNTER_OFFER': '提出反报价',
    };
    return descriptions[type];
  }

  private getActionParameters(type: ActionType, state: GameState): Record<string, any> {
    const params: Record<string, any> = {
      intensity: 0.5 + Math.random() * 0.5,
      confidence: 0.6 + Math.random() * 0.4,
    };

    if (type === 'CONCEDE') {
      params.concessionRate = 0.05 + Math.random() * 0.15;
    } else if (type === 'COUNTER_OFFER') {
      params.priceAdjustment = -0.1 + Math.random() * 0.2;
    }

    return params;
  }

  // UCT选择算法
  private select(node: MCTSNode): MCTSNode {
    let current = node;
    
    while (!current.state.terminal && current.unexploredActions.length === 0) {
      if (current.children.length === 0) break;
      
      // 选择UCT值最高的子节点
      let bestChild = current.children[0];
      let bestUCT = -Infinity;
      
      for (const child of current.children) {
        const uct = this.calculateUCT(child, current);
        if (uct > bestUCT) {
          bestUCT = uct;
          bestChild = child;
        }
      }
      
      current = bestChild;
    }
    
    return current;
  }

  private calculateUCT(node: MCTSNode, parent: MCTSNode): number {
    if (node.visits === 0) return Infinity;
    
    const exploitation = node.totalReward / node.visits;
    const exploration = this.config.explorationConstant * 
      Math.sqrt(Math.log(parent.visits) / node.visits);
    
    return exploitation + exploration;
  }

  // 扩展节点
  private expand(node: MCTSNode): MCTSNode {
    if (node.state.terminal || node.unexploredActions.length === 0) {
      return node;
    }

    // 随机选择一个未探索的动作
    const actionIndex = Math.floor(Math.random() * node.unexploredActions.length);
    const action = node.unexploredActions.splice(actionIndex, 1)[0];

    // 应用动作创建新状态
    const newState = this.applyAction(node.state, action);
    
    // 创建子节点
    const childNode = this.createNode(newState, node, action);
    node.children.push(childNode);

    return childNode;
  }

  private applyAction(state: GameState, action: GameAction): GameState {
    const newState: GameState = {
      ...state,
      id: `state_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      variables: new Map(state.variables),
      history: [...state.history, action],
      currentPlayer: state.currentPlayer === 'MASTER' ? 'OPPONENT' : 'MASTER',
    };

    // 更新状态变量
    const turn = (state.variables.get('turn') || 0) + 1;
    newState.variables.set('turn', turn);

    // 根据动作类型更新分数和紧张度
    const intensity = action.parameters.intensity || 0.5;
    let tension = state.variables.get('tension') || 0.5;
    let masterScore = state.variables.get('master_score') || 0;
    let opponentScore = state.variables.get('opponent_score') || 0;

    switch (action.type) {
      case 'PRESSURE':
        tension = Math.min(1, tension + 0.1 * intensity);
        if (action.player === 'MASTER') masterScore += 0.5;
        break;
      case 'CONCEDE':
        tension = Math.max(0, tension - 0.15);
        if (action.player === 'MASTER') opponentScore += 0.3;
        else masterScore += 0.3;
        break;
      case 'NEGOTIATE':
        if (action.player === 'MASTER') masterScore += 0.2;
        else opponentScore += 0.2;
        break;
      case 'DELAY':
        tension += 0.05;
        break;
      case 'LEGAL_THREAT':
        tension = Math.min(1, tension + 0.2);
        if (action.player === 'MASTER') masterScore += 0.4;
        break;
      case 'WALK_AWAY':
        newState.terminal = true;
        newState.outcome = {
          winner: 'DRAW',
          masterScore,
          opponentScore,
          riskLevel: 'HIGH',
          keyFactors: ['谈判破裂'],
        };
        break;
      case 'ACCEPT':
        newState.terminal = true;
        const winner = masterScore > opponentScore ? 'MASTER' : 
                      opponentScore > masterScore ? 'OPPONENT' : 'DRAW';
        newState.outcome = {
          winner,
          masterScore,
          opponentScore,
          riskLevel: tension > 0.7 ? 'HIGH' : tension > 0.4 ? 'MEDIUM' : 'LOW',
          keyFactors: ['达成协议'],
        };
        break;
    }

    newState.variables.set('tension', tension);
    newState.variables.set('master_score', masterScore);
    newState.variables.set('opponent_score', opponentScore);

    // 检查终止条件
    if (turn >= 15 && !newState.terminal) {
      newState.terminal = true;
      const winner = masterScore > opponentScore ? 'MASTER' : 
                    opponentScore > masterScore ? 'OPPONENT' : 'DRAW';
      newState.outcome = {
        winner,
        masterScore,
        opponentScore,
        riskLevel: 'MEDIUM',
        keyFactors: ['回合耗尽'],
      };
    }

    return newState;
  }

  // 模拟/Rollout
  private async simulate(node: MCTSNode, maxDepth: number): Promise<number> {
    let state = { ...node.state };
    let depth = 0;

    while (!state.terminal && depth < maxDepth) {
      const actions = this.getAvailableActions(state);
      if (actions.length === 0) break;

      // 随机选择动作
      const action = actions[Math.floor(Math.random() * actions.length)];
      state = this.applyAction(state, action);
      depth++;
    }

    // 计算奖励
    return this.evaluateState(state);
  }

  private evaluateState(state: GameState): number {
    const masterScore = state.variables.get('master_score') || 0;
    const opponentScore = state.variables.get('opponent_score') || 0;
    const tension = state.variables.get('tension') || 0.5;

    // 基础分数差
    let reward = masterScore - opponentScore;

    // 考虑紧张度惩罚
    reward -= tension * 0.2;

    // 终局加成
    if (state.outcome) {
      if (state.outcome.winner === 'MASTER') reward += 2;
      else if (state.outcome.winner === 'OPPONENT') reward -= 2;
    }

    // 归一化到[-1, 1]
    return Math.tanh(reward);
  }

  // 反向传播
  private backpropagate(node: MCTSNode, reward: number): void {
    let current: MCTSNode | null = node;
    let depth = 0;

    while (current !== null) {
      current.visits++;
      // 对主人节点用正reward，对手节点用负reward
      const adjustedReward = depth % 2 === 0 ? reward : -reward;
      current.totalReward += adjustedReward;
      current = current.parent;
      depth++;
    }
  }

  private extractBestPath(root: MCTSNode): GameAction[] {
    const path: GameAction[] = [];
    let current = root;

    while (current.children.length > 0) {
      // 选择访问次数最多的子节点
      let bestChild = current.children[0];
      for (const child of current.children) {
        if (child.visits > bestChild.visits) {
          bestChild = child;
        }
      }

      if (bestChild.action) {
        path.push(bestChild.action);
      }
      current = bestChild;
    }

    return path;
  }

  private calculateWinProbability(root: MCTSNode): number {
    if (root.visits === 0) return 0.5;
    
    // 基于平均奖励计算胜率
    const avgReward = root.totalReward / root.visits;
    // 将[-1, 1]映射到[0, 1]
    return (avgReward + 1) / 2;
  }

  private async assessRisk(root: MCTSNode, scenario: BusinessScenario): Promise<RiskAssessment> {
    const factors: RiskFactor[] = [];
    const mitigations: string[] = [];

    // 分析子节点风险分布
    let highRiskPaths = 0;
    let totalPaths = 0;

    for (const child of root.children) {
      totalPaths++;
      const avgReward = child.visits > 0 ? child.totalReward / child.visits : 0;
      if (avgReward < -0.3) highRiskPaths++;
    }

    const riskRatio = totalPaths > 0 ? highRiskPaths / totalPaths : 0;

    // 添加风险因素
    if (riskRatio > 0.3) {
      factors.push({
        name: '高风险路径占比',
        probability: riskRatio,
        impact: 0.7,
        description: `${(riskRatio * 100).toFixed(1)}%的决策路径可能导致不利结果`,
      });
      mitigations.push('建议采取稳健策略，避免激进动作');
    }

    // 紧张度风险
    const tension = root.state.variables.get('tension') || 0.5;
    if (tension > 0.6) {
      factors.push({
        name: '谈判紧张度过高',
        probability: tension,
        impact: 0.5,
        description: '当前谈判氛围紧张，可能导致破裂',
      });
      mitigations.push('适当做出小让步以缓和气氛');
    }

    // 确定整体风险等级
    let level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (factors.length > 2 || riskRatio > 0.5) level = 'CRITICAL';
    else if (factors.length > 1 || riskRatio > 0.3) level = 'HIGH';
    else if (factors.length > 0) level = 'MEDIUM';

    return { level, factors, mitigations };
  }

  private async generateInsights(
    root: MCTSNode, 
    scenario: BusinessScenario, 
    bestPath: GameAction[]
  ): Promise<string[]> {
    const insights: string[] = [];

    // 最佳开局分析
    if (bestPath.length > 0) {
      const firstAction = bestPath[0];
      insights.push(`推荐开局策略: ${firstAction.description}`);
    }

    // 胜率分析
    const winProb = this.calculateWinProbability(root);
    if (winProb > 0.7) {
      insights.push('当前局势对主人有利，可保持现有策略');
    } else if (winProb < 0.4) {
      insights.push('当前局势不利，建议调整策略或寻求让步点');
    }

    // 路径长度分析
    if (bestPath.length > 10) {
      insights.push('预计谈判需要多轮博弈，需做好持久战准备');
    }

    // 关键动作分析
    const actionCounts = new Map<ActionType, number>();
    for (const action of bestPath) {
      actionCounts.set(action.type, (actionCounts.get(action.type) || 0) + 1);
    }

    const dominantAction = Array.from(actionCounts.entries())
      .sort((a, b) => b[1] - a[1])[0];
    if (dominantAction && dominantAction[1] >= 3) {
      insights.push(`主要策略倾向: ${this.getActionDescription(dominantAction[0])}`);
    }

    return insights;
  }

  private async logSimulation(scenario: BusinessScenario, result: SimulationResult): Promise<void> {
    try {
      await getDatabase().insert(auditLogs).values({
        action: 'MCTS_SIMULATION',
        actor: 'SYSTEM',
        details: JSON.stringify({
          scenario: scenario.id,
          iterations: result.iterations,
          winProbability: result.winProbability,
          riskLevel: result.riskAssessment.level,
          durationMs: result.durationMs,
          insightsCount: result.insights.length,
        }),
      });
    } catch (error) {
      log(`记录审计日志失败: ${error}`);
    }
  }

  // ============ 梦境演化集成 ============

  async runDreamEvolution(
    dayData: {
      conversations: string[];
      decisions: string[];
      conflicts: string[];
    }
  ): Promise<{
    scenarios: SimulationResult[];
    recommendations: string[];
    strategicInsights: string[];
  }> {
    log('开始梦境演化推演...');
    const results: SimulationResult[] = [];
    const allInsights: string[] = [];

    // 为每个冲突点运行博弈推演
    for (const conflict of dayData.conflicts) {
      try {
        const context = {
          conflictPoint: conflict,
          relatedDecisions: dayData.decisions,
        };

        const result = await this.runSimulation('contract_negotiation', context, {
          maxIterations: 2000, // 每个冲突点2000次
        });

        results.push(result);
        allInsights.push(...result.insights);
      } catch (error) {
        log(`冲突点推演失败: ${error}`);
      }
    }

    // 生成综合建议
    const recommendations: string[] = [];
    const avgWinProb = results.reduce((sum, r) => sum + r.winProbability, 0) / results.length;

    if (avgWinProb > 0.6) {
      recommendations.push('当前策略路线正确，建议保持');
    } else {
      recommendations.push('建议调整博弈策略，增加灵活性');
    }

    // 提取高风险因素
    const highRiskFactors = results
      .filter(r => r.riskAssessment.level === 'HIGH' || r.riskAssessment.level === 'CRITICAL')
      .flatMap(r => r.riskAssessment.factors.map(f => f.name));

    if (highRiskFactors.length > 0) {
      const uniqueFactors = Array.from(new Set(highRiskFactors));
      recommendations.push(`需重点关注: ${uniqueFactors.join(', ')}`);
    }

    log(`梦境演化完成: ${results.length}个场景, ${allInsights.length}条洞察`);

    const uniqueInsights = Array.from(new Set(allInsights));
    return {
      scenarios: results,
      recommendations,
      strategicInsights: uniqueInsights,
    };
  }

  // ============ 统计与状态 ============

  getStats(): {
    isRunning: boolean;
    totalSimulations: number;
    scenarios: number;
    historyCount: number;
    config: SimulationConfig;
  } {
    return {
      isRunning: this.isRunning,
      totalSimulations: this.totalSimulations,
      scenarios: this.scenarios.size,
      historyCount: this.simulationHistory.length,
      config: this.config,
    };
  }

  getHistory(limit = 10): SimulationResult[] {
    return this.simulationHistory.slice(-limit);
  }

  updateConfig(updates: Partial<SimulationConfig>): void {
    this.config = { ...this.config, ...updates };
    log(`配置已更新: ${JSON.stringify(updates)}`);
  }
}

export const mctsEngine = new MCTSEngine();
logger.info('[MCTS] 蒙特卡洛博弈推演引擎 v1.0 已加载 (Phase 11.1)');
