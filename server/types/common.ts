import { Request, Response, NextFunction } from 'express';
import { z } from "zod";

const datetimeSchema = () => z.string().datetime();

// 通用API响应类型
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

export type ApiResponse<T = unknown> = z.infer<typeof ApiResponseSchema> & {
  data?: T;
};

// 分页响应类型
export const PaginatedResponseSchema = z.object({
  items: z.array(z.unknown()),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  }),
});

export type PaginatedResponse<T = unknown> = z.infer<typeof PaginatedResponseSchema> & {
  items: T[];
};

// 用户相关类型
export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  avatar: z.string().url().optional(),
  role: z.enum(['MASTER', 'GUEST', 'ADMIN']),
  preferences: z.record(z.unknown()).optional(),
  createdAt: datetimeSchema(),
  updatedAt: datetimeSchema(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

// 设备相关类型
export const DeviceInfoSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  type: z.enum(['LAPTOP', 'MOBILE', 'TABLET', 'DESKTOP', 'SERVER']),
  os: z.string().optional(),
  capabilities: z.array(z.string()),
  lastSeen: datetimeSchema(),
  isActive: z.boolean(),
  metadata: z.record(z.unknown()).optional(),
});

export type DeviceInfo = z.infer<typeof DeviceInfoSchema>;

// 消息相关类型
export const MessageSchema = z.object({
  id: z.string().uuid(),
  content: z.string().min(1).max(10000),
  type: z.enum(['text', 'image', 'audio', 'video', 'file']),
  sender: z.string().uuid(),
  receiver: z.string().uuid().optional(),
  timestamp: datetimeSchema(),
  metadata: z.record(z.unknown()).optional(),
  isRead: z.boolean().default(false),
});

export type Message = z.infer<typeof MessageSchema>;

// 项目相关类型
export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: z.enum(['planning', 'active', 'paused', 'completed', 'cancelled']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  createdBy: z.string().uuid(),
  assignedTo: z.array(z.string().uuid()).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: datetimeSchema(),
  updatedAt: datetimeSchema(),
});

export type Project = z.infer<typeof ProjectSchema>;

// 任务相关类型
export const TaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: z.enum(['todo', 'in_progress', 'review', 'completed']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  projectId: z.string().uuid(),
  assignedTo: z.string().uuid().optional(),
  dueDate: z.date().optional(),
  estimatedHours: z.number().positive().optional(),
  actualHours: z.number().positive().optional(),
  dependencies: z.array(z.string().uuid()).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: datetimeSchema(),
  updatedAt: datetimeSchema(),
});

export type Task = z.infer<typeof TaskSchema>;

// AI服务相关类型
export const AIProviderSchema = z.object({
  name: z.enum(['dashscope', 'deepseek', 'doubao', 'ollama', 'openai']),
  endpoint: z.string().url(),
  apiKey: z.string().min(1),
  model: z.string().min(1),
  maxTokens: z.number().positive().default(2048),
  temperature: z.number().min(0).max(2).default(0.7),
  timeout: z.number().positive().default(30000),
});

export type AIProvider = z.infer<typeof AIProviderSchema>;

export const ChatMessageSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
  timestamp: datetimeSchema(),
  metadata: z.record(z.unknown()).optional(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatSessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  messages: z.array(ChatMessageSchema),
  model: z.string(),
  provider: z.string(),
  createdAt: datetimeSchema(),
  updatedAt: datetimeSchema(),
  isActive: z.boolean().default(true),
});

export type ChatSession = z.infer<typeof ChatSessionSchema>;

// WebSocket相关类型
export const WebSocketMessageSchema = z.object({
  type: z.string(),
  payload: z.unknown(),
  timestamp: datetimeSchema(),
  id: z.string().optional(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
});

export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;

// 健康检查相关类型
export const HealthCheckSchema = z.object({
  status: z.enum(['healthy', 'unhealthy', 'degraded']),
  timestamp: datetimeSchema(),
  uptime: z.number(),
  version: z.string(),
  checks: z.array(z.object({
    name: z.string(),
    status: z.enum(['pass', 'fail', 'warn']),
    message: z.string().optional(),
    duration: z.number().optional(),
  })),
});

export type HealthCheck = z.infer<typeof HealthCheckSchema>;

// 配置相关类型
export const ConfigSchema = z.object({
  database: z.object({
    url: z.string().url(),
    poolSize: z.number().positive().default(10),
    timeout: z.number().positive().default(30000),
  }),
  redis: z.object({
    url: z.string().url().optional(),
    enabled: z.boolean().default(false),
  }),
  ai: z.object({
    providers: z.array(AIProviderSchema),
    defaultProvider: z.string(),
  }),
  security: z.object({
    sessionSecret: z.string().min(32),
    corsOrigin: z.string().default('*'),
    rateLimit: z.object({
      windowMs: z.number().positive(),
      maxRequests: z.number().positive(),
    }),
  }),
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']),
    format: z.enum(['json', 'text']),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

// 错误类型
export const AppErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  statusCode: z.number().positive(),
  details: z.unknown().optional(),
  timestamp: datetimeSchema(),
  stack: z.string().optional(),
});

export type AppError = z.infer<typeof AppErrorSchema>;

// 分页参数类型
export const PaginationParamsSchema = z.object({
  page: z.number().positive().default(1),
  limit: z.number().positive().max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationParams = z.infer<typeof PaginationParamsSchema>;

// 搜索参数类型
export const SearchParamsSchema = z.object({
  q: z.string().min(1).max(500),
  fields: z.array(z.string()).optional(),
  filters: z.record(z.unknown()).optional(),
});

export type SearchParams = z.infer<typeof SearchParamsSchema>;

// 文件上传类型
export const FileUploadSchema = z.object({
  filename: z.string(),
  mimetype: z.string(),
  size: z.number().positive(),
  url: z.string().url(),
  uploadedAt: datetimeSchema(),
  uploadedBy: z.string().uuid(),
});

export type FileUpload = z.infer<typeof FileUploadSchema>;

// 通知类型
export const NotificationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  type: z.enum(['info', 'success', 'warning', 'error']),
  isRead: z.boolean().default(false),
  data: z.record(z.unknown()).optional(),
  createdAt: datetimeSchema(),
  readAt: datetimeSchema().optional(),
});

export type Notification = z.infer<typeof NotificationSchema>;

// 导出验证中间件
export function validateSchema<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      (req as Request & { validated?: T }).validated = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求参数验证失败',
            details: error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message,
            })),
          },
          timestamp: new Date().toISOString(),
        });
      } else {
        next(error);
      }
    }
  };
}

// 类型守卫函数
export function isApiErrorResponse(response: unknown): response is ApiResponse & { error: NonNullable<ApiResponse['error']> } {
  return response !== null && typeof response === 'object' && 'error' in response;
}

export function isPaginatedResponse<T>(response: unknown): response is PaginatedResponse<T> {
  return response !== null && typeof response === 'object' && 'items' in response && 'pagination' in response;
}

// 常用类型组合
export interface ListResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface CrudOperations<T, CreateInput = Partial<T>, UpdateInput = Partial<T>> {
  create(data: CreateInput): Promise<T>;
  read(id: string): Promise<T | null>;
  list(params: PaginationParams & SearchParams): Promise<ListResponse<T>>;
  update(id: string, data: UpdateInput): Promise<T>;
  delete(id: string): Promise<boolean>;
}