import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { cryptoStorage } from './crypto-storage';
import { createServiceLogger } from './logger';

const logger = createServiceLogger('QueryClient');

// 重试配置
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

/**
 * 带重试的 fetch 请求
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = RETRY_CONFIG.maxRetries
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        credentials: options.credentials ?? "include",
      });

      // 如果成功返回或不可重试的状态码，直接返回
      if (response.ok || !RETRY_CONFIG.retryableStatuses.includes(response.status)) {
        return response;
      }

      // 可重试的状态码
      if (attempt < retries) {
        const delay = Math.min(
          RETRY_CONFIG.baseDelay * Math.pow(2, attempt),
          RETRY_CONFIG.maxDelay
        );
        logger.warn(`请求失败，状态码: ${response.status}，${delay}ms 后重试 (${attempt + 1}/${retries})`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < retries) {
        const delay = Math.min(
          RETRY_CONFIG.baseDelay * Math.pow(2, attempt),
          RETRY_CONFIG.maxDelay
        );
        logger.warn(`请求异常: ${lastError.message}，${delay}ms 后重试 (${attempt + 1}/${retries})`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw lastError || new Error('请求失败');
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

function compactSnippet(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 160);
}

function nonJsonApiError(context: string, res: Response, body: string) {
  const contentType = res.headers.get("content-type") || "unknown";
  const snippet = compactSnippet(body);
  const lowerSnippet = snippet.toLowerCase();

  if (lowerSnippet.includes("<!doctype") || lowerSnippet.includes("<html")) {
    return new Error(`${context} 返回了前端页面，不是 API JSON；请检查后端服务或 /api 代理端口。`);
  }

  return new Error(`${context} 返回了非 JSON 内容（${contentType}）${snippet ? `：${snippet}` : ""}`);
}

export async function parseApiJson<T = unknown>(res: Response, context = "API"): Promise<T> {
  const contentType = res.headers.get("content-type") || "";
  const clone = res.clone();

  if (!contentType.toLowerCase().includes("application/json")) {
    const body = await clone.text().catch(() => "");
    throw nonJsonApiError(context, res, body);
  }

  try {
    return await res.json() as T;
  } catch (error) {
    const body = await clone.text().catch(() => "");
    const snippet = compactSnippet(body);
    throw new Error(`${context} JSON 解析失败${snippet ? `：${snippet}` : ""}`);
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};

  if (typeof window !== 'undefined') {
    try {
      const role = await cryptoStorage.getItem<string>('avatar_role', 'MASTER');
      const secret = await cryptoStorage.getItem<string | null>('avatar_master_secret', null);

      headers['X-Avatar-Role'] = role;

      if (secret && role === 'MASTER') {
        headers['X-Avatar-Secret'] = secret;
        logger.debug('Auth secret included in request headers');
      }
    } catch (error) {
      logger.warn('Failed to retrieve auth credentials', error);
    }
  }

  return headers;
}

let cachedCsrf: { token: string; headerName: string } | null = null;

async function getCsrfHeader(): Promise<Record<string, string>> {
  if (typeof window === 'undefined') return {};

  if (cachedCsrf?.token) {
    return { [cachedCsrf.headerName]: cachedCsrf.token };
  }

  const response = await fetchWithRetry('/api/security/csrf-token', {
    method: 'GET',
    credentials: 'include',
  }, 1);

  await throwIfResNotOk(response);
  const data = await parseApiJson<{ token?: string; headerName?: string }>(response, "CSRF 接口");
  if (!data?.token) return {};

  cachedCsrf = {
    token: data.token,
    headerName: data.headerName || 'x-csrf-token',
  };

  return { [cachedCsrf.headerName]: cachedCsrf.token };
}

let cachedWsToken: { token: string; expiresAt: number } | null = null;

export async function getWsToken(): Promise<string | null> {
  if (cachedWsToken && Date.now() < cachedWsToken.expiresAt - 5000) {
    return cachedWsToken.token;
  }

  try {
    const res = await apiRequest('POST', '/api/auth/ws-token', {});
    const data = await parseApiJson<Record<string, any>>(res, "WebSocket token 接口");
    const token = data?.data?.token ?? data?.token;
    const expiresIn = data?.data?.expiresIn ?? data?.expiresIn ?? 30;
    if (token) {
      cachedWsToken = {
        token,
        expiresAt: Date.now() + (expiresIn * 1000),
      };
      logger.debug('WebSocket token refreshed');
      return token;
    }
  } catch (e) {
    logger.error('Failed to get WS token', e);
  }
  return null;
}

export function getAuthenticatedWsUrl(path: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${path}`;
}

export async function getAuthenticatedWsUrlAsync(path: string): Promise<string> {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const baseUrl = `${protocol}//${window.location.host}${path}`;

  try {
    const token = await getWsToken();
    if (token) {
      const url = new URL(baseUrl);
      url.searchParams.set('token', token);
      return url.toString();
    }
  } catch (e) {
    logger.error('Failed to get authenticated WS URL', e);
  }
  return baseUrl;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {
    ...await getAuthHeaders(),
  };

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) {
    Object.assign(headers, await getCsrfHeader());
  }

  if (data) {
    headers['Content-Type'] = 'application/json';
  }

  let res: Response;
  try {
    res = await fetchWithRetry(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });
  } catch (error) {
    logger.error('API request failed', error);
    throw new Error(`网络连接失败，请检查网络状态`);
  }

  if (res.status === 403 && !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) {
    const body = await res.clone().json().catch(() => null);
    if (body?.code === 'CSRF_TOKEN_MISMATCH') {
      cachedCsrf = null;
      const retryHeaders = {
        ...headers,
        ...await getCsrfHeader(),
      };
      res = await fetchWithRetry(url, {
        method,
        headers: retryHeaders,
        body: data ? JSON.stringify(data) : undefined,
      }, 0);
    }
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn = <T,>(options: {
  on401: UnauthorizedBehavior;
}): QueryFunction<T> =>
  async ({ queryKey }) => {
    const unauthorizedBehavior = options.on401;
    let res: Response;
    try {
      res = await fetchWithRetry(queryKey.join("/") as string, {
        credentials: "include",
        headers: await getAuthHeaders(),
      });
    } catch (error) {
      logger.error('Query request failed', error);
      throw new Error(`网络连接失败，请检查网络状态`);
    }

    if (unauthorizedBehavior === "returnNull" && (res.status === 401 || res.status === 403)) {
      return null as T;
    }

    await throwIfResNotOk(res);
    return await parseApiJson<T>(res, "查询接口");
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
