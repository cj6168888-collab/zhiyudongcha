import { spawn } from "node:child_process";

const composeFile = process.env.COMPOSE_FILE || "docker-compose.dev.yml";
const port = Number(process.env.PORT || 3000);
const baseUrl = `http://127.0.0.1:${port}`;
const keepRunning = process.argv.includes("--keep");
const skipBuild = process.argv.includes("--skip-build");

function run(commandName, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(commandName, args, {
      cwd: process.cwd(),
      env: process.env,
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

async function waitForHealth(timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      const body = await response.json();
      if (response.ok && body?.success && body?.database === "ok") {
        return body;
      }
      lastError = new Error(`health returned ${response.status}: ${JSON.stringify(body)}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
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
  const upArgs = ["compose", "-f", composeFile, "up", "-d"];
  if (!skipBuild) {
    upArgs.push("--build");
  }

  await run("docker", upArgs);
  await run("docker", ["compose", "-f", composeFile, "ps"]);

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
    if (!keepRunning) {
      await run("docker", ["compose", "-f", composeFile, "down"]);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
