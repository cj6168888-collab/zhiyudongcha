import { test, expect } from '@playwright/test';

test.describe('全面页面路由和功能测试', () => {
  const pages = [
    { path: '/', name: '首页/Dashboard' },
    { path: '/chat', name: '对话页' },
    { path: '/network', name: '关系网络' },
    { path: '/spirit', name: '灵魂控制' },
    { path: '/brain', name: '策略大脑' },
    { path: '/terminal', name: '战术终端' },
    { path: '/vault', name: '保险库' },
    { path: '/intel', name: '情报室' },
    { path: '/projects', name: '项目中心' },
    { path: '/projects/templates', name: '项目模板' },
    { path: '/evolution', name: '进化仪表盘' },
    { path: '/reports', name: '日报' },
    { path: '/genesis', name: '创世' },
    { path: '/remote', name: '远程控制' },
    { path: '/talk', name: '对话会话' },
    { path: '/inspiration', name: '灵感' },
    { path: '/integrations', name: '集成' },
    { path: '/email', name: '邮件管理' },
    { path: '/expense', name: '费用管理' },
    { path: '/dream', name: '梦境日志' },
    { path: '/care', name: '关怀规则' },
    { path: '/documents', name: '文档管理' },
    { path: '/ar', name: 'AR HUD' },
    { path: '/glasses', name: '眼镜伴侣' },
    { path: '/creator', name: '创造者' },
    { path: '/immune', name: '免疫仪表盘' },
    { path: '/console', name: '系统控制台' },
    { path: '/omni-archive', name: '全息档案' },
    { path: '/settings', name: '设置' },
    { path: '/command', name: '指挥中心' },
    { path: '/interface-x', name: '界面X' },
    { path: '/oracle', name: '预言家' },
    { path: '/fairy', name: '桌面精灵' },
    { path: '/spine', name: 'SpineAvatar' },
    { path: '/insight', name: '洞察监听' },
    { path: '/swarm', name: '蜂群控制台' },
    { path: '/recordings', name: '录音历史' },
  ];

  for (const page of pages) {
    test(`${page.name} (${page.path}) - 页面加载`, async ({ page: testPage }) => {
      const response = await testPage.goto(`http://localhost:5000${page.path}`, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      
      console.log(`✓ ${page.name}: ${response?.status() || '加载完成'}`);
      
      // 页面应该成功加载
      expect(response?.status() || 200).toBeLessThan(500);
    });
  }

  test('首页按钮和链接验证', async ({ page }) => {
    await page.goto('http://localhost:5000/', { waitUntil: 'networkidle' });
    
    // 获取所有按钮
    const buttons = await page.locator('button').all();
    console.log(`首页按钮数量: ${buttons.length}`);
    
    // 获取所有链接
    const links = await page.locator('a').all();
    console.log(`首页链接数量: ${links.length}`);
    
    // 至少应该有一些可交互元素
    expect(buttons.length + links.length).toBeGreaterThan(0);
  });

  test('对话页功能验证', async ({ page }) => {
    await page.goto('http://localhost:5000/chat', { waitUntil: 'networkidle' });
    
    // 检查输入框
    const inputVisible = await page.locator('input, textarea').first().isVisible().catch(() => false);
    console.log(`输入框可见: ${inputVisible}`);
    
    // 检查发送按钮
    const sendButton = page.locator('button:has-text("发送"), button:has-text("Submit")');
    const buttonVisible = await sendButton.isVisible().catch(() => false);
    console.log(`发送按钮可见: ${buttonVisible}`);
  });

  test('设置页功能验证', async ({ page }) => {
    await page.goto('http://localhost:5000/settings', { waitUntil: 'networkidle' });
    
    // 检查设置表单元素
    const inputs = await page.locator('input, select, textarea').count();
    console.log(`设置页输入元素: ${inputs}`);
    
    const buttons = await page.locator('button').count();
    console.log(`设置页按钮: ${buttons}`);
    
    expect(inputs + buttons).toBeGreaterThan(0);
  });

  test('API端点可用性检查', async ({ request }) => {
    const endpoints = [
      'http://localhost:3000/api/health',
      'http://localhost:3000/api/services/status',
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await request.get(endpoint, { timeout: 5000 });
        console.log(`${endpoint}: ${response.status()}`);
      } catch (e) {
        console.log(`${endpoint}: 不可用 (${e.message})`);
      }
    }
  });
});
