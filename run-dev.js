import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

process.env.NODE_ENV = 'development';

console.log('[启动] 正在启动小智数字生命系统...');

const server = spawn('npx', ['tsx', join(__dirname, 'server/index.ts')], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'development' },
  cwd: __dirname
});

server.on('error', (err) => {
  console.error('[错误] 启动失败:', err.message);
  process.exit(1);
});

server.on('exit', (code) => {
  process.exit(code || 0);
});
