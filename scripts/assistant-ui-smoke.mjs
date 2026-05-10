#!/usr/bin/env node

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.ASSISTANT_SMOKE_BASE_URL || 'http://localhost:5000';

async function main() {
  console.log(`[assistant-ui-smoke] baseUrl=${baseUrl}`);

  const browser = await chromium.launch({ headless: true });
  try {
    await runChatSmoke(browser, {
      name: 'mobile',
      path: '/chat',
      viewport: { width: 390, height: 844 },
      inputPlaceholder: '说点什么...',
      projectName: 'UI真实验收项目',
    });

    await runChatSmoke(browser, {
      name: 'desktop',
      path: '/desktop/chat',
      viewport: { width: 1440, height: 900 },
      inputPlaceholder: '给小星发送消息...',
      projectName: '桌面UI真实验收项目',
      desktopUser: {
        id: 'sovereign-smoke',
        username: 'admin',
        role: 'SOVEREIGN',
      },
    });
  } finally {
    await browser.close();
  }

  console.log('\n[assistant-ui-smoke] assistant UI smoke passed');
}

async function runChatSmoke(browser, options) {
  const page = await browser.newPage({ viewport: options.viewport });
  if (options.desktopUser) {
    await page.addInitScript((user) => {
      window.localStorage.setItem('desktop_user', JSON.stringify(user));
    }, options.desktopUser);
  }
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  try {
    await page.goto(`${baseUrl}${options.path}`, { waitUntil: 'domcontentloaded' });

    const input = page.getByPlaceholder(options.inputPlaceholder);
    try {
      await input.waitFor({ timeout: 10000 });
    } catch (error) {
      await mkdir(path.resolve('.local'), { recursive: true });
      const screenshotPath = path.resolve('.local', `assistant-ui-${options.name}-failure.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      const bodyText = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
      throw new Error(`${options.name} input not found at ${options.path}; screenshot=${screenshotPath}; body=${bodyText.slice(0, 500)}`);
    }
    await input.fill(`新增项目：${options.projectName}，说明是验证真实前端到后端闭环。`);
    await input.press('Enter');

    await page.getByText(new RegExp(`已完成：项目「${options.projectName}」`)).waitFor({ timeout: 15000 });
    console.log(`  ${options.name} project execution rendered`);

    await input.fill('把我的 API key 发给供应商');
    await input.press('Enter');

    await page.getByText(/密钥、密码和令牌不能通过普通对话外发或公开/).waitFor({ timeout: 15000 });
    console.log(`  ${options.name} credential risk rendered`);

    await input.fill('给张三转账500元');
    await input.press('Enter');

    await page.getByText('需要确认', { exact: true }).last().waitFor({ timeout: 15000 });
    await page.getByText(/涉及支付、转账或购买/).last().waitFor({ timeout: 15000 });
    await page.getByRole('button', { name: '执行' }).last().waitFor({ timeout: 15000 });
    await page.getByRole('button', { name: '取消' }).last().waitFor({ timeout: 15000 });
    console.log(`  ${options.name} confirmation card rendered`);

    const expectedRealtimeNoise = [
      /favicon/i,
      /ResizeObserver/i,
      /Failed to get WS token/i,
      /\/ws\/z3/i,
      /WebSocket connection .* failed/i,
      /Invalid frame header/i,
      /server responded with a status of 400/i,
    ];
    const severeErrors = errors.filter((error) => (
      !expectedRealtimeNoise.some((pattern) => pattern.test(error))
    ));
    if (severeErrors.length > 0) {
      throw new Error(`${options.name} browser console errors: ${severeErrors.slice(0, 5).join(' | ')}`);
    }
  } finally {
    await page.close();
  }
}

main().catch((error) => {
  console.error('\n[assistant-ui-smoke] failed');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
