import { expect, type Page, test } from '@playwright/test';

const mobileViewport = { width: 390, height: 844 };
const appUrl = 'http://localhost:5173/';
const localStateKey = 'navigator.mobile.conversation-home.local-state.v1';

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

    if (!mockOptions.preserveLocalState) {
      window.localStorage.removeItem('navigator.mobile.conversation-home.local-state.v1');
    }
    (window as unknown as { __assistantCalls?: number }).__assistantCalls = 0;
    let assistantCallCount = 0;

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
        const failureCount = typeof mockOptions.assistantFailureCount === 'number'
          ? mockOptions.assistantFailureCount
          : 0;
        if (mockOptions.assistantFailure || assistantCallCount <= failureCount) {
          return jsonResponse({ success: false, error: 'assistant unavailable' }, 400);
        }
        return jsonResponse(mockOptions.assistantResult ?? {
          success: true,
          response: {
            id: 'resp-ok',
            handler: 'ai',
            type: 'greeting',
            message: 'received',
          },
        });
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
    await expect(page.getByTestId('conversation-live-surface')).toContainText('我在，直接说你要我做什么');
    await expect(page.getByTestId('conversation-voice-toggle')).toBeVisible();
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

  test('keeps device setup out of the home surface', async ({ page }) => {
    await mockConversationShell(page);

    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('device-setup-card')).toHaveCount(0);
    await expect(page.getByText('设备 未绑定')).toBeVisible();
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
