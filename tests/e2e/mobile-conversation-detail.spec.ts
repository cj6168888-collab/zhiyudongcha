import { expect, test, type Page } from '@playwright/test';

const mobileViewport = { width: 390, height: 844 };
const detailUrl = 'http://localhost:5173/inbox/conv-pc';

async function mockConversationDetail(page: Page) {
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

      if (path === '/api/conversations/conv-pc' && method === 'GET') {
        return jsonResponse({
          success: true,
          conversation: {
            id: 'conv-pc',
            source: 'mobile',
            mode: 'task_request',
            status: 'review_pending',
            title: 'PC 执行回流',
            summary: '小智已经把桌面代理执行结果回传到手机端。',
            createdAt: '2026-05-12T06:00:00.000Z',
            updatedAt: '2026-05-12T06:05:00.000Z',
            startedAt: '2026-05-12T06:00:00.000Z',
            endedAt: '2026-05-12T06:05:00.000Z',
          },
          segments: [
            {
              id: 'seg-user',
              sequence: 1,
              segmentType: 'transcript',
              text: '帮我让 PC 整理今天最该推进的重点。',
              speaker: 'user',
              speakerType: 'user',
              createdAt: '2026-05-12T06:00:00.000Z',
            },
            {
              id: 'seg-assistant',
              sequence: 2,
              segmentType: 'reply',
              text: '我会让桌面端整理，并把结果回传到这里。',
              speaker: 'assistant',
              speakerType: 'assistant',
              createdAt: '2026-05-12T06:01:00.000Z',
            },
          ],
          candidates: [
            {
              id: 'cand-task',
              candidateType: 'task',
              status: 'pending',
              content: {
                title: '整理今天重点',
                description: 'PC 端已经完成初步整理，等待你确认是否应用到项目。',
              },
              confidence: '0.91',
              riskLevel: 'low',
              linkedEntityId: null,
              linkedEntityType: null,
              createdAt: '2026-05-12T06:03:00.000Z',
            },
            {
              id: 'cand-memory',
              candidateType: 'memory',
              status: 'applied',
              content: {
                content: '用户偏好：PC 执行结果必须回传到手机端，而不是远程桌面。',
              },
              confidence: '0.88',
              riskLevel: 'low',
              linkedEntityId: 'vault-1',
              linkedEntityType: 'vault_item',
              createdAt: '2026-05-12T06:04:00.000Z',
            },
          ],
        });
      }

      if (path === '/api/conversation-candidates/cand-task/apply' && method === 'POST') {
        return jsonResponse({ success: true, linkedEntityId: 'project-1', linkedEntityType: 'project' });
      }

      return originalFetch(input, init);
    };
  });
}

test.describe('Mobile conversation detail', () => {
  test.use({ viewport: mobileViewport, isMobile: true, hasTouch: true });

  test('shows the conversation timeline, work feedback, and continue entry', async ({ page }) => {
    await mockConversationDetail(page);

    await page.goto(detailUrl, { waitUntil: 'domcontentloaded' });

    await expect(page.locator('header')).toContainText('PC 执行回流');
    await expect(page.getByTestId('conversation-detail-overview')).toContainText('PC 执行回流');
    await expect(page.getByTestId('conversation-detail-overview')).toContainText('工作指令');
    await expect(page.getByTestId('conversation-work-alert')).toContainText('有工作结果需要你确认');
    await expect(page.getByTestId('conversation-timeline')).toContainText('帮我让 PC 整理今天最该推进的重点');
    await expect(page.getByTestId('conversation-timeline')).toContainText('我会让桌面端整理');
    await expect(page.getByTestId('work-feedback-section')).toContainText('整理今天重点');
    await expect(page.getByTestId('work-feedback-section')).toContainText('PC 端已经完成初步整理');
    await expect(page.getByTestId('candidate-actions')).toBeVisible();
    await expect(page.getByTestId('candidate-linked-entity')).toContainText('vault-1');

    await page.getByTestId('continue-conversation').click();
    await expect(page).toHaveURL('http://localhost:5173/');
  });
});
