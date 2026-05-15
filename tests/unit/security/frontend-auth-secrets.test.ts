import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx']);
const forbiddenClientSecrets = [
  'dev-master-key-change-in-production',
  'dev-secret-key',
];

async function collectSourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      return collectSourceFiles(fullPath);
    }

    return sourceExtensions.has(extname(entry.name)) ? [fullPath] : [];
  }));

  return files.flat();
}

describe('frontend auth secrets', () => {
  it('does not ship development master secrets in client source', async () => {
    const clientSourceDir = join(process.cwd(), 'client', 'src');
    const sourceFiles = await collectSourceFiles(clientSourceDir);
    const offenders: string[] = [];

    await Promise.all(sourceFiles.map(async (file) => {
      const content = await readFile(file, 'utf8');
      if (forbiddenClientSecrets.some((secret) => content.includes(secret))) {
        offenders.push(file.replace(process.cwd(), '').replace(/^[\\/]/, ''));
      }
    }));

    expect(offenders).toEqual([]);
  });
});
