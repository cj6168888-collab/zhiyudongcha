import type {
  ResponseMeta,
  PaginationInfo,
  ApiSuccessResponse,
  ApiErrorResponse,
  ApiPaginatedResponse
} from '../types/express.d';

export function createSuccessResponse<T>(
  data: T,
  meta?: ResponseMeta
): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    meta: meta || { timestamp: new Date().toISOString() }
  };
}

export function createErrorResponse(
  code: string,
  message: string,
  details?: unknown,
  requestId?: string
): ApiErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
      requestId
    }
  };
}

export function createPaginatedResponse<T>(
  items: T[],
  pagination: PaginationInfo,
  meta?: ResponseMeta
): ApiPaginatedResponse<T> {
  return {
    success: true,
    data: items,
    pagination,
    meta: meta || { timestamp: new Date().toISOString() }
  };
}

export function calculatePagination(
  page: number,
  limit: number,
  total: number
): PaginationInfo {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1
  };
}
