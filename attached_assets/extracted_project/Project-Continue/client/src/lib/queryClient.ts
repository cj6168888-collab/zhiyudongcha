import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    const role = localStorage.getItem('avatar_role') || 'MASTER';
    const secret = localStorage.getItem('avatar_master_secret');
    headers['X-Avatar-Role'] = role;
    if (secret && role === 'MASTER') {
      headers['X-Avatar-Secret'] = secret;
    }
  }
  return headers;
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
      return data.token;
    }
  } catch (e) {
    console.error('[Auth] Failed to get WS token:', e);
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
  
  const token = await getWsToken();
  if (token) {
    const url = new URL(baseUrl);
    url.searchParams.set('token', token);
    return url.toString();
  }
  return baseUrl;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
  };
  
  if (data) {
    headers['Content-Type'] = 'application/json';
  }
  
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });
  } catch (error) {
    console.error('[Network] API请求失败:', method, url, error);
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
      res = await fetch(queryKey.join("/") as string, {
        credentials: "include",
        headers: getAuthHeaders(),
      });
    } catch (error) {
      console.error('[Network] Query请求失败:', queryKey, error);
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
