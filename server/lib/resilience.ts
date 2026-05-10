import { logger } from './logger'
import { getConfig } from './secure-config'

/**
 * 重试机制和错误处理工具类
 * 实现指数退避、熔断器模式，降级策略
 */

// 扩展错误接口
interface HTTPError extends Error {
  status: number;
  url: string;
  type: string;
  shouldRetry: boolean;
  responseBody?: unknown;
}

// HTTP 响应体接口
interface HTTPResponseBody {
  message?: string;
  [key: string]: unknown;
}

// 重试配置接口
export interface RetryOptions<T = unknown> {
  maxAttempts?: number
  baseDelay?: number // 基础延迟（毫秒）
  maxDelay?: number // 最大延迟（毫秒）
  backoffFactor?: number // 退避因子
  jitter?: boolean // 是否添加随机抖动
  retryCondition?: (error: Error) => boolean // 重试条件
  onRetry?: (attempt: number, error: Error) => void // 重试回调
}

// 熔断器状态
enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

// 熔断器配置
export interface CircuitBreakerOptions {
  failureThreshold?: number // 失败阈值
  resetTimeout?: number // 重置超时（毫秒）
  monitoringPeriod?: number // 监控周期（毫秒）
  expectedRecoveryTime?: number // 预期恢复时间（毫秒）
}

// 降级策略接口
export interface FallbackOptions<T = unknown> {
  fallbackValue?: T
  fallbackFunction?: () => Promise<T> | T
  shouldFallback?: (error: Error) => boolean
  onFallback?: (error: Error) => void
}

/**
 * 重试机制类
 */
export class RetryMechanism {
  private static readonly DEFAULT_OPTIONS: Required<RetryOptions> = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2,
    jitter: true,
    retryCondition: (error) => true,
    onRetry: () => {}
  }

  /**
   * 带重试机制的函数执行
   */
  static async executeWithRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const config = { ...this.DEFAULT_OPTIONS, ...options }
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        // 检查是否应该重试
        if (attempt === config.maxAttempts || !config.retryCondition(error instanceof Error ? error : new Error(String(error)))) {
          break
        }

        // 计算延迟时间
        const delay = this.calculateDelay(attempt - 1, config)
        
        logger.warn(`Retry attempt ${attempt}/${config.maxAttempts}`, {
          error: error.message,
          delay: `${delay}ms`
        })

        // 执行重试回调
        config.onRetry(attempt, error instanceof Error ? error : new Error(String(error)))

        // 等待重试
        await this.sleep(delay)
      }
    }

    throw lastError
  }

  /**
   * 计算重试延迟
   */
  private static calculateDelay(attempt: number, config: Required<RetryOptions>): number {
    let delay = Math.min(config.baseDelay * Math.pow(config.backoffFactor, attempt), config.maxDelay)
    
    // 添加随机抖动
    if (config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5)
    }
    
    return Math.floor(delay)
  }

  /**
   * 延迟函数
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 创建带重试的函数包装器
   */
  static withRetry<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T,
    options: RetryOptions = {}
  ): T {
    return (async (...args: Parameters<T>) => {
      return this.executeWithRetry(() => fn(...args) as Promise<unknown>, options)
    }) as T
  }
}

/**
 * 熔断器类
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED
  private failures = 0
  private lastFailureTime = 0
  private nextAttempt = 0
  
  constructor(
    private name: string,
    private options: CircuitBreakerOptions = {}
  ) {
    this.options = {
      failureThreshold: 5,
      resetTimeout: 60000,
      monitoringPeriod: 10000,
      expectedRecoveryTime: 30000,
      ...options
    }
  }

  /**
   * 执行函数（带熔断保护）
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // 检查熔断器状态
    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        throw new Error(`Circuit breaker '${this.name}' is OPEN`)
      }
      this.state = CircuitBreakerState.HALF_OPEN
      logger.info(`Circuit breaker '${this.name}' entered HALF_OPEN state`)
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  /**
   * 成功处理
   */
  private onSuccess(): void {
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.reset()
      logger.info(`Circuit breaker '${this.name}' reset to CLOSED state`)
    }
    this.failures = 0
  }

  /**
   * 失败处理
   */
  private onFailure(): void {
    this.failures++
    this.lastFailureTime = Date.now()

    if (this.failures >= this.options.failureThreshold!) {
      this.trip()
    }
  }

  /**
   * 熔断器跳闸
   */
  private trip(): void {
    this.state = CircuitBreakerState.OPEN
    this.nextAttempt = Date.now() + this.options.resetTimeout!
    logger.warn(`Circuit breaker '${this.name}' tripped to OPEN state`, {
      failures: this.failures,
      resetTimeout: this.options.resetTimeout
    })
  }

  /**
   * 重置熔断器
   */
  private reset(): void {
    this.state = CircuitBreakerState.CLOSED
    this.failures = 0
    this.lastFailureTime = 0
    this.nextAttempt = 0
  }

  /**
   * 获取熔断器状态
   */
  getState(): {
    state: CircuitBreakerState
    failures: number
    lastFailureTime: number
    nextAttempt: number
  } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
      nextAttempt: this.nextAttempt
    }
  }

  /**
   * 强制重置熔断器
   */
  forceReset(): void {
    this.reset()
    logger.info(`Circuit breaker '${this.name}' force reset`)
  }
}

/**
 * 降级策略类
 */
export class FallbackStrategy<T = unknown> {
  constructor(private options: FallbackOptions<T> = {}) {
    this.options = {
      fallbackValue: null as T | null,
      fallbackFunction: undefined,
      shouldFallback: () => true,
      onFallback: () => {},
      ...options
    } as FallbackOptions<T>
  }

  /**
   * 执行降级
   */
  async execute(error: Error): Promise<T | null> {
    // 检查是否应该降级
    if (!this.options.shouldFallback!(error)) {
      throw error
    }

    logger.warn('Executing fallback strategy', {
      error: error.message,
      hasFallbackFunction: !!this.options.fallbackFunction
    })

    // 执行降级回调
    this.options.onFallback!(error)

    // 执行降级逻辑
    if (this.options.fallbackFunction) {
      return await this.options.fallbackFunction()
    }

    return this.options.fallbackValue
  }
}

/**
 * 综合错误处理类
 * 集成重试、熔断器、降级策略
 */
export class ResilientExecutor {
  private circuitBreaker: CircuitBreaker
  private fallbackStrategy: FallbackStrategy
  private retryOptions: RetryOptions

  constructor(
    name: string,
    options: {
      circuitBreaker?: CircuitBreakerOptions
      fallback?: FallbackOptions
      retry?: RetryOptions
    } = {}
  ) {
    this.circuitBreaker = new CircuitBreaker(name, options.circuitBreaker)
    this.fallbackStrategy = new FallbackStrategy(options.fallback)
    this.retryOptions = options.retry || {}
  }

  /**
   * 执行函数（带完整保护机制）
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return await RetryMechanism.executeWithRetry(async () => {
      try {
        return await this.circuitBreaker.execute(fn)
      } catch (error) {
        return await this.fallbackStrategy.execute(error)
      }
    }, this.retryOptions)
  }

  /**
   * 获取执行器状态
   */
  getStatus(): {
    circuitBreaker: ReturnType<CircuitBreaker['getState']>
    name: string
  } {
    return {
      circuitBreaker: this.circuitBreaker.getState(),
      name: this.circuitBreaker['name']
    }
  }
}

/**
 * API服务错误处理工具类
 */
export class APIErrorHandler {
  private static readonly HTTP_ERROR_CODES = {
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503,
    GATEWAY_TIMEOUT: 504
  }

  /**
   * 处理HTTP响应错误
   */
  static handleHTTPError(response: Response, responseBody?: HTTPResponseBody): Error {
    const status = response.status
    const url = response.url
    const message = responseBody?.message || response.statusText

    let errorType = 'UnknownError'
    let shouldRetry = false

    // 根据状态码分类错误
    if (status >= 400 && status < 500) {
      switch (status) {
        case this.HTTP_ERROR_CODES.TOO_MANY_REQUESTS:
          errorType = 'RateLimitError'
          shouldRetry = true
          break
        case this.HTTP_ERROR_CODES.UNAUTHORIZED:
          errorType = 'AuthenticationError'
          break
        case this.HTTP_ERROR_CODES.FORBIDDEN:
          errorType = 'AuthorizationError'
          break
        case this.HTTP_ERROR_CODES.NOT_FOUND:
          errorType = 'NotFoundError'
          break
        default:
          errorType = 'ClientError'
      }
    } else if (status >= 500) {
      errorType = 'ServerError'
      shouldRetry = true
    }

    const error = new Error(`${errorType}: ${message}`) as HTTPError
    error.status = status
    error.url = url
    error.type = errorType
    error.shouldRetry = shouldRetry
    error.responseBody = responseBody

    return error
  }

  /**
   * 创建重试条件函数
   */
  static createRetryCondition(): (error: Error) => boolean {
    return (error: Error & { code?: string; name?: string; shouldRetry?: boolean }) => {
      // 网络错误或超时错误应该重试
      if (error.code === 'ECONNRESET' || 
          error.code === 'ENOTFOUND' || 
          error.code === 'ETIMEDOUT' ||
          error.name === 'NetworkError') {
        return true
      }

      // HTTP 5xx 错误和 429 错误应该重试
      if (error.shouldRetry === true) {
        return true
      }

      // 其他错误不重试
      return false
    }
  }

  /**
   * 创建统一的API响应格式
   */
  static createAPIResponse(
    success: boolean,
    data?: unknown,
    error?: {
      code: string
      message: string
      details?: unknown
    },
    meta?: {
      timestamp?: string
      requestId?: string
      version?: string
    }
  ) {
    return {
      success,
      ...(data && { data }),
      ...(error && { error }),
      meta: {
        timestamp: new Date().toISOString(),
        ...meta
      }
    }
  }
}

/**
 * 安全的HTTP请求包装器
 */
export class SafeHTTPClient {
  private baseUrl: string
  private defaultHeaders: Record<string, string>
  private executor: ResilientExecutor

  constructor(
    baseUrl: string,
    options: {
      timeout?: number
      headers?: Record<string, string>
      circuitBreaker?: CircuitBreakerOptions
      fallback?: FallbackOptions
      retry?: RetryOptions
    } = {}
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '') // 移除尾部斜杠
    this.defaultHeaders = options.headers || {}
    this.executor = new ResilientExecutor(`http-client-${baseUrl}`, {
      circuitBreaker: options.circuitBreaker,
      fallback: options.fallback,
      retry: options.retry
    })
  }

  /**
   * 安全的GET请求
   */
  async get<T = unknown>(
    endpoint: string,
    options: {
      headers?: Record<string, string>
      params?: Record<string, unknown>
      timeout?: number
    } = {}
  ): Promise<T> {
    return this.executor.execute(async () => {
      const url = new URL(endpoint, this.baseUrl)
      
      // 添加查询参数
      if (options.params) {
        Object.entries(options.params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            url.searchParams.append(key, String(value))
          }
        })
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          ...this.defaultHeaders,
          ...options.headers
        },
        signal: options.timeout ? AbortSignal.timeout(options.timeout) : undefined
      })

      if (!response.ok) {
        let responseBody: unknown
        try {
          responseBody = await response.json()
        } catch {
          responseBody = null
        }

        throw APIErrorHandler.handleHTTPError(response, responseBody)
      }

      return await response.json() as T
    })
  }

  /**
   * 安全的POST请求
   */
  async post<T = unknown>(
    endpoint: string,
    data?: unknown,
    options: {
      headers?: Record<string, string>
      timeout?: number
    } = {}
  ): Promise<T> {
    return this.executor.execute(async () => {
      const url = new URL(endpoint, this.baseUrl)

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.defaultHeaders,
          ...options.headers
        },
        body: data ? JSON.stringify(data) : undefined,
        signal: options.timeout ? AbortSignal.timeout(options.timeout) : undefined
      })

      if (!response.ok) {
        let responseBody: unknown
        try {
          responseBody = await response.json()
        } catch {
          responseBody = null
        }

        throw APIErrorHandler.handleHTTPError(response, responseBody)
      }

      return await response.json() as T
    })
  }

  /**
   * 获取客户端状态
   */
  getStatus() {
    return this.executor.getStatus()
  }
}

/**
 * 创建AI服务的安全HTTP客户端
 */
export function createAIClient(serviceName: string, apiKey: string): SafeHTTPClient {
  return new SafeHTTPClient(getConfig().LOCAL_MODEL_ENDPOINT || '', {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    circuitBreaker: {
      failureThreshold: 3,
      resetTimeout: 60000
    },
    fallback: {
      fallbackValue: {
        success: false,
        error: {
          code: 'AI_SERVICE_UNAVAILABLE',
          message: `${serviceName} service is currently unavailable`
        }
      }
    },
    retry: {
      maxAttempts: 3,
      baseDelay: 1000,
      backoffFactor: 2,
      retryCondition: APIErrorHandler.createRetryCondition()
    }
  })
}

// 导出便捷函数
export const withRetry = RetryMechanism.withRetry
export const createCircuitBreaker = (name: string, options?: CircuitBreakerOptions) => 
  new CircuitBreaker(name, options)
export const createFallbackStrategy = (options: FallbackOptions) => 
  new FallbackStrategy(options)
export const createResilientExecutor = (name: string, options?: Record<string, unknown>) => 
  new ResilientExecutor(name, options)