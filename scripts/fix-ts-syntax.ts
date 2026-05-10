/**
 * 批量修复 TypeScript 语法错误
 * 修复常见的语法问题模式
 */

import fs from 'fs';
import path from 'path';

const SERVICES_DIR = 'server/services';
const ROUTES_DIR = 'server/routes';

function getAllTsFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllTsFiles(fullPath));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

function fixFile(filePath: string): number {
  let content = fs.readFileSync(filePath, 'utf-8');
  let fixes = 0;

  // Pattern 1: } catch (error) { - 缺少 try
  // This is harder to fix automatically - skip for now

  // Pattern 2: Fix common typos and malformed code

  // Remove duplicate imports
  const importMatches = content.match(/^import .+$/gm);
  if (importMatches) {
    const seen = new Set<string>();
    const newImports: string[] = [];
    for (const imp of importMatches) {
      if (!seen.has(imp)) {
        seen.add(imp);
        newImports.push(imp);
      }
    }
    if (newImports.length !== importMatches.length) {
      content = newImports.join('\n') + '\n' + content.replace(/^import .+$/gm, '');
      fixes++;
    }
  }

  // Fix malformed function returns
  content = content.replace(/return\s+\w+\s+{/g, 'return {');

  if (content !== fs.readFileSync(filePath, 'utf-8')) {
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  return fixes;
}

function main() {
  console.log('🔧 Starting TypeScript fixes...\n');

  const allDirs = [SERVICES_DIR, ROUTES_DIR];
  let totalFixed = 0;
  let filesProcessed = 0;

  for (const dir of allDirs) {
    if (!fs.existsSync(dir)) {
      console.log(`⚠️  Directory not found: ${dir}`);
      continue;
    }

    console.log(`📁 Processing ${dir}...`);
    const files = getAllTsFiles(dir);
    console.log(`   Found ${files.length} files`);

    for (const file of files) {
      try {
        const fixed = fixFile(file);
        if (fixed > 0) {
          console.log(`   ✅ Fixed ${path.basename(file)}: ${fixed} issues`);
          totalFixed += fixed;
        }
        filesProcessed++;
      } catch (err) {
        console.error(`   ❌ Error in ${path.basename(file)}:`, err);
      }
    }
  }

  console.log(`\n✅ Complete! Processed ${filesProcessed} files, fixed ${totalFixed} issues`);
}

main();
