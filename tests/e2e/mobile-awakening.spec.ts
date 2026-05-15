import { expect, test } from '@playwright/test';

const appUrl = 'http://localhost:5173/';

test.describe('Mobile awakening', () => {
  test('finishes onboarding and unlocks navigator settings for MASTER role', async ({ page }) => {
    await page.goto(`${appUrl}awakening`, { waitUntil: 'domcontentloaded' });

    for (let step = 0; step < 3; step += 1) {
      await expect(page.getByRole('button', { name: '跳过' })).toBeVisible();
      await page.getByRole('button', { name: '跳过' }).click();
    }

    await expect(page.getByRole('heading', { name: '选择你的模式' })).toBeVisible();
    await page.getByRole('button', { name: '确认模式' }).click();

    await expect(page.getByRole('heading', { name: '核心功能一览' })).toBeVisible();
    await page.getByRole('button', { name: '继续' }).click();

    await expect(page.getByPlaceholder('输入你的尊称...')).toBeVisible({ timeout: 4000 });
    await page.getByPlaceholder('输入你的尊称...').fill('验收主控');
    await page.getByRole('button', { name: '签署创世协议' }).click();

    await expect(page.getByRole('heading', { name: '创世完成' })).toBeVisible();
    await expect(page.getByText('出现错误')).toHaveCount(0);
    await page.waitForURL(appUrl, { timeout: 5000 });

    await page.goto(`${appUrl}navigator-settings`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('模型提供商')).toBeVisible();
    await expect(page.getByText('需要主控权限')).toHaveCount(0);
  });
});
