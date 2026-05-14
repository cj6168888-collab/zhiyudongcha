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

  await page.route('**/api/auth/ws-token', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { token: 'test-token', expiresIn: 3600, role: 'GUEST' },
      }),
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
        message: 'sent',
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
          message: 'registered',
        },
      }),
    });
  });

  await page.route('**/api/auth/password/reset', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { message: 'reset complete' } }),
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
          message: 'login complete',
        },
      }),
    });
  });

  await page.route('**/api/navigator/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/api/telemetry/status', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {} }) });
  });
  await page.route('**/api/remote/devices', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, devices: [] }) });
  });
}

async function clickCodeButton(page: Page, codeInputSelector: string) {
  await page.locator(codeInputSelector).locator('..').locator('button').click();
}

test.describe('Desktop phone auth', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('registers with SMS, resets password, and logs in with the reset password', async ({ page }) => {
    await mockPhoneAuth(page);

    await page.goto(`${appUrl}/desktop/login`, { waitUntil: 'domcontentloaded' });
    await page.locator('#username').waitFor();

    await page.locator('[role="tab"]').nth(1).click();
    await page.locator('#register-phone').fill('13800000001');
    await page.locator('#register-password').fill('password123');
    await page.locator('#register-confirm').fill('password123');
    await clickCodeButton(page, '#register-code');
    await expect(page.getByText(/111111/)).toBeVisible();
    await page.locator('#register-code').fill('111111');
    await page.locator('form:has(#register-phone) button[type="submit"]').click();

    await expect(page).toHaveURL(`${appUrl}/desktop/node`);
    await expect
      .poll(() => page.evaluate(() => JSON.parse(window.localStorage.getItem('desktop_user') || '{}').username))
      .toBe('13800000001');

    await page.goto(`${appUrl}/desktop/login`, { waitUntil: 'domcontentloaded' });
    await page.locator('#username').waitFor();
    await page.locator('[role="tab"]').nth(2).click();
    await page.locator('#reset-phone').fill('13800000001');
    await page.locator('#reset-password').fill('newpass123');
    await page.locator('#reset-confirm').fill('newpass123');
    await clickCodeButton(page, '#reset-code');
    await expect(page.getByText(/222222/)).toBeVisible();
    await page.locator('#reset-code').fill('222222');
    await page.locator('form:has(#reset-phone) button[type="submit"]').click();

    await page.waitForFunction(() => document.querySelectorAll('[role="tab"]')[0]?.getAttribute('data-state') === 'active');
    await expect(page.locator('#username')).toHaveValue('13800000001');

    await page.locator('#password').fill('newpass123');
    await page.locator('form:has(#username) button[type="submit"]').click();
    await expect(page).toHaveURL(`${appUrl}/desktop/node`);
  });
});
