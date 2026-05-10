/**
 * TypeScript 错误分析脚本
 * 分析并统计 TypeScript 编译错误
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const OUTPUT_FILE = 'ts_errors.json';

function runTsc(): string {
  try {
    const output = execSync('npx tsc -p tsconfig.server.json --noEmit 2>&1', {
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024,
    });
    return output;
  } catch (error: unknown) {
    if (error instanceof Error && 'stdout' in error) {
      return String((error as { stdout?: unknown }).stdout ?? '');
    }
    return '';
  }
}

function parseErrors(output: string) {
  const errors: Array<{
    file: string;
    line: number;
    code: string;
    message: string;
  }> = [];

  const lines = output.split('\n');
  const errorRegex = /^(.+?)\((\d+),\d+\):\s*error\s+(TS\d+):\s*(.+)$/;

  for (const line of lines) {
    const match = line.match(errorRegex);
    if (match) {
      errors.push({
        file: match[1],
        line: parseInt(match[2], 10),
        code: match[3],
        message: match[4],
      });
    }
  }

  return errors;
}

function groupByFile(errors: Array<{ file: string }>) {
  const groups: Record<string, number> = {};
  for (const err of errors) {
    groups[err.file] = (groups[err.file] || 0) + 1;
  }
  return Object.entries(groups)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
}

function analyzeErrorCodes(errors: Array<{ code: string }>) {
  const codes: Record<string, number> = {};
  for (const err of errors) {
    codes[err.code] = (codes[err.code] || 0) + 1;
  }
  return Object.entries(codes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
}

function main() {
  console.log('🔍 Running TypeScript compilation...\n');

  const output = runTsc();
  const errors = parseErrors(output);

  console.log(`Total errors: ${errors.length}\n`);

  // Group by file
  console.log('📁 Top files with most errors:');
  const topFiles = groupByFile(errors);
  for (const [file, count] of topFiles) {
    console.log(`  ${count}: ${path.basename(file)}`);
  }

  console.log('\n🔢 Top error codes:');
  const topCodes = analyzeErrorCodes(errors);
  for (const [code, count] of topCodes) {
    console.log(`  ${count}: ${code}`);
  }

  // Save to file
  const result = {
    total: errors.length,
    byFile: topFiles,
    byCode: topCodes,
    allErrors: errors,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
  console.log(`\n✅ Results saved to ${OUTPUT_FILE}`);

  // List first 10 files to fix
  console.log('\n📋 Files to fix (first 10):');
  const filesToFix = [...new Set(errors.map(e => e.file))].slice(0, 10);
  for (const file of filesToFix) {
    console.log(`  - ${file}`);
  }
}

main();
