import { expect, test, type Page } from '@playwright/test';

const appUrl = 'http://localhost:5173';

async function mockPhoneAuth(page: Page) {
  await page.route('**/api/security/csrf-token', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'test-csrf', headerName: 'x-csrf-token' }),
    });
  });

  await page.route('**/api/auth/sms/send', async (route) => {
    const requestBody = route.request().postDataJSON() as { phone?: string; scene?: string };
    const debugCode = requestBody.scene === 'reset_password' ? '222222' : '111111';

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          phone: requestBody.phone,
          expiresIn: 300,
          cooldownSeconds: 1,
          debugCode,
        },
        message: '验证码已发送',
      }),
    });
  });

  await page.route('**/api/auth/register', async (route) => {
    const requestBody = route.request().postDataJSON() as { phone?: string };

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          role: 'GUEST',
          user: { id: 'phone-user-1', username: requestBody.phone },
          message: '注册成功',
        },
      }),
    });
  });

  await page.route('**/api/auth/password/reset', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { message: '密码已重置，请重新登录' } }),
    });
  });

  await page.route('**/api/auth/login', async (route) => {
    const requestBody = route.request().postDataJSON() as { username?: string };

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          role: 'GUEST',
          user: { id: 'phone-user-1', username: requestBody.username },
          message: '登录成功',
        },
      }),
    });
  });
}

test.describe('Desktop phone auth', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('registers with SMS, resets password, and logs in with the reset password', async ({ page }) => {
    await mockPhoneAuth(page);

    await page.goto(`${appUrl}/desktop/login`, { waitUntil: 'domcontentloaded' });

    await page.getByRole('tab', { name: '注册' }).click();
    await page.getByLabel('手机号').fill('13800000001');
    await page.getByRole('button', { name: '获取验证码' }).click();
    await expect(page.getByText('验证码已发送：111111')).toBeVisible();

    await page.getByLabel('验证码', { exact: true }).fill('111111');
    await page.getByLabel('密码', { exact: true }).fill('password123');
    await page.getByLabel('确认密码', { exact: true }).fill('password123');
    await page.getByRole('button', { name: '注册并进入' }).click();

    await expect(page).toHaveURL(`${appUrl}/desktop/node`);
    await expect
      .poll(() => page.evaluate(() => JSON.parse(window.localStorage.getItem('desktop_user') || '{}').username))
      .toBe('13800000001');

    await page.goto(`${appUrl}/desktop/login`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: '找回' }).click();
    await page.getByLabel('手机号').fill('13800000001');
    await page.getByRole('button', { name: '获取验证码' }).click();
    await expect(page.getByText('验证码已发送：222222')).toBeVisible();

    await page.getByLabel('验证码', { exact: true }).fill('222222');
    await page.getByLabel('新密码', { exact: true }).fill('newpass123');
    await page.getByLabel('确认密码', { exact: true }).fill('newpass123');
    await page.getByRole('button', { name: '重置密码' }).click();

    await expect(page.getByText('密码已重置')).toBeVisible();
    await expect(page.getByLabel('手机号 / 用户名')).toHaveValue('13800000001');

    await page.getByLabel('密码', { exact: true }).fill('newpass123');
    await page.getByRole('button', { name: '登录' }).click();
    await expect(page).toHaveURL(`${appUrl}/desktop/node`);
  });
});
