/**
 * Function Calling 服务 - Phase 10.1
 * 
 * 功能：
 * 1. OpenAI Tools协议兼容
 * 2. 工具注册和管理
 * 3. 工具调用执行
 * 4. 参数验证
 * 5. 执行结果处理
 * 6. 工具调用日志
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('FunctionCalling');

import { EventEmitter } from 'events';

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required?: boolean;
  enum?: string[];
  items?: { type: string };
  properties?: Record<string, ToolParameter>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, Omit<ToolParameter, 'name' | 'required'>>;
    required?: string[];
  };
  handler: (args: Record<string, unknown>) => Promise<unknown>;
  category?: string;
  requiresAuth?: boolean;
  riskLevel?: 'low' | 'medium' | 'high';
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolCallResult {
  id: string;
  name: string;
  result: unknown;
  success: boolean;
  error?: string;
  duration: number;
}

export interface ToolCallLog {
  id: string;
  toolName: string;
  arguments: Record<string, unknown>;
  result: unknown;
  success: boolean;
  error?: string;
  duration: number;
  timestamp: number;
  userId?: string;
}

function generateCallId(): string {
  return 'call_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
}

function log(message: string) {
  const time = new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  logger.info(`${time} [FunctionCall] ${message}`);
}

class FunctionCallingService extends EventEmitter {
  private tools: Map<string, ToolDefinition> = new Map();
  private callLogs: ToolCallLog[] = [];
  private maxLogSize = 1000;

  constructor() {
    super();
    this.registerBuiltinTools();
    log('Function Calling服务已初始化 (Phase 10.1)');
  }

  private registerBuiltinTools(): void {
    // 获取当前时间
    this.registerTool({
      name: 'get_current_time',
      description: '获取当前日期和时间',
      parameters: {
        type: 'object',
        properties: {
          timezone: {
            type: 'string',
            description: '时区，如 Asia/Shanghai',
          },
          format: {
            type: 'string',
            description: '时间格式，如 full, date, time',
            enum: ['full', 'date', 'time'],
          },
        },
      },
      handler: async (args) => {
        const tz = args.timezone || 'Asia/Shanghai';
        const format = args.format || 'full';
        const now = new Date();
        
        const options: Intl.DateTimeFormatOptions = { timeZone: tz };
        
        if (format === 'date' || format === 'full') {
          options.year = 'numeric';
          options.month = '2-digit';
          options.day = '2-digit';
        }
        if (format === 'time' || format === 'full') {
          options.hour = '2-digit';
          options.minute = '2-digit';
          options.second = '2-digit';
        }

        return {
          formatted: now.toLocaleString('zh-CN', options),
          timestamp: now.getTime(),
          timezone: tz,
        };
      },
      category: 'system',
      riskLevel: 'low',
    });

    // 计算器
    this.registerTool({
      name: 'calculator',
      description: '执行数学计算',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: '数学表达式，如 2+2, sqrt(16), sin(0.5)',
          },
        },
        required: ['expression'],
      },
      handler: async (args) => {
        const expr = args.expression;
        try {
          // 安全的数学表达式求值
          const safeEval = new Function('Math', `
            with (Math) {
              return ${expr.replace(/[^0-9+\-*/().sincostanetlogqrpow\s]/g, '')}
            }
          `);
          const result = safeEval(Math);
          return { expression: expr, result };
        } catch (e) {
          throw new Error(`无法计算表达式: ${expr}`);
        }
      },
      category: 'utility',
      riskLevel: 'low',
    });

    // 天气查询（模拟）
    this.registerTool({
      name: 'get_weather',
      description: '查询天气信息',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: '城市名称，如 北京, 上海',
          },
          days: {
            type: 'number',
            description: '预报天数，1-7',
          },
        },
        required: ['location'],
      },
      handler: async (args) => {
        // 模拟天气数据
        const weatherTypes = ['晴', '多云', '阴', '小雨', '大雨'];
        const days = Math.min(args.days || 1, 7);
        const forecast = [];
        
        for (let i = 0; i < days; i++) {
          const date = new Date();
          date.setDate(date.getDate() + i);
          forecast.push({
            date: date.toISOString().split('T')[0],
            weather: weatherTypes[Math.floor(Math.random() * weatherTypes.length)],
            tempHigh: 20 + Math.floor(Math.random() * 15),
            tempLow: 10 + Math.floor(Math.random() * 10),
          });
        }

        return {
          location: args.location,
          forecast,
          note: '模拟数据，仅供测试',
        };
      },
      category: 'external',
      riskLevel: 'low',
    });

    // 知识库搜索
    this.registerTool({
      name: 'search_knowledge',
      description: '在知识库中搜索相关信息',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '搜索查询',
          },
          category: {
            type: 'string',
            description: '知识类别',
          },
          topK: {
            type: 'number',
            description: '返回结果数量',
          },
        },
        required: ['query'],
      },
      handler: async (args) => {
        // 调用RAG知识库服务
        try {
          const { ragKnowledgeService } = await import('./rag-knowledge');
          const results = await ragKnowledgeService.search(args.query, {
            category: args.category,
            topK: args.topK || 3,
          });
          
          return {
            query: args.query,
            results: results.map(r => ({
              content: r.chunk.content,
              source: r.chunk.source,
              score: r.score,
            })),
            count: results.length,
          };
        } catch (e) {
          return { query: args.query, results: [], error: 'RAG服务不可用' };
        }
      },
      category: 'knowledge',
      riskLevel: 'low',
    });

    // 设置提醒
    this.registerTool({
      name: 'set_reminder',
      description: '设置提醒事项',
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: '提醒内容',
          },
          time: {
            type: 'string',
            description: '提醒时间，ISO格式或自然语言',
          },
          priority: {
            type: 'string',
            description: '优先级',
            enum: ['low', 'medium', 'high'],
          },
        },
        required: ['message', 'time'],
      },
      handler: async (args) => {
        // 模拟设置提醒
        const reminderId = 'rem_' + Date.now().toString(36);
        return {
          success: true,
          reminderId,
          message: args.message,
          scheduledAt: args.time,
          priority: args.priority || 'medium',
          note: '模拟提醒，实际需连接提醒服务',
        };
      },
      category: 'productivity',
      riskLevel: 'low',
    });

    log(`已注册 ${this.tools.size} 个内置工具`);
  }

  registerTool(definition: ToolDefinition): void {
    if (this.tools.has(definition.name)) {
      log(`警告: 覆盖已存在的工具 ${definition.name}`);
    }
    this.tools.set(definition.name, definition);
    log(`工具已注册: ${definition.name}`);
    this.emit('tool_registered', definition.name);
  }

  unregisterTool(name: string): boolean {
    const deleted = this.tools.delete(name);
    if (deleted) {
      log(`工具已注销: ${name}`);
      this.emit('tool_unregistered', name);
    }
    return deleted;
  }

  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getToolsForOpenAI(): Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: ToolDefinition['parameters'];
    };
  }> {
    return Array.from(this.tools.values()).map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  async executeCall(call: ToolCall, options: { userId?: string } = {}): Promise<ToolCallResult> {
    const startTime = Date.now();
    const tool = this.tools.get(call.name);

    if (!tool) {
      const result: ToolCallResult = {
        id: call.id,
        name: call.name,
        result: null,
        success: false,
        error: `工具不存在: ${call.name}`,
        duration: Date.now() - startTime,
      };
      this.logCall(result, call.arguments, options.userId);
      return result;
    }

    try {
      // 参数验证
      this.validateArguments(tool, call.arguments);

      // 执行工具
      const result = await tool.handler(call.arguments);
      
      const callResult: ToolCallResult = {
        id: call.id,
        name: call.name,
        result,
        success: true,
        duration: Date.now() - startTime,
      };

      this.logCall(callResult, call.arguments, options.userId);
      this.emit('tool_executed', callResult);

      log(`工具执行成功: ${call.name} (${callResult.duration}ms)`);
      return callResult;

    } catch (error) {
      const callResult: ToolCallResult = {
        id: call.id,
        name: call.name,
        result: null,
        success: false,
        error: error instanceof Error ? error.message : '执行失败',
        duration: Date.now() - startTime,
      };

      this.logCall(callResult, call.arguments, options.userId);
      this.emit('tool_error', callResult);

      log(`工具执行失败: ${call.name} - ${callResult.error}`);
      return callResult;
    }
  }

  async executeCalls(
    calls: ToolCall[],
    options: { userId?: string; parallel?: boolean } = {}
  ): Promise<ToolCallResult[]> {
    if (options.parallel) {
      return Promise.all(calls.map(call => this.executeCall(call, options)));
    } else {
      const results: ToolCallResult[] = [];
      for (const call of calls) {
        results.push(await this.executeCall(call, options));
      }
      return results;
    }
  }

  private validateArguments(tool: ToolDefinition, args: Record<string, unknown>): void {
    const required = tool.parameters.required || [];
    
    for (const param of required) {
      if (args[param] === undefined) {
        throw new Error(`缺少必要参数: ${param}`);
      }
    }

    for (const [key, value] of Object.entries(args)) {
      const paramDef = tool.parameters.properties[key];
      if (!paramDef) continue;

      const expectedType = paramDef.type;
      const actualType = Array.isArray(value) ? 'array' : typeof value;

      if (expectedType !== actualType && value !== null && value !== undefined) {
        throw new Error(`参数类型错误: ${key} 期望 ${expectedType}，实际 ${actualType}`);
      }

      if (paramDef.enum && !paramDef.enum.includes(value)) {
        throw new Error(`参数值无效: ${key} 必须是 ${paramDef.enum.join(', ')} 之一`);
      }
    }
  }

  private logCall(
    result: ToolCallResult,
    args: Record<string, unknown>,
    userId?: string
  ): void {
    const logEntry: ToolCallLog = {
      id: result.id,
      toolName: result.name,
      arguments: args,
      result: result.result,
      success: result.success,
      error: result.error,
      duration: result.duration,
      timestamp: Date.now(),
      userId,
    };

    this.callLogs.push(logEntry);

    // 限制日志大小
    if (this.callLogs.length > this.maxLogSize) {
      this.callLogs.shift();
    }
  }

  getCallLogs(options: {
    toolName?: string;
    userId?: string;
    limit?: number;
  } = {}): ToolCallLog[] {
    let logs = [...this.callLogs];

    if (options.toolName) {
      logs = logs.filter(l => l.toolName === options.toolName);
    }
    if (options.userId) {
      logs = logs.filter(l => l.userId === options.userId);
    }

    logs.sort((a, b) => b.timestamp - a.timestamp);

    if (options.limit) {
      logs = logs.slice(0, options.limit);
    }

    return logs;
  }

  getStats(): {
    totalTools: number;
    byCategory: Record<string, number>;
    totalCalls: number;
    successRate: number;
    avgDuration: number;
  } {
    const tools = Array.from(this.tools.values());
    const byCategory: Record<string, number> = {};
    
    for (const tool of tools) {
      const cat = tool.category || 'uncategorized';
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }

    const successfulCalls = this.callLogs.filter(l => l.success).length;
    const totalDuration = this.callLogs.reduce((sum, l) => sum + l.duration, 0);

    return {
      totalTools: tools.length,
      byCategory,
      totalCalls: this.callLogs.length,
      successRate: this.callLogs.length > 0 ? successfulCalls / this.callLogs.length : 1,
      avgDuration: this.callLogs.length > 0 ? totalDuration / this.callLogs.length : 0,
    };
  }

  clearLogs(): void {
    this.callLogs = [];
    log('调用日志已清除');
  }
}

export const functionCallingService = new FunctionCallingService();
logger.info('[FunctionCall] Function Calling服务 v1.0 已加载 (Phase 10.1)');
