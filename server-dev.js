#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

process.env.NODE_ENV = 'development';

const child = spawn('npx', ['tsx', join(__dirname, 'server/index.ts')], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'development' }
});

child.on('exit', (code) => process.exit(code));
