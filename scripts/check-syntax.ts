// TypeScript syntax error checker
// Run with: npx tsx scripts/check-syntax.ts

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

const SERVER_DIR = 'server';
const IGNORE_DIRS = ['node_modules', 'dist', 'build', '.git'];

interface FileError {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
}

function findTsFiles(dir: string): string[] {
  const files: string[] = [];
  
  if (!fs.existsSync(dir)) return files;
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.includes(entry.name)) {
        files.push(...findTsFiles(fullPath));
      }
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function checkFile(filePath: string): FileError[] {
  const errors: FileError[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Check for common syntax issues
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    // Check for } catch without try
    if (line.trim().match(/^\}\s*catch/)) {
      errors.push({
        file: filePath,
        line: lineNum,
        column: line.indexOf('}'),
        code: 'TS1005',
        message: 'catch without try'
      });
    }
    
    // Check for malformed return statements
    if (line.match(/return\s+\w+\s*\{[^}]*\}$/)) {
      errors.push({
        file: filePath,
        line: lineNum,
        column: 0,
        code: 'TS1109',
        message: 'Expression expected'
      });
    }
  }
  
  // Try to compile the file
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true
  );
  
  const syntaxErrors = ts.getPreEmitDiagnostics(
    ts.createProgram([filePath], {
      strict: false,
      skipLibCheck: true,
      noEmit: true,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      target: ts.ScriptTarget.ES2022,
    })
  );
  
  for (const diag of syntaxErrors) {
    if (diag.file) {
      const pos = diag.file.getLineAndCharacterOfPosition(diag.start!);
      errors.push({
        file: filePath,
        line: pos.line + 1,
        column: pos.character + 1,
        code: `TS${diag.code}`,
        message: ts.flattenDiagnosticMessageText(diag.messageText, '\n')
      });
    }
  }
  
  return errors;
}

function main() {
  console.log('🔍 Scanning for TypeScript files...\n');
  
  const files = findTsFiles(SERVER_DIR);
  console.log(`Found ${files.length} TypeScript files\n`);
  
  const allErrors: FileError[] = [];
  
  for (const file of files) {
    const errors = checkFile(file);
    allErrors.push(...errors);
  }
  
  if (allErrors.length === 0) {
    console.log('✅ No syntax errors found!');
    return;
  }
  
  console.log(`❌ Found ${allErrors.length} errors:\n`);
  
  // Group by file
  const byFile = new Map<string, FileError[]>();
  for (const err of allErrors) {
    const existing = byFile.get(err.file) || [];
    existing.push(err);
    byFile.set(err.file, existing);
  }
  
  // Sort by file name
  const sortedFiles = Array.from(byFile.keys()).sort();
  
  for (const file of sortedFiles) {
    const errors = byFile.get(file)!;
    console.log(`📄 ${path.relative('.', file)} (${errors.length} errors)`);
    for (const err of errors.slice(0, 5)) {
      console.log(`   Line ${err.line}: ${err.message}`);
    }
    if (errors.length > 5) {
      console.log(`   ... and ${errors.length - 5} more`);
    }
    console.log('');
  }
  
  // Save to file
  const output = {
    total: allErrors.length,
    files: sortedFiles.length,
    errors: allErrors
  };
  
  fs.writeFileSync('syntax-errors.json', JSON.stringify(output, null, 2));
  console.log(`📝 Results saved to syntax-errors.json`);
}

main();
