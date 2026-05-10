/**
 * API + React Query 集成 hooks
 *
 * 将 fetchWrapper / ApiError / toast 串联：
 * 1. useApiQuery   - 带 toast 错误提示的 useQuery
 * 2. useApiMutation - 带 toast 提示 + 自动刷新的 useMutation
 * 3. 响应拦截器 - 自动处理 401 重定向、403 权限提示
 */

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  ApiError,
  fetchWrapper,
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  apiUpload,
  type FetchOptions,
} from "./api";

// ==================== 全局响应拦截 ====================

let globalOnUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(fn: () => void) {
  globalOnUnauthorized = fn;
}

function handleApiError(err: unknown, context?: string): ApiError {
  if (err instanceof ApiError) {
    // 401 未授权 → 跳转登录
    if (err.statusCode === 401) {
      globalOnUnauthorized?.();
      toast.error("登录已过期，请重新登录");
      return err;
    }
    // 403 无权限
    if (err.statusCode === 403) {
      toast.error("无权限执行此操作");
      return err;
    }
    // 其他错误
    const prefix = context ? `[${context}] ` : "";
    toast.error(`${prefix}${err.message}`);
    return err;
  }
  // 未知错误兜底
  const msg = err instanceof Error ? err.message : "网络异常";
  if (context) toast.error(`[${context}] ${msg}`);
  else toast.error(msg);
  return new ApiError(msg, 0, "UNKNOWN");
}

// ==================== useApiQuery ====================

interface UseApiQueryOptions<TData, TError = ApiError>
  extends Omit<
    Parameters<typeof useQuery<TData, TError>>[0],
    "queryKey" | "queryFn"
  > {
  /** 是否在错误时显示 toast，默认 true */
  showErrorToast?: boolean;
  /** toast 前缀上下文 */
  toastContext?: string;
}

/**
 * 带统一错误处理的 useQuery
 *
 * 特性：
 * - 自动 toast 错误提示（可关闭）
 * - 401 自动跳转登录（需调用 setUnauthorizedHandler）
 * - loading / fetching 状态分离
 * - 空数据优雅降级
 *
 * @example
 * const { data: projects, isLoading } = useApiQuery(
 *   ['/api/projects'],
 *   () => apiGet<ApiResp<Project[]>>('/api/projects').then(r => r.data ?? []),
 *   { toastContext: '加载项目列表' }
 * );
 */
export function useApiQuery<TData>(
  key: string | readonly unknown[],
  queryFn: () => Promise<TData>,
  options: UseApiQueryOptions<TData> = {}
) {
  const { showErrorToast = true, toastContext } = options;

  // 规范化 key 为数组格式
  const normalizedKey: readonly unknown[] = typeof key === 'string' ? [key] : key;

  return useQuery<TData, ApiError>({
    queryKey: normalizedKey,
    queryFn: async () => {
      try {
        return await queryFn();
      } catch (err) {
        if (showErrorToast) handleApiError(err, toastContext);
        throw err;
      }
    },
    ...options,
  });
}

// ==================== useApiMutation ====================

type MutationCallbacks<TData, TVariables> = {
  onSuccess?: (data: TData, variables: TVariables, context?: unknown) => void;
  onError?: (error: ApiError, variables: TVariables, context?: unknown) => void;
  onSettled?: (data: TData | null, error: ApiError | null, variables: TVariables, context?: unknown) => void;
};

interface UseApiMutationOptions<TData, TVariables>
  extends MutationCallbacks<TData, TVariables> {
  /** 成功后 toast 文案 */
  successMessage?: string;
  /** 失败时 toast 文案（设为空字符串则不弹） */
  errorMessage?: string;
  /** 成功后自动刷新的 queryKey 列表 */
  invalidateKeys?: (string | readonly unknown[])[];
  /** 自定义 toast 前缀上下文 */
  toastContext?: string;
}

/**
 * 带统一错误处理 + 自动刷新的 useMutation
 *
 * 特性：
 * - 成功/失败自动 toast
 * - 成功后自动 invalidateQueries（多 key 支持）
 * - 支持链式 callbacks
 * - 重置状态方法
 *
 * @example
 * const createProject = useApiMutation(
 *   (payload) => apiPost<ApiResp>('/api/projects', payload),
 *   {
 *     successMessage: '项目创建成功',
 *     errorMessage: '创建失败，请重试',
 *     invalidateKeys: [['projects']],
 *   }
 * );
 *
 * // 组件中使用
 * <button onClick={() => createProject.mutate({ title: 'xxx' })}>创建</button>
 */
export function useApiMutation<TData = unknown, TVariables = unknown>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: UseApiMutationOptions<TData, TVariables> = {}
) {
  const {
    successMessage,
    errorMessage,
    invalidateKeys = [],
    toastContext,
    onSuccess,
    onError,
    ...restOptions
  } = options;

  const queryClient = useQueryClient();

  const mutation = useMutation<TData, ApiError, TVariables>({
    mutationFn: async (variables) => {
      try {
        return await mutationFn(variables);
      } catch (err) {
        handleApiError(err, toastContext);
        throw err;
      }
    },
    onSuccess: (data, variables, context) => {
      if (invalidateKeys.length > 0) {
        invalidateKeys.forEach((key) => {
          const normalizedKey: readonly unknown[] = typeof key === 'string' ? [key] : key;
          queryClient.invalidateQueries({ queryKey: normalizedKey });
        });
      }
      if (successMessage) toast.success(successMessage);
      if (onSuccess) onSuccess(data, variables, context);
    },
    onError: (err, variables, context) => {
      if (errorMessage !== "") {
        const msg = errorMessage ?? (err as Error).message;
        if (msg) toast.error(`${toastContext ?? ""} ${msg}`.trim());
      }
      if (onError) onError(err, variables, context);
    },
  });

  return mutation;
}

// ==================== 业务层 API hooks（可选封装）====================

/** 项目列表 */
export function useProjects(options?: { search?: string; status?: string }) {
  return useApiQuery(
    ["/api/projects", options],
    async () => {
      const params = new URLSearchParams();
      if (options?.search) params.set("search", options.search);
      if (options?.status) params.set("status", options.status);
      const qs = params.toString();
      const url = `/api/projects${qs ? `?${qs}` : ""}`;
      const resp = await apiGet<{ projects?: unknown[]; items?: unknown[] }>(url);
      return (resp as { projects?: unknown[] }).projects
        ?? (resp as { items?: unknown[] }).items ?? [];
    },
    { toastContext: "加载项目", showErrorToast: false }
  );
}

/** 联系人列表 */
export function useContacts(options?: { search?: string }) {
  return useApiQuery(
    ["/api/contacts", options],
    async () => {
      const params = new URLSearchParams();
      if (options?.search) params.set("search", options.search);
      const qs = params.toString();
      const resp = await apiGet<{ items?: unknown[] }>(`/api/contacts${qs ? `?${qs}` : ""}`);
      return resp.items ?? [];
    },
    { toastContext: "加载联系人", showErrorToast: false }
  );
}

/** 任务列表 */
export function useTasks() {
  return useApiQuery(["/api/tasks"], async () => {
    const resp = await apiGet<{ data?: unknown[]; items?: unknown[] }>("/api/tasks");
    return (resp as { data?: unknown[] }).data ?? (resp as { items?: unknown[] }).items ?? [];
  }, { toastContext: "加载任务", showErrorToast: false });
}

/** 最近扫描记录 */
export function useRecentScans() {
  return useApiQuery(["/api/scans/recent"], async () => {
    const resp = await apiGet<{ items?: unknown[] }>("/api/scans/recent");
    return resp.items ?? [];
  }, { toastContext: "加载扫描记录", showErrorToast: false });
}

/** 数字智库列表 */
export function useVaultFiles(options?: { type?: string; projectId?: string; search?: string }) {
  return useApiQuery(
    ["/api/vault", options],
    async () => {
      const params = new URLSearchParams();
      if (options?.type) params.set("type", options.type);
      if (options?.projectId) params.set("projectId", options.projectId);
      if (options?.search) params.set("search", options.search);
      const qs = params.toString();
      const resp = await apiGet<{ items?: unknown[] }>(`/api/vault${qs ? `?${qs}` : ""}`);
      return resp.items ?? [];
    },
    { toastContext: "加载智库", showErrorToast: false }
  );
}

// Re-export for convenience
export { apiGet, apiPost, apiPut, apiDelete, apiUpload, fetchWrapper };
export type { ApiError, FetchOptions };
