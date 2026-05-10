#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const THRESHOLDS = {
  maxAny: 50,
  maxTryCatch: 100,
  maxFileSize: 50000,
};

const SERVER_DIR = path.join(__dirname, '..', 'server');

console.log('🕵️ 代码质量自动化检查\n');
console.log('='.repeat(50));

let hasError = false;

console.log('\n📊 1. TypeScript any 检查');
console.log('-'.repeat(40));

try {
  const output = execSync('node scripts/analyze-code-quality.cjs', { encoding: 'utf8' });
  const anyMatch = output.match(/总计:\s*(\d+)\s*处/);
  
  if (anyMatch) {
    const anyCount = parseInt(anyMatch[1]);
    console.log(`   any 使用: ${anyCount} 处`);
    
    if (anyCount > THRESHOLDS.maxAny) {
      console.log(`   ⚠️  超过阈值 ${THRESHOLDS.maxAny} 处`);
      hasError = true;
    } else {
      console.log(`   ✅ 符合标准 (< ${THRESHOLDS.maxAny})`);
    }
  }
} catch (e) {
  console.log('   ⚠️  无法运行分析脚本');
}

console.log('\n📊 2. 文件大小检查');
console.log('-'.repeat(40));

const largeFiles = [];
function checkFileSize(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      checkFileSize(fullPath);
    } else if (entry.name.endsWith('.ts')) {
      const stats = fs.statSync(fullPath);
      if (stats.size > THRESHOLDS.maxFileSize) {
        largeFiles.push({ file: fullPath, size: stats.size });
      }
    }
  }
}

try {
  checkFileSize(SERVER_DIR);
  if (largeFiles.length > 0) {
    console.log('   ⚠️  过大文件:');
    largeFiles.slice(0, 5).forEach(f => {
      const relPath = path.relative(SERVER_DIR, f.file);
      console.log(`   - ${relPath}: ${(f.size / 1024).toFixed(1)}KB`);
    });
    hasError = true;
  } else {
    console.log('   ✅ 无过大文件');
  }
} catch (e) {
  console.log('   ⚠️  无法检查文件大小');
}

console.log('\n📊 3. 新工具使用检查');
console.log('-'.repeat(40));

const newTools = [
  { file: 'server/lib/result.ts', name: 'Result<T>' },
  { file: 'server/lib/api-response.ts', name: 'API Response' },
  { file: 'server/types/express.d.ts', name: 'Express Types' },
];

newTools.forEach(tool => {
  const exists = fs.existsSync(path.join(__dirname, '..', tool.file));
  console.log(`   ${exists ? '✅' : '❌'} ${tool.name}`);
  if (!exists) hasError = true;
});

console.log('\n📊 4. 架构分组检查');
console.log('-'.repeat(40));

const architectureFiles = [
  'server/routes/route-groups.ts',
  'server/services/service-groups.ts',
  'server/storage/domains/index.ts',
];

architectureFiles.forEach(file => {
  const exists = fs.existsSync(path.join(__dirname, '..', file));
  console.log(`   ${exists ? '✅' : '❌'} ${file}`);
  if (!exists) hasError = true;
});

console.log('\n' + '='.repeat(50));

if (hasError) {
  console.log('❌ 代码质量检查未通过');
  process.exit(1);
} else {
  console.log('✅ 代码质量检查通过');
  process.exit(0);
}
