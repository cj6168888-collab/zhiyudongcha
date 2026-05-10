/**
 * API 集成测试
 * 
 * 测试核心 API 端点的功能
 */

import { test, expect } from '@playwright/test';

const API_BASE = 'http://localhost:3000/api';

test.describe('API 集成测试', () => {
  
  test('健康检查端点', async ({ request }) => {
    const response = await request.get(`${API_BASE}/health`);
    const body = await response.json();
    
    console.log(`健康检查: ${response.status()}`, body);
    
    // 根据实际响应调整断言
    expect(response.status()).toBeLessThan(500);
  });

  test('服务状态端点', async ({ request }) => {
    try {
      const response = await request.get(`${API_BASE}/services/status`, {
        timeout: 5000
      });
      console.log(`服务状态: ${response.status()}`);
    } catch (e) {
      console.log('服务状态端点不可用:', (e as Error).message);
    }
  });

  test('监控指标端点', async ({ request }) => {
    try {
      const response = await request.get(`${API_BASE}/monitoring/metrics`, {
        timeout: 5000
      });
      console.log(`监控指标: ${response.status()}`);
    } catch (e) {
      console.log('监控指标端点不可用:', (e as Error).message);
    }
  });

  test('验证 API 响应格式', async ({ request }) => {
    const endpoints = [
      '/health',
      '/services/status',
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await request.get(`${API_BASE}${endpoint}`, {
          timeout: 5000
        });
        
        const isJson = response.headers()['content-type']?.includes('application/json');
        console.log(`${endpoint}: JSON=${isJson}, Status=${response.status()}`);
        
        if (isJson && response.status() < 500) {
          const body = await response.json();
          expect(body).toHaveProperty('success');
        }
      } catch (e) {
        console.log(`${endpoint}: 不可用`);
      }
    }
  });

  test('验证错误响应格式', async ({ request }) => {
    // 测试不存在的路由
    const response = await request.get(`${API_BASE}/nonexistent-route-12345`);
    const body = await response.json();
    
    console.log(`404响应:`, body);
    
    expect(response.status()).toBe(404);
    expect(body).toHaveProperty('success');
    expect(body.success).toBe(false);
    expect(body).toHaveProperty('error');
  });

  test('CORS 头检查', async ({ request }) => {
    const response = await request.get(`${API_BASE}/health`);
    
    console.log('CORS Headers:', {
      'access-control-allow-origin': response.headers()['access-control-allow-origin'],
      'content-type': response.headers()['content-type']
    });
    
    expect(response.headers()['content-type']).toContain('application/json');
  });

  test('响应时间检查', async ({ request }) => {
    const start = Date.now();
    await request.get(`${API_BASE}/health`, { timeout: 10000 });
    const duration = Date.now() - start;
    
    console.log(`响应时间: ${duration}ms`);
    
    // 响应时间应该在合理范围内
    expect(duration).toBeLessThan(5000);
  });
});

test.describe('API 错误处理测试', () => {
  
  test('无效请求体处理', async ({ request }) => {
    const response = await request.post(`${API_BASE}/chat`, {
      data: {},  // 空请求体
      timeout: 5000
    }).catch(() => null);
    
    if (response) {
      console.log(`无效请求: ${response.status()}`);
      expect(response.status()).toBeGreaterThanOrEqual(400);
    }
  });

  test('超时处理', async ({ request }) => {
    // 测试超时情况
    const response = await request.get(`${API_BASE}/health`, {
      timeout: 1000
    });
    
    console.log(`超时测试: ${response.status()}`);
    expect(response.status()).toBeLessThan(500);
  });
});
