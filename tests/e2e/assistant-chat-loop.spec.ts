import { expect, test } from '@playwright/test';

test.describe('Assistant first product loop UI', () => {
  test('mobile chat displays execution result returned by /api/assistant', async ({ page }) => {
    await page.route('**/api/assistant', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
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
        }),
      });
    });

    await page.goto('http://localhost:5173/chat', { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder('说点什么...').fill('帮我创建增长计划项目');
    await page.getByPlaceholder('说点什么...').press('Enter');

    await expect(page.getByText('好的，已为你创建项目。')).toBeVisible();
    await expect(page.getByText('已完成：项目「增长计划」')).toBeVisible();
  });

  test('mobile chat confirms pending action before executing', async ({ page }) => {
    await page.route('**/api/assistant/authorize', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: '好的，已完成：project 已创建',
          execution: {
            success: true,
            action: 'create_project',
            entityType: 'project',
            entityId: 'project-2',
            entityData: { id: 'project-2', title: '待确认项目' },
          },
        }),
      });
    });

    await page.route('**/api/assistant', async (route) => {
      if (route.request().url().includes('/authorize') || route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
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
        }),
      });
    });

    await page.goto('http://localhost:5173/chat', { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder('说点什么...').fill('帮我创建一个需要确认的项目');
    await page.getByPlaceholder('说点什么...').press('Enter');

    await expect(page.getByText('需要确认', { exact: true })).toBeVisible();
    await expect(page.getByText('创建项目会写入你的项目中心')).toBeVisible();

    await page.getByRole('button', { name: '执行' }).click();

    await expect(page.getByText('已完成：项目「待确认项目」')).toBeVisible();
  });
});
