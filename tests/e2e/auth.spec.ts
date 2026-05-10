/**
 * E2E 测试 - 用户认证流程
 * 关键路径测试
 */

import { test, expect, type Page } from '@playwright/test';

test.describe('User Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // 打开应用
    await page.goto('/');
  });

  test('complete login flow', async ({ page }) => {
    // 1. 访问登录页面
    await page.goto('/login');
    await expect(page.locator('h1')).toContainText('登录');

    // 2. 输入凭据
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');

    // 3. 点击登录按钮
    await page.click('button[type="submit"]');

    // 4. 验证登录成功 - 应该跳转到 dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('text=欢迎')).toBeVisible();
  });

  test('login with invalid credentials', async ({ page }) => {
    await page.goto('/login');

    // 输入错误凭据
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // 验证错误提示
    await expect(page.locator('text=用户名或密码错误')).toBeVisible();
  });

  test('logout flow', async ({ page }) => {
    // 先登录
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);

    // 点击登出
    await page.click('button:has-text("登出")');

    // 验证登出成功
    await expect(page).toHaveURL('/login');
  });
});

test.describe('Dashboard Access', () => {
  test('unauthenticated user cannot access dashboard', async ({ page }) => {
    // 直接访问 dashboard
    await page.goto('/dashboard');

    // 应该跳转到登录页
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Core Features', () => {
  test('navigation works correctly', async ({ page }) => {
    // 先登录
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);

    // 测试导航
    await page.click('a[href="/projects"]');
    await expect(page).toHaveURL(/\/projects/);

    await page.click('a[href="/network"]');
    await expect(page).toHaveURL(/\/network/);

    await page.click('a[href="/settings"]');
    await expect(page).toHaveURL(/\/settings/);
  });
});
