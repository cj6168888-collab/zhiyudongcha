import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ApiResponse, PaginatedResponse, PaginationParams } from '../types/common';
import { createServiceLogger } from '../lib/logger';
import { validateRequest, validationErrorHandler } from '../middleware/validation';

const logger = createServiceLogger('RouteGenerator');

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

// JSON Schema 类型定义
interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  [key: string]: unknown;
}

// OpenAPI 类型定义
interface OpenApiPath {
  [method: string]: OpenApiOperation;
}

interface OpenApiOperation {
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: OpenApiParameter[];
  requestBody?: OpenApiRequestBody;
  responses?: Record<string, OpenApiResponse>;
  security?: Array<Record<string, string[]>>;
  deprecated?: boolean;
}

interface OpenApiParameter {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  required?: boolean;
  schema?: z.ZodSchema;
  description?: string;
}

interface OpenApiRequestBody {
  required?: boolean;
  content: Record<string, { schema: z.ZodSchema }>;
}

interface OpenApiResponse {
  description: string;
  content?: Record<string, { schema: z.ZodSchema }>;
}

// 路由配置接口
interface RouteConfig<TBody = unknown, TQuery = Record<string, unknown>, TParams = Record<string, string>, TResponse = unknown> {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  description?: string;
  tags?: string[];
  
  // 验证配置
  validation?: {
    body?: z.ZodSchema<TBody>;
    query?: z.ZodSchema<TQuery>;
    params?: z.ZodSchema<TParams>;
  };
  
  // 处理函数
  handler: (req: TypedRequest<TBody, TQuery, TParams>, res: Response) => Promise<TResponse>;
  
  // 中间件
  middleware?: Array<(req: Request, res: Response, next: NextFunction) => void>;
  
  // 权限控制
  permissions?: string[];
  auth?: boolean;
  
  // 响应模式
  responseSchema?: z.ZodSchema<TResponse>;
  
  // 文档
  summary?: string;
  deprecated?: boolean;
}

// 类型化的请求接口
interface TypedRequest<TBody = unknown, TQuery = Record<string, unknown>, TParams = Record<string, string>> extends Request {
  body: TBody;
  query: TQuery;
  params: TParams;
}

// API文档生成器
class ApiDocGenerator {
  private routes: Array<RouteConfig & { prefix?: string }> = [];
  
  addRoute(config: RouteConfig, prefix?: string): void {
    this.routes.push({ ...config, prefix });
  }
  
  generateOpenApi(): { openapi: string; paths: Record<string, OpenApiPath>; components?: JsonObject } {
    const paths: Record<string, OpenApiPath> = {};
    
    for (const route of this.routes) {
      const fullPath = `${route.prefix || ''}${route.path}`;
      const method = route.method.toLowerCase();
      
      if (!paths[fullPath]) {
        paths[fullPath] = {};
      }
      
      paths[fullPath][method] = {
        summary: route.summary || route.description,
        description: route.description,
        tags: route.tags,
        parameters: this.generateParameters(route),
        requestBody: this.generateRequestBody(route),
        responses: this.generateResponses(route),
        security: route.auth ? [{ bearerAuth: [] }] : undefined,
        deprecated: route.deprecated,
      };
    }
    
    return {
      openapi: '3.0.0',
      info: {
        title: '小智AI助手 API',
        version: '1.0.0',
        description: '小智AI助手的RESTful API文档',
      },
      paths,
      components: {
        schemas: this.generateSchemas(),
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    };
  }
  
  private generateParameters(route: RouteConfig): OpenApiParameter[] {
    const parameters: OpenApiParameter[] = [];
    
    // 查询参数
    if (route.validation?.query) {
      const schema = route.validation.query;
      if (schema instanceof z.ZodObject) {
        for (const [key, fieldSchema] of Object.entries(schema.shape)) {
          parameters.push({
            name: key,
            in: 'query',
            required: !fieldSchema.isOptional(),
            schema: this.zodToJsonSchema(fieldSchema),
          });
        }
      }
    }
    
    // 路径参数
    if (route.validation?.params) {
      const schema = route.validation.params;
      if (schema instanceof z.ZodObject) {
        for (const [key, fieldSchema] of Object.entries(schema.shape)) {
          parameters.push({
            name: key,
            in: 'path',
            required: true,
            schema: this.zodToJsonSchema(fieldSchema),
          });
        }
      }
    }
    
    return parameters;
  }
  
  private generateRequestBody(route: RouteConfig): OpenApiRequestBody | undefined {
    if (!route.validation?.body) return undefined;
    
    return {
      required: true,
      content: {
        'application/json': {
          schema: this.zodToJsonSchema(route.validation.body),
        },
      },
    };
  }
  
  private generateResponses(route: RouteConfig): Record<string, OpenApiResponse> {
    const responses: Record<string, OpenApiResponse> = {
      200: {
        description: '成功响应',
        content: {
          'application/json': {
            schema: this.zodToJsonSchema(
              route.responseSchema || ApiResponseSchema
            ),
          },
        },
      },
    };
    
    if (route.deprecated) {
      responses[301] = { description: '已弃用' };
    }
    
    return responses;
  }
  
  private generateSchemas(): Record<string, JsonSchema> {
    // 这里应该收集所有使用到的schema并生成
    // 简化实现
    return {};
  }
  
  private zodToJsonSchema(schema: z.ZodSchema): JsonSchema {
    // 简化实现，实际应该完整支持zod到JSON Schema的转换
    if (schema instanceof z.ZodString) {
      return { type: 'string' };
    }
    if (schema instanceof z.ZodNumber) {
      return { type: 'number' };
    }
    if (schema instanceof z.ZodBoolean) {
      return { type: 'boolean' };
    }
    if (schema instanceof z.ZodArray) {
      return {
        type: 'array',
        items: this.zodToJsonSchema(schema.element),
      };
    }
    if (schema instanceof z.ZodObject) {
      const properties: Record<string, JsonSchema> = {};
      const required: string[] = [];
      
      for (const [key, fieldSchema] of Object.entries(schema.shape)) {
        properties[key] = this.zodToJsonSchema(fieldSchema as z.ZodSchema);
        if (!fieldSchema.isOptional()) {
          required.push(key);
        }
      }
      
      return {
        type: 'object',
        properties,
        required,
      };
    }
    
    return { type: 'unknown' };
  }
}

// 路由生成器
class RouteGenerator {
  private router: Router;
  private docGenerator: ApiDocGenerator;
  private prefix: string;
  
  constructor(prefix = '') {
    this.router = Router();
    this.docGenerator = new ApiDocGenerator();
    this.prefix = prefix;
  }
  
  // 注册路由
  register<TBody = unknown, TQuery = Record<string, unknown>, TParams = Record<string, string>, TResponse = unknown>(
    config: RouteConfig<TBody, TQuery, TParams, TResponse>
  ): void {
    const {
      method,
      path,
      handler,
      validation,
      middleware = [],
      permissions,
      auth = true,
      responseSchema,
      tags = [],
      summary,
      description,
      deprecated = false,
    } = config;
    
    // 构建中间件链
    const middlewares: Array<(req: Request, res: Response, next: NextFunction) => void> = [
      ...middleware,
    ];
    
    // 添加验证中间件
    if (validation) {
      middlewares.push(...validateRequest(validation));
    }
    
    // 添加认证中间件
    if (auth) {
      middlewares.push(this.authMiddleware(permissions));
    }
    
    // 添加响应处理中间件
    middlewares.push(this.responseHandler(responseSchema));
    
    // 注册到Express路由
    this.router[method.toLowerCase()](
      path,
      ...middlewares,
      async (req: Request, res: Response, next: NextFunction) => {
        try {
          const result = await handler(req as TypedRequest<TBody, TQuery, TParams>, res);
          // responseHandler会处理响应
        } catch (error) {
          next(error);
        }
      }
    );
    
    // 添加到文档生成器
    this.docGenerator.addRoute({
      ...config,
      summary: summary || description,
      tags: tags.length > 0 ? tags : [this.prefix.replace('/', '') || 'default'],
      deprecated,
    }, this.prefix);
    
    // 记录路由注册
    logger.info('注册路由', {
      method,
      path: `${this.prefix}${path}`,
      auth,
      permissions,
      tags,
    });
  }
  
  // 批量注册路由
  registerBatch<TBody = unknown, TQuery = Record<string, unknown>, TParams = Record<string, string>, TResponse = unknown>(
    configs: RouteConfig<TBody, TQuery, TParams, TResponse>[]
  ): void {
    for (const config of configs) {
      this.register(config);
    }
  }
  
  // GET路由便捷方法
  get<TQuery = Record<string, unknown>, TParams = Record<string, string>, TResponse = unknown>(
    path: string,
    handler: (req: TypedRequest<undefined, TQuery, TParams>, res: Response) => Promise<TResponse>,
    options?: Omit<RouteConfig<undefined, TQuery, TParams, TResponse>, 'method' | 'path' | 'handler'>
  ): void {
    this.register({ ...options, method: 'GET', path, handler });
  }
  
  // POST路由便捷方法
  post<TBody = unknown, TQuery = Record<string, unknown>, TParams = Record<string, string>, TResponse = unknown>(
    path: string,
    handler: (req: TypedRequest<TBody, TQuery, TParams>, res: Response) => Promise<TResponse>,
    options?: Omit<RouteConfig<TBody, TQuery, TParams, TResponse>, 'method' | 'path' | 'handler'>
  ): void {
    this.register({ ...options, method: 'POST', path, handler });
  }
  
  // PUT路由便捷方法
  put<TBody = unknown, TQuery = Record<string, unknown>, TParams = Record<string, string>, TResponse = unknown>(
    path: string,
    handler: (req: TypedRequest<TBody, TQuery, TParams>, res: Response) => Promise<TResponse>,
    options?: Omit<RouteConfig<TBody, TQuery, TParams, TResponse>, 'method' | 'path' | 'handler'>
  ): void {
    this.register({ ...options, method: 'PUT', path, handler });
  }
  
  // DELETE路由便捷方法
  delete<TParams = Record<string, string>, TResponse = unknown>(
    path: string,
    handler: (req: TypedRequest<undefined, undefined, TParams>, res: Response) => Promise<TResponse>,
    options?: Omit<RouteConfig<undefined, undefined, TParams, TResponse>, 'method' | 'path' | 'handler'>
  ): void {
    this.register({ ...options, method: 'DELETE', path, handler });
  }
  
  // 资源路由（CRUD）
  resource<TBody = unknown, TQuery = Record<string, unknown>, TResponse = unknown>(
    basePath: string,
    options: {
      create?: (req: TypedRequest<TBody, undefined, undefined>, res: Response) => Promise<TResponse>;
      read?: (req: TypedRequest<undefined, TQuery, { id: string }>, res: Response) => Promise<TResponse>;
      list?: (req: TypedRequest<undefined, TQuery, undefined>, res: Response) => Promise<PaginatedResponse<TResponse>>;
      update?: (req: TypedRequest<TBody, undefined, { id: string }>, res: Response) => Promise<TResponse>;
      delete?: (req: TypedRequest<undefined, undefined, { id: string }>, res: Response) => Promise<void>;
      validation?: {
        create?: z.ZodSchema<TBody>;
        update?: z.ZodSchema<TBody>;
        list?: z.ZodSchema<TQuery>;
      };
      permissions?: {
        create?: string[];
        read?: string[];
        list?: string[];
        update?: string[];
        delete?: string[];
      };
    }
  ): void {
    const {
      create,
      read,
      list,
      update,
      delete: deleteFn,
      validation = {},
      permissions = {},
    } = options;
    
    // POST /resource - 创建
    if (create) {
      this.post(basePath, create, {
        validation: { body: validation.create },
        permissions: permissions.create,
        summary: `创建${basePath}`,
      });
    }
    
    // GET /resource - 列表
    if (list) {
      this.get(basePath, list, {
        validation: { query: validation.list || PaginationParamsSchema },
        permissions: permissions.list,
        summary: `获取${basePath}列表`,
      });
    }
    
    // GET /resource/:id - 读取
    if (read) {
      this.get(`${basePath}/:id`, read, {
        validation: { 
          params: z.object({ id: z.string().uuid() }),
        },
        permissions: permissions.read,
        summary: `获取${basePath}详情`,
      });
    }
    
    // PUT /resource/:id - 更新
    if (update) {
      this.put(`${basePath}/:id`, update, {
        validation: { 
          params: z.object({ id: z.string().uuid() }),
          body: validation.update,
        },
        permissions: permissions.update,
        summary: `更新${basePath}`,
      });
    }
    
    // DELETE /resource/:id - 删除
    if (deleteFn) {
      this.delete(`${basePath}/:id`, deleteFn, {
        validation: { 
          params: z.object({ id: z.string().uuid() }),
        },
        permissions: permissions.delete,
        summary: `删除${basePath}`,
      });
    }
  }
  
  // 路由组合
  combine(generators: RouteGenerator[]): Router {
    const combinedRouter = Router();
    combinedRouter.use(this.router);
    
    for (const generator of generators) {
      combinedRouter.use(generator.getRouter());
    }
    
    return combinedRouter;
  }
  
  // 获取Express路由
  getRouter(): Router {
    return this.router;
  }
  
  // 生成API文档
  generateApiDoc(): { openapi: string; paths: Record<string, OpenApiPath>; components?: JsonObject } {
    return this.docGenerator.generateOpenApi();
  }
  
  // 认证中间件
  private authMiddleware(permissions?: string[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
      // 简化实现，实际应该验证JWT或session
      const user = req.session?.user;
      
      if (!user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '需要认证',
          },
          timestamp: new Date().toISOString(),
        });
      }
      
      if (permissions && permissions.length > 0) {
        const hasPermission = permissions.some(permission => 
          user.permissions?.includes(permission)
        );
        
        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: '权限不足',
            },
            timestamp: new Date().toISOString(),
          });
        }
      }
      
      next();
    };
  }
  
  // 响应处理中间件
  private responseHandler<T>(responseSchema?: z.ZodSchema<T>) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const originalJson = res.json;
      
      res.json = function(data: unknown): Response {
        // 如果是API响应格式，直接返回
        if (data && typeof data === 'object' && 'success' in data) {
          return originalJson.call(this, data);
        }
        
        // 包装为标准API响应
        const response: ApiResponse<T> = {
          success: true,
          data,
          timestamp: new Date().toISOString(),
        };
        
        // 验证响应数据
        if (responseSchema) {
          const result = responseSchema.safeParse(data);
          if (!result.success) {
            logger.error('响应数据验证失败', {
              error: result.error,
              data,
            });
            
            return originalJson.call(this, {
              success: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: '响应数据格式错误',
              },
              timestamp: new Date().toISOString(),
            });
          }
        }
        
        return originalJson.call(this, response);
      };
      
      next();
    };
  }
}

// 导出便捷函数
export function createRouter(prefix = ''): RouteGenerator {
  return new RouteGenerator(prefix);
}

// 导出分页参数Schema
export const PaginationParamsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

// 导出API响应Schema
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }).optional(),
  timestamp: z.string(),
});
