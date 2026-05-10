#!/usr/bin/env node

const baseUrl = process.env.ASSISTANT_SMOKE_BASE_URL || 'http://localhost:5000';
let cookieHeader = '';
let csrfHeaderName = 'x-csrf-token';
let csrfToken = '';

const checks = [
  {
    name: 'create_project',
    message: process.env.ASSISTANT_SMOKE_PROJECT_MESSAGE || '帮我创建一个名为R1验收项目的项目，描述是第一产品闭环真实环境验收。',
    expectedAction: 'create_project',
  },
  {
    name: 'create_task',
    message: process.env.ASSISTANT_SMOKE_TASK_MESSAGE || '帮我创建一个任务，名字叫R1验收任务，描述是验证聊天到任务写入。',
    expectedAction: 'create_task',
  },
  {
    name: 'save_memory',
    message: process.env.ASSISTANT_SMOKE_MEMORY_MESSAGE || '请记住：R1验收需要检查聊天、执行、回流和复盘。',
    expectedAction: 'save_memory',
  },
];

function captureCookies(response) {
  const setCookie = response.headers.getSetCookie?.() ?? [];
  const fallback = response.headers.get('set-cookie');
  const cookies = setCookie.length > 0 ? setCookie : (fallback ? [fallback] : []);
  if (cookies.length === 0) return;

  const existing = new Map(
    cookieHeader
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, ...rest] = part.split('=');
        return [name, rest.join('=')];
      }),
  );

  for (const cookie of cookies) {
    const [pair] = cookie.split(';');
    const [name, ...rest] = pair.split('=');
    if (name && rest.length > 0) {
      existing.set(name.trim(), rest.join('=').trim());
    }
  }

  cookieHeader = Array.from(existing.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
  });
  captureCookies(response);
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

async function prepareCsrf() {
  const data = await getJson('/api/security/csrf-token');
  csrfToken = data.token;
  csrfHeaderName = data.headerName || csrfHeaderName;
  if (!csrfToken) {
    throw new Error('CSRF token endpoint did not return a token');
  }
}

async function post(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [csrfHeaderName]: csrfToken,
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
    body: JSON.stringify(body),
  });
  captureCookies(response);

  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${path} returned non-JSON response: ${text.slice(0, 200)}`);
  }

  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}: ${JSON.stringify(json)}`);
  }

  return json;
}

function assertExecution(name, result, expectedAction) {
  if (!result?.success) {
    throw new Error(`${name}: response success=false`);
  }

  if (result.response?.type === 'confirm') {
    return { needsApproval: true, responseId: result.response.id };
  }

  if (!result.execution?.success) {
    throw new Error(`${name}: execution missing or failed: ${JSON.stringify(result.execution)}`);
  }

  if (result.execution.action !== expectedAction) {
    throw new Error(`${name}: expected action ${expectedAction}, got ${result.execution.action}`);
  }

  if (!result.execution.entityId) {
    throw new Error(`${name}: execution did not return entityId`);
  }

  return { needsApproval: false };
}

async function runCheck(check) {
  console.log(`\n[assistant-r1-smoke] ${check.name}`);
  const result = await post('/api/assistant', {
    message: check.message,
    type: 'text',
    source: 'app',
  });

  const assertion = assertExecution(check.name, result, check.expectedAction);

  if (assertion.needsApproval) {
    const approved = await post('/api/assistant/authorize', {
      responseId: assertion.responseId,
      action: 'approve_once',
    });
    if (!approved.execution?.success) {
      throw new Error(`${check.name}: approval execution failed: ${JSON.stringify(approved.execution)}`);
    }
    if (approved.execution.action !== check.expectedAction) {
      throw new Error(`${check.name}: expected approved action ${check.expectedAction}, got ${approved.execution.action}`);
    }
    console.log(`  approved ${approved.execution.action}: ${approved.execution.entityId}`);
    return;
  }

  console.log(`  executed ${result.execution.action}: ${result.execution.entityId}`);
}

async function main() {
  console.log(`[assistant-r1-smoke] baseUrl=${baseUrl}`);
  await prepareCsrf();
  for (const check of checks) {
    await runCheck(check);
  }
  console.log('\n[assistant-r1-smoke] R1 assistant loop smoke passed');
}

main().catch((error) => {
  console.error('\n[assistant-r1-smoke] failed');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
