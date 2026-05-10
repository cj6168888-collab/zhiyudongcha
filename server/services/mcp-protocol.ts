/**
 * MCP协议集成服务 - Phase 10.2
 * 
 * Model Context Protocol (MCP) 桥接实现
 * 
 * 功能：
 * 1. MCP服务器协议支持
 * 2. 资源管理（文件、URL、数据库等）
 * 3. 工具调用桥接
 * 4. 提示词模板管理
 * 5. 采样请求处理
 * 6. 上下文窗口管理
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('McpProtocol');

import { EventEmitter } from 'events';

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  annotations?: {
    audience?: string[];
    priority?: number;
  };
}

export interface MCPResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string; // base64
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface MCPPromptMessage {
  role: 'user' | 'assistant';
  content: {
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
    resource?: { uri: string };
  };
}

export interface MCPSamplingRequest {
  messages: MCPPromptMessage[];
  modelPreferences?: {
    hints?: { name?: string }[];
    costPriority?: number;
    speedPriority?: number;
    intelligencePriority?: number;
  };
  systemPrompt?: string;
  includeContext?: 'none' | 'thisServer' | 'allServers';
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  metadata?: Record<string, any>;
}

export interface MCPServerCapabilities {
  experimental?: Record<string, any>;
  logging?: Record<string, any>;
  prompts?: { listChanged?: boolean };
  resources?: { subscribe?: boolean; listChanged?: boolean };
  tools?: { listChanged?: boolean };
}

function log(message: string) {
  const time = new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  logger.info(`${time} [MCP] ${message}`);
}

class MCPProtocolService extends EventEmitter {
  private resources: Map<string, MCPResource> = new Map();
  private tools: Map<string, MCPTool> = new Map();
  private prompts: Map<string, MCPPrompt> = new Map();
  private resourceContents: Map<string, MCPResourceContent> = new Map();
  private capabilities: MCPServerCapabilities;

  constructor() {
    super();
    this.capabilities = {
      resources: { subscribe: true, listChanged: true },
      tools: { listChanged: true },
      prompts: { listChanged: true },
    };
    this.registerBuiltinResources();
    this.registerBuiltinPrompts();
    log('MCP协议服务已初始化 (Phase 10.2)');
  }

  private registerBuiltinResources(): void {
    // 系统信息资源
    this.registerResource({
      uri: 'avatar://system/info',
      name: '系统信息',
      description: '小智系统配置和状态信息',
      mimeType: 'application/json',
    });

    // 用户资料资源
    this.registerResource({
      uri: 'avatar://user/profile',
      name: '用户资料',
      description: '当前用户的资料和偏好设置',
      mimeType: 'application/json',
    });

    // 对话历史资源
    this.registerResource({
      uri: 'avatar://conversation/history',
      name: '对话历史',
      description: '最近的对话记录',
      mimeType: 'application/json',
    });

    // 知识库资源
    this.registerResource({
      uri: 'avatar://knowledge/base',
      name: '知识库',
      description: 'RAG知识库检索接口',
      mimeType: 'application/json',
    });

    log(`已注册 ${this.resources.size} 个内置资源`);
  }

  private registerBuiltinPrompts(): void {
    // 小智对话提示词
    this.registerPrompt({
      name: 'xiaozhi_chat',
      description: '小智角色对话提示词',
      arguments: [
        { name: 'user_message', description: '用户消息', required: true },
        { name: 'persona', description: '角色模式', required: false },
      ],
    });

    // 专家咨询提示词
    this.registerPrompt({
      name: 'expert_consult',
      description: '专家咨询提示词',
      arguments: [
        { name: 'question', description: '咨询问题', required: true },
        { name: 'expert_type', description: '专家类型（法律/财务/策略等）', required: true },
      ],
    });

    // 文档分析提示词
    this.registerPrompt({
      name: 'document_analysis',
      description: '文档内容分析提示词',
      arguments: [
        { name: 'document_content', description: '文档内容', required: true },
        { name: 'analysis_type', description: '分析类型', required: false },
      ],
    });

    // 情感记忆提示词
    this.registerPrompt({
      name: 'emotional_memory',
      description: '情感记忆回顾提示词',
      arguments: [
        { name: 'topic', description: '主题或关键词', required: true },
        { name: 'time_range', description: '时间范围', required: false },
      ],
    });

    log(`已注册 ${this.prompts.size} 个内置提示词`);
  }

  // === 资源管理 ===

  registerResource(resource: MCPResource): void {
    this.resources.set(resource.uri, resource);
    this.emit('resources/list_changed');
  }

  unregisterResource(uri: string): boolean {
    const deleted = this.resources.delete(uri);
    if (deleted) {
      this.resourceContents.delete(uri);
      this.emit('resources/list_changed');
    }
    return deleted;
  }

  listResources(): MCPResource[] {
    return Array.from(this.resources.values());
  }

  async readResource(uri: string): Promise<MCPResourceContent | null> {
    if (!this.resources.has(uri)) {
      return null;
    }

    // 检查缓存
    if (this.resourceContents.has(uri)) {
      return this.resourceContents.get(uri)!;
    }

    // 动态生成资源内容
    const content = await this.generateResourceContent(uri);
    if (content) {
      this.resourceContents.set(uri, content);
    }
    return content;
  }

  private async generateResourceContent(uri: string): Promise<MCPResourceContent | null> {
    if (uri === 'avatar://system/info') {
      return {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          name: '小智',
          version: '3.0.0',
          phase: 'Phase 10.2',
          capabilities: ['voice', 'knowledge', 'tools', 'mcp'],
          timestamp: Date.now(),
        }),
      };
    }

    if (uri === 'avatar://user/profile') {
      return {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          role: 'MASTER',
          addressing: '爸爸',
          preferences: {},
          timestamp: Date.now(),
        }),
      };
    }

    if (uri === 'avatar://conversation/history') {
      return {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          messages: [],
          count: 0,
          timestamp: Date.now(),
        }),
      };
    }

    return null;
  }

  setResourceContent(uri: string, content: MCPResourceContent): void {
    if (this.resources.has(uri)) {
      this.resourceContents.set(uri, content);
      this.emit('resources/updated', { uri });
    }
  }

  // === 工具管理 ===

  registerTool(tool: MCPTool): void {
    this.tools.set(tool.name, tool);
    this.emit('tools/list_changed');
  }

  unregisterTool(name: string): boolean {
    const deleted = this.tools.delete(name);
    if (deleted) {
      this.emit('tools/list_changed');
    }
    return deleted;
  }

  listTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  async callTool(name: string, arguments_: Record<string, any>): Promise<{
    content: Array<{ type: string; text?: string }>;
    isError?: boolean;
  }> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        content: [{ type: 'text', text: `工具不存在: ${name}` }],
        isError: true,
      };
    }

    try {
      // 桥接到FunctionCallingService
      const { functionCallingService } = await import('./function-calling');
      const result = await functionCallingService.executeCall({
        id: 'mcp_' + Date.now().toString(36),
        name,
        arguments: arguments_,
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result.result, null, 2),
        }],
        isError: !result.success,
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `工具调用失败: ${error}` }],
        isError: true,
      };
    }
  }

  // === 提示词管理 ===

  registerPrompt(prompt: MCPPrompt): void {
    this.prompts.set(prompt.name, prompt);
    this.emit('prompts/list_changed');
  }

  unregisterPrompt(name: string): boolean {
    const deleted = this.prompts.delete(name);
    if (deleted) {
      this.emit('prompts/list_changed');
    }
    return deleted;
  }

  listPrompts(): MCPPrompt[] {
    return Array.from(this.prompts.values());
  }

  async getPrompt(name: string, arguments_: Record<string, string>): Promise<{
    description?: string;
    messages: MCPPromptMessage[];
  } | null> {
    const prompt = this.prompts.get(name);
    if (!prompt) {
      return null;
    }

    // 根据提示词名称生成消息
    const messages = this.generatePromptMessages(name, arguments_);
    
    return {
      description: prompt.description,
      messages,
    };
  }

  private generatePromptMessages(name: string, args: Record<string, string>): MCPPromptMessage[] {
    switch (name) {
      case 'xiaozhi_chat':
        return [{
          role: 'user',
          content: {
            type: 'text',
            text: args.user_message || '',
          },
        }];

      case 'expert_consult':
        return [{
          role: 'user',
          content: {
            type: 'text',
            text: `[${args.expert_type}专家咨询]\n问题: ${args.question}`,
          },
        }];

      case 'document_analysis':
        return [{
          role: 'user',
          content: {
            type: 'text',
            text: `请分析以下文档内容:\n\n${args.document_content}`,
          },
        }];

      case 'emotional_memory':
        return [{
          role: 'user',
          content: {
            type: 'text',
            text: `回忆关于"${args.topic}"的相关记忆${args.time_range ? `，时间范围: ${args.time_range}` : ''}`,
          },
        }];

      default:
        return [];
    }
  }

  // === 采样请求 ===

  async createSamplingRequest(request: MCPSamplingRequest): Promise<{
    model: string;
    stopReason: 'endTurn' | 'stopSequence' | 'maxTokens';
    role: 'user' | 'assistant';
    content: { type: 'text'; text: string };
  }> {
    // 这里桥接到实际的LLM服务
    const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
    
    if (!DASHSCOPE_API_KEY) {
      return {
        model: 'mock',
        stopReason: 'endTurn',
        role: 'assistant',
        content: {
          type: 'text',
          text: 'AI服务未配置',
        },
      };
    }

    try {
      const messages = request.messages.map(m => ({
        role: m.role,
        content: m.content.text || '',
      }));

      if (request.systemPrompt) {
        messages.unshift({
          role: 'user' as const,
          content: `[System] ${request.systemPrompt}`,
        });
      }

      const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen-turbo',
          messages,
          max_tokens: request.maxTokens || 500,
          temperature: request.temperature || 0.7,
          stop: request.stopSequences,
        }),
      });

      if (!response.ok) {
        throw new Error(`LLM请求失败: ${response.status}`);
      }

      const data = await response.json();
      const choice = data.choices?.[0];

      return {
        model: data.model || 'qwen-turbo',
        stopReason: choice?.finish_reason === 'stop' ? 'endTurn' : 'maxTokens',
        role: 'assistant',
        content: {
          type: 'text',
          text: choice?.message?.content || '',
        },
      };

    } catch (error) {
      return {
        model: 'error',
        stopReason: 'endTurn',
        role: 'assistant',
        content: {
          type: 'text',
          text: `采样请求失败: ${error}`,
        },
      };
    }
  }

  // === 服务器信息 ===

  getServerInfo(): {
    name: string;
    version: string;
    capabilities: MCPServerCapabilities;
  } {
    return {
      name: 'xiaozhi-mcp-server',
      version: '1.0.0',
      capabilities: this.capabilities,
    };
  }

  getStats(): {
    resources: number;
    tools: number;
    prompts: number;
    cachedContents: number;
  } {
    return {
      resources: this.resources.size,
      tools: this.tools.size,
      prompts: this.prompts.size,
      cachedContents: this.resourceContents.size,
    };
  }

  // 同步Function Calling工具到MCP
  async syncToolsFromFunctionCalling(): Promise<number> {
    try {
      const { functionCallingService } = await import('./function-calling');
      const tools = functionCallingService.getToolsForOpenAI();
      
      let synced = 0;
      for (const tool of tools) {
        this.registerTool({
          name: tool.function.name,
          description: tool.function.description,
          inputSchema: tool.function.parameters,
        });
        synced++;
      }

      log(`同步了 ${synced} 个工具从 Function Calling`);
      return synced;
    } catch (error) {
      log(`工具同步失败: ${error}`);
      return 0;
    }
  }
}

export const mcpProtocolService = new MCPProtocolService();

// 自动同步工具
setTimeout(() => {
  mcpProtocolService.syncToolsFromFunctionCalling();
}, 1000);

logger.info('[MCP] MCP协议服务 v1.0 已加载 (Phase 10.2)');
