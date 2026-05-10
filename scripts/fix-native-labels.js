/**
 * 修复原生 label 标签的 htmlFor 关联
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const stats = {
  filesProcessed: 0,
  labelsFixed: 0,
  errors: []
};

const filesToFix = [
  'client/src/components/z1/voiceprint-lock.tsx',
  'client/src/pages/chat-demo.tsx',
  'client/src/pages/command-center.tsx',
  'client/src/pages/creator-god.tsx',
  'client/src/pages/relationship-network.tsx',
  'client/src/pages/settings.tsx',
  'client/src/pages/smart-project-create.tsx',
  'client/src/pages/swarm-console.tsx',
  'client/src/pages/interface-x.tsx',
  'client/src/pages/project-templates.tsx',
  'client/src/pages/talk-session.tsx',
];

function fixLabelsInFile(filePath) {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    
    if (!fs.existsSync(fullPath)) {
      return;
    }
    
    let content = fs.readFileSync(fullPath, 'utf-8');
    let modified = false;
    let labelCount = 0;
    
    // 匹配原生 <label> 标签
    const labelRegex = /<label([^>]*)>([^<]+)<\/label>/g;
    
    content = content.replace(labelRegex, (match, attrs, text) => {
      // 如果已经有 htmlFor 或 for，跳过
      if (attrs.includes('htmlFor') || attrs.includes('for=')) {
        return match;
      }
      
      labelCount++;
      modified = true;
      
      // 生成 htmlFor id
      const id = text.trim()
        .toLowerCase()
        .replace(/[^\w\s\u4e00-\u9fa5]/g, '') // 保留中文
        .replace(/\s+/g, '-')
        .substring(0, 30);
      
      // 返回带有 htmlFor 的 label
      return `<label htmlFor="${id}"${attrs}>${text}</label>`;
    });
    
    if (modified) {
      fs.writeFileSync(fullPath, content, 'utf-8');
      stats.filesProcessed++;
      stats.labelsFixed += labelCount;
      console.log(`✅ 已修复: ${filePath} (${labelCount} labels)`);
    } else {
      console.log(`⏭️  无需修复: ${filePath}`);
    }
    
  } catch (error) {
    stats.errors.push({ file: filePath, error: error.message });
    console.error(`❌ 错误: ${filePath} - ${error.message}`);
  }
}

function main() {
  console.log('🚀 开始修复原生 label 标签...\n');
  
  filesToFix.forEach(fixLabelsInFile);
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 修复统计:');
  console.log(`  处理文件: ${stats.filesProcessed}`);
  console.log(`  Label修复: ${stats.labelsFixed}`);
  
  if (stats.errors.length > 0) {
    console.log(`\n⚠️  错误数: ${stats.errors.length}`);
  }
  
  console.log('\n✅ 原生 label 修复完成!');
}

main();
