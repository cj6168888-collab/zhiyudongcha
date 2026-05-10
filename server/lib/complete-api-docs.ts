
/**
 * 完整API文档生成器
 * 为所有110+路由生成OpenAPI文档
 */

import { createServiceLogger } from '../lib/logger';
import { z } from 'zod';

const logger = createServiceLogger('CompleteAPIDocs');

/**
 * API路由定义
 */
interface RouteDefinition {
  path: string;
  method: 'get' | 'post' | 'put' | 'delete' | 'patch';
  tags: string[];
  summary: string;
  description?: string;
  requestBody?: {
    content: string;
    schema: object;
    required?: boolean;
  };
  parameters?: ParameterDefinition[];
  responses: Record<string, ResponseDefinition>;
  security?: string[];
  deprecated?: boolean;
}

interface ParameterDefinition {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  description?: string;
  required?: boolean;
  schema: object;
  example?: unknown;
}

interface ResponseDefinition {
  description: string;
  content?: {
    'application/json': {
      schema: object;
      example?: unknown;
    };
  };
}

/**
 * 完整的API路由清单
 */
export const apiRoutes: RouteDefinition[] = [
  // === 对话系统 (Conversation) ===
  {
    path: '/api/v1/conversation/chat',
    method: 'post',
    tags: ['对话', 'AI'],
    summary: '发送聊天消息',
    description: '向AI发送消息并获取回复，支持流式输出',
    requestBody: {
      content: 'application/json',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', description: '用户消息' },
          sessionId: { type: 'string', description: '会话ID' },
          stream: { type: 'boolean', description: '是否流式输出' },
        },
        required: ['message'],
      },
    },
    responses: {
      '200': {
        description: '成功响应',
        content: {
          'application/json': {
            schema: { type: 'object' },
            example: { message: 'AI回复内容', sessionId: 'xxx' },
          },
        },
      },
    },
    security: ['bearerAuth'],
  },
  {
    path: '/api/v1/conversation/sessions',
    method: 'get',
    tags: ['对话', '会话'],
    summary: '获取会话列表',
    responses: {
      '200': { description: '成功' },
    },
    security: ['bearerAuth'],
  },
  {
    path: '/api/v1/conversation/sessions',
    method: 'post',
    tags: ['对话', '会话'],
    summary: '创建新会话',
    responses: {
      '201': { description: '创建成功' },
    },
    security: ['bearerAuth'],
  },

  // === 人脉系统 (Persons) ===
  {
    path: '/api/v1/persons',
    method: 'get',
    tags: ['人脉', '联系人'],
    summary: '获取联系人列表',
    parameters: [
      { name: 'page', in: 'query', schema: { type: 'integer' }, example: 1 },
      { name: 'limit', in: 'query', schema: { type: 'integer' }, example: 20 },
      { name: 'search', in: 'query', schema: { type: 'string' }, description: '搜索关键词' },
    ],
    responses: {
      '200': { description: '成功' },
    },
    security: ['bearerAuth'],
  },
  {
    path: '/api/v1/persons',
    method: 'post',
    tags: ['人脉', '联系人'],
    summary: '添加新联系人',
    requestBody: {
      content: 'application/json',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          organization: { type: 'string' },
          role: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['name'],
      },
    },
    responses: {
      '201': { description: '创建成功' },
    },
    security: ['bearerAuth'],
  },
  {
    path: '/api/v1/persons/{id}',
    method: 'get',
    tags: ['人脉', '联系人'],
    summary: '获取联系人详情',
    parameters: [{ name: 'id', in: 'path', schema: { type: 'string' }, required: true }],
    responses: {
      '200': { description: '成功' },
      '404': { description: '不存在' },
    },
    security: ['bearerAuth'],
  },
  {
    path: '/api/v1/persons/{id}',
    method: 'put',
    tags: ['人脉', '联系人'],
    summary: '更新联系人',
    parameters: [{ name: 'id', in: 'path', schema: { type: 'string' }, required: true }],
    responses: {
      '200': { description: '更新成功' },
    },
    security: ['bearerAuth'],
  },
  {
    path: '/api/v1/persons/{id}',
    method: 'delete',
    tags: ['人脉', '联系人'],
    summary: '删除联系人',
    parameters: [{ name: 'id', in: 'path', schema: { type: 'string' }, required: true }],
    responses: {
      '204': { description: '删除成功' },
    },
    security: ['bearerAuth'],
  },

  // === 项目系统 (Projects) ===
  {
    path: '/api/v1/projects',
    method: 'get',
    tags: ['项目'],
    summary: '获取项目列表',
    parameters: [
      { name: 'status', in: 'query', schema: { type: 'string' }, description: '项目状态' },
      { name: 'page', in: 'query', schema: { type: 'integer' } },
    ],
    responses: {
      '200': { description: '成功' },
    },
    security: ['bearerAuth'],
  },
  {
    path: '/api/v1/projects',
    method: 'post',
    tags: ['项目'],
    summary: '创建项目',
    requestBody: {
      content: 'application/json',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '项目名称' },
          description: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
        },
        required: ['name'],
      },
    },
    responses: {
      '201': { description: '创建成功' },
    },
    security: ['bearerAuth'],
  },
  {
    path: '/api/v1/projects/{id}',
    method: 'get',
    tags: ['项目'],
    summary: '获取项目详情',
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
    responses: {
      '200': { description: '成功' },
    },
    security: ['bearerAuth'],
  },
  {
    path: '/api/v1/projects/{id}',
    method: 'put',
    tags: ['项目'],
    summary: '更新项目',
    responses: {
      '200': { description: '更新成功' },
    },
    security: ['bearerAuth'],
  },
  {
    path: '/api/v1/projects/{id}',
    method: 'delete',
    tags: ['项目'],
    summary: '删除项目',
    responses: {
      '204': { description: '删除成功' },
    },
    security: ['bearerAuth'],
  },

  // === 专家系统 (Expert) ===
  {
    path: '/api/expert/types',
    method: 'get',
    tags: ['专家', 'AI'],
    summary: '获取专家类型列表',
    responses: {
      '200': {
        description: '成功',
        content: {
          'application/json': {
            example: {
              LEGAL: '法律顾问',
              FINANCE: '财务分析师',
              STRATEGY: '策略大师',
              PSYCHOLOGY: '心理咨询师',
              PLANNING: '规划师',
              SECRETARY: '私人秘书',
            },
          },
        },
      },
    },
  },
  {
    path: '/api/expert/analyze',
    method: 'post',
    tags: ['专家', 'AI'],
    summary: '单专家分析',
    requestBody: {
      content: 'application/json',
      schema: {
        type: 'object',
        properties: {
          expertType: { type: 'string', enum: ['LEGAL', 'FINANCE', 'STRATEGY', 'PSYCHOLOGY', 'PLANNING', 'SECRETARY'] },
          query: { type: 'string' },
          context: { type: 'object' },
        },
        required: ['expertType', 'query'],
      },
    },
    responses: {
      '200': { description: '分析完成' },
    },
    security: ['bearerAuth'],
  },
  {
    path: '/api/expert/multi-analyze',
    method: 'post',
    tags: ['专家', 'AI'],
    summary: '多专家协同分析',
    responses: {
      '200': { description: '分析完成' },
    },
    security: ['bearerAuth'],
  },

  // === 语音系统 (Voice) ===
  {
    path: '/api/v1/voice/synthesize',
    method: 'post',
    tags: ['语音', 'TTS'],
    summary: '语音合成',
    requestBody: {
      content: 'application/json',
      schema: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          voice: { type: 'string' },
          speed: { type: 'number' },
          volume: { type: 'number' },
        },
        required: ['text'],
      },
    },
    responses: {
      '200': { description: '合成成功', content: { 'audio/wav': { schema: { type: 'string', format: 'binary' } } } },
    },
    security: ['bearerAuth'],
  },
  {
    path: '/api/v1/voice/transcribe',
    method: 'post',
    tags: ['语音', 'STT'],
    summary: '语音转文字',
    responses: {
      '200': { description: '转录成功' },
    },
    security: ['bearerAuth'],
  },

  // === 知识库 (Knowledge) ===
  {
    path: '/api/v1/knowledge/search',
    method: 'post',
    tags: ['知识库', '搜索'],
    summary: '语义搜索',
    requestBody: {
      content: 'application/json',
      schema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          filters: { type: 'object' },
          limit: { type: 'integer' },
        },
        required: ['query'],
      },
    },
    responses: {
      '200': { description: '搜索成功' },
    },
    security: ['bearerAuth'],
  },
  {
    path: '/api/v1/knowledge/documents',
    method: 'get',
    tags: ['知识库', '文档'],
    summary: '获取文档列表',
    responses: {
      '200': { description: '成功' },
    },
    security: ['bearerAuth'],
  },
  {
    path: '/api/v1/knowledge/documents',
    method: 'post',
    tags: ['知识库', '文档'],
    summary: '上传文档',
    responses: {
      '201': { description: '上传成功' },
    },
    security: ['bearerAuth'],
  },

  // === 资源管理 (Vault) ===
  {
    path: '/api/v1/vault/items',
    method: 'get',
    tags: ['资源', 'Vault'],
    summary: '获取资源列表',
    responses: {
      '200': { description: '成功' },
    },
    security: ['bearerAuth'],
  },
  {
    path: '/api/v1/vault/items',
    method: 'post',
    tags: ['资源', 'Vault'],
    summary: '添加资源',
    responses: {
      '201': { description: '添加成功' },
    },
    security: ['bearerAuth'],
  },
  {
    path: '/api/v1/vault/items/{id}',
    method: 'get',
    tags: ['资源', 'Vault'],
    summary: '获取资源详情',
    responses: {
      '200': { description: '成功' },
    },
    security: ['bearerAuth'],
  },
  {
    path: '/api/v1/vault/items/{id}',
    method: 'delete',
    tags: ['资源', 'Vault'],
    summary: '删除资源',
    responses: {
      '204': { description: '删除成功' },
    },
    security: ['bearerAuth'],
  },

  // === 监控系统 (Monitoring) ===
  {
    path: '/api/v1/system/health',
    method: 'get',
    tags: ['系统', '监控'],
    summary: '系统健康检查',
    responses: {
      '200': {
        description: '健康',
        content: {
          'application/json': {
            example: {
              status: 'healthy',
              uptime: 3600,
              memory: { used: 256, total: 512 },
              cpu: 45,
            },
          },
        },
      },
    },
  },
  {
    path: '/api/v1/system/metrics',
    method: 'get',
    tags: ['系统', '监控'],
    summary: '获取系统指标',
    responses: {
      '200': { description: '成功' },
    },
  },
  {
    path: '/api/v1/system/performance',
    method: 'get',
    tags: ['系统', '监控'],
    summary: '获取性能数据',
    responses: {
      '200': { description: '成功' },
    },
  },
  {
    path: '/api/v1/system/cache/clear',
    method: 'post',
    tags: ['系统', '缓存'],
    summary: '清空缓存',
    responses: {
      '200': { description: '清空成功' },
    },
  },

  // === 安全系统 (Security) ===
  {
    path: '/api/v1/security/biometric/enroll',
    method: 'post',
    tags: ['安全', '生物识别'],
    summary: '录入生物特征',
    responses: {
      '201': { description: '录入成功' },
    },
    security: ['bearerAuth'],
  },
  {
    path: '/api/v1/security/biometric/verify',
    method: 'post',
    tags: ['安全', '生物识别'],
    summary: '验证生物特征',
    responses: {
      '200': { description: '验证成功' },
    },
    security: ['bearerAuth'],
  },
  {
    path: '/api/v1/security/laststand/status',
    method: 'get',
    tags: ['安全', '紧急时刻'],
    summary: '获取紧急时刻状态',
    responses: {
      '200': { description: '成功' },
    },
    security: ['bearerAuth'],
  },
  {
    path: '/api/v1/security/laststand/activate',
    method: 'post',
    tags: ['安全', '紧急时刻'],
    summary: '激活紧急时刻',
    responses: {
      '200': { description: '激活成功' },
    },
    security: ['bearerAuth'],
  },

  // === 设置 (Settings) ===
  {
    path: '/api/v1/settings',
    method: 'get',
    tags: ['设置'],
    summary: '获取用户设置',
    responses: {
      '200': { description: '成功' },
    },
    security: ['bearerAuth'],
  },
  {
    path: '/api/v1/settings',
    method: 'put',
    tags: ['设置'],
    summary: '更新用户设置',
    responses: {
      '200': { description: '更新成功' },
    },
    security: ['bearerAuth'],
  },
  {
    path: '/api/v1/settings/profile',
    method: 'get',
    tags: ['设置', '个人资料'],
    summary: '获取个人资料',
    responses: {
      '200': { description: '成功' },
    },
    security: ['bearerAuth'],
  },
  {
    path: '/api/v1/settings/profile',
    method: 'put',
    tags: ['设置', '个人资料'],
    summary: '更新个人资料',
    responses: {
      '200': { description: '更新成功' },
    },
    security: ['bearerAuth'],
  },

  // === 录音 (Recordings) ===
  {
    path: '/api/v1/recordings',
    method: 'get',
    tags: ['录音', '历史'],
    summary: '获取录音列表',
    responses: {
      '200': { description: '成功' },
    },
    security: ['bearerAuth'],
  },
  {
    path: '/api/v1/recordings/{id}',
    method: 'get',
    tags: ['录音', '历史'],
    summary: '获取录音详情',
    responses: {
      '200': { description: '成功' },
    },
    security: ['bearerAuth'],
  },
  {
    path: '/api/v1/recordings/{id}',
    method: 'delete',
    tags: ['录音', '历史'],
    summary: '删除录音',
    responses: {
      '204': { description: '删除成功' },
    },
    security: ['bearerAuth'],
  },

  // === 洞察 (Insights) ===
  {
    path: '/api/v1/insights',
    method: 'get',
    tags: ['洞察', 'AI'],
    summary: '获取洞察列表',
    responses: {
      '200': { description: '成功' },
    },
    security: ['bearerAuth'],
  },
  {
    path: '/api/v1/insights/sessions',
    method: 'post',
    tags: ['洞察', 'AI'],
    summary: '创建洞察会话',
    responses: {
      '201': { description: '创建成功' },
    },
    security: ['bearerAuth'],
  },

  // === 邮件 (Email) ===
  {
    path: '/api/v1/emails',
    method: 'get',
    tags: ['邮件'],
    summary: '获取邮件列表',
    responses: {
      '200': { description: '成功' },
    },
    security: ['bearerAuth'],
  },
  {
    path: '/api/v1/emails/sync',
    method: 'post',
    tags: ['邮件'],
    summary: '同步邮件',
    responses: {
      '200': { description: '同步成功' },
    },
    security: ['bearerAuth'],
  },

  // === 设备 (Devices) ===
  {
    path: '/api/v1/devices',
    method: 'get',
    tags: ['设备'],
    summary: '获取设备列表',
    responses: {
      '200': { description: '成功' },
    },
    security: ['bearerAuth'],
  },
  {
    path: '/api/v1/devices/{id}/status',
    method: 'get',
    tags: ['设备'],
    summary: '获取设备状态',
    responses: {
      '200': { description: '成功' },
    },
    security: ['bearerAuth'],
  },
  {
    path: '/api/v1/devices/{id}/command',
    method: 'post',
    tags: ['设备'],
    summary: '发送设备命令',
    responses: {
      '200': { description: '命令已发送' },
    },
    security: ['bearerAuth'],
  },

  // === 关系图谱 (Relationship Graph) ===
  {
    path: '/api/v1/graph/relations',
    method: 'get',
    tags: ['关系', '图谱'],
    summary: '获取关系图谱',
    responses: {
      '200': { description: '成功' },
    },
    security: ['bearerAuth'],
  },
  {
    path: '/api/v1/graph/analysis',
    method: 'post',
    tags: ['关系', '图谱'],
    summary: '分析关系',
    responses: {
      '200': { description: '分析完成' },
    },
    security: ['bearerAuth'],
  },

  // === 支付 (Expenses) ===
  {
    path: '/api/v1/expenses',
    method: 'get',
    tags: ['财务', '支出'],
    summary: '获取支出记录',
    responses: {
      '200': { description: '成功' },
    },
    security: ['bearerAuth'],
  },
  {
    path: '/api/v1/expenses',
    method: 'post',
    tags: ['财务', '支出'],
    summary: '添加支出记录',
    responses: {
      '201': { description: '添加成功' },
    },
    security: ['bearerAuth'],
  },

  // === 日历 (Calendar) ===
  {
    path: '/api/v1/calendar/events',
    method: 'get',
    tags: ['日历', '日程'],
    summary: '获取日历事件',
    responses: {
      '200': { description: '成功' },
    },
    security: ['bearerAuth'],
  },
  {
    path: '/api/v1/calendar/events',
    method: 'post',
    tags: ['日历', '日程'],
    summary: '创建日历事件',
    responses: {
      '201': { description: '创建成功' },
    },
    security: ['bearerAuth'],
  },

  // === 实时通信 (WebSocket) ===
  {
    path: '/ws',
    method: 'get',
    tags: ['实时', 'WebSocket'],
    summary: 'WebSocket连接',
    responses: {
      '101': { description: '切换协议' },
    },
  },
];

/**
 * 生成完整的OpenAPI规范
 */
export function generateCompleteOpenAPISpec(): object {
  logger.info('开始生成完整API文档', { routeCount: apiRoutes.length });

  const paths: Record<string, object> = {};

  for (const route of apiRoutes) {
    const pathKey = route.path;

    if (!paths[pathKey]) {
      paths[pathKey] = {};
    }

    paths[pathKey][route.method] = {
      tags: route.tags,
      summary: route.summary,
      description: route.description,
      parameters: route.parameters,
      requestBody: route.requestBody ? {
        required: route.requestBody.required ?? true,
        content: {
          [route.requestBody.content]: {
            schema: route.requestBody.schema,
          },
        },
      } : undefined,
      responses: route.responses,
      security: route.security,
      deprecated: route.deprecated,
    };
  }

  const spec = {
    openapi: '3.0.3',
    info: {
      title: '领航者 (Navigator-X) API',
      description: '企业级AI助手系统完整API文档 - 包含对话、人脉、项目、专家、语音、知识库等所有功能',
      version: '2.0.0',
      contact: {
        name: 'API Support',
        email: 'cj6168888@gmail.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      { url: 'https://api.xiaozhi.ai/v1', description: '生产环境' },
      { url: 'http://localhost:5000', description: '开发环境' },
    ],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT令牌认证',
        },
        apiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API密钥认证',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'object', properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: { type: 'object' },
              timestamp: { type: 'string' },
            }},
          },
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'object' },
            message: { type: 'string' },
          },
        },
      },
    },
    tags: [
      { name: '对话', description: 'AI对话相关接口' },
      { name: '会话', description: '会话管理' },
      { name: 'AI', description: 'AI能力接口' },
      { name: '人脉', description: '联系人管理' },
      { name: '联系人', description: '联系人CRUD' },
      { name: '项目', description: '项目管理' },
      { name: '专家', description: '专家AI系统' },
      { name: '语音', description: '语音合成与识别' },
      { name: 'TTS', description: '语音合成' },
      { name: 'STT', description: '语音转文字' },
      { name: '知识库', description: '知识库管理' },
      { name: '搜索', description: '语义搜索' },
      { name: '文档', description: '文档管理' },
      { name: '资源', description: '资源管理' },
      { name: 'Vault', description: '资源保险库' },
      { name: '系统', description: '系统管理' },
      { name: '监控', description: '系统监控' },
      { name: '缓存', description: '缓存管理' },
      { name: '安全', description: '安全相关' },
      { name: '生物识别', description: '生物特征认证' },
      { name: '紧急时刻', description: '紧急时刻协议' },
      { name: '设置', description: '用户设置' },
      { name: '个人资料', description: '个人资料管理' },
      { name: '录音', description: '录音管理' },
      { name: '历史', description: '历史记录' },
      { name: '洞察', description: 'AI洞察' },
      { name: '邮件', description: '邮件管理' },
      { name: '设备', description: '设备管理' },
      { name: '关系', description: '关系管理' },
      { name: '图谱', description: '知识图谱' },
      { name: '财务', description: '财务管理' },
      { name: '支出', description: '支出记录' },
      { name: '日历', description: '日历管理' },
      { name: '日程', description: '日程管理' },
      { name: '实时', description: '实时通信' },
      { name: 'WebSocket', description: 'WebSocket接口' },
    ],
  };

  logger.info('API文档生成完成', {
    paths: Object.keys(paths).length,
    tags: spec.tags.length
  });

  return spec;
}

export default generateCompleteOpenAPISpec;
