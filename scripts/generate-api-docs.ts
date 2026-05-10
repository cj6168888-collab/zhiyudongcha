#!/usr/bin/env node

/**
 * API文档生成器
 * 自动从路由和类型定义生成OpenAPI文档
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { createRouter, RouteConfig } from '../server/lib/route-generator';

interface OpenAPIDocument {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
    contact?: {
      name: string;
      email: string;
    };
    license?: {
      name: string;
      url: string;
    };
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  paths: Record<string, any>;
  components: {
    schemas: Record<string, any>;
    securitySchemes: Record<string, any>;
  };
  tags: Array<{
    name: string;
    description: string;
  }>;
}

class APIDocGenerator {
  private docs: OpenAPIDocument;
  private schemas: Map<string, any> = new Map();
  private examples: Map<string, any> = new Map();

  constructor() {
    this.docs = this.initializeDocument();
  }

  private initializeDocument(): OpenAPIDocument {
    return {
      openapi: '3.0.3',
      info: {
        title: '小智AI助手 API',
        version: '1.0.0',
        description: '小智AI助手的RESTful API文档，提供用户管理、AI对话、项目管理等功能。',
        contact: {
          name: '小智开发团队',
          email: 'dev@xiaozhi.ai',
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
        },
      },
      servers: [
        {
          url: 'http://localhost:5000',
          description: '开发环境',
        },
        {
          url: 'https://api.xiaozhi.ai',
          description: '生产环境',
        },
      ],
      paths: {},
      components: {
        schemas: {},
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT认证令牌',
          },
          sessionAuth: {
            type: 'apiKey',
            in: 'cookie',
            name: 'sessionId',
            description: '会话认证',
          },
        },
      },
      tags: [
        {
          name: '认证',
          description: '用户认证和授权相关接口',
        },
        {
          name: '用户',
          description: '用户管理相关接口',
        },
        {
          name: 'AI对话',
          description: 'AI对话和智能交互接口',
        },
        {
          name: '项目管理',
          description: '项目和任务管理接口',
        },
        {
          name: '文件管理',
          description: '文件上传和管理接口',
        },
        {
          name: '系统',
          description: '系统监控和健康检查接口',
        },
      ],
    };
  }

  private generateSchema(schema: any): any {
    if (schema._def) {
      // Zod schema
      return this.zodSchemaToJsonSchema(schema);
    } else if (typeof schema === 'object') {
      return this.objectSchemaToJsonSchema(schema);
    }
    return {};
  }

  private zodSchemaToJsonSchema(schema: any): any {
    if (schema._def?.typeName === 'ZodString') {
      return { type: 'string' };
    }
    if (schema._def?.typeName === 'ZodNumber') {
      return { type: 'number' };
    }
    if (schema._def?.typeName === 'ZodBoolean') {
      return { type: 'boolean' };
    }
    if (schema._def?.typeName === 'ZodArray') {
      return {
        type: 'array',
        items: this.zodSchemaToJsonSchema(schema._def.type),
      };
    }
    if (schema._def?.typeName === 'ZodObject') {
      const properties: any = {};
      const required: string[] = [];

      for (const [key, field] of Object.entries(schema._def.shape())) {
        const fieldSchema = field as any;
        properties[key] = this.zodSchemaToJsonSchema(fieldSchema);
        
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
    if (schema._def?.typeName === 'ZodEnum') {
      return {
        type: 'string',
        enum: schema._def.values,
      };
    }
    if (schema._def?.typeName === 'ZodOptional') {
      return this.zodSchemaToJsonSchema(schema._def.innerType);
    }
    if (schema._def?.typeName === 'ZodDefault') {
      const jsonSchema = this.zodSchemaToJsonSchema(schema._def.innerType);
      jsonSchema.default = schema._def.defaultValue();
      return jsonSchema;
    }
    if (schema._def?.typeName === 'ZodEffects') {
      return this.zodSchemaToJsonSchema(schema._def.schema);
    }

    return { type: 'unknown' };
  }

  private objectSchemaToJsonSchema(obj: any): any {
    if (Array.isArray(obj)) {
      return {
        type: 'array',
        items: this.objectSchemaToJsonSchema(obj[0]),
      };
    }

    if (typeof obj === 'object' && obj !== null) {
      const properties: any = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(obj)) {
        properties[key] = this.objectSchemaToJsonSchema(value);
        if (value !== undefined && value !== null) {
          required.push(key);
        }
      }

      return {
        type: 'object',
        properties,
        required,
      };
    }

    if (typeof obj === 'string') {
      return { type: 'string', example: obj };
    }
    if (typeof obj === 'number') {
      return { type: 'number', example: obj };
    }
    if (typeof obj === 'boolean') {
      return { type: 'boolean', example: obj };
    }

    return { type: 'unknown' };
  }

  private generateParameters(config: RouteConfig): any[] {
    const parameters: any[] = [];

    // 查询参数
    if (config.validation?.query) {
      const schema = this.generateSchema(config.validation.query);
      if (schema.properties) {
        for (const [name, paramSchema] of Object.entries(schema.properties)) {
          parameters.push({
            name,
            in: 'query',
            description: `查询参数: ${name}`,
            required: schema.required?.includes(name) || false,
            schema: paramSchema,
          });
        }
      }
    }

    // 路径参数
    if (config.validation?.params) {
      const schema = this.generateSchema(config.validation.params);
      if (schema.properties) {
        for (const [name, paramSchema] of Object.entries(schema.properties)) {
          parameters.push({
            name,
            in: 'path',
            description: `路径参数: ${name}`,
            required: true,
            schema: paramSchema,
          });
        }
      }
    }

    return parameters;
  }

  private generateRequestBody(config: RouteConfig): any {
    if (!config.validation?.body) {
      return undefined;
    }

    const schema = this.generateSchema(config.validation.body);

    return {
      description: '请求体',
      required: true,
      content: {
        'application/json': {
          schema,
        },
        'multipart/form-data': {
          schema: schema,
        },
      },
    };
  }

  private generateResponses(config: RouteConfig): any {
    const responses: any = {};

    // 成功响应
    const successSchema = config.responseSchema ? this.generateSchema(config.responseSchema) : undefined;

    responses['200'] = {
      description: '操作成功',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              data: successSchema || { type: 'object', description: '响应数据' },
              timestamp: { type: 'string', format: 'date-time' },
            },
            required: ['success', 'timestamp'],
          },
        },
      },
    };

    // 创建成功响应 (201)
    if (config.method === 'POST') {
      responses['201'] = {
        description: '创建成功',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: true },
                data: successSchema || { type: 'object', description: '创建的资源' },
                timestamp: { type: 'string', format: 'date-time' },
              },
              required: ['success', 'timestamp'],
            },
          },
        },
      };
    }

    // 错误响应
    responses['400'] = {
      description: '请求参数错误',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string', example: 'VALIDATION_ERROR' },
                  message: { type: 'string', example: '请求参数验证失败' },
                  details: { type: 'object' },
                },
                required: ['code', 'message'],
              },
              timestamp: { type: 'string', format: 'date-time' },
            },
            required: ['success', 'error', 'timestamp'],
          },
        },
      },
    };

    responses['401'] = {
      description: '未授权',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string', example: 'UNAUTHORIZED' },
                  message: { type: 'string', example: '需要认证' },
                },
                required: ['code', 'message'],
              },
              timestamp: { type: 'string', format: 'date-time' },
            },
            required: ['success', 'error', 'timestamp'],
          },
        },
      },
    };

    responses['403'] = {
      description: '权限不足',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string', example: 'FORBIDDEN' },
                  message: { type: 'string', example: '权限不足' },
                },
                required: ['code', 'message'],
              },
              timestamp: { type: 'string', format: 'date-time' },
            },
            required: ['success', 'error', 'timestamp'],
          },
        },
      },
    };

    responses['404'] = {
      description: '资源不存在',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string', example: 'NOT_FOUND' },
                  message: { type: 'string', example: '资源不存在' },
                },
                required: ['code', 'message'],
              },
              timestamp: { type: 'string', format: 'date-time' },
            },
            required: ['success', 'error', 'timestamp'],
          },
        },
      },
    };

    responses['500'] = {
      description: '服务器内部错误',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string', example: 'INTERNAL_ERROR' },
                  message: { type: 'string', example: '服务器内部错误' },
                },
                required: ['code', 'message'],
              },
              timestamp: { type: 'string', format: 'date-time' },
            },
            required: ['success', 'error', 'timestamp'],
          },
        },
      },
    };

    return responses;
  }

  private addRoute(path: string, config: RouteConfig): void {
    const method = config.method.toLowerCase();
    const fullPath = path.startsWith('/') ? path : `/${path}`;

    if (!this.docs.paths[fullPath]) {
      this.docs.paths[fullPath] = {};
    }

    this.docs.paths[fullPath][method] = {
      summary: config.summary || config.description,
      description: config.description,
      tags: config.tags || ['默认'],
      parameters: this.generateParameters(config),
      requestBody: this.generateRequestBody(config),
      responses: this.generateResponses(config),
      security: config.auth ? [{ bearerAuth: [] }] : [],
      deprecated: config.deprecated || false,
    };
  }

  private generateCommonSchemas(): void {
    // 通用响应格式
    this.docs.components.schemas['ApiResponse'] = {
      type: 'object',
      properties: {
        success: { type: 'boolean', description: '操作是否成功' },
        data: { type: 'object', description: '响应数据' },
        error: {
          type: 'object',
          description: '错误信息',
          properties: {
            code: { type: 'string', description: '错误代码' },
            message: { type: 'string', description: '错误消息' },
            details: { type: 'object', description: '错误详情' },
          },
        },
        timestamp: { type: 'string', format: 'date-time', description: '时间戳' },
      },
      required: ['success', 'timestamp'],
    };

    // 分页响应
    this.docs.components.schemas['PaginatedResponse'] = {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'object' }, description: '数据列表' },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer', description: '当前页码' },
            limit: { type: 'integer', description: '每页数量' },
            total: { type: 'integer', description: '总数量' },
            totalPages: { type: 'integer', description: '总页数' },
            hasNext: { type: 'boolean', description: '是否有下一页' },
            hasPrev: { type: 'boolean', description: '是否有上一页' },
          },
        },
      },
      required: ['items', 'pagination'],
    };

    // 错误响应
    this.docs.components.schemas['ErrorResponse'] = {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        error: {
          type: 'object',
          properties: {
            code: { type: 'string', description: '错误代码' },
            message: { type: 'string', description: '错误消息' },
            details: { type: 'object', description: '错误详情' },
          },
          required: ['code', 'message'],
        },
        timestamp: { type: 'string', format: 'date-time' },
      },
      required: ['success', 'error', 'timestamp'],
    };

    // 用户信息
    this.docs.components.schemas['User'] = {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid', description: '用户ID' },
        name: { type: 'string', description: '用户名' },
        email: { type: 'string', format: 'email', description: '邮箱' },
        avatar: { type: 'string', format: 'uri', description: '头像URL' },
        role: { type: 'string', enum: ['MASTER', 'GUEST', 'ADMIN'], description: '用户角色' },
        preferences: { type: 'object', description: '用户偏好设置' },
        createdAt: { type: 'string', format: 'date-time', description: '创建时间' },
        updatedAt: { type: 'string', format: 'date-time', description: '更新时间' },
      },
      required: ['id', 'name', 'email', 'role', 'createdAt', 'updatedAt'],
    };

    // 项目信息
    this.docs.components.schemas['Project'] = {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid', description: '项目ID' },
        name: { type: 'string', description: '项目名称' },
        description: { type: 'string', description: '项目描述' },
        status: { type: 'string', enum: ['planning', 'active', 'paused', 'completed', 'cancelled'], description: '项目状态' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: '优先级' },
        startDate: { type: 'string', format: 'date-time', description: '开始日期' },
        endDate: { type: 'string', format: 'date-time', description: '结束日期' },
        createdBy: { type: 'string', format: 'uuid', description: '创建者ID' },
        assignedTo: { type: 'array', items: { type: 'string', format: 'uuid' }, description: '分配给的用户ID列表' },
        tags: { type: 'array', items: { type: 'string' }, description: '标签列表' },
        createdAt: { type: 'string', format: 'date-time', description: '创建时间' },
        updatedAt: { type: 'string', format: 'date-time', description: '更新时间' },
      },
      required: ['id', 'name', 'status', 'priority', 'createdBy', 'createdAt', 'updatedAt'],
    };
  }

  public generateFromRoutes(routes: Array<{ path: string; config: RouteConfig }>): OpenAPIDocument {
    this.generateCommonSchemas();

    for (const route of routes) {
      this.addRoute(route.path, route.config);
    }

    return this.docs;
  }

  public saveToFile(outputPath: string): void {
    const dir = dirname(outputPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const json = JSON.stringify(this.docs, null, 2);
    writeFileSync(outputPath, json);
  }

  public saveToMarkdown(outputPath: string): void {
    const dir = dirname(outputPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const markdown = this.generateMarkdown();
    writeFileSync(outputPath, markdown);
  }

  private generateMarkdown(): string {
    let markdown = `# ${this.docs.info.title}

${this.docs.info.description}

## 版本信息

- **版本**: ${this.docs.info.version}
- **OpenAPI版本**: ${this.docs.openapi}

## 服务器

`;

    for (const server of this.docs.servers) {
      markdown += `- **${server.description}**: \`${server.url}\`\n`;
    }

    markdown += `\n## 认证\n\n`;
    markdown += `### Bearer Token\n\n`;
    markdown += `在请求头中添加Authorization字段：\n\n`;
    markdown += `\`\`\`\nAuthorization: Bearer <token>\n\`\`\`\n\n`;

    markdown += `### Session Cookie\n\n`;
    markdown += `使用会话Cookie进行认证：\n\n`;
    markdown += `\`\`\`\nCookie: sessionId=<session-id>\n\`\`\`\n\n`;

    markdown += `## API端点\n\n`;

    for (const [path, pathItem] of Object.entries(this.docs.paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        const op = operation as any;
        
        markdown += `### ${method.toUpperCase()} ${path}\n\n`;
        markdown += `**${op.summary}**\n\n`;
        markdown += `${op.description}\n\n`;

        if (op.tags && op.tags.length > 0) {
          markdown += `**标签**: ${op.tags.join(', ')}\n\n`;
        }

        if (op.parameters && op.parameters.length > 0) {
          markdown += `#### 参数\n\n`;
          markdown += `| 名称 | 位置 | 类型 | 必需 | 描述 |\n`;
          markdown += `|------|------|------|------|------|\n`;
          
          for (const param of op.parameters) {
            const p = param as any;
            const type = p.schema?.type || 'unknown';
            const required = p.required ? '是' : '否';
            markdown += `| ${p.name} | ${p.in} | ${type} | ${required} | ${p.description} |\n`;
          }
          markdown += '\n';
        }

        if (op.requestBody) {
          markdown += `#### 请求体\n\n`;
          markdown += `\`\`\`json\n${JSON.stringify(op.requestBody.content['application/json'].schema, null, 2)}\n\`\`\`\n\n`;
        }

        if (op.responses) {
          markdown += `#### 响应\n\n`;
          for (const [statusCode, response] of Object.entries(op.responses)) {
            const resp = response as any;
            markdown += `**${statusCode}**: ${resp.description}\n\n`;
            
            if (resp.content && resp.content['application/json']) {
              markdown += `\`\`\`json\n${JSON.stringify(resp.content['application/json'].schema, null, 2)}\n\`\`\`\n\n`;
            }
          }
        }

        markdown += `---\n\n`;
      }
    }

    markdown += `## 数据模型\n\n`;

    for (const [name, schema] of Object.entries(this.docs.components.schemas)) {
      markdown += `### ${name}\n\n`;
      markdown += `\`\`\`json\n${JSON.stringify(schema, null, 2)}\n\`\`\`\n\n`;
    }

    return markdown;
  }
}

// CLI接口
async function main() {
  const generator = new APIDocGenerator();
  
  // 示例路由配置
  const exampleRoutes = [
    {
      path: '/api/health',
      config: {
        method: 'GET' as const,
        summary: '健康检查',
        description: '检查应用健康状态',
        tags: ['系统'],
        auth: false,
        handler: async () => ({}),
      },
    },
    {
      path: '/api/auth/login',
      config: {
        method: 'POST' as const,
        summary: '用户登录',
        description: '用户登录接口',
        tags: ['认证'],
        auth: false,
        handler: async () => ({}),
      },
    },
  ];

  const docs = generator.generateFromRoutes(exampleRoutes);
  
  // 保存OpenAPI JSON
  generator.saveToFile('./docs/api/openapi.json');
  console.log('✅ OpenAPI文档已生成: ./docs/api/openapi.json');
  
  // 保存Markdown文档
  generator.saveToMarkdown('./docs/api/README.md');
  console.log('✅ API文档已生成: ./docs/api/README.md');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}