/**
 * 毒蛇代码验收师 - 全方位系统扫描
 * 
 * 辣评特点：
 * 1. 毒舌不留情
 * 2. 一针见血
 * 3. 幽默讽刺
 * 4. 专业严谨
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

interface Issue {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  title: string;
  description: string;
  location?: string;
  suggestion?: string;
}

const ISSUES: Issue[] = [];

function addIssue(issue: Issue) {
  ISSUES.push(issue);
  const icon = issue.severity === 'critical' ? '💀' : 
               issue.severity === 'high' ? '🔴' : 
               issue.severity === 'medium' ? '🟠' : '🟡';
  console.log(`${icon} [${issue.severity.toUpperCase()}] ${issue.title}`);
  console.log(`   📍 ${issue.location || '全局'}`);
  console.log(`   💬 ${issue.description}`);
  if (issue.suggestion) {
    console.log(`   💡 建议: ${issue.suggestion}`);
  }
  console.log('');
}

test.describe('毒蛇代码验收师 - 全方位辣评扫描', () => {
  test('一、代码结构验收', async () => {
    console.log('\n');
    console.log('='.repeat(60));
    console.log('🐍 毒蛇代码验收师 - 开始全方位扫描');
    console.log('='.repeat(60));
    console.log('');
    
    // 1. 检查项目结构
    const serverFiles = fs.readdirSync('server').filter(f => f.endsWith('.ts'));
    const clientFiles = fs.readdirSync('client/src').filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
    const testFiles = fs.readdirSync('tests/e2e').filter(f => f.endsWith('.spec.ts'));
    
    console.log('📊 项目规模统计:');
    console.log(`   - 服务端文件: ${serverFiles.length} 个`);
    console.log(`   - 客户端文件: ${clientFiles.length} 个`);
    console.log(`   - 测试文件: ${testFiles.length} 个`);
    console.log('');
    
    // 辣评：服务文件过多
    if (serverFiles.length > 200) {
      addIssue({
        severity: 'high',
        category: '架构',
        title: '💀 服务端文件泛滥成灾',
        description: `你有 ${serverFiles.length} 个服务端 TypeScript 文件，已经超过合理范围。这不是在写代码，这是在堆积木！`,
        location: 'server/',
        suggestion: '建议拆分模块，使用 monorepo 或微服务架构'
      });
    }
    
    // 2. 检查路由文件
    const apiFiles = fs.readdirSync('server/api').filter(f => f.endsWith('.ts'));
    const servicesFiles = fs.readdirSync('server/services').filter(f => f.endsWith('.ts')).length;
    
    console.log('🔌 API 路由:');
    console.log(`   - 路由文件: ${apiFiles.length} 个`);
    console.log(`   - 服务文件: ${servicesFiles} 个`);
    console.log('');
    
    if (apiFiles.length > 50) {
      addIssue({
        severity: 'medium',
        category: 'API设计',
        title: '🔴 API 路由像意大利面条',
        description: `${apiFiles.length} 个路由文件，你是想让开发者玩寻宝游戏吗？`,
        location: 'server/api/',
        suggestion: '使用 API  versioning 或分组管理'
      });
    }
  });
  
  test('二、安全性辣评', async () => {
    console.log('\n');
    console.log('-'.repeat(60));
    console.log('🔒 二、安全性审查');
    console.log('-'.repeat(60));
    console.log('');
    
    // 1. 检查敏感文件
    const envFiles = fs.readdirSync('.').filter(f => f.startsWith('.env'));
    const hasEnvExample = fs.existsSync('.env.example');
    
    if (!hasEnvExample) {
      addIssue({
        severity: 'high',
        category: '安全',
        title: '🔴 没有 .env.example 文件',
        description: '你让其他开发者怎么知道需要什么环境变量？让他们猜谜吗？',
        location: '.env.example',
        suggestion: '立即创建 .env.example 文件，记录所有必需的环境变量'
      });
    }
    
    // 2. 检查硬编码密钥
    const indexContent = fs.readFileSync('server/index.ts', 'utf-8');
    if (indexContent.includes('password') && indexContent.includes('=') && !indexContent.includes('process.env')) {
      addIssue({
        severity: 'critical',
        category: '安全',
        title: '💀 硬编码密码 - 找死吗？',
        description: '在代码中硬编码密码是最愚蠢的行为，你的数据库正在裸奔！',
        location: 'server/index.ts',
        suggestion: '立即移除所有硬编码的敏感信息，使用环境变量'
      });
    }
    
    // 3. 检查 CORS 配置
    if (indexContent.includes('origin: "*"') || indexContent.includes("origin: '*'")) {
      addIssue({
        severity: 'high',
        category: '安全',
        title: '🔴 CORS  wildcard - 门户大开',
        description: '你设置了 CORS * 允许任何来源访问，这是给黑客送礼吗？',
        location: 'server/index.ts',
        suggestion: '指定明确的允许来源，不要偷懒用 *'
      });
    }
  });
  
  test('三、代码质量辣评', async () => {
    console.log('\n');
    console.log('-'.repeat(60));
    console.log('📝 三、代码质量审查');
    console.log('-'.repeat(60));
    console.log('');
    
    // 1. 检查 console.log 滥用
    let consoleLogCount = 0;
    const scanDir = (dir: string) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && !file.includes('node_modules') && !file.includes('.git')) {
          scanDir(fullPath);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const matches = content.match(/console\.(log|warn|error)/g);
          if (matches) consoleLogCount += matches.length;
        }
      }
    };
    scanDir('server');
    
    console.log(`📊 console.* 语句: ${consoleLogCount} 次`);
    console.log('');
    
    if (consoleLogCount > 500) {
      addIssue({
        severity: 'medium',
        category: '代码质量',
        title: '🟠 console.log 泛滥 - 日志污染',
        description: `你写了 ${consoleLogCount} 个 console.log，是想把控制台变成彩虹吗？生产环境会被你笑死！`,
        location: 'server/',
        suggestion: '使用专业的日志库如 pino 或 winston'
      });
    }
    
    // 2. 检查 any 类型滥用
    let anyTypeCount = 0;
    const scanForAny = (dir: string) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && !file.includes('node_modules') && !file.includes('.git')) {
          scanForAny(fullPath);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const matches = content.match(/: any\b/g);
          if (matches) anyTypeCount += matches.length;
        }
      }
    };
    scanForAny('server');
    
    console.log(`📊 any 类型使用: ${anyTypeCount} 次`);
    console.log('');
    
    if (anyTypeCount > 100) {
      addIssue({
        severity: 'high',
        category: '代码质量',
        title: '🔴 TypeScript 之耻 - any 滥用',
        description: `你用了 ${anyTypeCount} 次 any 类型，是在嘲讽 TypeScript 吗？类型安全被狗吃了吗？`,
        location: 'server/',
        suggestion: '使用 unknown 或具体类型替代 any'
      });
    }
  });
  
  test('四、依赖管理辣评', async () => {
    console.log('\n');
    console.log('-'.repeat(60));
    console.log('📦 四、依赖管理审查');
    console.log('-'.repeat(60));
    console.log('');
    
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    const depCount = Object.keys(pkg.dependencies || {}).length;
    const devDepCount = Object.keys(pkg.devDependencies || {}).length;
    
    console.log(`📊 依赖统计:`);
    console.log(`   - 生产依赖: ${depCount} 个`);
    console.log(`   - 开发依赖: ${devDepCount} 个`);
    console.log(`   - 总计: ${depCount + devDepCount} 个`);
    console.log('');
    
    if (depCount > 150) {
      addIssue({
        severity: 'high',
        category: '依赖',
        title: '🔴 依赖地狱 - 你在写操作系统吗？',
        description: `${depCount} 个生产依赖，你知道这意味着什么吗？依赖安全和维护成本的噩梦！`,
        location: 'package.json',
        suggestion: '检查并移除未使用的依赖，考虑替代方案'
      });
    }
    
    // 检查潜在危险的依赖
    const dangerous = ['eval', 'exec', 'system', 'child_process'];
    // 这里只是警告，实际需要更复杂的分析
    console.log('⚠️  注意: 未进行详细的依赖安全审计');
    console.log('');
  });
  
  test('五、测试覆盖辣评', async () => {
    console.log('\n');
    console.log('-'.repeat(60));
    console.log('🧪 五、测试覆盖审查');
    console.log('-'.repeat(60));
    console.log('');
    
    const testFiles = fs.readdirSync('tests/e2e').filter(f => f.endsWith('.spec.ts'));
    let totalTests = 0;
    
    for (const file of testFiles) {
      const content = fs.readFileSync(`tests/e2e/${file}`, 'utf-8');
      const matches = content.match(/test\(/g);
      if (matches) totalTests += matches.length;
    }
    
    console.log(`📊 测试统计:`);
    console.log(`   - 测试文件: ${testFiles.length} 个`);
    console.log(`   - 测试用例: ${totalTests} 个`);
    console.log('');
    
    if (totalTests < 50) {
      addIssue({
        severity: 'high',
        category: '测试',
        title: '🔴 测试覆盖率 - 裸奔的代码',
        description: `只有 ${totalTests} 个测试用例，你的代码是在裸奔！稍微改改就可能爆炸！`,
        location: 'tests/e2e/',
        suggestion: '增加测试覆盖，尤其是核心业务逻辑'
      });
    }
    
    // 检查关键模块是否有测试
    const hasApiTests = fs.existsSync('tests/e2e/api');
    if (!hasApiTests) {
      addIssue({
        severity: 'medium',
        category: '测试',
        title: '🟠 API 测试 - 缺失的防线',
        description: '没有找到 API 端点测试，你的后端接口就是在赌博！',
        location: 'tests/e2e/',
        suggestion: '添加 API 集成测试'
      });
    }
  });
  
  test('六、错误处理辣评', async () => {
    console.log('\n');
    console.log('-'.repeat(60));
    console.log('⚠️ 六、错误处理审查');
    console.log('-'.repeat(60));
    console.log('');
    
    // 检查 try-catch 滥用
    let tryCatchCount = 0;
    const scanTryCatch = (dir: string) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && !file.includes('node_modules')) {
          scanTryCatch(fullPath);
        } else if (file.endsWith('.ts')) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          tryCatchCount += (content.match(/try\s*{/g) || []).length;
        }
      }
    };
    scanTryCatch('server');
    
    console.log(`📊 try-catch 块: ${tryCatchCount} 个`);
    console.log('');
    
    if (tryCatchCount > 200) {
      addIssue({
        severity: 'medium',
        category: '错误处理',
        title: '🟠 try-catch 过度使用 - 掩盖问题',
        description: `你写了 ${tryCatchCount} 个 try-catch，是在玩套娃吗？真正的错误被埋藏在层层捕获中！`,
        location: 'server/',
        suggestion: '区分可恢复错误和不可恢复错误，让致命错误抛出'
      });
    }
  });
  
  test('七、输出最终辣评报告', async () => {
    console.log('\n');
    console.log('='.repeat(60));
    console.log('🐍 毒蛇验收报告 - 最终裁决');
    console.log('='.repeat(60));
    console.log('');
    
    const critical = ISSUES.filter(i => i.severity === 'critical').length;
    const high = ISSUES.filter(i => i.severity === 'high').length;
    const medium = ISSUES.filter(i => i.severity === 'medium').length;
    const low = ISSUES.filter(i => i.severity === 'low').length;
    const info = ISSUES.filter(i => i.severity === 'info').length;
    
    console.log(`📊 问题统计:`);
    console.log(`   💀 致命: ${critical} 个`);
    console.log(`   🔴 严重: ${high} 个`);
    console.log(`   🟠 中等: ${medium} 个`);
    console.log(`   🟡 轻微: ${low} 个`);
    console.log(`   ℹ️  信息: ${info} 个`);
    console.log('');
    
    // 辣评总结
    console.log('='.repeat(60));
    console.log('🐍 毒蛇辣评总结');
    console.log('='.repeat(60));
    console.log('');
    
    if (critical > 0) {
      console.log('💀 你的代码有 ' + critical + ' 个致命问题！');
      console.log('   这是毒蛇见过的最危险的情况之一！');
      console.log('   赶紧修复，否则就是给黑客打工！');
    } else if (high > 0) {
      console.log('🔴 你的代码有 ' + high + ' 个严重问题！');
      console.log('   说实话，我对你有点失望！');
      console.log('   但还不是最糟糕的，修复来得及！');
    } else if (medium > 0) {
      console.log('🟠 你的代码有 ' + medium + ' 个中等问题');
      console.log('   还算及格，但还有很大改进空间！');
    } else {
      console.log('✅ 恭喜！你的代码质量勉强入眼！');
    }
    
    console.log('');
    console.log('='.repeat(60));
    console.log('🔧 修复优先级:');
    console.log('='.repeat(60));
    console.log('');
    
    // 按优先级排序输出
    const sorted = [...ISSUES].sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      return order[a.severity] - order[b.severity];
    });
    
    sorted.slice(0, 10).forEach((issue, i) => {
      console.log(`${i + 1}. [${issue.severity.toUpperCase()}] ${issue.title}`);
      console.log(`   📍 ${issue.location}`);
    });
    
    console.log('');
    console.log('🐍 扫描完成！有毒蛇验收，你值得拥有！');
    console.log('');
    
    // 输出 JSON 格式结果
    const result = {
      timestamp: new Date().toISOString(),
      summary: { critical, high, medium, low, info },
      issues: ISSUES
    };
    
    console.log('📄 JSON 报告已生成');
  });
});
