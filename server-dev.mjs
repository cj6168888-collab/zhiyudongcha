import { spawn } from 'child_process';
process.env.NODE_ENV = 'development';
const p = spawn('npx', ['tsx', 'server/index.ts'], { stdio: 'inherit', env: process.env });
p.on('exit', c => process.exit(c));
