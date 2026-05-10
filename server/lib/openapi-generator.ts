import { createServiceLogger } from '../lib/logger';
import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../lib/di-container';
import { createValidationMiddleware } from '../middleware/input-validation';
import { createUserSchema, updateUserSchema, paginationSchema, searchQuerySchema, idSchema } from '../middleware/input-validation';

const logger = createServiceLogger('APIDocumentation');

/**
 * OpenAPI 类型定义
 */
interface OpenAPIParameter {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  required?: boolean;
  description?: string;
  schema?: unknown;
}

interface OpenAPIRequestBody {
  required?: boolean;
  content: Record<string, { schema: unknown }>;
  description?: string;
}

interface OpenAPIResponse {
  description: string;
  content?: Record<string, { schema: unknown }>;
}

interface OpenAPISecurity {
  type: string;
  scheme?: string;
  bearerFormat?: string;
  name?: string;
  in?: string;
  description?: string;
}

interface OpenAPITag {
  name: string;
  description: string;
}

interface OpenAPISpec {
  openapi: string;
  info: Record<string, unknown>;
  servers?: unknown[];
  paths: Record<string, unknown>;
  components: Record<string, unknown>;
  schemas: Record<string, unknown>;
  security: Record<string, OpenAPISecurity>[];
  tags: unknown[];
}

/**
 * API标签枚举
 */
export enum ApiTag {
  USERS = 'users',
  AUTH = 'authentication',
  PROJECTS = 'projects',
  FILES = 'files',
  HEALTH = 'health',
  SYSTEM = 'system',
  MONITORING = 'monitoring',
  CACHE = 'cache'
}

/**
 * 安全方案枚举
 */
export enum SecurityScheme {
  BEARER_AUTH = 'bearerAuth',
  API_KEY_AUTH = 'apiKeyAuth',
  BASIC_AUTH = 'basicAuth'
}

/**
 * API响应包装器
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 分页响应
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
  hasPrev: boolean;
  };
}

/**
 * 错误响应
 */
export interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  code?: string;
  details?: Record<string, unknown>;
  timestamp: string;
  requestId?: string;
}

/**
 * OpenAPI规范生成器
 */
export class OpenAPIGenerator {
  private version: string;
  private title: string;
  private description: string;
  private servers: ServerConfig[];
  private paths: Record<string, PathItem>;
  private components: Components;
  private schemas: Record<string, Schema>;

  constructor() {
    this.version = '1.0.0';
    this.title = '小智AI Assistant API';
    this.description = '企业级AI助手系统API接口文档';
    this.servers = [
      {
        url: 'https://api.example.com/v1',
        description: '生产环境API服务'
      },
      {
        url: 'https://dev-api.example.com/v1',
        description: '开发环境API服务'
      }
    ];
    this.paths = {};
    this.components = {};
    this.schemas = {};
  }

  /**
   * 生成完整的OpenAPI规范
   */
  public generate(): OpenAPISpec {
    logger.info('开始生成OpenAPI规范');

    const openapi = {
      openapi: '3.0.0',
      info: {
        title: this.title,
        description: this.description,
        version: this.version,
        contact: {
          name: 'API Support',
          email: 'support@example.com',
          url: 'https://example.com/support'
        },
        license: {
          name: 'MIT',
          url: 'https://example.com/license'
        }
      },
      servers: this.servers,
      paths: this.paths,
      components: this.components,
      schemas: this.schemas,
      security: this.generateSecuritySchemes(),
      tags: this.generateTags()
    };

    logger.info('OpenAPI规范生成完成', {
      pathsCount: Object.keys(this.paths).length,
      schemasCount: Object.keys(this.schemas).length,
      componentsCount: Object.keys(this.components).length
    });

    return openapi;
  }

  /**
   * 添加路径
   */
  public addPath(
    method: 'get' | 'post' | 'put' | 'delete' | 'patch',
    path: string,
    tags: ApiTag[],
    summary: string,
    description: string,
    parameters?: OpenAPIParameter[],
    requestBody?: OpenAPIRequestBody,
    responses?: Record<string, OpenAPIResponse>,
    security?: Record<string, string[]>[]
  ): void {
    const pathKey = this.normalizePath(path);
    
    if (!this.paths[pathKey]) {
      this.paths[pathKey] = {};
    }

    const operation = {
      tags,
      summary,
      description,
      parameters: parameters || [],
      responses: responses || this.generateDefaultResponses(),
      security: security || []
    };

    this.paths[pathKey][method.toLowerCase()] = operation;
  }

  /**
   * 添加用户相关路径
   */
  public addUserPaths(): void {
    // POST /users - 创建用户
    this.addPath('post', '/users', [ApiTag.USERS], '创建用户', '创建新的用户账号', [
      {
        name: 'body',
        in: 'body',
        required: true,
        schema: { $ref: '#/components/schemas/CreateUserRequest' },
        description: '用户创建请求体'
      }
    ], {
      '201': {
        description: '用户创建成功',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/UserResponse' }
          }
        }
      },
      '400': {
        description: '输入验证失败',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' }
          }
        }
      },
      '409': {
        description: '用户已存在',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' }
          }
        }
      }
    });

    // GET /users - 获取用户列表
    this.addPath('get', '/users', [ApiTag.USERS], '获取用户列表', '获取系统中的用户列表（分页）', [
      {
        name: 'page',
        in: 'query',
        schema: paginationSchema.shape.page,
        description: '页码'
      },
      {
        name: 'limit',
        in: 'query',
        schema: paginationSchema.shape.limit,
        description: '每页数量'
      }
    ], {
      '200': {
        description: '获取成功',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/UserListResponse' }
          }
        }
      }
    });

    // GET /users/{id} - 获取单个用户
    this.addPath('get', '/users/{id}', [ApiTag.USERS], '获取用户详情', '根据ID获取特定用户信息', [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: idSchema,
        description: '用户ID'
      }
    ], {
      '200': {
        description: '获取成功',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/UserResponse' }
          }
        }
      },
      '404': {
        description: '用户不存在',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' }
          }
        }
      }
    });

    // PUT /users/{id} - 更新用户
    this.addPath('put', '/users/{id}', [ApiTag.USERS], '更新用户信息', '更新指定用户的信息', [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: idSchema,
        description: '用户ID'
      },
      {
        name: 'body',
        in: 'body',
        required: true,
        schema: { $ref: '#/components/schemas/UpdateUserRequest' },
        description: '用户更新信息'
      }
    ], {
      '200': {
        description: '更新成功',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/UserResponse' }
          }
        }
      },
      '400': {
        description: '输入验证失败',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' }
          }
        }
      },
      '404': {
        description: '用户不存在',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' }
          }
        }
      }
    });

    // DELETE /users/{id} - 删除用户
    this.addPath('delete', '/users/{id}', [ApiTag.USERS], '删除用户', '删除指定的用户', [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: idSchema,
        description: '用户ID'
      }
    ], {
      '200': {
        description: '删除成功',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/SuccessResponse' }
          }
        }
      },
      '404': {
        description: '用户不存在',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' }
          }
        }
      }
    });
  }

  /**
   * 添加项目相关路径
   */
  public addProjectPaths(): void {
    // POST /projects - 创建项目
    this.addPath('post', '/projects', [ApiTag.PROJECTS], '创建项目', '创建新的项目', [
      {
        name: 'body',
        in: 'body',
        required: true,
        schema: { $ref: '#/components/schemas/CreateProjectRequest' },
        description: '项目创建请求体'
      }
    ], {
      '201': {
        description: '项目创建成功',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ProjectResponse' }
          }
        }
      }
    });

    // GET /projects - 获取项目列表
    this.addPath('get', '/projects', [ApiTag.PROJECTS], '获取项目列表', '获取系统中的项目列表', [
      {
        name: 'page',
        in: 'query',
        schema: paginationSchema.shape.page,
        description: '页码'
      },
      {
        name: 'limit',
        in: 'query',
        schema: paginationSchema.shape.limit,
        description: '每页数量'
      }
    ], {
      '200': {
        description: '获取成功',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ProjectListResponse' }
          }
        }
      }
    });

    // 添加认证相关路径
    this.addAuthPaths();
    
    // 添加系统健康检查路径
    this.addHealthPaths();
  }

  /**
   * 添加认证路径
   */
  private addAuthPaths(): void {
    // POST /auth/login - 用户登录
    this.addPath('post', '/auth/login', [ApiTag.AUTH], '用户登录', '用户身份验证', [
      {
        name: 'body',
        in: 'body',
        required: true,
        schema: {
          type: 'object',
          properties: {
            username: {
              type: 'string',
              description: '用户名'
            },
            password: {
              type: 'string',
              format: 'password',
              description: '密码'
            }
          },
          required: ['username', 'password']
        },
        description: '登录凭据'
      }
    ], {
      '200': {
        description: '登录成功',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/AuthResponse' }
          }
        }
      },
      '401': {
        description: '认证失败',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' }
          }
        }
      }
    });

    // POST /auth/refresh - 刷新令牌
    this.addPath('post', '/auth/refresh', [ApiTag.AUTH], '刷新令牌', '刷新访问令牌', [
      {
        name: 'body',
        in: 'body',
        required: true,
        schema: {
          type: 'object',
          properties: {
            refresh_token: {
              type: 'string',
              description: '刷新令牌'
            }
          },
          required: ['refresh_token']
        },
        description: '刷新令牌请求'
      }
    ], {
      '200': {
        description: '令牌刷新成功',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/AuthResponse' }
          }
        }
      },
      '401': {
        description: '令牌无效',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' }
          }
        }
      }
    });
  }

  /**
   * 添加健康检查路径
   */
  private addHealthPaths(): void {
    // GET /health - 系统健康检查
    this.addPath('get', '/health', [ApiTag.HEALTH], '系统健康检查', '检查系统运行状态', [
      {
        name: 'detailed',
        in: 'query',
        schema: {
          type: 'boolean',
          description: '是否返回详细健康信息'
        }
      }
    ], {
      '200': {
        description: '健康检查成功',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/HealthResponse' }
          }
        }
      }
    });

    // GET /health/cache - 缓存状态
    this.addPath('get', '/health/cache', [ApiTag.HEALTH, ApiTag.CACHE], '缓存状态检查', '检查缓存系统运行状态', undefined, {
      '200': {
        description: '缓存状态获取成功',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/CacheHealthResponse' }
          }
        }
      }
    });

    // GET /health/database - 数据库状态
    this.addPath('get', '/health/database', [ApiTag.HEALTH], '数据库状态检查', '检查数据库连接状态', undefined, {
      '200': {
        description: '数据库状态获取成功',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/DatabaseHealthResponse' }
          }
        }
      }
    });
  }

  /**
   * 标准化路径
   */
  private normalizePath(path: string): string {
    return path.startsWith('/') ? path : `/${path}`;
  }

  /**
   * 生成默认响应
   */
  private generateDefaultResponses(): Record<string, OpenAPIResponse> {
    return {
      '200': {
        description: '请求成功',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApiResponse' }
          }
        }
      },
      '400': {
        description: '请求参数错误',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' }
          }
        }
      },
      '401': {
        description: '未授权访问',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' }
          }
        }
      },
      '403': {
        description: '权限不足',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' }
          }
        }
      },
      '404': {
        description: '资源不存在',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' }
          }
        }
      },
      '500': {
        description: '服务器内部错误',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' }
          }
        }
      }
    };
  }

  /**
   * 生成安全方案
   */
  private generateSecuritySchemes(): Record<string, OpenAPISecurity> {
    return {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT Bearer认证'
      },
      apiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API密钥认证'
      }
    };
  }

  /**
   * 生成标签
   */
  private generateTags(): OpenAPITag[] {
    return [
      {
        name: ApiTag.USERS,
        description: '用户管理相关接口'
      },
      {
        name: ApiTag.AUTH,
        description: '身份验证相关接口'
      },
      {
        name: ApiTag.PROJECTS,
        description: '项目管理相关接口'
      },
      {
        name: ApiTag.HEALTH,
        description: '系统健康检查接口'
      }
    ];
  }

  /**
   * 生成组件模式
   */
  public generateSchemas(): void {
    // 用户相关模式
    this.schemas['CreateUserRequest'] = {
      type: 'object',
      properties: {
        username: {
          type: 'string',
          description: '用户名',
          minLength: 2,
          maxLength: 50,
          pattern: '^[a-zA-Z0-9_]+$',
          example: 'john_doe'
        },
        email: {
          type: 'string',
          format: 'email',
          description: '邮箱地址',
          example: 'john@example.com'
        },
        password: {
          type: 'string',
          format: 'password',
          description: '密码（8-128字符）',
          minLength: 8,
          maxLength: 128,
          example: 'SecurePass123!'
        },
        full_name: {
          type: 'string',
          description: '用户姓名',
          maxLength: 100,
          example: 'John Doe'
        },
        phone: {
          type: 'string',
          description: '电话号码',
          pattern: '^\\+?[\\d\\s-()]+$',
          example: '+1234567890'
        }
      },
      required: ['username', 'email', 'password']
    };

    this.schemas['UpdateUserRequest'] = {
      type: 'object',
      properties: {
        username: {
          type: 'string',
          description: '用户名',
          minLength: 2,
          maxLength: 50
        },
        email: {
          type: 'string',
          format: 'email',
          description: '邮箱地址'
        },
        full_name: {
          type: 'string',
          description: '用户姓名',
          maxLength: 100
        },
        phone: {
          type: 'string',
          description: '电话号码',
          pattern: '^\\+?[\\d\\s-()]+$'
        }
      }
    };

    this.schemas['UserResponse'] = {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          format: 'uuid',
          description: '用户唯一标识',
          example: '550e8400-e29b-41d4-a716-446655440000'
        },
        username: {
          type: 'string',
          description: '用户名',
          example: 'john_doe'
        },
        email: {
          type: 'string',
          format: 'email',
          description: '邮箱地址',
          example: 'john@example.com'
        },
        full_name: {
          type: 'string',
          description: '用户姓名',
          example: 'John Doe'
        },
        phone: {
          type: 'string',
          description: '电话号码',
          example: '+1234567890'
        },
        created_at: {
          type: 'string',
          format: 'date-time',
          description: '创建时间',
          example: '2024-01-01T00:00:00Z'
        },
        updated_at: {
          type: 'string',
          format: 'date-time',
          description: '更新时间',
          example: '2024-01-01T00:00:00Z'
        }
      }
    };

    this.schemas['UserListResponse'] = {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/UserResponse' },
          description: '用户列表'
        },
        pagination: {
          $ref: '#/components/schemas/Pagination'
        }
      }
    };

    this.schemas['ProjectResponse'] = {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          format: 'uuid',
          description: '项目唯一标识',
          example: '550e8400-e29b-41d4-a716-446655440001'
        },
        name: {
          type: 'string',
          description: '项目名称',
          example: 'AI Assistant Platform'
        },
        description: {
          type: 'string',
          description: '项目描述',
          example: '企业级AI助手系统平台'
        },
        status: {
          type: 'string',
          enum: ['planning', 'active', 'completed', 'archived'],
          description: '项目状态',
          example: 'active'
        },
        created_at: {
          type: 'string',
          format: 'date-time',
          description: '创建时间',
          example: '2024-01-01T00:00:00Z'
        },
        updated_at: {
          type: 'string',
          format: 'date-time',
          description: '更新时间',
          example: '2024-01-01T00:00:00Z'
        }
      }
    };

    this.schemas['ProjectListResponse'] = {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/ProjectResponse' },
          description: '项目列表'
        },
        pagination: {
          $ref: '#/components/schemas/Pagination'
        }
      }
    };

    // 通用响应模式
    this.schemas['ApiResponse'] = {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description: '请求是否成功',
          example: true
        },
        data: {
          description: '响应数据',
          example: null
        },
        message: {
          type: 'string',
          description: '响应消息',
          example: '操作成功'
        }
      }
    };

    this.schemas['ErrorResponse'] = {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          example: false,
          description: '请求是否成功'
        },
        error: {
          type: 'string',
          description: '错误类型',
          example: 'VALIDATION_ERROR'
        },
        message: {
          type: 'string',
          description: '错误描述',
          example: '输入验证失败'
        },
        details: {
          type: 'object',
          description: '错误详情',
          example: null
        },
        timestamp: {
          type: 'string',
          format: 'date-time',
          description: '错误时间',
          example: '2024-01-01T00:00:00Z'
        },
        requestId: {
          type: 'string',
          description: '请求ID',
          example: 'req_550e8400-e29b-41d4-a716'
        }
      },
      required: ['success', 'error', 'message', 'timestamp']
    };

    this.schemas['Pagination'] = {
      type: 'object',
      properties: {
        page: {
          type: 'integer',
          minimum: 1,
          description: '当前页码',
          example: 1
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          description: '每页记录数',
          example: 20
        },
        total: {
          type: 'integer',
          minimum: 0,
          description: '总记录数',
          example: 150
        },
        totalPages: {
          type: 'integer',
          minimum: 0,
          description: '总页数',
          example: 8
        },
        hasNext: {
          type: 'boolean',
          description: '是否有下一页',
          example: true
        },
        hasPrev: {
          type: 'boolean',
          description: '是否有上一页',
          example: false
        }
      },
      required: ['page', 'limit', 'total']
    };

    // 认证响应模式
    this.schemas['AuthResponse'] = {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: '访问令牌',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIx...'
        },
        refresh_token: {
          type: 'string',
          description: '刷新令牌',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIx...'
        },
        expires_in: {
          type: 'integer',
          description: '令牌过期时间（秒）',
          example: 3600
        },
        token_type: {
          type: 'string',
          description: '令牌类型',
          example: 'Bearer'
        },
        user: {
          $ref: '#/components/schemas/UserResponse'
        }
      },
      required: ['token']
    };

    // 健康检查响应模式
    this.schemas['HealthResponse'] = {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['healthy', 'degraded', 'unhealthy'],
          description: '系统状态',
          example: 'healthy'
        },
        timestamp: {
          type: 'string',
          format: 'date-time',
          description: '检查时间',
          example: '2024-01-01T00:00:00Z'
        },
        version: {
          type: 'string',
          description: '系统版本',
          example: '1.0.0'
        },
        uptime: {
          type: 'string',
          description: '系统运行时间',
          example: '72:30:45'
        },
        services: {
          type: 'object',
          description: '服务状态',
          properties: {
            database: {
              type: 'string',
              description: '数据库状态',
              example: 'healthy'
            },
            cache: {
              type: 'string',
              description: '缓存状态',
              example: 'healthy'
            }
          }
        }
      }
    };
  }
}

/**
 * 创建OpenAPI生成器实例
 */
export function createOpenAPIGenerator(): OpenAPIGenerator {
  return new OpenAPIGenerator();
}

/**
 * 全局OpenAPI生成器实例
 */
export const openAPIGenerator = createOpenAPIGenerator();
