/**
 * ============================================================================
 *           🐍 毒舌架构师 - 全方位系统扫描验收
 * ============================================================================
 * 
 * 扫描范围:
 * 1. 所有页面路由
 * 2. 所有按钮和交互元素
 * 3. 所有API端点
 * 4. 代码实现逻辑
 * 5. 架构设计缺陷
 * 
 * 辣评风格: 毒舌、不留面子、一针见血
 * 
 * ============================================================================
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

interface ScanResult {
  category: string;
  items: {
    name: string;
    status: 'pass' | 'fail' | 'warning';
    details: string;
    score: number; // 0-10
  }[];
}

const results: ScanResult[] = [];

function addResult(category: string, name: string, status: 'pass' | 'fail' | 'warning', details: string, score: number) {
  const existing = results.find(r => r.category === category);
  if (existing) {
    existing.items.push({ name, status, details, score });
  } else {
    results.push({ category, items: [{ name, status, details, score }] });
  }
  const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️';
  console.log(`  ${icon} ${name}: ${details} (${score}/10)`);
}

test.describe('🐍 毒舌架构师 - 全方位系统扫描', () => {

  test('一、页面路由全面扫描', async ({ page }) => {
    console.log('\n');
    console.log('═'.repeat(70));
    console.log('🐍 一、页面路由全面扫描');
    console.log('═'.repeat(70));

    const routes = [
      { path: '/', name: '首页/Dashboard' },
      { path: '/chat', name: '对话页' },
      { path: '/settings', name: '设置页' },
      { path: '/network', name: '关系网络' },
      { path: '/spirit', name: '灵魂控制' },
      { path: '/brain', name: '策略大脑' },
      { path: '/terminal', name: '战术终端' },
      { path: '/vault', name: '保险库' },
      { path: '/projects', name: '项目中心' },
      { path: '/intel', name: '情报室' },
    ];

    let passed = 0;
    let failed = 0;

    for (const route of routes) {
      try {
        const response = await page.goto(`http://localhost:5000${route.path}`, {
          waitUntil: 'domcontentloaded',
          timeout: 15000
        });
        
        if (response && response.status() < 500) {
          passed++;
          addResult('页面路由', route.name, 'pass', `HTTP ${response.status()}`, 10);
        } else {
          failed++;
          addResult('页面路由', route.name, 'fail', `HTTP ${response?.status()}`, 0);
        }
      } catch (e) {
        failed++;
        addResult('页面路由', route.name, 'fail', (e as Error).message, 0);
      }
    }

    console.log(`\n  📊 页面路由得分: ${passed}/${routes.length}`);
    if (failed > routes.length * 0.3) {
      addResult('页面路由', '总体评分', 'fail', `仅 ${passed}/${routes.length} 可访问`, Math.round(passed / routes.length * 10));
    }
  });

  test('二、页面交互元素扫描', async ({ page }) => {
    console.log('\n');
    console.log('═'.repeat(70));
    console.log('🐍 二、页面交互元素扫描');
    console.log('═'.repeat(70));

    await page.goto('http://localhost:5000/', { waitUntil: 'networkidle' });

    const buttons = await page.locator('button').all();
    const links = await page.locator('a').all();
    const inputs = await page.locator('input, textarea, select').all();
    
    console.log(`\n  📊 交互元素统计:`);
    console.log(`     按钮: ${buttons.length}`);
    console.log(`     链接: ${links.length}`);
    console.log(`     输入框: ${inputs.length}`);

    if (buttons.length < 5) {
      addResult('交互元素', '首页按钮数量', 'fail', `仅 ${buttons.length} 个按钮，太少了！`, 2);
    } else if (buttons.length > 50) {
      addResult('交互元素', '首页按钮数量', 'warning', `${buttons.length} 个按钮，管理不过来了吧？`, 6);
    } else {
      addResult('交互元素', '首页按钮数量', 'pass', `${buttons.length} 个按钮，还算正常`, 8);
    }

    if (links.length < 1) {
      addResult('交互元素', '导航链接', 'fail', '没有导航链接？用户在迷宫里转悠！', 0);
    } else {
      addResult('交互元素', '导航链接', 'pass', `${links.length} 个链接`, 8);
    }

    if (inputs.length < 3) {
      addResult('交互元素', '输入元素', 'warning', `仅 ${inputs.length} 个输入，能干啥？`, 5);
    } else {
      addResult('交互元素', '输入元素', 'pass', `${inputs.length} 个输入框`, 8);
    }
  });

  test('三、API端点扫描', async ({ request }) => {
    console.log('\n');
    console.log('═'.repeat(70));
    console.log('🐍 三、API端点扫描');
    console.log('═'.repeat(70));

    const endpoints = [
      { url: 'http://localhost:3000/api/health', name: '健康检查' },
      { url: 'http://localhost:3000/api/services/status', name: '服务状态' },
      { url: 'http://localhost:3000/api/monitoring/metrics', name: '监控指标' },
    ];

    let available = 0;
    let unavailable = 0;

    for (const endpoint of endpoints) {
      try {
        const response = await request.get(endpoint.url, { timeout: 5000 });
        if (response.status() < 500) {
          available++;
          addResult('API端点', endpoint.name, 'pass', `HTTP ${response.status()}`, 10);
        } else {
          unavailable++;
          addResult('API端点', endpoint.name, 'fail', `HTTP ${response.status()}`, 0);
        }
      } catch (e) {
        unavailable++;
        addResult('API端点', endpoint.name, 'fail', '无法连接', 0);
      }
    }

    console.log(`\n  📊 API可用性: ${available}/${endpoints.length}`);
    
    if (available === 0) {
      addResult('API端点', '后端服务', 'fail', '后端完全不可用！你在逗我？', 0);
    } else if (available < endpoints.length) {
      addResult('API端点', '后端服务', 'warning', `仅 ${available}/${endpoints.length} 可用`, 5);
    }
  });

  test('四、代码质量扫描', async () => {
    console.log('\n');
    console.log('═'.repeat(70));
    console.log('🐍 四、代码质量扫描');
    console.log('═'.repeat(70));

    // 扫描 any 类型
    let anyCount = 0;
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
          if (matches) anyCount += matches.length;
        }
      }
    };
    scanForAny('server');

    console.log(`\n  📊 any 类型使用: ${anyCount} 次`);
    
    if (anyCount > 300) {
      addResult('代码质量', 'TypeScript 类型安全', 'fail', `${anyCount} 个 any，类型系统崩盘！`, 1);
    } else if (anyCount > 100) {
      addResult('代码质量', 'TypeScript 类型安全', 'warning', `${anyCount} 个 any，勉强能用`, 5);
    } else {
      addResult('代码质量', 'TypeScript 类型安全', 'pass', `${anyCount} 个 any，还行`, 8);
    }

    // 扫描 try-catch
    let tryCatchCount = 0;
    const scanForTryCatch = (dir: string) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && !file.includes('node_modules')) {
          scanForTryCatch(fullPath);
        } else if (file.endsWith('.ts')) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          tryCatchCount += (content.match(/try\s*{/g) || []).length;
        }
      }
    };
    scanForTryCatch('server');

    console.log(`  📊 try-catch 块: ${tryCatchCount} 个`);
    
    if (tryCatchCount > 2000) {
      addResult('代码质量', '错误处理', 'fail', `${tryCatchCount} 个 try-catch，错误被埋了！`, 2);
    } else if (tryCatchCount > 500) {
      addResult('代码质量', '错误处理', 'warning', `${tryCatchCount} 个 try-catch，偏多`, 6);
    } else {
      addResult('代码质量', '错误处理', 'pass', `${tryCatchCount} 个 try-catch，正常`, 8);
    }

    // 扫描 console.log
    let consoleCount = 0;
    const scanForConsole = (dir: string) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && !file.includes('node_modules')) {
          scanForConsole(fullPath);
        } else if (file.endsWith('.ts')) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          consoleCount += (content.match(/console\.(log|warn|error)/g) || []).length;
        }
      }
    };
    scanForConsole('server');

    console.log(`  📊 console.* 语句: ${consoleCount} 次`);
    
    if (consoleCount > 100) {
      addResult('代码质量', '日志规范', 'fail', `${consoleCount} 个 console.log，生产环境会被淹没！`, 2);
    } else {
      addResult('代码质量', '日志规范', 'pass', `${consoleCount} 个 console.log，还行`, 7);
    }
  });

  test('五、架构设计扫描', async () => {
    console.log('\n');
    console.log('═'.repeat(70));
    console.log('🐍 五、架构设计扫描');
    console.log('═'.repeat(70));

    // 检查目录结构
    const servicesCount = fs.readdirSync('server/services').filter(f => f.endsWith('.ts')).length;
    const routesCount = fs.readdirSync('server/routes').filter(f => f.endsWith('.ts')).length;
    const modulesExist = fs.existsSync('server/modules');

    console.log(`\n  📊 架构统计:`);
    console.log(`     服务文件: ${servicesCount}`);
    console.log(`     路由文件: ${routesCount}`);
    console.log(`     模块目录: ${modulesExist ? '存在' : '不存在'}`);

    if (servicesCount > 100) {
      addResult('架构设计', '服务层组织', 'fail', `${servicesCount} 个服务文件堆积，垃圾堆？`, 2);
    } else if (servicesCount > 50) {
      addResult('架构设计', '服务层组织', 'warning', `${servicesCount} 个服务，太多太乱`, 5);
    } else {
      addResult('架构设计', '服务层组织', 'pass', `${servicesCount} 个服务，合理`, 8);
    }

    if (!modulesExist) {
      addResult('架构设计', '领域模块', 'fail', '没有 modules 目录，架构意识在哪？', 3);
    } else {
      const modulesCount = fs.readdirSync('server/modules').length;
      addResult('架构设计', '领域模块', 'pass', `${modulesCount} 个领域模块`, 8);
    }

    if (routesCount > 100) {
      addResult('架构设计', '路由组织', 'fail', `${routesCount} 个路由文件，意大利面？`, 2);
    } else if (routesCount > 30) {
      addResult('架构设计', '路由组织', 'warning', `${routesCount} 个路由，偏多`, 6);
    } else {
      addResult('架构设计', '路由组织', 'pass', `${routesCount} 个路由，正常`, 8);
    }
  });

  test('六、测试覆盖扫描', async () => {
    console.log('\n');
    console.log('═'.repeat(70));
    console.log('🐍 六、测试覆盖扫描');
    console.log('═'.repeat(70));

    const testFiles = fs.readdirSync('tests/e2e').filter(f => f.endsWith('.spec.ts'));
    let totalTests = 0;

    for (const file of testFiles) {
      const content = fs.readFileSync(`tests/e2e/${file}`, 'utf-8');
      const matches = content.match(/test\(/g);
      if (matches) totalTests += matches.length;
    }

    console.log(`\n  📊 测试统计:`);
    console.log(`     测试文件: ${testFiles.length}`);
    console.log(`     测试用例: ${totalTests}`);

    if (totalTests < 50) {
      addResult('测试覆盖', '测试用例数量', 'fail', `${totalTests} 个测试，覆盖率0.1%？逗我呢！`, 1);
    } else if (totalTests < 200) {
      addResult('测试覆盖', '测试用例数量', 'warning', `${totalTests} 个测试，偏少`, 5);
    } else {
      addResult('测试覆盖', '测试用例数量', 'pass', `${totalTests} 个测试，勉强够用`, 8);
    }

    const hasApiTest = fs.existsSync('tests/e2e/api-integration.spec.ts');
    if (!hasApiTest) {
      addResult('测试覆盖', 'API集成测试', 'fail', '没有 API 集成测试，后端在裸奔！', 0);
    } else {
      addResult('测试覆盖', 'API集成测试', 'pass', '有 API 集成测试', 8);
    }
  });

  test('七、安全性扫描', async () => {
    console.log('\n');
    console.log('═'.repeat(70));
    console.log('🐍 七、安全性扫描');
    console.log('═'.repeat(70));

    // 检查敏感文件
    const hasEnvExample = fs.existsSync('.env.example');
    const hasEnv = fs.existsSync('.env');
    
    if (!hasEnvExample) {
      addResult('安全性', '.env.example', 'fail', '没有 .env.example，其他开发者怎么玩？', 0);
    } else {
      addResult('安全性', '.env.example', 'pass', '有环境变量模板', 8);
    }

    // 检查硬编码密钥
    let hardcodedSecrets = 0;
    const scanForSecrets = (dir: string) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && !file.includes('node_modules')) {
          scanForSecrets(fullPath);
        } else if (file.endsWith('.ts') && !file.includes('.spec.')) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          if (content.match(/password\s*=\s*['"][^'"]+['"]/i) ||
              content.match(/secret\s*=\s*['"][^'"]+['"]/i) ||
              content.match(/apiKey\s*=\s*['"][^'"]+['"]/i)) {
            hardcodedSecrets++;
          }
        }
      }
    };
    scanForSecrets('server');

    console.log(`\n  📊 安全扫描:`);
    console.log(`     硬编码密钥: ${hardcodedSecrets} 个可疑`);

    if (hardcodedSecrets > 0) {
      addResult('安全性', '密钥管理', 'fail', `${hardcodedSecrets} 个文件疑似硬编码密钥，找死！`, 0);
    } else {
      addResult('安全性', '密钥管理', 'pass', '未发现硬编码密钥', 10);
    }

    // 检查 CORS
    const indexContent = fs.readFileSync('server/index.ts', 'utf-8');
    const hasWildcardCors = indexContent.includes('origin: "*"') || indexContent.includes("origin: '*'");
    
    if (hasWildcardCors) {
      addResult('安全性', 'CORS配置', 'fail', 'CORS 允许所有来源，黑客在向你招手！', 1);
    } else {
      addResult('安全性', 'CORS配置', 'pass', 'CORS 配置正常', 9);
    }
  });

  test('八、性能扫描', async ({ page }) => {
    console.log('\n');
    console.log('═'.repeat(70));
    console.log('🐍 八、性能扫描');
    console.log('═'.repeat(70));

    const start = Date.now();
    await page.goto('http://localhost:5000/', { waitUntil: 'networkidle' });
    const loadTime = Date.now() - start;

    console.log(`\n  📊 页面加载时间: ${loadTime}ms`);

    if (loadTime > 10000) {
      addResult('性能', '首屏加载', 'fail', `${loadTime}ms，慢成狗了！`, 1);
    } else if (loadTime > 5000) {
      addResult('性能', '首屏加载', 'warning', `${loadTime}ms，偏慢`, 5);
    } else {
      addResult('性能', '首屏加载', 'pass', `${loadTime}ms，还行`, 8);
    }

    // 检查资源
    const images = await page.locator('img').count();
    const scripts = await page.locator('script').count();
    const styles = await page.locator('link[rel="stylesheet"]').count();

    console.log(`     图片: ${images}`);
    console.log(`     脚本: ${scripts}`);
    console.log(`     样式: ${styles}`);

    if (scripts > 20) {
      addResult('性能', 'JS资源', 'warning', `${scripts} 个脚本，太多了吧？`, 5);
    } else {
      addResult('性能', 'JS资源', 'pass', `${scripts} 个脚本，正常`, 8);
    }
  });

  test('九、生成最终辣评报告', async () => {
    console.log('\n');
    console.log('═'.repeat(70));
    console.log('🐍 毒舌架构师 - 最终辣评报告');
    console.log('═'.repeat(70));

    // 计算总分
    let totalScore = 0;
    let totalItems = 0;

    for (const result of results) {
      for (const item of result.items) {
        totalScore += item.score;
        totalItems++;
      }
    }

    const avgScore = Math.round(totalScore / totalItems * 10) / 10;

    console.log(`\n`);
    console.log('╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║                      🐍 最终评分 🐍                                ║');
    console.log('╠══════════════════════════════════════════════════════════════════════╣');
    console.log(`║  平均得分: ${avgScore}/10                                               ║`);
    console.log(`║  评估项目: ${totalItems} 个                                              ║`);
    console.log('╚══════════════════════════════════════════════════════════════════════╝');
    console.log(`\n`);

    // 按类别汇总
    console.log('═'.repeat(70));
    console.log('📊 分类得分:');
    console.log('═'.repeat(70));

    for (const result of results) {
      const categoryScore = result.items.reduce((sum, item) => sum + item.score, 0) / result.items.length;
      const stars = '⭐'.repeat(Math.round(categoryScore));
      console.log(`  ${result.category}: ${categoryScore.toFixed(1)}/10 ${stars}`);
    }

    console.log(`\n`);

    // 毒舌点评
    console.log('═'.repeat(70));
    console.log('🐍 毒舌辣评:');
    console.log('═'.repeat(70));

    if (avgScore >= 8) {
      console.log('  不错嘛！代码质量勉强入眼，继续保持！');
    } else if (avgScore >= 6) {
      console.log('  及格边缘徘徊，还有很大改进空间！');
    } else if (avgScore >= 4) {
      console.log('  及格都达不到，代码质量堪忧啊！');
    } else {
      console.log('  这代码是怎么写出来的？是在逗我玩吗？');
    }

    // 列出最严重的问题
    const failures = results.flatMap(r => r.items.filter(i => i.status === 'fail'));
    if (failures.length > 0) {
      console.log(`\n  💀 致命问题 (${failures.length}个):`);
      failures.forEach((f, i) => {
        console.log(`     ${i + 1}. ${f.name}: ${f.details}`);
      });
    }

    const warnings = results.flatMap(r => r.items.filter(i => i.status === 'warning'));
    if (warnings.length > 0) {
      console.log(`\n  ⚠️ 警告问题 (${warnings.length}个):`);
      warnings.slice(0, 5).forEach((w, i) => {
        console.log(`     ${i + 1}. ${w.name}: ${w.details}`);
      });
    }

    console.log(`\n`);
    console.log('═'.repeat(70));
    console.log('🐍 毒蛇寄语:');
    console.log('═'.repeat(70));
    console.log(`
  孩子，写代码不容易，但你得用心啊！
  
  ${avgScore >= 8 ? '勉强及格，继续保持！' : '还不赶紧去改！'}
  
  代码是写给人看的，不是写给机器看的！
  你是想让后人维护你的代码时骂娘吗？
  
  赶紧把那些 any 给我换了！
  赶紧把那些 try-catch 给我理清了！
  赶紧把测试给我加上！
  
  滚去改代码吧！
    `);
    console.log('═'.repeat(70));
  });
});
