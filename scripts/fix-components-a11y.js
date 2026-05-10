/**
 * 可访问性修复 - Components目录批量处理
 * 修复components目录下的可访问性问题
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

// 优先处理的核心组件
const priorityComponents = [
  'client/src/components/ui/dialog-accessible.tsx',
  'client/src/components/ui/mobile-nav.tsx',
  'client/src/components/ui/star-map.tsx',
  'client/src/components/z1/ai-config-panel.tsx',
  'client/src/components/z3/collaboration-panel.tsx',
  'client/src/components/avatar/avatar-modes.tsx',
  'client/src/components/birth/laboratory-scene.tsx',
  'client/src/components/mobile-voice-sheet.tsx',
];

function fixFile(filePath) {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  跳过: ${filePath} (不存在)`);
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
      console.log(`⏭️  无需修复: ${filePath}`);
    }
    
  } catch (error) {
    stats.errors.push({ file: filePath, error: error.message });
    console.error(`❌ 错误: ${filePath} - ${error.message}`);
  }
}

function scanDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !file.includes('node_modules')) {
      scanDirectory(fullPath);
    } else if (file.endsWith('.tsx') && !file.endsWith('.test.tsx')) {
      // 计算相对路径
      const relativePath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');
      fixFile(relativePath);
    }
  });
}

function main() {
  console.log('🚀 开始修复 Components 目录...\n');
  
  // 先处理优先级组件
  console.log('📋 处理优先级组件...');
  priorityComponents.forEach(fixFile);
  
  // 扫描整个components目录
  console.log('\n📁 扫描整个 components 目录...');
  scanDirectory('client/src/components');
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 修复统计:');
  console.log(`  处理文件: ${stats.filesProcessed}`);
  console.log(`  Input修复: ${stats.inputsFixed}`);
  console.log(`  Button标记: ${stats.buttonsMarked}`);
  
  if (stats.errors.length > 0) {
    console.log(`\n⚠️  错误数: ${stats.errors.length}`);
  }
  
  console.log('\n✅ Components目录修复完成!');
}

main();
