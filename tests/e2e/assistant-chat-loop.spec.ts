import { expect, type Page, test } from '@playwright/test';

const appUrl = 'http://localhost:5173/chat';

type MockLoopOptions = {
  assistantResult: Record<string, unknown>;
  authorizeResult?: Record<string, unknown>;
};

async function mockAssistantProductLoop(page: Page, options: MockLoopOptions) {
  await page.addInitScript((mockOptions) => {
    const jsonResponse = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    const originalFetch = window.fetch.bind(window);

    window.localStorage.removeItem('navigator.mobile.conversation-home.local-state.v1');

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
      const requestUrl = new URL(url, window.location.origin);
      const path = requestUrl.pathname;
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
        return jsonResponse({ success: true, count: 0, data: [] });
      }

      if (path === '/api/alerts/pending' && method === 'GET') {
        return jsonResponse({ success: true, count: 0, data: [] });
      }

      if (path === '/api/assistant/pending' && method === 'GET') {
        return jsonResponse({ success: true, count: 0, pending: [], draft: [] });
      }

      if (path === '/api/assistant/history' && method === 'GET') {
        return jsonResponse({ success: true, messages: [] });
      }

      if (path === '/api/conversation-inbox' && method === 'GET') {
        return jsonResponse({ success: true, conversations: [] });
      }

      if (path === '/api/conversation-inbox/counts' && method === 'GET') {
        return jsonResponse({ success: true, counts: { total: 0, task: 0, memory: 0, event: 0 } });
      }

      if (path === '/api/assistant/authorize' && method === 'POST') {
        const payload = init?.body ? JSON.parse(String(init.body)) : {};
        (window as unknown as { __authorizePayload?: unknown }).__authorizePayload = payload;
        return jsonResponse(mockOptions.authorizeResult ?? {
          success: true,
          message: '好的，已完成。',
        });
      }

      if ((path === '/api/assistant' || path === '/api/assistant/') && method === 'POST') {
        const payload = init?.body ? JSON.parse(String(init.body)) : {};
        (window as unknown as { __assistantPayload?: unknown }).__assistantPayload = payload;
        return jsonResponse(mockOptions.assistantResult);
      }

      return originalFetch(input, init);
    };
  }, options);
}

async function sendConversationMessage(page: Page, message: string) {
  await page.getByTestId('conversation-input').fill(message);
  await page.getByTestId('conversation-send').click();
}

test.describe('Assistant first product loop UI', () => {
  test('chat displays execution result returned by /api/assistant', async ({ page }) => {
    await mockAssistantProductLoop(page, {
      assistantResult: {
        success: true,
        response: {
          id: 'resp-project',
          handler: 'ai',
          type: 'execute',
          message: '好的，已为你创建项目。',
          action: 'create_project',
          actionParams: { title: '增长计划' },
        },
        execution: {
          success: true,
          action: 'create_project',
          entityType: 'project',
          entityId: 'project-1',
          entityData: { id: 'project-1', title: '增长计划' },
        },
      },
    });

    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
    await sendConversationMessage(page, '帮我创建增长计划项目');

    await expect(page.getByText('好的，已为你创建项目。')).toBeVisible();
    await expect(page.getByTestId('execution-result-jump')).toContainText('执行结果已回传');
    await expect(page.getByTestId('execution-result-target')).toContainText('项目');
    await expect(page.getByTestId('execution-result-jump')).toContainText('已完成：项目「增长计划」');
    await expect(page.getByTestId('execution-result-jump')).toContainText('查看项目');
  });

  test('chat confirms pending action before executing', async ({ page }) => {
    await mockAssistantProductLoop(page, {
      assistantResult: {
        success: true,
        response: {
          id: 'resp-confirm-project',
          handler: 'ai',
          type: 'confirm',
          message: '需要您确认是否创建项目。',
          action: 'create_project',
          actionParams: { title: '待确认项目' },
          authorization: {
            required: true,
            reason: '创建项目会写入你的项目中心',
            operation: 'create_project',
            options: [
              { label: '好的，去做吧', action: 'approve' },
              { label: '算了', action: 'deny' },
            ],
          },
        },
      },
      authorizeResult: {
        success: true,
        message: '好的，已完成：project 已创建',
        execution: {
          success: true,
          action: 'create_project',
          entityType: 'project',
          entityId: 'project-2',
          entityData: { id: 'project-2', title: '待确认项目' },
        },
      },
    });

    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
    await sendConversationMessage(page, '帮我创建一个需要确认的项目');

    await expect(page.getByTestId('pending-confirmation-card')).toContainText('需要确认后执行');
    await expect(page.getByTestId('pending-confirmation-card')).toContainText('创建项目会写入你的项目中心');

    await page.getByTestId('pending-confirmation-approve').click();

    await expect(page.getByTestId('execution-result-jump')).toContainText('执行结果已回传');
    await expect(page.getByTestId('execution-result-jump')).toContainText('已完成：项目「待确认项目」');
    await expect(page.getByTestId('execution-result-jump')).toContainText('待确认项目');
  });
});
