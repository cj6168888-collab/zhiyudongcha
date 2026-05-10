/**
 * 启动配置检查
 * Phase 5.3 - 配置管理优化
 * 确保所有必需配置在启动时验证
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('StartupCheck');

export interface ConfigValidation {
  category: string;
  key: string;
  required: boolean;
  present: boolean;
  description: string;
}

export interface StartupCheckResult {
  success: boolean;
  timestamp: string;
  validations: ConfigValidation[];
  errors: string[];
  warnings: string[];
}

const CONFIG_SCHEMA = [
  { category: 'database', key: 'DATABASE_URL', required: true, description: 'PostgreSQL连接字符串' },
  { category: 'security', key: 'SESSION_SECRET', required: true, description: '会话加密密钥' },
  { category: 'ai', key: 'DASHSCOPE_API_KEY', required: false, description: '阿里云DashScope API密钥' },
  { category: 'ai', key: 'DEEPSEEK_API_KEY', required: false, description: 'DeepSeek API密钥' },
  { category: 'ai', key: 'DOUBAO_API_KEY', required: false, description: '豆包/火山引擎API密钥' },
];

export function validateStartupConfig(): StartupCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const validations: ConfigValidation[] = [];

  for (const config of CONFIG_SCHEMA) {
    const present = !!process.env[config.key];
    
    validations.push({
      category: config.category,
      key: config.key,
      required: config.required,
      present,
      description: config.description,
    });

    if (config.required && !present) {
      errors.push(`缺少必需配置: ${config.key} (${config.description})`);
    } else if (!config.required && !present) {
      warnings.push(`未配置可选项: ${config.key} (${config.description})`);
    }
  }

  const aiKeysPresent = ['DASHSCOPE_API_KEY', 'DEEPSEEK_API_KEY', 'DOUBAO_API_KEY']
    .some(key => !!process.env[key]);
  
  if (!aiKeysPresent) {
    warnings.push('未配置任何AI服务密钥，系统将在离线模式运行');
  }

  return {
    success: errors.length === 0,
    timestamp: new Date().toISOString(),
    validations,
    errors,
    warnings,
  };
}

export function printStartupBanner(result: StartupCheckResult): void {
  logger.info('\n╔══════════════════════════════════════════════════════════════╗');
  logger.info('║                 领航者 (Navigator-X) 系统启动                  ║');
  logger.info('╠══════════════════════════════════════════════════════════════╣');
  
  const statusIcon = result.success ? '✓' : '✗';
  const statusText = result.success ? '配置验证通过' : '配置验证失败';
  logger.info(`║  ${statusIcon} ${statusText.padEnd(58)}║`);

  if (result.errors.length > 0) {
    logger.info('╠══════════════════════════════════════════════════════════════╣');
    logger.info('║  错误:                                                        ║');
    for (const error of result.errors) {
      logger.error(`║    - ${error.substring(0, 54).padEnd(54)}║`);
    }
  }

  if (result.warnings.length > 0) {
    logger.info('╠══════════════════════════════════════════════════════════════╣');
    logger.info('║  警告:                                                        ║');
    for (const warning of result.warnings) {
      logger.warn(`║    - ${warning.substring(0, 54).padEnd(54)}║`);
    }
  }

  logger.info('╚══════════════════════════════════════════════════════════════╝\n');
}

export function runStartupChecks(): boolean {
  const result = validateStartupConfig();
  printStartupBanner(result);
  
  if (!result.success) {
    logger.error('启动检查失败，请修复配置后重试');
    return false;
  }
  
  return true;
}
