/**
 * 替换原生button为Button组件
 * 处理带有TODO-A11Y标记的button
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const stats = {
  filesProcessed: 0,
  buttonsReplaced: 0,
  errors: []
};

function replaceButtonsInFile(filePath) {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    
    if (!fs.existsSync(fullPath)) {
      return;
    }
    
    let content = fs.readFileSync(fullPath, 'utf-8');
    
    // 检查是否有TODO-A11Y标记
    if (!content.includes('TODO-A11Y')) {
      return;
    }
    
    // 检查是否已经导入Button
    const hasButtonImport = content.includes("import { Button }") || 
                           content.includes("import {Button}");
    
    if (!hasButtonImport) {
      // 在文件开头添加Button导入
      const importRegex = /^(import.*from.*;)/m;
      const firstImport = content.match(importRegex);
      if (firstImport) {
        content = content.replace(
          firstImport[0],
          `import { Button } from "@/components/ui/button";\n${firstImport[0]}`
        );
      }
    }
    
    // 替换button为Button
    // 移除TODO注释和data-a11y-fixed标记
    const buttonRegex = /<!-- TODO-A11Y: 替换为 <Button> 组件 -->\s*<button([^>]*?)data-a11y-fixed="true"([^>]*?)>([\s\S]*?)<\/button>/g;
    
    content = content.replace(buttonRegex, (match, attrs1, attrs2, children) => {
      const allAttrs = attrs1 + attrs2;
      
      // 提取className
      const classMatch = allAttrs.match(/className=["']([^"']+)["']/);
      const className = classMatch ? classMatch[1] : '';
      
      // 提取onClick
      const onClickMatch = allAttrs.match(/onClick=\{([^}]+)\}/);
      const onClick = onClickMatch ? `onClick={${onClickMatch[1]}}` : '';
      
      // 提取disabled
      const disabledMatch = allAttrs.match(/disabled=\{([^}]+)\}/);
      const disabled = disabledMatch ? `disabled={${disabledMatch[1]}}` : '';
      
      // 提取data-testid
      const testIdMatch = allAttrs.match(/data-testid=["']([^"']+)["']/);
      const testId = testIdMatch ? `data-testid="${testIdMatch[1]}"` : '';
      
      // 提取其他属性
      const otherAttrs = [];
      if (allAttrs.includes('type="submit"')) otherAttrs.push('type="submit"');
      if (allAttrs.includes('aria-label')) {
        const ariaLabelMatch = allAttrs.match(/aria-label=["']([^"']+)["']/);
        if (ariaLabelMatch) otherAttrs.push(`aria-label="${ariaLabelMatch[1]}"`);
      }
      
      // 简化className判断variant
      let variant = 'outline';
      if (className.includes('bg-primary') || className.includes('bg-cyan') || className.includes('bg-green')) {
        variant = 'default';
      } else if (className.includes('bg-destructive') || className.includes('bg-red')) {
        variant = 'destructive';
      } else if (className.includes('bg-ghost') || className.includes('hover:bg-transparent')) {
        variant = 'ghost';
      }
      
      // 判断size
      let size = '';
      if (className.includes('h-8') || className.includes('text-xs')) {
        size = 'size="sm"';
      } else if (className.includes('h-11') || className.includes('h-12')) {
        size = 'size="lg"';
      }
      
      stats.buttonsReplaced++;
      
      // 构建Button组件
      const buttonAttrs = [
        `variant="${variant}"`,
        size,
        onClick,
        disabled,
        testId,
        ...otherAttrs
      ].filter(Boolean).join(' ');
      
      return `<Button ${buttonAttrs}>${children.trim()}</Button>`;
    });
    
    fs.writeFileSync(fullPath, content, 'utf-8');
    stats.filesProcessed++;
    console.log(`✅ 已替换: ${filePath} (${stats.buttonsReplaced} buttons)`);
    
  } catch (error) {
    stats.errors.push({ file: filePath, error: error.message });
    console.error(`❌ 错误: ${filePath} - ${error.message}`);
  }
}

function main() {
  console.log('🚀 开始替换 Button 组件...\n');
  
  // 扫描所有tsx文件
  function scanDir(dir) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !file.includes('node_modules')) {
        scanDir(fullPath);
      } else if (file.endsWith('.tsx')) {
        const relativePath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');
        replaceButtonsInFile(relativePath);
      }
    });
  }
  
  scanDir('client/src');
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 替换统计:');
  console.log(`  处理文件: ${stats.filesProcessed}`);
  console.log(`  Button替换: ${stats.buttonsReplaced}`);
  
  if (stats.errors.length > 0) {
    console.log(`\n⚠️  错误数: ${stats.errors.length}`);
  }
  
  console.log('\n✅ Button替换完成!');
  console.log('📝 提示:');
  console.log('   - 请检查替换后的代码');
  console.log('   - 确保样式正确');
  console.log('   - 运行测试验证功能');
}

main();
