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
  const data = await response.json();
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
    const res = await apiRequest('POST', '/api/auth/ws-token');
    const data = await res.json();
    if (data.token) {
      cachedWsToken = {
        token: data.token,
        expiresAt: Date.now() + (data.expiresIn * 1000),
      };
      logger.debug('WebSocket token refreshed');
      return data.token;
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

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
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
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
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
