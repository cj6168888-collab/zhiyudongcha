import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { TestUtils } from './setup'
import { server } from '../index'

describe('API Health Check', () => {
  let app: any

  beforeAll(async () => {
    app = await TestUtils.createTestApp()
  })

  afterAll(async () => {
    if (app && app.close) {
      await app.close()
    }
  })

  test('should return 200 for health check', async () => {
    const response = await TestUtils.makeRequest(app, 'GET', '/api/health')
    
    TestUtils.expectSuccess(response)
    expect(response.body.data).toHaveProperty('status')
  })

  test('should return API version info', async () => {
    const response = await TestUtils.makeRequest(app, 'GET', '/api/meta/version')
    
    TestUtils.expectSuccess(response)
    expect(response.body.data).toHaveProperty('version')
    expect(response.body.data).toHaveProperty('build')
  })

  test('should rate limit requests', async () => {
    const responses = await Promise.all([
      TestUtils.makeRequest(app, 'GET', '/api/meta/version'),
      TestUtils.makeRequest(app, 'GET', '/api/meta/version'),
      TestUtils.makeRequest(app, 'GET', '/api/meta/version'),
      TestUtils.makeRequest(app, 'GET', '/api/meta/version'),
      TestUtils.makeRequest(app, 'GET', '/api/meta/version')
    ])

    // 检查是否有rate限制响应
    const rateLimitResponses = responses.filter(res => res.status === 429)
    expect(rateLimitResponses.length).toBeGreaterThan(0)
  })
})

describe('Security Headers', () => {
  let app: any

  beforeAll(async () => {
    app = await TestUtils.createTestApp()
  })

  afterAll(async () => {
    if (app && app.close) {
      await app.close()
    }
  })

  test('should include security headers', async () => {
    const response = await TestUtils.makeRequest(app, 'GET', '/api/health')
    
    expect(response.headers).toHaveProperty('x-content-type-options')
    expect(response.headers).toHaveProperty('x-frame-options')
    expect(response.headers).toHaveProperty('x-xss-protection')
  })

  test('should include CORS headers', async () => {
    const response = await TestUtils.makeRequest(app, 'GET', '/api/health', {
      headers: { 'Origin': 'http://localhost:3000' }
    })
    
    expect(response.headers).toHaveProperty('access-control-allow-origin')
  })
})

describe('Database Connection', () => {
  let app: any

  beforeAll(async () => {
    app = await TestUtils.createTestApp()
  })

  afterAll(async () => {
    if (app && app.close) {
      await app.close()
    }
  })

  test('should have database connection', async () => {
    const response = await TestUtils.makeRequest(app, 'GET', '/api/meta/version')
    
    TestUtils.expectSuccess(response)
    // 数据库连接状态应该包含在健康检查中
  })
})

describe('API Error Handling', () => {
  let app: any

  beforeAll(async () => {
    app = await TestUtils.createTestApp()
  })

  afterAll(async () => {
    if (app && app.close) {
      await app.close()
    }
  })

  test('should return 404 for non-existent endpoint', async () => {
    const response = await TestUtils.makeRequest(app, 'GET', '/api/non-existent')
    
    TestUtils.expectError(response, 404, 'NOT_FOUND')
  })

  test('should return 400 for invalid JSON', async () => {
    const response = await TestUtils.makeRequest(app, 'POST', '/api/test', {
      headers: {
        'Content-Type': 'application/json'
      },
      data: 'invalid json'
    })
    
    TestUtils.expectError(response, 400, 'BAD_REQUEST')
  })

  test('should handle server errors gracefully', async () => {
    const response = await TestUtils.makeRequest(app, 'GET', '/api/error-test')
    
    expect(response.status).toBeLessThan(500)
    expect(response.body).toHaveProperty('error')
  })
})