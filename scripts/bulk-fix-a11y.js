/**
 * 批量可访问性修复脚本
 * 自动为input添加aria-label，标记需要替换的button
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const stats = {
  filesProcessed: 0,
  inputsFixed: 0,
  buttonsMarked: 0,
  errors: []
};

// 需要修复的文件列表
const filesToFix = [
  'client/src/pages/email-manager.tsx',
  'client/src/pages/birth-experience.tsx',
  'client/src/pages/genesis.tsx',
  'client/src/pages/relationship-network.tsx',
  'client/src/pages/ar-hud.tsx',
  'client/src/pages/smart-project-create.tsx',
  'client/src/pages/settings.tsx',
  'client/src/pages/glasses-companion.tsx',
  'client/src/pages/strategy-brain.tsx',
];

function fixFile(filePath) {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  文件不存在: ${filePath}`);
      return;
    }
    
    let content = fs.readFileSync(fullPath, 'utf-8');
    let modified = false;
    
    // 修复1: 为没有aria-label的input添加aria-label
    const inputRegex = /<input([^>]*?)>/g;
    content = content.replace(inputRegex, (match, attrs) => {
      if (attrs.includes('aria-label') || attrs.includes('aria-labelledby')) {
        return match;
      }
      
      // 尝试从placeholder提取标签文本
      const placeholderMatch = attrs.match(/placeholder=["']([^"']+)["']/);
      const labelText = placeholderMatch ? placeholderMatch[1] : '输入字段';
      
      stats.inputsFixed++;
      modified = true;
      return `<input${attrs} aria-label="${labelText}"`;
    });
    
    // 修复2: 为原生button添加注释标记
    const buttonRegex = /<button([\s\S]*?)>([\s\S]*?)<\/button>/g;
    content = content.replace(buttonRegex, (match, attrs, children) => {
      if (attrs.includes('data-a11y-fixed')) {
        return match;
      }
      
      stats.buttonsMarked++;
      modified = true;
      return `<!-- TODO-A11Y: 替换为 <Button> 组件 -->\n<button${attrs} data-a11y-fixed="true">${children}</button>`;
    });
    
    if (modified) {
      fs.writeFileSync(fullPath, content, 'utf-8');
      stats.filesProcessed++;
      console.log(`✅ 已修复: ${filePath}`);
    } else {
      console.log(`⏭️  跳过: ${filePath} (无需修复)`);
    }
    
  } catch (error) {
    stats.errors.push({ file: filePath, error: error.message });
    console.error(`❌ 错误: ${filePath} - ${error.message}`);
  }
}

function main() {
  console.log('🚀 开始批量可访问性修复...\n');
  
  filesToFix.forEach(fixFile);
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 修复统计:');
  console.log(`  处理文件: ${stats.filesProcessed}`);
  console.log(`  Input修复: ${stats.inputsFixed}`);
  console.log(`  Button标记: ${stats.buttonsMarked}`);
  
  if (stats.errors.length > 0) {
    console.log(`\n⚠️  错误数: ${stats.errors.length}`);
  }
  
  console.log('\n✅ 完成!');
  console.log('📝 提示:');
  console.log('   - 搜索 "aria-label" 查看新增的输入标签');
  console.log('   - 搜索 "TODO-A11Y" 查看需要替换的button');
}

main();
