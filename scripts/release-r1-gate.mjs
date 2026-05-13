import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const port = Number(process.env.PORT || 3998);
const host = process.env.HOST || '127.0.0.1';
const baseUrl = `http://${host}:${port}`;
const logDir = path.join(root, '.local');
const skipBuild = process.argv.includes('--skip-build');
const skipMigrate = process.argv.includes('--skip-migrate');
const skipUi = process.argv.includes('--skip-ui');
const skipQuality = process.argv.includes('--skip-quality');

function command(name) {
  return process.platform === 'win32' && name === 'npm' ? 'npm.cmd' : name;
}

function windowsCommandLine(commandName, args) {
  return [command(commandName), ...args]
    .map((part) => (/\s/.test(part) ? `"${part.replace(/"/g, '\\"')}"` : part))
    .join(' ');
}

async function loadDotEnv() {
  const envPath = path.join(root, '.env');
  if (!existsSync(envPath)) return {};

  const content = await readFile(envPath, 'utf8');
  const values = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [name, ...rest] = trimmed.split('=');
    const key = name.trim();
    if (!key || process.env[key]) continue;
    values[key] = rest.join('=').trim().replace(/^['"]|['"]$/g, '');
  }
  return values;
}

function run(commandName, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = process.platform === 'win32'
      ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', windowsCommandLine(commandName, args)], {
          cwd: root,
          env: { ...process.env, ...options.env },
          stdio: options.stdio || 'inherit',
          shell: false,
        })
      : spawn(command(commandName), args, {
          cwd: root,
          env: { ...process.env, ...options.env },
          stdio: options.stdio || 'inherit',
          shell: false,
        });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${commandName} ${args.join(' ')} exited with ${code}`));
    });
  });
}

function terminateProcessTree(child) {
  return new Promise((resolve) => {
    if (child.killed || child.exitCode !== null) {
      resolve();
      return;
    }

    if (process.platform === 'win32') {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        shell: false,
      });
      killer.on('exit', () => resolve());
      killer.on('error', () => resolve());
      return;
    }

    child.kill('SIGTERM');
    setTimeout(() => {
      if (!child.killed && child.exitCode === null) child.kill('SIGKILL');
      resolve();
    }, 1500);
  });
}

async function waitForHealth(timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      const body = await response.json();
      if (response.ok && body?.success) return body;
      lastError = new Error(`health returned ${response.status}: ${JSON.stringify(body)}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw lastError || new Error('health check timed out');
}

async function main() {
  const dotEnv = await loadDotEnv();
  const env = {
    ...dotEnv,
    ...process.env,
    NODE_ENV: 'development',
    PORT: String(port),
    HOST: host,
    COOKIE_SECURE: process.env.COOKIE_SECURE || 'false',
    COOKIE_SAME_SITE: process.env.COOKIE_SAME_SITE || 'lax',
    AUTHZ_STRICT: process.env.AUTHZ_STRICT || 'false',
    REDIS_HOST: process.env.REDIS_HOST || dotEnv.REDIS_HOST || 'localhost',
    REDIS_PORT: process.env.REDIS_PORT || dotEnv.REDIS_PORT || '6379',
    ASSISTANT_SMOKE_BASE_URL: baseUrl,
    ASSISTANT_QUALITY_BASE_URL: baseUrl,
    ASSISTANT_QUALITY_OUTPUT_DIR: logDir,
  };

  if (!env.DATABASE_URL && !skipMigrate) {
    throw new Error('DATABASE_URL is required. Configure .env or pass --skip-migrate.');
  }

  if (!env.DASHSCOPE_API_KEY && !env.DEEPSEEK_API_KEY && !env.DOUBAO_API_KEY && env.LOCAL_MODEL_ENABLED !== 'true') {
    throw new Error('At least one AI provider API key or LOCAL_MODEL_ENABLED=true is required for R1 assistant smoke.');
  }

  await mkdir(logDir, { recursive: true });

  if (!skipBuild) {
    await run('npm', ['run', 'build'], {
      env: {
        ...env,
        NODE_ENV: 'production',
      },
    });
  }

  if (!skipMigrate) {
    await run('npm', ['run', 'db:migrate'], { env });
  }

  const stdout = [];
  const stderr = [];
  const server = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });

  server.stdout.on('data', (chunk) => stdout.push(chunk));
  server.stderr.on('data', (chunk) => stderr.push(chunk));

  async function stopServer() {
    await terminateProcessTree(server);
    await writeFile(path.join(logDir, 'release-r1-gate.out.log'), Buffer.concat(stdout));
    await writeFile(path.join(logDir, 'release-r1-gate.err.log'), Buffer.concat(stderr));
  }

  try {
    const health = await waitForHealth();
    await run('npm', ['run', 'smoke:assistant-r1'], { env });
    await run('npm', ['run', 'smoke:assistant-risk'], { env });
    if (!skipUi) {
      await run('npm', ['run', 'smoke:assistant-ui'], { env });
    }
    if (!skipQuality) {
      await run('npm', ['run', 'quality:lawyer'], { env });
      await run('npm', ['run', 'quality:assistant'], { env });
    }
    console.log(JSON.stringify({
      gate: 'r1',
      baseUrl,
      health,
      assistantSmoke: 'passed',
      riskSmoke: 'passed',
      uiSmoke: skipUi ? 'skipped' : 'passed',
      lawyerQuality: skipQuality ? 'skipped' : 'passed',
      assistantQuality: skipQuality ? 'skipped' : 'passed',
    }, null, 2));
  } finally {
    await stopServer();
  }
}

main().catch((error) => {
  console.error('[release-r1-gate] failed');
  console.error(error);
  process.exit(1);
});
