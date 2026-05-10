#!/usr/bin/env node

/**
 * 安全密钥生成工具
 * 用于生成和管理系统中的加密密钥
 */

import { randomBytes, createHash } from 'crypto';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface KeyConfig {
  integrationEncryptionKey: string;
  sessionSecret: string;
  apiSigningKey: string;
  databaseEncryptionKey: string;
  timestamp: string;
  version: string;
}

class SecureKeyGenerator {
  private readonly ENV_FILE_PATH = join(process.cwd(), '.secure-keys.json');
  
  generateKey(bytes: number = 32): string {
    return randomBytes(bytes).toString('hex');
  }
  
  generateKeyWithDescription(description: string): string {
    const random = randomBytes(16); // 16 bytes random salt
    const hash = createHash('sha256')
      .update(description)
      .update(random)
      .digest();
    return hash.toString('hex');
  }
  
  validateKey(key: string, expectedLength: number = 64): boolean {
    return /^[0-9a-fA-F]+$/.test(key) && key.length === expectedLength;
  }
  
  generateSecureKeySet(): KeyConfig {
    return {
      integrationEncryptionKey: this.generateKey(32), // 64 chars
      sessionSecret: this.generateKeyWithHash('session-secret') + this.generateKey(16),
      apiSigningKey: this.generateKey(64), // 128 chars for HMAC
      databaseEncryptionKey: this.generateKey(32), // 64 chars
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
  }
  
  saveKeyConfig(config: KeyConfig): void {
    try {
      writeFileSync(this.ENV_FILE_PATH, JSON.stringify(config, null, 2), { mode: 0o600 }); // 读写权限仅所有者
      console.log('✅ 安全密钥配置已保存到:', this.ENV_FILE_PATH);
    } catch (error) {
      console.error('❌ 保存密钥配置失败:', error);
      throw error;
    }
  }
  
  loadKeyConfig(): KeyConfig | null {
    try {
      if (!existsSync(this.ENV_FILE_PATH)) {
        return null;
      }
      
      const content = readFileSync(this.ENV_FILE_PATH, 'utf-8');
      const config = JSON.parse(content) as KeyConfig;
      
      // 验证配置完整性
      this.validateConfig(config);
      
      return config;
    } catch (error) {
      console.error('❌ 读取密钥配置失败:', error);
      return null;
    }
  }
  
  private validateConfig(config: KeyConfig): void {
    const requiredFields: Array<keyof KeyConfig> = [
      'integrationEncryptionKey',
      'sessionSecret', 
      'apiSigningKey',
      'databaseEncryptionKey'
    ];
    
    for (const field of requiredFields) {
      if (!config[field]) {
        throw new Error(`缺少必需的密钥字段: ${field}`);
      }
    }
    
    // 验证密钥格式
    if (!this.validateKey(config.integrationEncryptionKey, 64)) {
      throw new Error('integrationEncryptionKey 格式无效，需要64位十六进制字符');
    }
    
    if (config.sessionSecret.length < 32) {
      throw new Error('sessionSecret 长度不足，至少需要32个字符');
    }
  }
  
  generateEnvironmentFile(config: KeyConfig): void {
    const envTemplate = `# 🔒 安全密钥配置 - 请将这些添加到您的环境变量中
# ⚠️  这些密钥应该安全地存储在您的 CI/CD 系统或密钥管理服务中

# 集成加密密钥 (64位十六进制)
# 用于敏感数据加密和解密
INTEGRATION_ENCRYPTION_KEY=${config.integrationEncryptionKey}

# 会话密钥 (至少32个字符)
# 用于用户会话和JWT令牌签名
SESSION_SECRET=${config.sessionSecret}

# API签名密钥 (128位十六进制)
# 用于API请求签名验证
API_SIGNING_KEY=${config.apiSigningKey}

# 数据库加密密钥 (64位十六进制)
# 用于数据库字段加密
DATABASE_ENCRYPTION_KEY=${config.databaseEncryptionKey}

# 密钥生成时间
SECURE_KEYS_GENERATED_AT=${config.timestamp}
SECURE_KEYS_VERSION=${config.version}

# 🔐 安全提醒
# 1. 请勿将这些密钥提交到版本控制系统
# 2. 请定期轮换密钥（建议每90天）
# 3. 请在生产环境中使用强密钥
# 4. 请使用环境变量或密钥管理服务存储这些值
`;

    const envPath = join(process.cwd(), '.env.keys');
    writeFileSync(envPath, envTemplate, { mode: 0o600 });
    console.log('✅ 环境变量文件已生成:', envPath);
  }
  
  rotateKeys(): KeyConfig {
    console.log('🔄 开始密钥轮换...');
    
    // 加载现有配置
    const existingConfig = this.loadKeyConfig();
    if (existingConfig) {
      console.log('📋 发现现有密钥配置，版本:', existingConfig.version);
      console.log('📅 上次生成时间:', existingConfig.timestamp);
    }
    
    // 生成新密钥
    const newConfig = this.generateSecureKeySet();
    
    // 保存新配置
    this.saveKeyConfig(newConfig);
    this.generateEnvironmentFile(newConfig);
    
    console.log('✅ 密钥轮换完成');
    return newConfig;
  }
  
  verifyKeys(): void {
    const config = this.loadKeyConfig();
    if (!config) {
      console.log('❌ 未找到密钥配置文件，请先运行: node scripts/generate-keys.js');
      return;
    }
    
    console.log('🔍 验证密钥配置...');
    
    try {
      // 测试加密解密
      const testData = { test: 'verification', timestamp: Date.now() };
      const encrypted = this.encryptTestData(testData, config.integrationEncryptionKey);
      const decrypted = this.decryptTestData(encrypted, config.integrationEncryptionKey);
      
      if (decrypted.test === testData.test) {
        console.log('✅ 集成加密密钥验证通过');
      } else {
        console.log('❌ 集成加密密钥验证失败');
      }
      
      // 测试会话密钥长度
      if (config.sessionSecret.length >= 32) {
        console.log('✅ 会话密钥长度验证通过');
      } else {
        console.log('❌ 会话密钥长度不足');
      }
      
      // 测试API签名密钥
      if (this.validateKey(config.apiSigningKey, 128)) {
        console.log('✅ API签名密钥验证通过');
      } else {
        console.log('❌ API签名密钥格式无效');
      }
      
      // 测试数据库加密密钥
      if (this.validateKey(config.databaseEncryptionKey, 64)) {
        console.log('✅ 数据库加密密钥验证通过');
      } else {
        console.log('❌ 数据库加密密钥格式无效');
      }
      
      console.log('✅ 密钥配置验证完成');
      
    } catch (error) {
      console.error('❌ 密钥验证过程中出错:', error);
    }
  }
  
  private encryptTestData(data: any, key: string): { encrypted: string; iv: string } {
    const crypto = require('crypto');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted: encrypted + ':' + authTag.toString('hex'),
      iv: iv.toString('hex'),
    };
  }
  
  private decryptTestData(encrypted: { encrypted: string; iv: string }, key: string): any {
    const crypto = require('crypto');
    const [encData, authTag] = encrypted.encrypted.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), Buffer.from(encrypted.iv, 'hex'));
    
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    let decrypted = decipher.update(encData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }
}

// CLI接口
function main() {
  const generator = new SecureKeyGenerator();
  const command = process.argv[2];
  
  switch (command) {
    case 'generate':
      console.log('🔑 生成新的安全密钥集...');
      const config = generator.generateSecureKeySet();
      generator.saveKeyConfig(config);
      generator.generateEnvironmentFile(config);
      break;
      
    case 'rotate':
      generator.rotateKeys();
      break;
      
    case 'verify':
      generator.verifyKeys();
      break;
      
    default:
      console.log(`
🔑 小智AI助手 - 安全密钥管理工具

用法:
  node scripts/key-generator.js <command>

命令:
  generate  - 生成新的安全密钥集
  rotate    - 轮换现有密钥
  verify     - 验证现有密钥

示例:
  node scripts/key-generator.js generate
  node scripts/key-generator.js rotate
  node scripts/key-generator.js verify

注意事项:
  • 生成的密钥将保存在 .secure-keys.json 文件中
  • 环境变量将输出到 .env.keys 文件中
  • 请将环境变量安全地添加到您的部署环境中
  • 建议定期轮换密钥（每90天一次）
      `);
  }
}

if (require.main === module) {
  main();
}

export { SecureKeyGenerator, KeyConfig };