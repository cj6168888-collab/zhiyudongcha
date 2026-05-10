# CSRF Protection 实现说明

## 概述

本系统已实现基于 session 的 CSRF（跨站请求伪造）保护机制，为所有状态改变的请求（POST、PUT、DELETE 等）提供安全防护。

## 实现方式

### 1. 中间件配置

**文件**: `server/middleware/csrf-protection.ts`

- `generateCSRFToken()`: 生成 32 字节的随机 token
- `attachCSRFToken()`: 在每个请求中附加 CSRF token 到 `res.locals`
- `csrfProtection()`: 验证非安全方法的请求是否包含有效的 CSRF token

### 2. 路由配置

**CSRF Token 获取端点**: `GET /api/security/csrf-token`

```typescript
// 客户端请求示例
fetch('/api/security/csrf-token')
  .then(res => res.json())
  .then(data => {
    const csrfToken = data.token;
    const headerName = data.headerName; // 'x-csrf-token'
  });
```

### 3. 在请求中使用

客户端需要在所有非 GET 请求中包含 CSRF token：

#### 方法 1: HTTP Header (推荐)

```typescript
fetch('/api/some-endpoint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-csrf-token': csrfToken
  },
  body: JSON.stringify(data)
});
```

#### 方法 2: Request Body

```typescript
fetch('/api/some-endpoint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    ...data,
    _csrf: csrfToken
  })
});
```

## 安全特性

1. **Token 生成**: 使用 `crypto.randomBytes(32)` 生成强随机 token
2. **Session 绑定**: Token 存储在用户 session 中，与用户会话绑定
3. **双重验证**: 支持 header 和 body 两种传递方式
4. **安全方法豁免**: GET、HEAD、OPTIONS 请求不需要 token
5. **SameSite Cookie**: Session cookie 配置了 `sameSite: 'strict'`

## 错误处理

### CSRF_TOKEN_MISSING (403)
- **原因**: 请求中未包含 CSRF token
- **解决**: 确保在请求 header 或 body 中包含 token

### CSRF_TOKEN_MISMATCH (403)
- **原因**: 提供的 token 与 session 中的不匹配
- **解决**: 重新获取有效的 CSRF token

## 前端集成示例

### React 示例

```typescript
// hooks/useCSRF.ts
import { useState, useEffect } from 'react';

export function useCSRF() {
  const [csrfToken, setCsrfToken] = useState<string>('');

  useEffect(() => {
    fetch('/api/security/csrf-token')
      .then(res => res.json())
      .then(data => setCsrfToken(data.token))
      .catch(err => console.error('Failed to fetch CSRF token:', err));
  }, []);

  const fetchWithCSRF = async (url: string, options: RequestInit = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'x-csrf-token': csrfToken
      }
    });
  };

  return { csrfToken, fetchWithCSRF };
}

// 使用示例
function MyComponent() {
  const { fetchWithCSRF } = useCSRF();

  const handleSubmit = async (data: any) => {
    const response = await fetchWithCSRF('/api/endpoint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    return response.json();
  };

  // ...
}
```

### Axios 拦截器示例

```typescript
import axios from 'axios';

let csrfToken = '';

// 获取 CSRF token
axios.get('/api/security/csrf-token')
  .then(res => {
    csrfToken = res.data.token;
  });

// 请求拦截器
axios.interceptors.request.use(config => {
  if (['post', 'put', 'delete', 'patch'].includes(config.method || '')) {
    config.headers['x-csrf-token'] = csrfToken;
  }
  return config;
});

// 响应拦截器 - 处理 token 过期
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 403 && 
        error.response?.data?.code === 'CSRF_TOKEN_MISMATCH') {
      // 重新获取 token
      return axios.get('/api/security/csrf-token')
        .then(res => {
          csrfToken = res.data.token;
          // 重试原请求
          error.config.headers['x-csrf-token'] = csrfToken;
          return axios.request(error.config);
        });
    }
    return Promise.reject(error);
  }
);
```

## 配置选项

环境变量配置（在 `.env` 文件中）：

```env
# Session Cookie 安全配置
COOKIE_SECURE=true           # 生产环境必须为 true
COOKIE_HTTP_ONLY=true        # 防止 JavaScript 访问
COOKIE_SAME_SITE=true        # 启用 SameSite 保护
COOKIE_MAX_AGE=86400000      # Cookie 有效期（毫秒）

# Session 配置
SESSION_SECRET=your-secret-key  # Session 加密密钥
SESSION_RESAVE=false
SESSION_SAVE_UNINITIALIZED=false
```

## 测试

### 单元测试示例

```typescript
import request from 'supertest';
import app from '../server';

describe('CSRF Protection', () => {
  let csrfToken: string;
  let cookies: string;

  beforeEach(async () => {
    const response = await request(app)
      .get('/api/security/csrf-token');
    
    csrfToken = response.body.token;
    cookies = response.headers['set-cookie'];
  });

  it('should reject POST without CSRF token', async () => {
    const response = await request(app)
      .post('/api/endpoint')
      .set('Cookie', cookies)
      .send({ data: 'test' });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('CSRF_TOKEN_MISSING');
  });

  it('should accept POST with valid CSRF token', async () => {
    const response = await request(app)
      .post('/api/endpoint')
      .set('Cookie', cookies)
      .set('x-csrf-token', csrfToken)
      .send({ data: 'test' });

    expect(response.status).not.toBe(403);
  });
});
```

## 最佳实践

1. **首次加载时获取 token**: 在应用初始化时获取 CSRF token
2. **存储在内存中**: 不要存储在 localStorage 或 sessionStorage（XSS 风险）
3. **自动重试**: 当 token 失效时自动重新获取并重试请求
4. **使用 HTTPS**: 生产环境必须使用 HTTPS 以防止 token 被窃取
5. **定期刷新**: 可选地在用户活跃时刷新 token

## 已知限制

1. **Session 依赖**: 需要启用 express-session
2. **不支持 JWT**: 当前实现仅支持 session-based 认证
3. **API 客户端**: 第三方 API 客户端需要特殊处理（如使用 API keys）

## 迁移指南

如果您的应用之前没有 CSRF 保护：

1. **更新前端代码**: 在所有非 GET 请求中添加 CSRF token
2. **测试所有端点**: 确保 API 端点正常工作
3. **监控错误日志**: 关注 CSRF token 相关的 403 错误
4. **逐步启用**: 可以先在测试环境验证，再部署到生产环境

## 参考文档

- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Express Session Documentation](https://www.npmjs.com/package/express-session)
