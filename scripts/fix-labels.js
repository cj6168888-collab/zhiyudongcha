/**
 * 修复 Label htmlFor 关联
 * 为缺少 htmlFor 的 Label 添加关联属性
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

// 需要修复的文件列表 (来自Day 3报告)
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
      console.log(`⚠️  跳过: ${filePath} (不存在)`);
      return;
    }
    
    let content = fs.readFileSync(fullPath, 'utf-8');
    let modified = false;
    let labelCount = 0;
    
    // 查找 <Label>xxx</Label> 模式 (注意: 不是 <Label htmlFor=...>)
    const labelRegex = /<Label([^>]*)>([^<]+)<\/Label>/g;
    
    content = content.replace(labelRegex, (match, attrs, text) => {
      // 如果已经有 htmlFor，跳过
      if (attrs.includes('htmlFor')) {
        return match;
      }
      
      labelCount++;
      modified = true;
      
      // 生成 htmlFor id (基于文本内容)
      const id = text.trim()
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 20);
      
      // 返回带有 htmlFor 的 Label
      return `<Label htmlFor="${id}"${attrs}>${text}</Label>`;
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
  console.log('🚀 开始修复 Label htmlFor 关联...\n');
  
  filesToFix.forEach(fixLabelsInFile);
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 修复统计:');
  console.log(`  处理文件: ${stats.filesProcessed}`);
  console.log(`  Label修复: ${stats.labelsFixed}`);
  
  if (stats.errors.length > 0) {
    console.log(`\n⚠️  错误数: ${stats.errors.length}`);
  }
  
  console.log('\n✅ Label修复完成!');
  console.log('📝 提示:');
  console.log('   - 已为 Label 添加 htmlFor 属性');
  console.log('   - 请确保对应的 Input 有相同的 id');
  console.log('   - 运行测试验证关联是否正确');
}

main();
