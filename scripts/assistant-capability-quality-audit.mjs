#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const cwd = process.cwd();
loadDotEnv(path.join(cwd, '.env'));

const baseUrl = process.env.ASSISTANT_QUALITY_BASE_URL
  || process.env.ASSISTANT_SMOKE_BASE_URL
  || `http://localhost:${process.env.PORT || 3000}`;
const outputDir = process.env.ASSISTANT_QUALITY_OUTPUT_DIR || path.join(cwd, '.local');
const useLlmJudge = process.env.ASSISTANT_QUALITY_USE_LLM_JUDGE !== 'false' && Boolean(process.env.DASHSCOPE_API_KEY);

let cookieHeader = '';
let csrfHeaderName = 'x-csrf-token';
let csrfToken = '';

const CASES = [
  {
    id: 'finance_cashflow_tax_advice',
    feature: '财务专家：现金流与税务风险',
    userExpectation: '识别回款、现金流缺口、税负和应收账款风险，给出可执行的财务动作。',
    call: () => post('/api/expert-orchestrator/single', {
      expertType: 'FINANCE',
      useKnowledgeBase: true,
      query: '我公司本月确认收入80万元，应收账款有45万元还没回，工资和房租下周要付28万元，供应商账期还有15万元。客户要求先开全额增值税专票再付款。请帮我判断现金流和税务风险，并给一份本周处理建议。',
    }),
    rubric: {
      requiredAny: [
        [/现金流|资金缺口|回款|应收账款/u],
        [/发票|增值税|税负|专票|销项/u],
        [/工资|房租|供应商|付款优先级/u],
        [/建议|本周|动作|催收|账期/u],
      ],
      requireRiskLanguage: true,
      requireActionLanguage: true,
    },
  },
  {
    id: 'psychology_client_conflict',
    feature: '心理专家：客户冲突沟通',
    userExpectation: '理解用户压力，分析客户行为动机与沟通边界，给出不激化矛盾的对话方案。',
    call: () => post('/api/expert-orchestrator/single', {
      expertType: 'PSYCHOLOGY',
      query: '客户连续三次临时改需求，还说我们不专业。我现在很烦，想直接怼回去。你从心理和沟通角度帮我判断对方可能在怕什么，我应该怎么回，既不失控也不让步过头。',
    }),
    rubric: {
      requiredAny: [
        [/情绪|压力|愤怒|共情|理解/u],
        [/动机|担心|不安全感|控制感|信任/u],
        [/边界|不让步|底线|范围/u],
        [/话术|回复|沟通|先/u],
      ],
      requireRiskLanguage: true,
      requireActionLanguage: true,
    },
  },
  {
    id: 'planning_release_breakdown',
    feature: '策划专家：两周上线拆解',
    userExpectation: '把模糊目标拆成阶段、依赖、优先级、风险和验收点，而不是泛泛鼓励。',
    call: () => post('/api/expert-orchestrator/single', {
      expertType: 'PLANNING',
      query: '我们要在两周内上线移动端报价审批流程，团队只有前端1人、后端1人、测试半个人。请拆成可执行计划，说明先做什么、每天看什么指标、哪些要砍掉。',
    }),
    rubric: {
      requiredAny: [
        [/两周|第1周|第2周|里程碑|阶段/u],
        [/前端|后端|测试|依赖|负责人/u],
        [/验收|指标|测试|上线/u],
        [/砍掉|范围|优先级|风险/u],
      ],
      requireRiskLanguage: true,
      requireActionLanguage: true,
    },
  },
  {
    id: 'secretary_task_execution',
    feature: '全能秘书：任务创建执行',
    userExpectation: '把自然语言任务转成 create_task 并实际执行，保留任务名和描述。',
    call: () => post('/api/assistant', {
      message: '新建任务叫客户回访，描述是明天上午10点给王总打电话确认报价',
      type: 'text',
      source: 'app',
    }),
    assertions: [
      fieldEquals('response.type', 'execute'),
      fieldEquals('response.action', 'create_task'),
      fieldEquals('execution.action', 'create_task'),
      (payload) => ({
        passed: payload?.execution?.success === true,
        detail: `execution.success=${payload?.execution?.success}, error=${payload?.execution?.errorMessage || ''}`,
      }),
      fieldIncludes('response.actionParams.name', '客户回访'),
      fieldIncludes('response.actionParams.description', '王总'),
    ],
    rubric: {
      requiredAny: [[/客户回访/u], [/王总|报价/u], [/create_task|任务/u]],
      requireActionLanguage: true,
    },
  },
  {
    id: 'secretary_memory_execution',
    feature: '全能秘书：记忆保存执行',
    userExpectation: '识别“记下”并实际保存记忆，不误判成闲聊。',
    call: () => post('/api/assistant', {
      message: '帮我记下：张总喜欢周五下午复盘，报价要先给总价再给明细',
      type: 'text',
      source: 'app',
    }),
    assertions: [
      fieldEquals('response.type', 'execute'),
      fieldEquals('response.action', 'save_memory'),
      fieldEquals('execution.action', 'save_memory'),
      (payload) => ({
        passed: payload?.execution?.success === true,
        detail: `execution.success=${payload?.execution?.success}, error=${payload?.execution?.errorMessage || ''}`,
      }),
      fieldIncludes('response.actionParams.content', '张总'),
    ],
    rubric: {
      requiredAny: [[/张总/u], [/周五下午|报价/u], [/save_memory|记忆/u]],
      requireActionLanguage: true,
    },
  },
  {
    id: 'secretary_multi_action_draft',
    feature: '全能秘书：复杂多动作草案',
    userExpectation: '复杂输入不能乱执行，应拆成项目、任务、联系人草案等待确认。',
    call: () => post('/api/assistant', {
      message: '创建项目叫华东客户续约，描述是五月续约战役；再创建任务叫整理报价底稿，描述是今天完成；把张总加到联系人，他在星河科技公司，职位是采购总监',
      type: 'text',
      source: 'app',
    }),
    assertions: [
      fieldEquals('response.type', 'draft'),
      arrayActionContains('response.draftItems', 'create_project'),
      arrayActionContains('response.draftItems', 'create_task'),
      arrayActionContains('response.draftItems', 'create_person'),
      (payload) => ({
        passed: !payload?.execution,
        detail: payload?.execution ? 'unexpected immediate execution' : 'no immediate execution',
      }),
    ],
    rubric: {
      requiredAny: [[/华东客户续约/u], [/整理报价底稿/u], [/张总|星河科技/u], [/确认|草案|检查/u]],
      requireActionLanguage: true,
    },
  },
  {
    id: 'assistant_emotional_intelligence',
    feature: '小智聊天：情绪理解与高情商回应',
    userExpectation: '先接住情绪，再帮用户拆解问题和下一步，不空泛说教、不乱执行。',
    call: () => post('/api/assistant', {
      message: '我今天被客户怼得很烦，脑子乱，不知道要不要立刻回他。你先别创建任务，先帮我理一下。',
      type: 'text',
      source: 'app',
    }),
    assertions: [
      (payload) => ({
        passed: !payload?.response?.action && !payload?.execution,
        detail: `action=${payload?.response?.action || 'none'}, execution=${Boolean(payload?.execution)}`,
      }),
    ],
    rubric: {
      requiredAny: [
        [/烦|委屈|压力|情绪|先别急|理解/u],
        [/先|拆|理|复盘|下一步/u],
        [/不要立刻|暂时别|冷静|边界/u],
      ],
      requireActionLanguage: true,
    },
  },
];

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log(`[assistant-capability-quality] baseUrl=${baseUrl}`);
  console.log(`[assistant-capability-quality] llmJudge=${useLlmJudge ? 'enabled' : 'disabled'}`);
  await prepareCsrf();

  const results = [];
  for (const testCase of CASES) {
    console.log(`\n[assistant-capability-quality] ${testCase.id} - ${testCase.feature}`);
    const result = await runCase(testCase);
    results.push(result);
    console.log(`  ${result.passed ? 'PASS' : 'FAIL'} score=${result.score}/100 duration=${result.durationMs}ms`);
    for (const issue of result.issues) console.log(`  - ${issue}`);
  }

  const summary = summarize(results);
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    llmJudge: useLlmJudge,
    summary,
    results,
  };

  const jsonPath = path.join(outputDir, 'assistant-capability-quality-report.json');
  const markdownPath = path.join(outputDir, 'assistant-capability-quality-report.md');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(markdownPath, renderMarkdown(report), 'utf8');

  console.log(`\n[assistant-capability-quality] summary: ${summary.passed}/${summary.total} passed, average=${summary.averageScore}/100`);
  console.log(`[assistant-capability-quality] report=${jsonPath}`);
  console.log(`[assistant-capability-quality] markdown=${markdownPath}`);

  if (summary.failed > 0 || summary.averageScore < 80) {
    process.exitCode = 1;
  }
}

async function runCase(testCase) {
  const startedAt = Date.now();
  const issues = [];
  const checks = [];
  let payload = null;
  let rawText = '';
  let endpointOk = false;

  try {
    payload = await testCase.call();
    endpointOk = true;
    rawText = collectText(payload);
  } catch (error) {
    issues.push(`接口调用失败：${error instanceof Error ? error.message : String(error)}`);
  }

  if (payload && testCase.assertions) {
    for (const assertion of testCase.assertions) {
      const check = assertion(payload);
      checks.push(check);
      if (!check.passed) issues.push(`结构断言失败：${check.detail}`);
    }
  }

  const rubricResult = evaluateRubric(rawText, testCase.rubric || {});
  issues.push(...rubricResult.issues);

  const llmJudge = payload && useLlmJudge && testCase.judge !== false
    ? await judgeWithLlm(testCase, rawText).catch((error) => ({
      score: null,
      issues: [`LLM评审失败：${error instanceof Error ? error.message : String(error)}`],
      summary: '',
    }))
    : null;

  const seriousIssues = (llmJudge?.issues || []).filter(isSeriousIssue);
  issues.push(...seriousIssues.map(issue => `LLM评审：${issue}`));

  const structureScore = checks.length === 0
    ? 15
    : Math.round(15 * checks.filter(check => check.passed).length / checks.length);
  const llmScore = typeof llmJudge?.score === 'number'
    ? Math.max(0, Math.min(20, Math.round(llmJudge.score / 5)))
    : 15;
  const score = Math.max(0, Math.min(100,
    (endpointOk ? 20 : 0) + structureScore + rubricResult.score + llmScore
  ));

  return {
    id: testCase.id,
    feature: testCase.feature,
    userExpectation: testCase.userExpectation,
    passed: endpointOk && checks.every(check => check.passed) && rubricResult.passed && score >= 75 && issues.length === 0,
    score,
    durationMs: Date.now() - startedAt,
    issues,
    checks,
    rubric: rubricResult,
    llmJudge,
    responsePreview: rawText.slice(0, 2000),
  };
}

function evaluateRubric(text, rubric) {
  const issues = [];
  let score = 0;
  const groups = rubric.requiredAny || [];
  let matchedGroups = 0;

  for (const group of groups) {
    const matched = group.some(pattern => pattern.test(text));
    if (matched) matchedGroups++;
    else issues.push(`缺少预期要点：${group.map(String).join(' 或 ')}`);
  }
  score += groups.length === 0 ? 25 : Math.round(25 * matchedGroups / groups.length);

  if (rubric.requireRiskLanguage) {
    if (/风险|不确定|证据|缺口|置信|边界|代价|后果|压力|冲突/u.test(text)) score += 10;
    else issues.push('缺少风险、边界或不确定性说明');
  } else {
    score += 10;
  }

  if (rubric.requireActionLanguage) {
    if (/建议|下一步|先|再|执行|创建|保存|确认|清单|动作|今天|本周|负责人|截止/u.test(text)) score += 10;
    else issues.push('缺少面向用户的下一步行动');
  } else {
    score += 10;
  }

  score += 25;
  return { passed: issues.length === 0, score, issues };
}

async function judgeWithLlm(testCase, answerText) {
  const prompt = `你是AI产品质量审计员。请审核以下系统输出是否满足用户期望，重点检查：
1. 是否真正解决该专家或秘书功能的核心任务；
2. 是否指出风险、事实缺口、边界条件；
3. 是否给出可执行下一步；
4. 对秘书能力，是否正确区分“立即执行、等待确认、只聊天不执行”；
5. 是否存在编造、过度承诺、空泛套话、情绪回应冷漠或误解用户意图。

请只输出JSON：{"score":0-100,"summary":"一句话结论","issues":["问题1"],"promptTuning":["可优化的提示词要求"]}

功能：${testCase.feature}
用户期望：${testCase.userExpectation}
系统输出：${answerText.slice(0, 5000)}`;

  const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.ASSISTANT_QUALITY_JUDGE_MODEL || 'qwen-plus',
      messages: [
        { role: 'system', content: '你只输出严格JSON，不输出Markdown。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 800,
    }),
  });

  if (!response.ok) {
    throw new Error(`judge api ${response.status}: ${await response.text()}`);
  }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  const json = content.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error(`judge returned non-json: ${content.slice(0, 200)}`);
  return JSON.parse(json);
}

function isSeriousIssue(issue) {
  if (/LLM评审失败/u.test(issue)) return false;
  const normalized = issue.replace(/错误率/gu, '指标率');
  return /未解决|事实错误|错误结论|误解|不准确|编造|过度承诺|空泛|缺少.*(?:下一步|风险|证据|执行)|不应.*执行|应该.*确认|冷漠|严重/u.test(normalized);
}

function fieldEquals(pathExpression, expected) {
  return payload => {
    const actual = getByPath(payload, pathExpression);
    return {
      passed: actual === expected,
      detail: `${pathExpression}: expected=${expected}, actual=${actual}`,
    };
  };
}

function fieldIncludes(pathExpression, expected) {
  return payload => {
    const actual = String(getByPath(payload, pathExpression) ?? '');
    return {
      passed: actual.includes(expected),
      detail: `${pathExpression}: expected includes ${expected}, actual=${actual}`,
    };
  };
}

function arrayActionContains(pathExpression, action) {
  return payload => {
    const actual = getByPath(payload, pathExpression);
    return {
      passed: Array.isArray(actual) && actual.some(item => item?.action === action),
      detail: `${pathExpression}: expected action ${action}, actual=${JSON.stringify(actual)}`,
    };
  };
}

function getByPath(value, pathExpression) {
  return pathExpression.split('.').reduce((current, key) => current?.[key], value);
}

function collectText(value) {
  const chunks = [];
  const seen = new Set();
  const ignoredKeys = new Set(['originalText', 'mainContent', 'processingSteps', 'timestamp', 'createdAt', 'updatedAt', 'semanticIndex', 'filePath']);

  function visit(node) {
    if (node == null) return;
    if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') {
      chunks.push(String(node));
      return;
    }
    if (typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    for (const [key, item] of Object.entries(node)) {
      if (ignoredKeys.has(key)) continue;
      visit(item);
    }
  }

  visit(value);
  return chunks.join('\n');
}

function summarize(results) {
  const total = results.length;
  const passed = results.filter(result => result.passed).length;
  const failed = total - passed;
  const averageScore = Math.round(results.reduce((sum, result) => sum + result.score, 0) / Math.max(1, total));
  return { total, passed, failed, averageScore };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# Assistant Capability Quality Report');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Base URL: ${report.baseUrl}`);
  lines.push(`LLM judge: ${report.llmJudge ? 'enabled' : 'disabled'}`);
  lines.push('');
  lines.push(`Summary: ${report.summary.passed}/${report.summary.total} passed, average ${report.summary.averageScore}/100`);
  lines.push('');
  for (const result of report.results) {
    lines.push(`## ${result.passed ? 'PASS' : 'FAIL'} ${result.id}`);
    lines.push(`Feature: ${result.feature}`);
    lines.push(`Score: ${result.score}/100`);
    lines.push(`Expectation: ${result.userExpectation}`);
    if (result.issues.length > 0) {
      lines.push('Issues:');
      result.issues.forEach(issue => lines.push(`- ${issue}`));
    }
    if (result.llmJudge?.summary) lines.push(`LLM summary: ${result.llmJudge.summary}`);
    lines.push('');
  }
  return lines.join('\n');
}

async function prepareCsrf() {
  const data = await getJson('/api/security/csrf-token');
  csrfToken = data.token;
  csrfHeaderName = data.headerName || csrfHeaderName;
  if (!csrfToken) throw new Error('CSRF token endpoint did not return a token');
}

async function getJson(pathname) {
  return withApiRetry(`GET ${pathname}`, async () => {
    const response = await fetch(`${baseUrl}${pathname}`, {
      headers: {
        Connection: 'close',
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
    });
    captureCookies(response);
    const text = await response.text();
    const json = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(`${pathname} failed with ${response.status}: ${JSON.stringify(json)}`);
    return json;
  });
}

async function post(pathname, body) {
  return withApiRetry(`POST ${pathname}`, async (attempt) => {
    if (attempt > 1) await prepareCsrf();
    const response = await fetch(`${baseUrl}${pathname}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Connection: 'close',
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
      throw new Error(`${pathname} returned non-JSON response: ${text.slice(0, 200)}`);
    }
    if (!response.ok) throw new Error(`${pathname} failed with ${response.status}: ${JSON.stringify(json)}`);
    return json;
  });
}

async function withApiRetry(label, action) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await action(attempt);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!isTransientApiError(message) || attempt === 3) break;
      console.warn(`[assistant-capability-quality] ${label} transient failure (${message}), retrying ${attempt}/3`);
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
  throw lastError;
}

function isTransientApiError(message) {
  return /fetch failed|ECONNRESET|ECONNREFUSED|UND_ERR|socket|terminated|aborted/i.test(message);
}

function captureCookies(response) {
  const setCookie = response.headers.getSetCookie?.() ?? [];
  const fallback = response.headers.get('set-cookie');
  const cookies = setCookie.length > 0 ? setCookie : (fallback ? [fallback] : []);
  if (cookies.length > 0) {
    cookieHeader = cookies.map(cookie => cookie.split(';')[0]).join('; ');
  }
}

function loadDotEnv(envPath) {
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, raw] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = raw.trim().replace(/^(['"])(.*)\1$/, '$2');
  }
}

main().catch(error => {
  console.error('\n[assistant-capability-quality] failed');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
