import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const port = Number(process.env.PORT || 3999);
const baseUrl = `http://127.0.0.1:${port}`;
const skipBuild = process.argv.includes("--skip-build");
const skipMigrate = process.argv.includes("--skip-migrate");
const logDir = path.join(root, ".local");

function command(name) {
  return process.platform === "win32" && name === "npm" ? "npm.cmd" : name;
}

async function loadDotEnv() {
  const envPath = path.join(root, ".env");
  if (!existsSync(envPath)) return {};

  const content = await readFile(envPath, "utf8");
  const values = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [name, ...rest] = trimmed.split("=");
    const key = name.trim();
    if (!key || process.env[key]) continue;
    values[key] = rest.join("=").trim().replace(/^['"]|['"]$/g, "");
  }
  return values;
}

function run(commandName, args, options = {}) {
  return new Promise((resolve, reject) => {
    const executable = command(commandName);
    const child = process.platform === "win32"
      ? spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", [executable, ...args].join(" ")], {
          cwd: root,
          env: { ...process.env, ...options.env },
          stdio: options.stdio || "inherit",
          shell: false,
        })
      : spawn(executable, args, {
      cwd: root,
      env: { ...process.env, ...options.env },
      stdio: options.stdio || "inherit",
      shell: false,
        });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${commandName} ${args.join(" ")} exited with ${code}`));
      }
    });
  });
}

async function waitForHealth(timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      const body = await response.json();
      if (response.ok && body?.success) {
        return body;
      }
      lastError = new Error(`health returned ${response.status}: ${JSON.stringify(body)}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw lastError || new Error("health check timed out");
}

async function checkEndpoint(pathname) {
  const response = await fetch(`${baseUrl}${pathname}`);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${pathname} returned ${response.status}: ${text.slice(0, 300)}`);
  }
  return { path: pathname, status: response.status, sample: text.slice(0, 180) };
}

async function main() {
  const dotEnv = await loadDotEnv();
  const env = {
    ...dotEnv,
    ...process.env,
    NODE_ENV: "production",
    PORT: String(port),
    DATABASE_SSL: process.env.DATABASE_SSL || dotEnv.DATABASE_SSL || "false",
  };

  if (!env.DATABASE_URL && !skipMigrate) {
    throw new Error("DATABASE_URL is required. Set it or pass --skip-migrate.");
  }

  await mkdir(logDir, { recursive: true });

  if (!skipBuild) {
    await run("npm", ["run", "build"], { env });
  }

  if (!skipMigrate) {
    await run("npm", ["run", "db:migrate"], { env });
  }

  const outputChunks = [];
  const errorChunks = [];
  const server = spawn(process.execPath, ["dist/index.cjs"], {
    cwd: root,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  server.stdout.on("data", (chunk) => outputChunks.push(chunk));
  server.stderr.on("data", (chunk) => errorChunks.push(chunk));

  const stopServer = async () => {
    if (!server.killed) {
      server.kill("SIGTERM");
      await new Promise((resolve) => setTimeout(resolve, 1500));
      if (!server.killed) server.kill("SIGKILL");
    }
    await writeFile(path.join(logDir, "deploy-smoke.out.log"), Buffer.concat(outputChunks));
    await writeFile(path.join(logDir, "deploy-smoke.err.log"), Buffer.concat(errorChunks));
  };

  try {
    const health = await waitForHealth();
    const endpoints = [];
    for (const pathname of [
      "/api/models/status",
      "/api/remote/status",
      "/api/navigator/pending-reports",
      "/api/navigator/alerts",
    ]) {
      endpoints.push(await checkEndpoint(pathname));
    }

    console.log(JSON.stringify({ baseUrl, health, endpoints }, null, 2));
  } finally {
    await stopServer();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
