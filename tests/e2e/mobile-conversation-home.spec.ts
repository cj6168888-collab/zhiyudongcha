import { expect, type Page, test } from 'playwright/test';

const mobileViewport = { width: 390, height: 844 };

async function mockConversationShell(page: Page, options?: {
  pendingSummary?: Record<string, unknown>;
  assistantFailure?: boolean;
  assistantResult?: Record<string, unknown>;
}) {
  await page.addInitScript((mockOptions) => {
    const jsonResponse = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    const originalFetch = window.fetch.bind(window);

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

      if ((path === '/api/assistant' || path === '/api/assistant/') && method === 'POST') {
        if (mockOptions.assistantFailure) {
          return jsonResponse({ success: false, error: 'assistant unavailable' }, 400);
        }
        return jsonResponse(mockOptions.assistantResult ?? {
          success: true,
          response: {
            id: 'resp-ok',
            handler: 'ai',
            type: 'greeting',
            message: '收到，我来处理。',
          },
        });
      }

      return originalFetch(input, init);
    };
  }, {
    pendingSummary: options?.pendingSummary,
    assistantFailure: options?.assistantFailure,
    assistantResult: options?.assistantResult,
  });
}

test.describe('Mobile conversation home', () => {
  test.describe.configure({ mode: 'serial' });
  test.use({ viewport: mobileViewport, isMobile: true, hasTouch: true });

  test('renders conversation-first controls', async ({ page }) => {
    await mockConversationShell(page);

    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: '小智' })).toBeVisible();
    await expect(page.getByPlaceholder('直接告诉小智要做什么...')).toBeVisible();
    await expect(page.getByRole('button', { name: '语音输入' })).toBeVisible();
    await expect(page.getByRole('button', { name: '添加材料' })).toBeVisible();
    await expect(page.getByRole('button', { name: '发送' })).toBeVisible();
  });

  test('keeps a failed send available for retry or edit', async ({ page }) => {
    await mockConversationShell(page, { assistantFailure: true });

    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder('直接告诉小智要做什么...').fill('帮我创建失败重试测试');
    await page.getByRole('button', { name: '发送' }).click();

    await expect(page.getByText('消息没有送达')).toBeVisible();
    await expect(page.getByText('帮我创建失败重试测试').last()).toBeVisible();
    await expect(page.getByRole('button', { name: '重试发送' })).toBeVisible();
    await expect(page.getByRole('button', { name: '放回输入' })).toBeVisible();
  });

  test('shows a confirmation card returned by the assistant', async ({ page }) => {
    await mockConversationShell(page, {
      assistantResult: {
        success: true,
        response: {
          id: 'pending-project',
          handler: 'ai',
          type: 'confirm',
          message: '需要您确认是否创建项目。',
          action: 'create_project',
          actionParams: { title: '待确认项目' },
          authorization: {
            required: true,
            reason: '准备执行：项目「待确认项目」',
            operation: 'create_project',
            options: [
              { label: '确认执行', action: 'approve' },
              { label: '取消', action: 'deny' },
            ],
          },
        },
      },
    });

    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder('直接告诉小智要做什么...').fill('帮我创建一个需要确认的项目');
    await page.getByRole('button', { name: '发送' }).click();

    await expect(page.getByText('需要确认后执行')).toBeVisible();
    await expect(page.getByText('准备执行：项目「待确认项目」')).toBeVisible();
    await expect(page.getByRole('button', { name: '确认执行' })).toBeVisible();
    await expect(page.getByRole('button', { name: '取消' })).toBeVisible();
  });

  test('edits and saves a draft before execution', async ({ page }) => {
    await mockConversationShell(page, {
      assistantResult: {
        success: true,
        response: {
          id: 'draft-edit',
          handler: 'ai',
          type: 'draft',
          message: '我整理了一份草案。',
          draftItems: [
            {
              action: 'create_project',
              label: '创建项目：旧项目',
              actionParams: { title: '旧项目', description: '旧说明' },
            },
          ],
        },
      },
    });

    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder('直接告诉小智要做什么...').fill('帮我起草一个项目');
    await page.getByRole('button', { name: '发送' }).click();
    await expect(page.getByText('草案待确认')).toBeVisible();

    await page.getByRole('button', { name: '修改' }).click();
    await page.getByLabel('项目名').fill('新项目');
    await page.getByLabel('说明').fill('新说明');
    await page.getByRole('button', { name: '保存修改' }).click();

    await expect(page.getByText('已保存草案修改，共 1 项。')).toBeVisible();
    const updatePayload = await page.evaluate(() =>
      (window as unknown as { __draftUpdatePayload?: unknown }).__draftUpdatePayload
    );
    expect(updatePayload).toMatchObject({
      responseId: 'draft-edit',
      items: [
        {
          action: 'create_project',
          actionParams: { title: '新项目', description: '新说明' },
        },
      ],
    });
  });
});
