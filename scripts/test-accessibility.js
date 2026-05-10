/**
 * 可访问性测试脚本 (ES Module)
 * 
 * 运行方式:
 * node scripts/test-accessibility.js
 * 
 * 功能:
 * - 扫描组件可访问性
 * - 生成测试报告
 * - 输出修复建议
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
const CONFIG = {
  srcDir: path.join(__dirname, '..', 'client', 'src'),
  reportFile: path.join(__dirname, '..', 'docs', 'ACCESSIBILITY_TEST_REPORT.md'),
};

// 统计对象
const stats = {
  files: 0,
  issues: {
    button: 0,
    input: 0,
    label: 0,
    img: 0,
    total: 0
  },
  filesWithIssues: []
};

// 扫描文件
function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const issues = [];
  const relativePath = path.relative(process.cwd(), filePath);

  // 检查原生 button
  const buttonMatches = content.match(/<button[\s\S]*?>/g);
  if (buttonMatches) {
    issues.push({
      type: 'button',
      count: buttonMatches.length,
      message: '发现原生 button 标签，建议使用 <Button> 组件'
    });
    stats.issues.button += buttonMatches.length;
  }

  // 检查 input 标签 (排除 import 语句)
  const inputMatches = content.match(/<input[^>]*>/g);
  if (inputMatches) {
    let inputIssues = 0;
    inputMatches.forEach((input) => {
      const hasAriaLabel = input.includes('aria-label');
      const hasAriaLabelledBy = input.includes('aria-labelledby');
      const hasId = input.includes('id=');
      
      // 简单检查：如果 input 没有 id，可能无法关联 label
      if (!hasAriaLabel && !hasAriaLabelledBy) {
        inputIssues++;
      }
    });
    
    if (inputIssues > 0) {
      issues.push({
        type: 'input',
        count: inputIssues,
        message: 'Input 可能缺少 label 或 aria-label'
      });
      stats.issues.input += inputIssues;
    }
  }

  // 检查 label
  const labelMatches = content.match(/<label[\s>][^>]*>/g);
  if (labelMatches) {
    let labelIssues = 0;
    labelMatches.forEach((label) => {
      if (!label.includes('htmlFor') && !label.includes('for=')) {
        labelIssues++;
      }
    });
    
    if (labelIssues > 0) {
      issues.push({
        type: 'label',
        count: labelIssues,
        message: 'Label 缺少 htmlFor 属性'
      });
      stats.issues.label += labelIssues;
    }
  }

  // 检查 img
  const imgMatches = content.match(/<img[^>]*>/g);
  if (imgMatches) {
    let imgIssues = 0;
    imgMatches.forEach((img) => {
      if (!img.includes('alt=')) {
        imgIssues++;
      }
    });
    
    if (imgIssues > 0) {
      issues.push({
        type: 'img',
        count: imgIssues,
        message: 'Image 缺少 alt 属性'
      });
      stats.issues.img += imgIssues;
    }
  }

  if (issues.length > 0) {
    stats.filesWithIssues.push({
      file: relativePath,
      issues: issues
    });
    stats.issues.total += issues.length;
  }

  stats.files++;
}

// 递归扫描目录
function scanDirectory(dir) {
  const items = fs.readdirSync(dir);
  
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.includes('node_modules')) {
      scanDirectory(fullPath);
    } else if (stat.isFile() && item.endsWith('.tsx')) {
      scanFile(fullPath);
    }
  });
}

// 生成报告
function generateReport() {
  const timestamp = new Date().toLocaleString('zh-CN');
  
  const report = `# 可访问性测试报告

**生成时间**: ${timestamp}
**扫描文件**: ${stats.files} 个
**发现问题**: ${stats.issues.total} 个
**问题文件**: ${stats.filesWithIssues.length} 个

---

## 📊 问题统计

| 类型 | 数量 | 严重程度 | 优先级 |
|------|------|----------|--------|
| Button (原生) | ${stats.issues.button} | 🔴 高 | P0 |
| Input (无label) | ${stats.issues.input} | 🔴 高 | P0 |
| Label (无htmlFor) | ${stats.issues.label} | 🟡 中 | P1 |
| Image (无alt) | ${stats.issues.img} | 🟡 中 | P1 |
| **总计** | **${stats.issues.total}** | - | - |

---

## 🎯 修复计划

### 立即修复 (P0)
- [ ] 替换 ${stats.issues.button} 个原生 button 为 Button 组件
- [ ] 为 ${stats.issues.input} 个 input 添加 label 关联

### 本周修复 (P1)
- [ ] 修复 ${stats.issues.label} 个 label 的 htmlFor
- [ ] 为 ${stats.issues.img} 个 img 添加 alt

---

## 📁 问题文件列表 (前 20 个)

${stats.filesWithIssues.slice(0, 20).map(({ file, issues }) => `
### ${file}
${issues.map(issue => `- **${issue.type}** (${issue.count}处): ${issue.message}`).join('\n')}
`).join('\n---\n')}

${stats.filesWithIssues.length > 20 ? `\n... 还有 ${stats.filesWithIssues.length - 20} 个文件\n` : ''}

---

## 🛠️ 修复命令

### 批量替换 Button
\`\`\`bash
# 查找所有原生 button
find client/src -name "*.tsx" -exec grep -l "<button" {} \\;

# 使用 IDE 批量替换
# 搜索: <button([^>]*)>
# 替换: <Button$1>
\`\`\`

### 批量修复 Input
\`\`\`bash
# 查找所有无 label 的 input
grep -r "<input" client/src --include="*.tsx" | grep -v "aria-label"
\`\`\`

---

## ✅ 验证检查清单

- [ ] axe-core 扫描 0 错误
- [ ] Lighthouse 可访问性 > 90
- [ ] 键盘导航测试通过
- [ ] 屏幕阅读器测试通过

---

**报告生成**: Day 3 进度检查
`;

  fs.writeFileSync(CONFIG.reportFile, report);
  console.log(`\n✅ 报告已生成: ${CONFIG.reportFile}`);
}

// 主函数
function main() {
  console.log('🔍 开始可访问性扫描...\n');
  
  if (!fs.existsSync(CONFIG.srcDir)) {
    console.error(`❌ 错误: 找不到目录 ${CONFIG.srcDir}`);
    process.exit(1);
  }
  
  scanDirectory(CONFIG.srcDir);
  
  console.log('\n📊 扫描结果:');
  console.log('═══════════════════════════════════════');
  console.log(`  扫描文件: ${stats.files}`);
  console.log(`  问题文件: ${stats.filesWithIssues.length}`);
  console.log(`  总问题数: ${stats.issues.total}`);
  console.log('═══════════════════════════════════════');
  console.log('');
  console.log('📋 问题详情:');
  console.log(`  🔴 Button (原生):    ${stats.issues.button} 处`);
  console.log(`  🔴 Input (无label):   ${stats.issues.input} 处`);
  console.log(`  🟡 Label (无htmlFor): ${stats.issues.label} 处`);
  console.log(`  🟡 Image (无alt):     ${stats.issues.img} 处`);
  console.log('');
  
  generateReport();
  
  console.log('✨ 扫描完成!');
  console.log('');
  console.log('📄 查看详细报告:');
  console.log(`   ${CONFIG.reportFile}`);
  console.log('');
  console.log('🚀 下一步:');
  console.log('   1. 查看报告中的问题文件');
  console.log('   2. 按优先级修复问题');
  console.log('   3. 运行测试验证');
}

// 运行
main();
