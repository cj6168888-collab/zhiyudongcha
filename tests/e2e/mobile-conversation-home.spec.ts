import { expect, type Page, test } from '@playwright/test';

const mobileViewport = { width: 390, height: 844 };
const appUrl = 'http://localhost:5173/';
const localStateKey = 'navigator.mobile.conversation-home.local-state.v1';
const ideaCaptureKey = 'xiaozhi_idea_capture_notes';

async function mockConversationShell(page: Page, options?: {
  pendingSummary?: Record<string, unknown>;
  assistantFailure?: boolean;
  assistantFailureCount?: number;
  assistantResult?: Record<string, unknown>;
  preserveLocalState?: boolean;
  offline?: boolean;
}) {
  await page.addInitScript((mockOptions) => {
    const jsonResponse = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    const originalFetch = window.fetch.bind(window);
    const historyKey = 'navigator.mobile.conversation-home.mock-history.v1';
    const sessionKey = 'navigator.mobile.conversation-home.session-id.v1';
    const deviceKey = 'navigator.mobile.conversation-home.device-id.v1';

    if (!mockOptions.preserveLocalState) {
      window.localStorage.removeItem('navigator.mobile.conversation-home.local-state.v1');
      window.localStorage.removeItem(historyKey);
      window.localStorage.removeItem(sessionKey);
      window.localStorage.removeItem(deviceKey);
    }
    (window as unknown as { __assistantCalls?: number }).__assistantCalls = 0;
    (window as unknown as { __assistantHistoryCalls?: number }).__assistantHistoryCalls = 0;
    let assistantCallCount = 0;

    const readHistory = (): Array<{ id: string; role: string; content: string; timestamp: string; ai?: unknown }> => {
      try {
        return JSON.parse(window.localStorage.getItem(historyKey) || '[]');
      } catch {
        return [];
      }
    };

    const writeHistory = (messages: Array<{ id: string; role: string; content: string; timestamp: string; ai?: unknown }>) => {
      window.localStorage.setItem(historyKey, JSON.stringify(messages.slice(-20)));
    };

    const appendHistory = (role: 'user' | 'assistant', content: string, ai?: unknown) => {
      const history = readHistory();
      history.push({
        id: `mock-history-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        role,
        content,
        timestamp: new Date().toISOString(),
        ...(ai ? { ai } : {}),
      });
      writeHistory(history);
    };

    if (mockOptions.offline) {
      Object.defineProperty(window.navigator, 'onLine', {
        configurable: true,
        get: () => false,
      });
    }

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
      const path = new URL(url, window.location.origin).pathname;
      const method = (init?.method ?? 'GET').toUpperCase();

      if (path === '/api/security/csrf-token') {
        return jsonResponse({ token: 'test-csrf', headerName: 'x-csrf-token' });
      }

      if (path === '/api/hp/balance') {
        return jsonResponse({
          success: true,
          data: { current: 100, maximum: 100, academicLevel: 'R1' },
        });
      }

      if (path === '/api/models/status') {
        return jsonResponse({
          success: true,
          cloud: { ready: true, availableProviders: ['test'] },
        });
      }

      if (path === '/api/device-bindings') {
        return jsonResponse({ success: true, devices: [] });
      }

      if (path === '/api/tasks' && method === 'GET') {
        return jsonResponse({
          success: true,
          count: 1,
          data: [
            {
              id: 'task-heartbeat',
              name: 'Contract review reminder',
              enabled: true,
              trigger: { type: 'HEARTBEAT', config: {} },
              nextRunAt: Date.now() + 30 * 60 * 1000,
            },
          ],
        });
      }

      if (path === '/api/alerts/pending' && method === 'GET') {
        return jsonResponse({
          success: true,
          count: 0,
          data: [],
        });
      }

      if (path === '/api/assistant/pending' && method === 'GET') {
        return jsonResponse(mockOptions.pendingSummary ?? {
          success: true,
          count: 0,
          pending: [],
          draft: [],
        });
      }

      if (path === '/api/assistant/history' && method === 'GET') {
        (window as unknown as { __assistantHistoryCalls?: number }).__assistantHistoryCalls =
          ((window as unknown as { __assistantHistoryCalls?: number }).__assistantHistoryCalls ?? 0) + 1;
        (window as unknown as { __assistantHistorySearch?: string }).__assistantHistorySearch =
          new URL(url, window.location.origin).search;
        return jsonResponse({
          success: true,
          messages: readHistory(),
        });
      }

      if (path === '/api/conversation-inbox' && method === 'GET') {
        return jsonResponse({
          success: true,
          conversations: [],
        });
      }

      if (path === '/api/conversation-inbox/counts' && method === 'GET') {
        return jsonResponse({
          success: true,
          counts: { total: 0, task: 0, memory: 0, event: 0 },
        });
      }

      if (path === '/api/assistant/draft/update' && method === 'POST') {
        const payload = init?.body ? JSON.parse(String(init.body)) : {};
        (window as unknown as { __draftUpdatePayload?: unknown }).__draftUpdatePayload = payload;
        return jsonResponse({
          success: true,
          draft: {
            id: payload.responseId,
            entryType: 'draft',
            action: null,
            items: payload.items,
            expiresAt: new Date(Date.now() + 600000).toISOString(),
            createdAt: new Date().toISOString(),
          },
        });
      }

      if (path === '/api/assistant/authorize' && method === 'POST') {
        const payload = init?.body ? JSON.parse(String(init.body)) : {};
        (window as unknown as { __authorizePayload?: unknown }).__authorizePayload = payload;
        return jsonResponse({
          success: true,
          message: '好的，PC 执行已完成：PC 端连通性测试完成：127.0.0.1 可达，耗时约 42ms',
          execution: {
            success: true,
            action: 'pc_execute',
            entityType: 'pc_task',
            entityId: 'pc-run-1',
            entityData: {
              message: 'PC 端连通性测试完成：127.0.0.1 可达，耗时约 42ms',
            },
          },
        });
      }

      if ((path === '/api/assistant' || path === '/api/assistant/') && method === 'POST') {
        assistantCallCount += 1;
        (window as unknown as { __assistantCalls?: number }).__assistantCalls = assistantCallCount;
        const payload = init?.body ? JSON.parse(String(init.body)) : {};
        const failureCount = typeof mockOptions.assistantFailureCount === 'number'
          ? mockOptions.assistantFailureCount
          : 0;
        if (mockOptions.assistantFailure || assistantCallCount <= failureCount) {
          return jsonResponse({ success: false, error: 'assistant unavailable' }, 400);
        }
        const responseBody = mockOptions.assistantResult ?? {
          success: true,
          response: {
            id: 'resp-ok',
            handler: 'ai',
            type: 'greeting',
            message: 'received',
          },
        };
        (window as unknown as { __assistantPayload?: unknown }).__assistantPayload = payload;
        appendHistory('user', String(payload.message ?? ''));
        appendHistory(
          'assistant',
          String((responseBody as any).response?.message ?? 'received'),
          (responseBody as any).response?.ai,
        );
        return jsonResponse(responseBody);
      }

      return originalFetch(input, init);
    };
  }, {
    pendingSummary: options?.pendingSummary,
    assistantFailure: options?.assistantFailure,
    assistantFailureCount: options?.assistantFailureCount,
    assistantResult: options?.assistantResult,
    preserveLocalState: options?.preserveLocalState,
    offline: options?.offline,
  });
}

async function sendConversationMessage(page: Page, message: string) {
  await page.getByTestId('conversation-input').fill(message);
  await page.getByTestId('conversation-send').click();
}

test.describe('Mobile conversation home', () => {
  test.describe.configure({ mode: 'serial' });
  test.use({ viewport: mobileViewport, isMobile: true, hasTouch: true });

  test('renders conversation-first controls', async ({ page }) => {
    await mockConversationShell(page);

    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });

    await expect(page.locator('header')).toBeVisible();
    await expect(page.getByTestId('conversation-live-surface')).toContainText('和小智说话');
    await expect(page.getByTestId('conversation-live-surface')).toContainText('点按麦克风直接说');
    await expect(page.getByTestId('conversation-voice-toggle')).toBeVisible();
    await expect(page.getByTestId('conversation-voice-toggle')).toHaveCount(1);
    await expect(page.getByTestId('conversation-history-heading')).toHaveCount(0);
    await expect(page.getByTestId('now-strip')).toHaveCount(0);
    await expect(page.getByText('PC 执行')).toHaveCount(0);
    await expect(page.getByTestId('conversation-input')).toBeVisible();
    await expect(page.getByTestId('conversation-send')).toBeDisabled();
    await expect(page.getByTestId('bottom-nav')).toHaveAttribute('aria-label', /.+/);
    await expect(page.getByTestId('nav-item-conversation')).toHaveAttribute('aria-current', 'page');
  });

  test('keeps attached files in the current conversation composer', async ({ page }) => {
    await mockConversationShell(page);

    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });

    await page.getByTestId('conversation-file-input').setInputFiles({
      name: 'contract-notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('contract context'),
    });

    await expect(page.getByTestId('conversation-attachment')).toContainText('contract-notes.txt');
    await expect(page.getByText('材料已加入本次对话')).toBeVisible();
    await expect(page.getByTestId('conversation-send')).toBeEnabled();
    expect(page.url()).toBe(appUrl);
  });

  test('captures an idea locally without leaving the conversation flow', async ({ page }) => {
    await mockConversationShell(page, { preserveLocalState: true });

    await page.goto(`${appUrl}inspiration`, { waitUntil: 'domcontentloaded' });
    await page.evaluate((key) => window.localStorage.removeItem(key), ideaCaptureKey);
    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: '想法暂存' })).toBeVisible();
    await expect(page.getByText('这里不广播、不自动立项')).toBeVisible();
    await expect(page.getByText('广播至全舰队')).toHaveCount(0);
    await expect(page.getByText('语义血缘')).toHaveCount(0);

    const idea = '把首页继续收敛成真实沟通，不展示假能力卡片';
    await page.getByRole('textbox').fill(idea);
    await page.getByRole('button', { name: '暂存' }).click();

    await expect(page.getByText('已暂存的想法')).toHaveCount(0);
    await expect(page.getByText('暂存列表')).toBeVisible();
    await expect(page.getByText(idea)).toBeVisible();
    await expect.poll(() => page.evaluate(
      ({ key, expected }) => window.localStorage.getItem(key)?.includes(expected) ?? false,
      { key: ideaCaptureKey, expected: idea }
    )).toBe(true);

    await page.getByRole('button', { name: '移除想法' }).click();

    await expect(page.getByText(idea)).toHaveCount(0);
    await expect(page.getByText('暂无想法')).toBeVisible();
    await expect.poll(() => page.evaluate(
      ({ key, expected }) => window.localStorage.getItem(key)?.includes(expected) ?? false,
      { key: ideaCaptureKey, expected: idea }
    )).toBe(false);
  });

  test('brings a captured idea back into the unified chat composer', async ({ page }) => {
    await mockConversationShell(page, { preserveLocalState: true });

    await page.goto(`${appUrl}inspiration`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(({ ideaKey, stateKey }) => {
      window.localStorage.removeItem(ideaKey);
      window.localStorage.removeItem(stateKey);
      window.sessionStorage.removeItem('xiaozhi_resume_prompt');
    }, { ideaKey: ideaCaptureKey, stateKey: localStateKey });
    await page.reload({ waitUntil: 'domcontentloaded' });

    const idea = '让小智把这段产品反馈整理成下一轮 UI 修改任务';
    await page.getByRole('textbox').fill(idea);
    await page.getByRole('button', { name: '暂存' }).click();
    await page.getByRole('button', { name: '带回对话' }).click();

    await expect(page).toHaveURL(appUrl);
    await expect(page.getByTestId('conversation-live-surface')).toContainText('和小智说话');
    await expect(page.getByTestId('conversation-input')).toHaveValue(`帮我继续展开这个想法：${idea}`);
    await expect(page.getByTestId('conversation-send')).toBeEnabled();
    await expect.poll(() => page.evaluate(() => window.sessionStorage.getItem('xiaozhi_resume_prompt'))).toBeNull();
  });

  test('shows model source on AI assistant replies', async ({ page }) => {
    await mockConversationShell(page, {
      assistantResult: {
        success: true,
        response: {
          id: 'ai-source-ok',
          handler: 'ai',
          type: 'chat',
          message: 'received',
          ai: {
            provider: 'dashscope',
            model: 'qwen-plus',
            latencyMs: 3100,
          },
        },
      },
    });

    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
    await sendConversationMessage(page, 'show model source');

    await expect(page.getByText('received')).toBeVisible();
    await expect(page.getByTestId('conversation-history-heading')).toContainText('本次会话');
    await expect(page.getByTestId('conversation-history-heading')).toContainText('语音和文字会连续保留在这里');
    await expect(page.getByTestId('conversation-inbox-link')).toContainText('全部会话');
    await expect(page.getByTestId('assistant-ai-source')).toContainText('通义 qwen-plus');

    await page.getByTestId('conversation-inbox-link').click();
    await expect(page).toHaveURL(/\/inbox$/);
  });

  test('sends final voice transcript through the current conversation', async ({ page }) => {
    const voiceTranscript = '帮我整理今天最该推进的三件事';

    await page.addInitScript(() => {
      const instances: FakeSpeechRecognition[] = [];

      class FakeSpeechRecognition {
        continuous = false;
        interimResults = false;
        lang = 'zh-CN';
        maxAlternatives = 1;
        onstart: (() => void) | null = null;
        onresult: ((event: unknown) => void) | null = null;
        onerror: ((event: unknown) => void) | null = null;
        onend: (() => void) | null = null;
        started = false;

        constructor() {
          instances.push(this);
        }

        start() {
          this.started = true;
          this.onstart?.();
        }

        stop() {
          this.started = false;
          this.onend?.();
        }

        emitFinalTranscript(text: string) {
          const finalResult = [{ transcript: text, confidence: 0.96 }] as Array<unknown> & { isFinal: boolean };
          finalResult.isFinal = true;
          this.onresult?.({ results: [finalResult] });
          this.onend?.();
        }
      }

      (window as unknown as { SpeechRecognition: typeof FakeSpeechRecognition }).SpeechRecognition = FakeSpeechRecognition;
      (window as unknown as { webkitSpeechRecognition: typeof FakeSpeechRecognition }).webkitSpeechRecognition = FakeSpeechRecognition;
      (window as unknown as { __fakeSpeechRecognitionReady: () => boolean }).__fakeSpeechRecognitionReady = () => {
        const recognition = instances[instances.length - 1];
        return Boolean(recognition?.started && recognition.onresult && recognition.onend);
      };
      (window as unknown as { __emitFinalVoiceTranscript: (text: string) => void }).__emitFinalVoiceTranscript = (text: string) => {
        const recognition = instances[instances.length - 1];
        if (!recognition) throw new Error('SpeechRecognition was not started');
        window.setTimeout(() => recognition.emitFinalTranscript(text), 0);
      };
    });
    await mockConversationShell(page);

    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('conversation-voice-toggle')).toBeEnabled();
    await page.getByTestId('conversation-voice-toggle').click();
    await expect.poll(() => page.evaluate(() =>
      (window as unknown as { __fakeSpeechRecognitionReady: () => boolean }).__fakeSpeechRecognitionReady()
    )).toBe(true);
    await page.evaluate((text) =>
      (window as unknown as { __emitFinalVoiceTranscript: (value: string) => void }).__emitFinalVoiceTranscript(text),
      voiceTranscript,
    );

    await expect.poll(() => page.evaluate(() => document.body.innerText)).toContain(voiceTranscript);
    await expect(page.getByText(voiceTranscript)).toBeVisible();
    await expect(page.getByText('received')).toBeVisible();
    await expect(page.getByTestId('conversation-input')).toHaveValue('');
    expect(await page.evaluate(() =>
      (window as unknown as { __assistantCalls?: number }).__assistantCalls ?? 0
    )).toBe(1);
  });

  test('shows recoverable microphone permission guidance', async ({ page }) => {
    await page.addInitScript(() => {
      class DeniedSpeechRecognition {
        continuous = false;
        interimResults = false;
        lang = 'zh-CN';
        maxAlternatives = 1;
        onstart: (() => void) | null = null;
        onerror: ((event: unknown) => void) | null = null;
        onend: (() => void) | null = null;

        start() {
          this.onstart?.();
          window.setTimeout(() => {
            this.onerror?.({ error: 'not-allowed' });
            this.onend?.();
          }, 0);
        }

        stop() {
          this.onend?.();
        }
      }

      (window as unknown as { SpeechRecognition: typeof DeniedSpeechRecognition }).SpeechRecognition = DeniedSpeechRecognition;
      (window as unknown as { webkitSpeechRecognition: typeof DeniedSpeechRecognition }).webkitSpeechRecognition = DeniedSpeechRecognition;
    });
    await mockConversationShell(page);

    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('conversation-voice-toggle')).toBeEnabled();
    await page.getByTestId('conversation-voice-toggle').click();

    await expect(page.getByTestId('conversation-live-surface')).toContainText('麦克风权限被拒绝');
    await expect(page.getByTestId('conversation-live-surface')).toContainText('请在浏览器或系统设置里允许麦克风');
  });

  test('restores unsent composer text after reload', async ({ page }) => {
    await mockConversationShell(page, { preserveLocalState: true });

    const message = 'unfinished composer text should survive reload';
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
    await page.evaluate((key) => window.localStorage.removeItem(key), localStateKey);
    await page.getByTestId('conversation-input').fill(message);

    await expect.poll(() => page.evaluate(
      ({ key, expected }) => window.localStorage.getItem(key)?.includes(expected) ?? false,
      { key: localStateKey, expected: message }
    )).toBe(true);

    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('conversation-input')).toHaveValue(message);
    await expect(page.getByTestId('conversation-send')).toBeEnabled();
  });

  test('hydrates recent conversation history after reload', async ({ page }) => {
    await mockConversationShell(page, { preserveLocalState: true });

    const message = '刷新后仍然能看到这条历史对话';
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
    await sendConversationMessage(page, message);

    await expect(page.getByText(message)).toBeVisible();
    await expect(page.getByText('received')).toBeVisible();
    const assistantPayload = await page.evaluate(() =>
      (window as unknown as { __assistantPayload?: Record<string, unknown> }).__assistantPayload
    );
    expect(assistantPayload?.sessionId).toMatch(/^mobile-session-/);
    expect(assistantPayload?.deviceId).toMatch(/^mobile-device-/);

    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(page.getByText(message)).toBeVisible();
    await expect(page.getByText('received')).toBeVisible();
    expect(await page.evaluate(() =>
      (window as unknown as { __assistantHistoryCalls?: number }).__assistantHistoryCalls ?? 0
    )).toBeGreaterThan(0);
    const historySearch = await page.evaluate(() =>
      (window as unknown as { __assistantHistorySearch?: string }).__assistantHistorySearch ?? ''
    );
    expect(historySearch).toContain('sessionId=mobile-session-');
    expect(historySearch).toContain('deviceId=mobile-device-');
  });

  test('sends resumed conversation context with the next message', async ({ page }) => {
    await mockConversationShell(page);

    await page.goto(`${appUrl}?resumeConversationId=conv-pc&resumeTitle=${encodeURIComponent('PC 执行回流')}`, {
      waitUntil: 'domcontentloaded',
    });

    await expect(page.getByTestId('resume-conversation-context')).toContainText('正在接着这段会话');
    await expect(page.getByTestId('resume-conversation-context')).toContainText('PC 执行回流');

    await sendConversationMessage(page, '接着刚才那段继续');

    const assistantPayload = await page.evaluate(() =>
      (window as unknown as { __assistantPayload?: Record<string, unknown> }).__assistantPayload
    );
    expect(assistantPayload?.resumeConversationId).toBe('conv-pc');
    expect(assistantPayload?.resumeConversationTitle).toBe('PC 执行回流');
    expect(assistantPayload?.sessionId).toMatch(/^mobile-session-/);
    expect(assistantPayload?.deviceId).toMatch(/^mobile-device-/);
  });

  test('keeps device setup out of the home surface', async ({ page }) => {
    await mockConversationShell(page);

    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('device-setup-card')).toHaveCount(0);
    await expect(page.getByText('设备 未绑定')).toHaveCount(0);
    await expect(page.getByText('PC 执行')).toHaveCount(0);
  });

  test('shows offline guidance and retains a send without calling the assistant', async ({ page }) => {
    await mockConversationShell(page, {
      offline: true,
      preserveLocalState: true,
    });

    const message = 'offline send should be retained locally';
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
    await page.evaluate((key) => window.localStorage.removeItem(key), localStateKey);

    await expect(page.getByTestId('home-notice')).toContainText('当前离线');
    await sendConversationMessage(page, message);

    await expect(page.getByTestId('failed-send-card')).toContainText(message);
    await expect(page.getByTestId('failed-send-card')).toContainText('第 1 次失败');
    expect(await page.evaluate(() =>
      (window as unknown as { __assistantCalls?: number }).__assistantCalls ?? 0
    )).toBe(0);
    await expect.poll(() => page.evaluate(
      ({ key, expected }) => window.localStorage.getItem(key)?.includes(expected) ?? false,
      { key: localStateKey, expected: message }
    )).toBe(true);
  });

  test('keeps a failed send available for retry or edit', async ({ page }) => {
    await mockConversationShell(page, { assistantFailure: true });

    const message = 'create a failed-send retry test';
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
    await sendConversationMessage(page, message);

    await expect(page.getByTestId('failed-send-card')).toContainText(message);
    await expect(page.getByTestId('failed-send-retry')).toBeVisible();
    await expect(page.getByTestId('failed-send-restore')).toBeVisible();
    await expect(page.getByTestId('failed-send-dismiss')).toBeVisible();
  });

  test('clears a retained failed send after a successful retry', async ({ page }) => {
    await mockConversationShell(page, {
      assistantFailureCount: 1,
      preserveLocalState: true,
    });

    const message = 'retry succeeds without duplicating the user message';
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
    await page.evaluate((key) => window.localStorage.removeItem(key), localStateKey);
    await sendConversationMessage(page, message);

    await expect(page.getByTestId('failed-send-card')).toContainText('第 1 次失败');
    await expect(page.getByText(message)).toHaveCount(2);

    await page.getByTestId('failed-send-retry').click();

    await expect(page.getByTestId('failed-send-card')).toBeHidden();
    await expect(page.getByText(message)).toHaveCount(1);
    await expect(page.getByText('received')).toBeVisible();
    expect(await page.evaluate(() =>
      (window as unknown as { __assistantCalls?: number }).__assistantCalls ?? 0
    )).toBe(2);
    await expect.poll(() => page.evaluate(
      ({ key, expected }) => window.localStorage.getItem(key)?.includes(expected) ?? false,
      { key: localStateKey, expected: message }
    )).toBe(false);
  });

  test('increments failed send attempts and can discard the retained message', async ({ page }) => {
    await mockConversationShell(page, {
      assistantFailure: true,
      preserveLocalState: true,
    });

    const message = 'retry attempts should keep counting';
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
    await page.evaluate((key) => window.localStorage.removeItem(key), localStateKey);
    await sendConversationMessage(page, message);

    await expect(page.getByTestId('failed-send-card')).toContainText('第 1 次失败');
    await expect(page.getByText(message)).toHaveCount(2);

    await page.getByTestId('failed-send-retry').click();

    await expect(page.getByTestId('failed-send-card')).toContainText('第 2 次失败');
    await expect(page.getByText(message)).toHaveCount(2);
    await expect.poll(() => page.evaluate(
      ({ key, expected }) => window.localStorage.getItem(key)?.includes(expected) ?? false,
      { key: localStateKey, expected: message }
    )).toBe(true);

    await page.getByTestId('failed-send-dismiss').click();

    await expect(page.getByTestId('failed-send-card')).toBeHidden();
    await expect.poll(() => page.evaluate(
      ({ key, expected }) => window.localStorage.getItem(key)?.includes(expected) ?? false,
      { key: localStateKey, expected: message }
    )).toBe(false);
  });

  test('restores a locally retained failed send after reload', async ({ page }) => {
    await mockConversationShell(page, {
      assistantFailure: true,
      preserveLocalState: true,
    });

    const message = 'local failed send should survive reload';
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
    await page.evaluate((key) => window.localStorage.removeItem(key), localStateKey);
    await sendConversationMessage(page, message);

    await expect(page.getByTestId('failed-send-card')).toContainText(message);
    await expect.poll(() => page.evaluate(
      ({ key, expected }) => window.localStorage.getItem(key)?.includes(expected) ?? false,
      { key: localStateKey, expected: message }
    )).toBe(true);

    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('failed-send-card')).toContainText(message);
    await expect.poll(() => page.evaluate(
      ({ key, expected }) => window.localStorage.getItem(key)?.includes(expected) ?? false,
      { key: localStateKey, expected: message }
    )).toBe(true);
  });

  test('shows a confirmation card returned by the assistant', async ({ page }) => {
    await mockConversationShell(page, {
      assistantResult: {
        success: true,
        response: {
          id: 'pending-project',
          handler: 'ai',
          type: 'confirm',
          message: 'approval required',
          action: 'create_project',
          actionParams: { title: 'Approval Project' },
          authorization: {
            required: true,
            reason: 'Ready to create Approval Project',
            operation: 'create_project',
            options: [
              { label: 'Approve', action: 'approve' },
              { label: 'Cancel', action: 'deny' },
            ],
          },
        },
      },
    });

    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
    await sendConversationMessage(page, 'create a project that needs approval');

    await expect(page.getByTestId('pending-confirmation-card')).toContainText('Ready to create Approval Project');
    await expect(page.getByTestId('pending-confirmation-approve')).toBeVisible();
    await expect(page.getByTestId('pending-confirmation-deny')).toBeVisible();
  });

  test('places real execution reports above the composer after approval', async ({ page }) => {
    await mockConversationShell(page, {
      assistantResult: {
        success: true,
        response: {
          id: 'pending-pc',
          handler: 'hybrid',
          type: 'confirm',
          message: 'approval required',
          action: 'pc_execute',
          actionParams: { type: 'system_optimize', description: 'connectivity diagnostic' },
          authorization: {
            required: true,
            reason: '准备让 PC 执行连通性测试，并把结果回传手机端',
            operation: 'pc_execute',
            options: [
              { label: 'Approve', action: 'approve' },
              { label: 'Cancel', action: 'deny' },
            ],
          },
        },
      },
    });

    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
    await sendConversationMessage(page, '让PC端执行一次连通性测试，并把结果回传到手机端');
    await page.getByTestId('pending-confirmation-approve').click();

    await expect(page.getByTestId('execution-result-jump')).toContainText('执行结果已回传');
    await expect(page.getByTestId('execution-result-jump')).toContainText('PC 端连通性测试完成');
    await expect(page.getByTestId('execution-result-target')).toContainText('PC 执行');
    await expect(page.getByTestId('execution-result-jump')).toContainText('查看设备');
    await expect(page.getByTestId('execution-result-time')).toBeVisible();
    await expect(page.getByText('好的，PC 执行已完成：PC 端连通性测试完成：127.0.0.1 可达，耗时约 42ms')).toBeVisible();
  });

  test('edits and saves a draft before execution', async ({ page }) => {
    await mockConversationShell(page, {
      assistantResult: {
        success: true,
        response: {
          id: 'draft-edit',
          handler: 'ai',
          type: 'draft',
          message: 'draft prepared',
          draftItems: [
            {
              action: 'create_project',
              label: 'Create project: Old Project',
              actionParams: { title: 'Old Project', description: 'Old description' },
            },
          ],
        },
      },
    });

    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
    await sendConversationMessage(page, 'draft a project');
    await expect(page.getByTestId('pending-draft-card')).toBeVisible();

    await page.getByTestId('draft-edit-button').click();
    await page.getByTestId('draft-field-0-title').fill('New Project');
    await page.getByTestId('draft-field-0-description').fill('New description');
    await page.getByTestId('draft-save-button').click();

    await expect.poll(() => page.evaluate(() =>
      (window as unknown as { __draftUpdatePayload?: unknown }).__draftUpdatePayload
    )).toMatchObject({
      responseId: 'draft-edit',
      items: [
        {
          action: 'create_project',
          actionParams: { title: 'New Project', description: 'New description' },
        },
      ],
    });
  });

  test('restores in-progress draft edits after reload', async ({ page }) => {
    const pendingSummary = {
      success: true,
      count: 1,
      pending: [],
      draft: [
        {
          id: 'pending-draft-restore',
          entryType: 'draft',
          action: null,
          items: [
            {
              action: 'create_project',
              label: 'Create project: Original Project',
              actionParams: { title: 'Original Project', description: 'Original description' },
            },
          ],
          expiresAt: new Date(Date.now() + 600000).toISOString(),
          createdAt: new Date().toISOString(),
        },
      ],
    };

    await mockConversationShell(page, {
      pendingSummary,
      preserveLocalState: true,
    });
    await page.addInitScript(({ key, updatedAt }) => {
      window.localStorage.setItem(key, JSON.stringify({
        activeDraft: {
          responseId: 'pending-draft-restore',
          items: [
            {
              action: 'create_project',
              label: 'Create project: Restored Project',
              actionParams: { title: 'Restored Project', description: 'Restored description' },
            },
          ],
          editing: true,
          updatedAt,
        },
        updatedAt,
      }));
    }, { key: localStateKey, updatedAt: Date.now() });

    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('pending-draft-card')).toBeVisible();
    await expect(page.getByTestId('draft-field-0-title')).toHaveValue('Restored Project');
    await expect(page.getByTestId('draft-field-0-description')).toHaveValue('Restored description');
  });
});
