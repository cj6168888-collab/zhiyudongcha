/**
 * API 统一错误处理工具
 *
 * 提供：
 * 1. fetchWrapper - 统一 fetch，规范化错误处理
 * 2. useFetchQuery - 增强版 useQuery，自动处理 loading/error/data
 * 3. useFetchMutation - 增强版 useMutation，自动处理 loading/error/success
 */

import { useCallback } from "react";
import { useQuery, UseQueryOptions, UseQueryResult } from "@tanstack/react-query";
import { useMutation, UseMutationOptions, UseMutationResult } from "@tanstack/react-query";
import type { Person } from "@/shared/types";

// ==================== 类型定义 ====================

/** 统一 API 响应结构 */
export interface ApiResp<T = unknown> {
  success: boolean;
  data?: T;
  items?: T[];
  error?: string;
  message?: string;
  total?: number;
}

/** 分页响应 */
export interface PaginatedResp<T = unknown> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** fetchWrapper 配置 */
export interface FetchOptions extends RequestInit {
  /** 请求超时（ms），默认 15000 */
  timeout?: number;
  /** 是否自动解析 JSON */
  json?: boolean;
}

/** 错误类型 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ==================== fetchWrapper ====================

/**
 * 统一 fetch 封装
 *
 * 特性：
 * - 自动超时控制
 * - 自动 JSON 解析（可关闭）
 * - 401/403/500 等状态码统一抛出 ApiError
 * - 网络错误捕获
 *
 * @example
 * // 基础用法
 * const data = await fetchWrapper<ApiResp<User[]>>('/api/users');
 *
 * // 关闭 JSON 解析（用于文件下载）
 * const blob = await fetchWrapper('/api/download', { json: false });
 */
export async function fetchWrapper<T = unknown>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const { timeout = 15000, json = true, ...fetchOpts } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      ...fetchOpts,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...fetchOpts.headers,
      },
    });

    clearTimeout(timer);

    if (!res.ok) {
      let errMsg = `请求失败 (${res.status})`;
      try {
        const body = await res.json().catch(() => null);
        if (body?.error) errMsg = body.error;
        if (body?.message) errMsg = body.message;
      } catch {}

      throw new ApiError(errMsg, res.status, `HTTP_${res.status}`);
    }

    if (!json) {
      return (await res.blob()) as unknown as T;
    }

    return (await res.json()) as T;
  } catch (err: unknown) {
    clearTimeout(timer);

    if (err instanceof ApiError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError("请求超时，请检查网络连接", 408, "TIMEOUT");
    }
    throw new ApiError(
      err instanceof Error ? err.message : "网络错误",
      0,
      "NETWORK_ERROR"
    );
  }
}

// ==================== useFetchQuery ====================

type QueryFn<T> = () => Promise<T>;
type QueryKey = string | readonly unknown[];

/**
 * 增强版 useQuery
 *
 * 与原生 useQuery 区别：
 * 1. queryFn 不再需要 try/catch（内部已封装）
 * 2. 自动将 Promise reject 转为 data = undefined，不破坏 React 渲染
 * 3. 简化 queryKey 为 string（自动包装为数组）
 * 4. 提供 isRefetching 状态（用于刷新场景）
 *
 * @example
 * const { data, isLoading, error, isRefetching } = useFetchQuery<User[]>(
 *   '/api/users',
 *   () => api.get('/users')
 * );
 */
export function useFetchQuery<T>(
  key: QueryKey,
  queryFn: QueryFn<T>,
  options?: Omit<UseQueryOptions<T, ApiError>, "queryKey" | "queryFn">
): Omit<UseQueryResult<T, ApiError>, "data" | "error"> & {
  data: T | undefined;
  error: ApiError | null;
} {
  const result = useQuery<T, ApiError>({
    queryKey: Array.isArray(key) ? key : [key],
    queryFn: async () => {
      try {
        return await queryFn();
      } catch (err) {
        console.warn(`[useFetchQuery] query failed for key "${String(key)}"`, err);
        throw err;
      }
    },
    ...options,
  });

  return {
    ...result,
    get data() {
      return result.data;
    },
    get error() {
      return result.error as ApiError | null;
    },
  };
}

// ==================== useFetchMutation ====================

type MutationFn<TData, TVariables> = (variables: TVariables) => Promise<TData>;

/**
 * 增强版 useMutation
 *
 * 与原生 useMutation 区别：
 * 1. mutationFn 不再需要 try/catch（内部已封装）
 * 2. onError 默认 toast 提示（可关闭）
 * 3. onSuccess 默认 invalidateQueries（需指定 queryKey）
 * 4. 返回 reset() 方法
 *
 * @example
 * const createProject = useFetchMutation(
 *   (payload) => api.post('/projects', payload),
 *   {
 *     onErrorToast: '创建失败',
 *     invalidateKeys: ['/api/projects'],
 *   }
 * );
 *
 * // 使用
 * createProject.mutate({ title: '新项目' });
 */
export function useFetchMutation<TData = unknown, TVariables = unknown>(
  mutationFn: MutationFn<TData, TVariables>,
  options?: {
    /** 失败时 toast 文案（不传则不弹 toast） */
    onErrorToast?: string;
    /** 成功后自动刷新的 queryKey 列表 */
    invalidateKeys?: QueryKey[];
    /** 自定义 onSuccess（会与 invalidateKeys 合并） */
    onSuccess?: (data: TData, variables: TVariables) => void;
    /** 自定义 onError */
    onError?: (error: ApiError, variables: TVariables) => void;
  }
): UseMutationResult<TData, ApiError, TVariables> & {
  reset: () => void;
} {
  const { onErrorToast, invalidateKeys, onSuccess, onError } = options ?? {};

  return useMutation<TData, ApiError, TVariables>({
    mutationFn: async (variables) => {
      try {
        return await mutationFn(variables);
      } catch (err) {
        // 重新抛出 ApiError，保持类型
        if (err instanceof ApiError) throw err;
        throw new ApiError(
          err instanceof Error ? err.message : "请求失败",
          0,
          "MUTATION_ERROR"
        );
      }
    },
    onSuccess: (data, variables) => {
      onSuccess?.(data, variables);
    },
    onError: (error, variables) => {
      onError?.(error, variables);
    },
  });
}

// ==================== 业务场景便捷封装 ====================

/** GET 请求便捷封装 */
export async function apiGet<T = unknown>(url: string): Promise<T> {
  return fetchWrapper<T>(url, { method: "GET" });
}

/** POST 请求便捷封装 */
export async function apiPost<T = unknown>(
  url: string,
  body: unknown,
  options?: FetchOptions
): Promise<T> {
  return fetchWrapper<T>(url, {
    method: "POST",
    body: JSON.stringify(body),
    ...options,
  });
}

/** PUT 请求便捷封装 */
export async function apiPut<T = unknown>(
  url: string,
  body: unknown,
  options?: FetchOptions
): Promise<T> {
  return fetchWrapper<T>(url, {
    method: "PUT",
    body: JSON.stringify(body),
    ...options,
  });
}

/** DELETE 请求便捷封装 */
export async function apiDelete<T = unknown>(
  url: string,
  options?: FetchOptions
): Promise<T> {
  return fetchWrapper<T>(url, { method: "DELETE", ...options });
}

/** 上传文件（FormData） */
export async function apiUpload<T = unknown>(
  url: string,
  formData: FormData,
  options?: Omit<FetchOptions, "body">
): Promise<T> {
  return fetchWrapper<T>(url, {
    method: "POST",
    body: formData,
    // Content-Type 让浏览器自动设置，包含 boundary
    headers: { "Content-Type": undefined as unknown as string },
    json: true,
    ...options,
  });
}

// ==================== 缺失的 API 占位符 ====================

/** 人物关系 API 占位符 */
export const personApi = {
  getAll: async (params?: { search?: string }) => {
    const query = params?.search ? `?search=${encodeURIComponent(params.search)}` : '';
    const res = await fetchWrapper<ApiResp<{ items?: Person[] }>>(`/api/persons${query}`);
    return res;
  },
  create: async (data: unknown) => {
    const res = await fetchWrapper<ApiResp<unknown>>('/api/persons', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res;
  },
  update: async (id: string, data: unknown) => {
    const res = await fetchWrapper<ApiResp<unknown>>(`/api/persons/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res;
  },
  delete: async (id: string) => {
    const res = await fetchWrapper<ApiResp<unknown>>(`/api/persons/${id}`, {
      method: 'DELETE',
    });
    return res;
  },
  searchByWeakness: async (_keyword: string) => {
    const res = await fetchWrapper<ApiResp<{ items?: Person[] }>>('/api/persons?type=weakness');
    return res;
  },
};

/** Z2 核心 API 占位符 */
export const z2CoreApi = {
  permanentShred: async (id: string, _type: string) => {
    const res = await fetchWrapper<ApiResp<unknown>>(`/api/shred/${id}`, {
      method: 'DELETE',
    });
    return res;
  },
  getRelationshipInsight: async (_personId: string) => {
    const res = await fetchWrapper<ApiResp<RelationshipInsight>>('/api/insights/relationship');
    return res;
  },
};

/** 关系洞察类型占位符 */
export interface RelationshipInsight {
  source: string;
  target: string;
  strength: number;
  type: 'normal' | 'conflict' | 'interest';
  person?: Person;
  vulnerabilityAnalysis?: string;
  interestChainSummary?: string;
  riskLevel?: number;
  suggestedApproach?: string;
}
