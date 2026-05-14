import { z } from "zod";
import { logger } from './logger';

// 环境变量验证模式
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  
  // 数据库配置
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  
  // 会话安全
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  
  // Master 密钥 (生产环境必须)
  AVATAR_MASTER_SECRET: z.string().min(64, "AVATAR_MASTER_SECRET must be at least 64 characters in production").optional(),
  
  // AI服务API密钥
  DASHSCOPE_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  DOUBAO_API_KEY: z.string().optional(),

  // 扣子AI配置
  COZE_API_KEY: z.string().optional(),
  COZE_BOT_ID: z.string().optional(),
  COZE_WORKFLOW_ID: z.string().optional(),
  COZE_WORKFLOW_FORMAT: z.string().optional(),
  COZE_WORKFLOW_POLISH: z.string().optional(),
  COZE_WORKFLOW_TRANSLATE: z.string().optional(),
  COZE_WORKFLOW_SUMMARIZE: z.string().optional(),
  COZE_WORKFLOW_PPT: z.string().optional(),
  COZE_WORKFLOW_REPORT: z.string().optional(),

  // Aliyun SMS
  ALIYUN_ACCESS_KEY_ID: z.string().optional(),
  ALIYUN_ACCESS_KEY_SECRET: z.string().optional(),
  ALIYUN_SMS_SIGN_NAME: z.string().optional(),
  ALIYUN_SMS_TEMPLATE_CODE: z.string().optional(),
  ALIYUN_SMS_REGISTER_TEMPLATE_CODE: z.string().optional(),
  ALIYUN_SMS_RESET_TEMPLATE_CODE: z.string().optional(),
  ALIYUN_SMS_ENDPOINT: z.string().default("dysmsapi.aliyuncs.com"),
  ALIYUN_SMS_DRY_RUN: z.string().transform(val => val === "true").default("false"),
  SMS_CODE_TTL_SECONDS: z.string().transform(Number).default("300"),
  SMS_SEND_COOLDOWN_SECONDS: z.string().transform(Number).default("60"),
  SMS_HOURLY_SEND_LIMIT: z.string().transform(Number).default("5"),
  SMS_MAX_VERIFY_ATTEMPTS: z.string().transform(Number).default("5"),
  
  // 本地AI配置
  LOCAL_MODEL_ENABLED: z.string().transform(val => val === "true").default("false"),
  LOCAL_MODEL_ENDPOINT: z.string().url().optional(),
  LOCAL_MODEL_NAME: z.string().optional(),
  
  // 其他配置
  PORT: z.string().transform(Number).default("5000"),
  
  // Redis缓存配置
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.string().transform(Number).default("6379"),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.string().transform(Number).default("0"),
  
  // 安全配置
  CORS_ORIGIN: z.string().default("*"),
  RATE_LIMIT_WINDOW: z.string().transform(Number).default("900000"), // 15分钟
  RATE_LIMIT_MAX: z.string().transform(Number).default("100"),
  
  // 缓存配置
  CACHE_DEFAULT_TTL: z.string().transform(Number).default("300"), // 5分钟
  CACHE_SESSION_TTL: z.string().transform(Number).default("3600"), // 1小时
  CACHE_AI_CONTEXT_TTL: z.string().transform(Number).default("3600"), // 1小时
});

// 验证环境变量
export function validateEnv() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ 环境变量验证失败:");
      error.errors.forEach(err => {
        console.error(`  - ${err.path.join(".")}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
}

// 导出类型安全的配置
export type EnvConfig = z.infer<typeof envSchema>;

// 单例配置实例
let config: EnvConfig | null = null;

export function getConfig(): EnvConfig {
  if (!config) {
    config = validateEnv();
  }
  return config;
}

// 安全检查函数
export function performSecurityChecks() {
  const config = getConfig();
  
  // 生产环境安全检查
  if (config.NODE_ENV === "production") {
    const warnings = [];
    const errors = [];
    
    if (!config.SESSION_SECRET || config.SESSION_SECRET.length < 32) {
      errors.push("SESSION_SECRET must be at least 32 characters in production");
    }
    
    if (!config.AVATAR_MASTER_SECRET || config.AVATAR_MASTER_SECRET.length < 64) {
      errors.push("AVATAR_MASTER_SECRET must be at least 64 characters in production");
    }
    
    if (config.AVATAR_MASTER_SECRET === 'dev-master-key-change-in-production') {
      errors.push("Cannot use default insecure master secret in production");
    }
    
    if (config.CORS_ORIGIN === "*") {
      warnings.push("CORS_ORIGIN should not be '*' in production");
    }
    
    if (!config.DATABASE_URL.includes("ssl") && config.DATABASE_URL.includes("postgres")) {
      warnings.push("DATABASE_URL should use SSL in production");
    }
    
    if (errors.length > 0) {
      console.error("🚨 生产环境安全错误 (必须修复):");
      errors.forEach(err => console.error(`  ❌ ${err}`));
      process.exit(1);
    }
    
    if (warnings.length > 0) {
      console.warn("⚠️  生产环境安全警告:");
      warnings.forEach(warning => console.warn(`  ⚠️  ${warning}`));
    }
  } else {
    // 开发环境检查
    if (!config.AVATAR_MASTER_SECRET) {
      console.warn("⚠️  WARNING: AVATAR_MASTER_SECRET not set in development mode");
    } else if (config.AVATAR_MASTER_SECRET.length < 64) {
      console.warn("⚠️  WARNING: AVATAR_MASTER_SECRET should be at least 64 characters");
    }
  }
  
  // API密钥检查
  const availableProviders = [];
  if (config.DASHSCOPE_API_KEY) availableProviders.push("DashScope");
  if (config.DEEPSEEK_API_KEY) availableProviders.push("DeepSeek");
  if (config.DOUBAO_API_KEY) availableProviders.push("豆包");
  
  if (availableProviders.length === 0 && !config.LOCAL_MODEL_ENABLED) {
    console.warn("⚠️  未配置任何AI服务提供商，部分功能可能不可用");
  }
  
  logger.info(`可用AI服务: ${availableProviders.join(', ') || '无'}`);
  logger.info(`本地AI模型: ${config.LOCAL_MODEL_ENABLED ? '启用' : '禁用'}`);
}

// 缓存配置
export const cacheConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
  },
  defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL || '300'),
  sessionTTL: parseInt(process.env.CACHE_SESSION_TTL || '3600'),
  aiContextTTL: parseInt(process.env.CACHE_AI_CONTEXT_TTL || '3600'),
}
