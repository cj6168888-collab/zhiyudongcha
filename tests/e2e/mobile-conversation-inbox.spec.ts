import { expect, test, type Page } from '@playwright/test';

const mobileViewport = { width: 390, height: 844 };
const appUrl = 'http://localhost:5173/inbox';

async function mockConversationInbox(page: Page) {
  await page.addInitScript(() => {
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

      if (path === '/api/conversation-inbox' && method === 'GET') {
        return jsonResponse({
          success: true,
          total: 3,
          conversations: [
            {
              id: 'conv-pc',
              source: 'mobile',
              mode: 'task_request',
              status: 'review_pending',
              title: 'PC 执行回流',
              summary: '小智已经把桌面代理执行结果回传到手机端。',
              createdAt: '2026-05-12T06:00:00.000Z',
              updatedAt: '2026-05-12T06:03:00.000Z',
              lastActivityAt: '2026-05-12T06:03:00.000Z',
              pendingCount: 1,
              candidateCounts: { total: 1, task: 1, memory: 0, event: 0 },
            },
            {
              id: 'conv-memory',
              source: 'omi',
              mode: 'conversation_record',
              status: 'review_pending',
              title: '会议纪要沉淀',
              summary: '从导入对话中抽取了需要确认的记忆。',
              createdAt: '2026-05-12T05:00:00.000Z',
              updatedAt: '2026-05-12T05:04:00.000Z',
              lastActivityAt: '2026-05-12T05:04:00.000Z',
              pendingCount: 1,
              candidateCounts: { total: 1, task: 0, memory: 1, event: 0 },
            },
            {
              id: 'conv-done',
              source: 'mobile',
              mode: 'casual_chat',
              status: 'completed',
              title: '普通沟通',
              summary: '这段沟通已经记录，没有待处理工作。',
              createdAt: '2026-05-12T04:00:00.000Z',
              updatedAt: '2026-05-12T04:02:00.000Z',
              lastActivityAt: '2026-05-12T04:02:00.000Z',
              pendingCount: 0,
              candidateCounts: { total: 0, task: 0, memory: 0, event: 0 },
            },
          ],
        });
      }

      if (path === '/api/conversation-inbox/counts' && method === 'GET') {
        return jsonResponse({
          success: true,
          counts: { total: 2, task: 1, memory: 1, event: 0 },
        });
      }

      return originalFetch(input, init);
    };
  });
}

test.describe('Mobile conversation inbox', () => {
  test.use({ viewport: mobileViewport, isMobile: true, hasTouch: true });

  test('presents conversation history with pending work and real detail navigation', async ({ page }) => {
    await mockConversationInbox(page);

    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('会话历史')).toBeVisible();
    await expect(page.getByTestId('conversation-history-overview')).toContainText('3 段沟通已记录');
    await expect(page.getByTestId('conversation-history-overview')).toContainText('待处理');
    await expect(page.getByTestId('conversation-pending-summary')).toContainText('任务');
    await expect(page.getByTestId('conversation-pending-summary')).toContainText('记忆');
    await expect(page.getByTestId('conversation-card')).toHaveCount(3);
    await expect(page.getByText('PC 执行回流')).toBeVisible();
    await expect(page.getByText('普通沟通')).toBeVisible();
    await expect(page.getByTestId('conversation-pending-badge')).toHaveCount(2);

    await page.getByTestId('conversation-filter-pending').click();
    await expect(page.getByTestId('conversation-card')).toHaveCount(2);
    await expect(page.getByText('普通沟通')).toHaveCount(0);

    await page.getByText('PC 执行回流').click();
    await expect(page).toHaveURL(/\/inbox\/conv-pc$/);
  });
});
