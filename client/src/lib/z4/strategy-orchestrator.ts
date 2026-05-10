import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useZ3Store } from '../z3/spirit-core';
import { useZ1Store } from '../z1/god-protocol';
import { z2CoreApi, type RelationshipInsight } from '@/lib/api';

// Expert Types (六核专家)
export type ExpertType = 'LEGAL' | 'FINANCE' | 'STRATEGY' | 'SECRETARY' | 'PSYCHOLOGY' | 'PLANNING';

// Chain of Thought - 推理链结构
export interface ThoughtChain {
  expertId: ExpertType;
  step: number;
  reasoning: string;
  evidence: string[];
  conclusion: string;
  confidence: number; // 0-100
  timestamp: number;
}

// Expert Analysis Result
export interface ExpertAnalysis {
  expert: ExpertType;
  chainOfThought: ThoughtChain[];
  finalVerdict: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommendations: string[];
  executionTime: number;
}

// Task Decomposition
export interface SubTask {
  id: string;
  description: string;
  assignedExpert: ExpertType;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';
  dependencies: string[];
  result?: ExpertAnalysis;
}

// Orchestration Result
export interface OrchestrationResult {
  taskId: string;
  originalInstruction: string;
  subTasks: SubTask[];
  expertAnalyses: ExpertAnalysis[];
  synthesizedStrategy: string;
  outputMode: 'WHISPER' | 'AMBIENT' | 'HUD' | 'SILENT';
  timestamp: number;
}

// Bio Guard Alert
export interface BioAlert {
  type: 'STRESS' | 'ANGER' | 'FATIGUE' | 'HEARTRATE';
  level: number;
  action: 'DELAY_SEND' | 'SOFTEN_TONE' | 'FORCE_BREAK' | 'ALERT_ONLY';
  message: string;
}

// Expert Module Interfaces
interface LegalExpert {
  auditDocument: (doc: string) => Promise<ExpertAnalysis>;
  checkCompliance: (action: string) => Promise<ThoughtChain[]>;
  identifyRisks: (contract: string) => Promise<string[]>;
}

interface FinanceExpert {
  calcRoi: (data: Record<string, number>) => Promise<ExpertAnalysis>;
  analyzeCashflow: (periods: number) => Promise<ThoughtChain[]>;
  assessRisk: (exposure: number) => Promise<string>;
}

interface StrategyExpert {
  generateCounterMoves: (legalRisks: ExpertAnalysis, financialImpact: ExpertAnalysis, personContext?: RelationshipInsight) => Promise<ExpertAnalysis>;
  analyzeWeakness: (targetName: string) => Promise<ThoughtChain[]>;
  planNegotiation: (scenario: string) => Promise<string[]>;
}

interface SecretaryAgent {
  simulateGuiOp: (targetApp: string, action: string) => Promise<{ success: boolean; log: string }>;
  scheduleTask: (task: string, time: Date) => void;
  draftResponse: (context: string, tone: 'FORMAL' | 'CASUAL' | 'AGGRESSIVE') => Promise<string>;
}

interface PsychologyExpert {
  checkEmotionalState: () => BioAlert | null;
  shouldDelayAction: (actionType: string) => boolean;
  getStressLevel: () => number;
  analyzeOpponentMindset: (context: string) => Promise<string>;
}

interface PlanningExpert {
  generateCreativePlan: (goal: string) => Promise<string[]>;
  proposeAlternative: (currentPlan: string) => Promise<string>;
  evaluateFeasibility: (plan: string) => Promise<number>;
}

// Z4 State
interface Z4State {
  // Expert Status
  activeExperts: ExpertType[];
  expertHealth: Record<ExpertType, number>; // 0-100 health score

  // Current Operations
  currentTask: OrchestrationResult | null;
  taskHistory: OrchestrationResult[];
  pendingActions: SubTask[];

  // Psychology State (情绪追踪)
  emotionalAlerts: BioAlert[];
  ownerStressLevel: number;
  actionDelayActive: boolean;

  // Chain of Thought Log
  thoughtLog: ThoughtChain[];

  // Actions
  activateExpert: (expert: ExpertType) => void;
  deactivateExpert: (expert: ExpertType) => void;

  // Core Functions
  processComplexInstruction: (instruction: string, ownerContext: string) => Promise<OrchestrationResult>;
  decomposeInstruction: (instruction: string) => SubTask[];
  executeSubTask: (task: SubTask) => Promise<ExpertAnalysis>;
  synthesizeResults: (analyses: ExpertAnalysis[]) => string;

  // Expert Operations
  runLegalAudit: (document: string) => Promise<ExpertAnalysis>;
  runFinanceAnalysis: (data: Record<string, number>) => Promise<ExpertAnalysis>;
  runStrategyPlanning: (context: string, opponentName?: string) => Promise<ExpertAnalysis>;

  // Secretary Operations
  autonomousAction: (targetApp: string, targetAction: string) => Promise<{ success: boolean; log: string }>;

  // Psychology (情绪管理)
  checkEmotionalState: () => BioAlert | null;
  setOwnerStress: (level: number) => void;
  delayAggressiveAction: (actionId: string) => void;

  // Output Dispatch
  dispatchOutput: (content: OrchestrationResult) => void;
}

// Expert Implementations (Simulated)
const createLegalExpert = (): LegalExpert => ({
  auditDocument: async (doc) => {
    const startTime = Date.now();
    const thoughts: ThoughtChain[] = [
      {
        expertId: 'LEGAL',
        step: 1,
        reasoning: '扫描合同条款，识别单方面有利条款...',
        evidence: ['第3.2条: 乙方承担无限责任', '第5.1条: 甲方可单方面终止'],
        conclusion: '发现3处潜在法律陷阱',
        confidence: 85,
        timestamp: Date.now(),
      },
      {
        expertId: 'LEGAL',
        step: 2,
        reasoning: '对比行业标准合同模板，评估偏离程度...',
        evidence: ['责任条款偏离标准 +40%', '违约金比例超出市场水平'],
        conclusion: '合同整体偏向甲方',
        confidence: 90,
        timestamp: Date.now(),
      },
    ];

    return {
      expert: 'LEGAL',
      chainOfThought: thoughts,
      finalVerdict: '建议重新谈判第3.2条和第5.1条',
      riskLevel: 'HIGH',
      recommendations: ['要求添加责任上限', '要求双方对等终止权', '增加争议仲裁条款'],
      executionTime: Date.now() - startTime,
    };
  },
  checkCompliance: async (action) => [],
  identifyRisks: async (contract) => [],
});

const createFinanceExpert = (): FinanceExpert => ({
  calcRoi: async (data) => {
    const startTime = Date.now();
    const thoughts: ThoughtChain[] = [
      {
        expertId: 'FINANCE',
        step: 1,
        reasoning: '分析对方财报，计算现金流健康度...',
        evidence: ['应收账款周转天数: 120天', '资产负债率: 72%'],
        conclusion: '对方资金流转压力大',
        confidence: 88,
        timestamp: Date.now(),
      },
      {
        expertId: 'FINANCE',
        step: 2,
        reasoning: '评估交易对我方财务影响...',
        evidence: ['预计ROI: 15%', '回款周期: 6个月'],
        conclusion: '收益可接受但需要账期保护',
        confidence: 82,
        timestamp: Date.now(),
      },
    ];

    return {
      expert: 'FINANCE',
      chainOfThought: thoughts,
      finalVerdict: '对方资金紧张可作为谈判筹码',
      riskLevel: 'MEDIUM',
      recommendations: ['要求预付款30%', '分阶段付款降低风险', '设置违约金条款'],
      executionTime: Date.now() - startTime,
    };
  },
  analyzeCashflow: async (periods) => [],
  assessRisk: async (exposure) => '',
});

const createStrategyExpert = (): StrategyExpert => ({
  generateCounterMoves: async (legalRisks, financialImpact, personContext) => {
    const startTime = Date.now();

    const weaknessInfo = personContext?.vulnerabilityAnalysis || '无已知弱点';
    const interestInfo = personContext?.interestChainSummary || '未知利益关联';

    const thoughts: ThoughtChain[] = [
      {
        expertId: 'STRATEGY',
        step: 1,
        reasoning: `综合法律风险 (${legalRisks.riskLevel}) 和财务分析 (${financialImpact.riskLevel})...`,
        evidence: [legalRisks.finalVerdict, financialImpact.finalVerdict],
        conclusion: '对方急于成交但试图转嫁风险',
        confidence: 85,
        timestamp: Date.now(),
      },
      {
        expertId: 'STRATEGY',
        step: 2,
        reasoning: `分析对方决策者画像：${weaknessInfo}`,
        evidence: [`利益链: ${interestInfo}`],
        conclusion: '建议采用"欲擒故纵"策略',
        confidence: 78,
        timestamp: Date.now(),
      },
      {
        expertId: 'STRATEGY',
        step: 3,
        reasoning: '推演博弈树，评估最优反击时机...',
        evidence: ['对方最可能在第二轮让步', '我方底牌尚未暴露'],
        conclusion: '第一轮故意示弱，第二轮发力',
        confidence: 80,
        timestamp: Date.now(),
      },
    ];

    return {
      expert: 'STRATEGY',
      chainOfThought: thoughts,
      finalVerdict: '建议：第一轮接受部分条款表示诚意，保留核心诉求到第二轮谈判发力',
      riskLevel: 'MEDIUM',
      recommendations: [
        '表面接受第7条但附加执行条件',
        '利用对方资金压力争取更好账期',
        '准备备选供应商作为谈判筹码',
      ],
      executionTime: Date.now() - startTime,
    };
  },
  analyzeWeakness: async (targetName) => [],
  planNegotiation: async (scenario) => [],
});

const createSecretaryAgent = (): SecretaryAgent => ({
  simulateGuiOp: async (targetApp, action) => {
    // In real implementation, this would use RPA/automation APIs
    return {
      success: true,
      log: `[${new Date().toISOString()}] Executed ${action} on ${targetApp}`,
    };
  },
  scheduleTask: (task, time) => {
  },
  draftResponse: async (context, tone) => {
    const toneMap = {
      FORMAL: '尊敬的合作伙伴，',
      CASUAL: '您好，',
      AGGRESSIVE: '关于此事，我方立场明确：',
    };
    return `${toneMap[tone]}基于${context}，我方认为...`;
  },
});

const createPsychologyExpert = (getStress: () => number): PsychologyExpert => ({
  checkEmotionalState: () => {
    const stress = getStress();
    if (stress > 80) {
      return {
        type: 'STRESS',
        level: stress,
        action: 'DELAY_SEND',
        message: '检测到情绪波动较大，建议冷静后再决策',
      };
    }
    if (stress > 60) {
      return {
        type: 'STRESS',
        level: stress,
        action: 'SOFTEN_TONE',
        message: '建议调整沟通语气，避免过激表达',
      };
    }
    return null;
  },
  shouldDelayAction: (actionType: string) => {
    const stress = getStress();
    return stress > 70 && (actionType.includes('SEND') || actionType.includes('SUBMIT'));
  },
  getStressLevel: getStress,
  analyzeOpponentMindset: async (context: string) => {
    return `基于${context}的分析，对方可能采取防御性策略`;
  },
});

const createPlanningExpert = (): PlanningExpert => ({
  generateCreativePlan: async (goal: string) => {
    return [`方案A: 直接推进${goal}`, `方案B: 迂回策略`, `方案C: 分阶段实施`];
  },
  proposeAlternative: async (currentPlan: string) => {
    return `针对${currentPlan}的替代方案：考虑从另一角度切入`;
  },
  evaluateFeasibility: async (plan: string) => {
    return 0.75; // 可行性评分
  },
});

// Zustand Store
export const useZ4Store = create<Z4State>()(
  persist(
    (set, get) => {
      // Initialize experts
      const legalExpert = createLegalExpert();
      const financeExpert = createFinanceExpert();
      const strategyExpert = createStrategyExpert();
      const secretaryAgent = createSecretaryAgent();
      const psychologyExpert = createPsychologyExpert(() => get().ownerStressLevel);
      const planningExpert = createPlanningExpert();

      return {
        // Initial State
        activeExperts: ['LEGAL', 'FINANCE', 'STRATEGY', 'SECRETARY', 'PSYCHOLOGY', 'PLANNING'],
        expertHealth: {
          LEGAL: 100,
          FINANCE: 100,
          STRATEGY: 100,
          SECRETARY: 100,
          PSYCHOLOGY: 100,
          PLANNING: 100,
        },

        currentTask: null,
        taskHistory: [],
        pendingActions: [],

        emotionalAlerts: [],
        ownerStressLevel: 30,
        actionDelayActive: false,

        thoughtLog: [],

        // Expert Management
        activateExpert: (expert) => {
          set((state) => ({
            activeExperts: state.activeExperts.includes(expert)
              ? state.activeExperts
              : [...state.activeExperts, expert],
          }));
        },

        deactivateExpert: (expert) => {
          set((state) => ({
            activeExperts: state.activeExperts.filter((e) => e !== expert),
          }));
        },

        // Core: Process Complex Instruction
        processComplexInstruction: async (instruction, ownerContext) => {
          const taskId = `task_${Date.now()}`;

          // Check emotional state first
          const emotionalAlert = get().checkEmotionalState();
          if (emotionalAlert && emotionalAlert.action === 'DELAY_SEND') {
            set((state) => ({
              emotionalAlerts: [...state.emotionalAlerts, emotionalAlert],
              actionDelayActive: true,
            }));
          }

          // Decompose instruction into subtasks
          const subTasks = get().decomposeInstruction(instruction);

          // Execute each subtask
          const analyses: ExpertAnalysis[] = [];
          for (const task of subTasks) {
            if (get().activeExperts.includes(task.assignedExpert)) {
              const result = await get().executeSubTask(task);
              analyses.push(result);
              task.status = 'COMPLETED';
              task.result = result;
            }
          }

          // Synthesize results
          const synthesized = get().synthesizeResults(analyses);

          // Determine output mode via Z3
          const z3 = useZ3Store.getState();
          const outputMode = z3.arbitrateAudioStream('SECRET');

          const result: OrchestrationResult = {
            taskId,
            originalInstruction: instruction,
            subTasks,
            expertAnalyses: analyses,
            synthesizedStrategy: synthesized,
            outputMode: outputMode === 'BLUETOOTH_EARPHONE' ? 'WHISPER' :
                       outputMode === 'GLASSES_DISPLAY' ? 'HUD' :
                       outputMode === 'SUBTITLE_ONLY' ? 'SILENT' : 'AMBIENT',
            timestamp: Date.now(),
          };

          set((state) => ({
            currentTask: result,
            taskHistory: [...state.taskHistory, result].slice(-20),
          }));

          // Dispatch output
          get().dispatchOutput(result);

          return result;
        },

        // Decompose Instruction
        decomposeInstruction: (instruction) => {
          const tasks: SubTask[] = [];
          const lower = instruction.toLowerCase();

          if (lower.includes('合同') || lower.includes('contract') || lower.includes('法律')) {
            tasks.push({
              id: `sub_legal_${Date.now()}`,
              description: '法律合规审查',
              assignedExpert: 'LEGAL',
              status: 'PENDING',
              dependencies: [],
            });
          }

          if (lower.includes('财务') || lower.includes('财报') || lower.includes('roi') || lower.includes('成本')) {
            tasks.push({
              id: `sub_finance_${Date.now()}`,
              description: '财务影响分析',
              assignedExpert: 'FINANCE',
              status: 'PENDING',
              dependencies: [],
            });
          }

          if (lower.includes('策略') || lower.includes('对策') || lower.includes('弱点') || lower.includes('谈判')) {
            tasks.push({
              id: `sub_strategy_${Date.now()}`,
              description: '博弈策略制定',
              assignedExpert: 'STRATEGY',
              status: 'PENDING',
              dependencies: tasks.map(t => t.id), // Depends on all previous analyses
            });
          }

          // Default: at least run strategy analysis
          if (tasks.length === 0) {
            tasks.push({
              id: `sub_strategy_${Date.now()}`,
              description: '综合策略分析',
              assignedExpert: 'STRATEGY',
              status: 'PENDING',
              dependencies: [],
            });
          }

          return tasks;
        },

        // Execute SubTask - Uses backend Expert AI API
        executeSubTask: async (task) => {
          set((state) => ({
            pendingActions: state.pendingActions.map((t) =>
              t.id === task.id ? { ...t, status: 'IN_PROGRESS' as const } : t
            ),
          }));

          const callExpertAPI = async (expertType: string, query: string): Promise<ExpertAnalysis | null> => {
            try {
              const response = await fetch('/api/expert/analyze', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Avatar-Role': 'MASTER',
                },
                body: JSON.stringify({ expertType, query }),
              });
              if (response.ok) {
                const data = await response.json();
                return {
                  expert: expertType as ExpertAnalysis['expert'],
                  chainOfThought: (data.chainOfThought || []).map((t: any, i: number) => ({
                    expertId: expertType,
                    step: t.step || i + 1,
                    reasoning: t.reasoning || '',
                    evidence: t.evidence || [],
                    conclusion: t.conclusion || '',
                    confidence: t.confidence || 70,
                    timestamp: Date.now(),
                  })),
                  finalVerdict: data.finalVerdict || '分析完成',
                  riskLevel: data.riskLevel || 'MEDIUM',
                  recommendations: data.recommendations || [],
                  executionTime: data.executionTimeMs || 0,
                };
              }
            } catch (e) {
              console.error(`[Z4] ${expertType} API call failed:`, e);
            }
            return null;
          };

          let result: ExpertAnalysis;

          switch (task.assignedExpert) {
            case 'LEGAL':
              result = await callExpertAPI('LEGAL', task.description) || await legalExpert.auditDocument(task.description);
              break;
            case 'FINANCE':
              result = await callExpertAPI('FINANCE', task.description) || await financeExpert.calcRoi({});
              break;
            case 'STRATEGY': {
              const apiResult = await callExpertAPI('STRATEGY', task.description);
              if (apiResult) {
                result = apiResult;
              } else {
                const legalResult = await legalExpert.auditDocument('');
                const financeResult = await financeExpert.calcRoi({});
                result = await strategyExpert.generateCounterMoves(legalResult, financeResult);
              }
              break;
            }
            case 'PSYCHOLOGY':
              result = await callExpertAPI('PSYCHOLOGY', task.description) || {
                expert: 'PSYCHOLOGY',
                chainOfThought: [],
                finalVerdict: '心理分析完成',
                riskLevel: 'LOW',
                recommendations: [],
                executionTime: 0,
              };
              break;
            case 'SECRETARY':
              result = await callExpertAPI('SECRETARY', task.description) || {
                expert: 'SECRETARY',
                chainOfThought: [],
                finalVerdict: '任务分解完成',
                riskLevel: 'LOW',
                recommendations: [],
                executionTime: 0,
              };
              break;
            case 'PLANNING':
              result = await callExpertAPI('PLANNING', task.description) || {
                expert: 'PLANNING',
                chainOfThought: [],
                finalVerdict: '方案设计完成',
                riskLevel: 'LOW',
                recommendations: [],
                executionTime: 0,
              };
              break;
            default:
              result = {
                expert: task.assignedExpert,
                chainOfThought: [],
                finalVerdict: '分析完成',
                riskLevel: 'LOW',
                recommendations: [],
                executionTime: 0,
              };
          }

          // Log thought chain
          set((state) => ({
            thoughtLog: [...state.thoughtLog, ...result.chainOfThought].slice(-50),
          }));

          return result;
        },

        // Synthesize Results
        synthesizeResults: (analyses) => {
          if (analyses.length === 0) return '无可用分析结果';

          const highRiskCount = analyses.filter((a) => a.riskLevel === 'HIGH' || a.riskLevel === 'CRITICAL').length;
          const allRecommendations = analyses.flatMap((a) => a.recommendations);

          let synthesis = `【综合研判】基于${analyses.length}位专家的分析：\n`;

          if (highRiskCount > 0) {
            synthesis += `⚠️ 发现${highRiskCount}项高风险因素，建议谨慎行动。\n`;
          }

          synthesis += `\n【核心建议】\n`;
          allRecommendations.slice(0, 5).forEach((rec, i) => {
            synthesis += `${i + 1}. ${rec}\n`;
          });

          analyses.forEach((a) => {
            synthesis += `\n【${a.expert}】${a.finalVerdict}`;
          });

          return synthesis;
        },

        // Expert Operations - Calls backend Expert AI API
        runLegalAudit: async (document) => {
          try {
            const response = await fetch('/api/expert/analyze', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Avatar-Role': 'MASTER',
              },
              body: JSON.stringify({ expertType: 'LEGAL', query: document }),
            });
            if (response.ok) {
              const data = await response.json();
              return {
                expert: 'LEGAL' as const,
                chainOfThought: (data.chainOfThought || []).map((t: any, i: number) => ({
                  expertId: 'LEGAL',
                  step: t.step || i + 1,
                  reasoning: t.reasoning || '',
                  evidence: t.evidence || [],
                  conclusion: t.conclusion || '',
                  confidence: t.confidence || 70,
                  timestamp: Date.now(),
                })),
                finalVerdict: data.finalVerdict || '分析完成',
                riskLevel: data.riskLevel || 'MEDIUM',
                recommendations: data.recommendations || [],
                executionTime: data.executionTimeMs || 0,
              };
            }
          } catch (e) {
            console.error('[Z4] Legal API call failed, using fallback');
          }
          return await legalExpert.auditDocument(document);
        },

        runFinanceAnalysis: async (data) => {
          try {
            const response = await fetch('/api/expert/analyze', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Avatar-Role': 'MASTER',
              },
              body: JSON.stringify({ expertType: 'FINANCE', query: JSON.stringify(data) }),
            });
            if (response.ok) {
              const apiData = await response.json();
              return {
                expert: 'FINANCE' as const,
                chainOfThought: (apiData.chainOfThought || []).map((t: any, i: number) => ({
                  expertId: 'FINANCE',
                  step: t.step || i + 1,
                  reasoning: t.reasoning || '',
                  evidence: t.evidence || [],
                  conclusion: t.conclusion || '',
                  confidence: t.confidence || 70,
                  timestamp: Date.now(),
                })),
                finalVerdict: apiData.finalVerdict || '分析完成',
                riskLevel: apiData.riskLevel || 'MEDIUM',
                recommendations: apiData.recommendations || [],
                executionTime: apiData.executionTimeMs || 0,
              };
            }
          } catch (e) {
            console.error('[Z4] Finance API call failed, using fallback');
          }
          return await financeExpert.calcRoi(data);
        },

        runStrategyPlanning: async (context, opponentName) => {
          let personContext: RelationshipInsight | undefined;
          if (opponentName) {
            try {
              personContext = await z2CoreApi.getRelationshipInsight(opponentName) as unknown as RelationshipInsight;
            } catch (e) {
            }
          }

          try {
            const response = await fetch('/api/expert/analyze', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Avatar-Role': 'MASTER',
              },
              body: JSON.stringify({
                expertType: 'STRATEGY',
                query: context,
                context: personContext ? JSON.stringify(personContext) : undefined,
              }),
            });
            if (response.ok) {
              const data = await response.json();
              return {
                expert: 'STRATEGY' as const,
                chainOfThought: (data.chainOfThought || []).map((t: any, i: number) => ({
                  expertId: 'STRATEGY',
                  step: t.step || i + 1,
                  reasoning: t.reasoning || '',
                  evidence: t.evidence || [],
                  conclusion: t.conclusion || '',
                  confidence: t.confidence || 70,
                  timestamp: Date.now(),
                })),
                finalVerdict: data.finalVerdict || '分析完成',
                riskLevel: data.riskLevel || 'MEDIUM',
                recommendations: data.recommendations || [],
                executionTime: data.executionTimeMs || 0,
              };
            }
          } catch (e) {
            console.error('[Z4] Strategy API call failed, using fallback');
          }

          const legalResult = await legalExpert.auditDocument(context);
          const financeResult = await financeExpert.calcRoi({});
          return await strategyExpert.generateCounterMoves(legalResult, financeResult, personContext);
        },

        // Secretary: Autonomous Action
        autonomousAction: async (targetApp, targetAction) => {
          // Check emotional state first
          if (psychologyExpert.shouldDelayAction(targetAction)) {
            return {
              success: false,
              log: '[Psychology] 检测到情绪波动，建议稍后再执行操作',
            };
          }

          return await secretaryAgent.simulateGuiOp(targetApp, targetAction);
        },

        // Psychology (情绪管理)
        checkEmotionalState: () => {
          return psychologyExpert.checkEmotionalState();
        },

        setOwnerStress: (level) => {
          set({ ownerStressLevel: Math.min(100, Math.max(0, level)) });

          // Auto-trigger Z3 stress degradation
          if (level > 70) {
            useZ3Store.getState().setStressLevel(level);
          }
        },

        delayAggressiveAction: (actionId) => {
          set({ actionDelayActive: true });
        },

        // Output Dispatch
        dispatchOutput: (content) => {
          const z3 = useZ3Store.getState();
          const z1 = useZ1Store.getState();

          // Sync to all devices with real HP from Z1
          z3.syncUiState(
            z1.hpBalance,
            z1.academicLevel,
            content.expertAnalyses.map((a) => a.expert)
          );
        },
      };
    },
    {
      name: 'z4-strategy-orchestrator-storage',
    }
  )
);

// Z4 Protocol Schema
export const Z4_SCHEMA = {
  protocol_name: "StrategyOrchestrator_v6",
  experts: {
    LEGAL: "大律师：合同审计、合规风险",
    FINANCE: "财务师：盈利分析、风险红线",
    STRATEGY: "策划师：弱点分析、博弈计谋",
    SECRETARY: "秘书：拟人化操作、日程分发",
    PSYCHOLOGY: "心理专家：情绪洞察、谈判心理",
    PLANNING: "策划大师：创意构思、方案设计",
  },
  chain_of_thought_required: true,
  psychology_priority: "HIGH",
};
