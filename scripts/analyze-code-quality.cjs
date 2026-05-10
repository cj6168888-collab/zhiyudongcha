#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const serverDir = path.join(__dirname, '..', 'server');

function findAnyUsages(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) {
        continue;
      }
      findAnyUsages(fullPath, files);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.includes(': any') || trimmed.includes('any[]') || trimmed.includes('as any') || 
            trimmed.includes('Promise<any>') || trimmed.includes('<any>') ||
            trimmed.match(/function\s+\w+\s*\([^)]*\)\s*:\s*any/)) {
          files.push({
            file: path.relative(serverDir, fullPath),
            line: index + 1,
            content: trimmed.substring(0, 100)
          });
        }
      });
    }
  }
  
  return files;
}

function findTryCatchBlocks(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) {
        continue;
      }
      findTryCatchBlocks(fullPath, files);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const matches = content.match(/catch\s*\(/g);
      if (matches) {
        files.push({
          file: path.relative(serverDir, fullPath),
          count: matches.length
        });
      }
    }
  }
  
  return files;
}

console.log('🕵️ 代码质量分析报告\n');
console.log('='.repeat(60));

const anyUsages = findAnyUsages(serverDir);
const tryCatchUsages = findTryCatchBlocks(serverDir);

console.log('\n📊 TypeScript any 使用统计');
console.log('-'.repeat(40));
console.log(`总计: ${anyUsages.length} 处`);

const byFile = {};
anyUsages.forEach(usage => {
  if (!byFile[usage.file]) {
    byFile[usage.file] = [];
  }
  byFile[usage.file].push(usage);
});

console.log('\n🔥 热点文件 (Top 10):');
Object.entries(byFile)
  .sort((a, b) => b[1].length - a[1].length)
  .slice(0, 10)
  .forEach(([file, usages], i) => {
    console.log(`  ${i + 1}. ${file}: ${usages.length} 处`);
  });

console.log('\n📊 try-catch 使用统计');
console.log('-'.repeat(40));
const totalTryCatch = tryCatchUsages.reduce((sum, f) => sum + f.count, 0);
console.log(`总计: ${totalTryCatch} 处`);

const tryCatchByFile = tryCatchUsages.sort((a, b) => b.count - a.count);

console.log('\n🔥 热点文件 (Top 10):');
tryCatchByFile.slice(0, 10).forEach((item, i) => {
  console.log(`  ${i + 1}. ${item.file}: ${item.count} 处`);
});

console.log('\n' + '='.repeat(60));
console.log('📈 改进建议');
console.log('-'.repeat(40));

if (anyUsages.length > 50) {
  console.log('⚠️  建议: 优先处理以下场景的 any:');
  console.log('   1. Express req/res/next 参数');
  console.log('   2. 数据库查询结果');
  console.log('   3. 第三方 API 响应');
}

if (totalTryCatch > 500) {
  console.log('⚠️  建议: 考虑使用 Result<T> 类型封装错误');
  console.log('   参见: server/lib/result.ts');
}

console.log('\n✅ 使用新工具:');
console.log('   - Result<T>: server/lib/result.ts');
console.log('   - safeAsync: server/lib/result.ts');
console.log('   - API Response: server/lib/api-response.ts');

console.log('\n');
