import { BusinessError, ErrorCode } from './errors';

export type Ok<T> = { ok: true; value: T };
export type Fail<E = BusinessError> = { ok: false; error: E };
export type Result<T, E = BusinessError> = Ok<T> | Fail<E>;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function fail<E = BusinessError>(error: E): Fail<E> {
  return { ok: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok === true;
}

export function isFail<T, E>(result: Result<T, E>): result is Fail<E> {
  return (result as Fail<E>).ok === false;
}

export function unwrap<T, E>(result: Result<T, E>): T {
  if (!result.ok) {
    throw (result as Fail<E>).error;
  }
  return result.value;
}

export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  return result.ok === true ? result.value : defaultValue;
}

export function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  if (result.ok === true) {
    return ok(fn(result.value));
  }
  return fail((result as Fail<E>).error);
}

export function mapErr<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> {
  if (result.ok === true) {
    return ok(result.value);
  }
  return fail(fn((result as Fail<E>).error));
}

export async function safeAsync<T>(
  fn: () => Promise<T>,
  errorCode: ErrorCode = ErrorCode.INTERNAL_ERROR,
  defaultErrorMessage?: string
): Promise<Result<T, BusinessError>> {
  try {
    const value = await fn();
    return ok(value);
  } catch (error) {
    const message = error instanceof Error 
      ? error.message 
      : (defaultErrorMessage || '操作失败');
    return fail(new BusinessError(message, errorCode));
  }
}

export function safeSync<T>(
  fn: () => T,
  errorCode: ErrorCode = ErrorCode.INTERNAL_ERROR,
  defaultErrorMessage?: string
): Result<T, BusinessError> {
  try {
    const value = fn();
    return ok(value);
  } catch (error) {
    const message = error instanceof Error 
      ? error.message 
      : (defaultErrorMessage || '操作失败');
    return fail(new BusinessError(message, errorCode));
  }
}

export async function safeAsyncWithDetails<T, D = unknown>(
  fn: () => Promise<T>,
  errorCode: ErrorCode,
  details?: D
): Promise<Result<T, BusinessError>> {
  try {
    const value = await fn();
    return ok(value);
  } catch (error) {
    const message = error instanceof Error ? error.message : '操作失败';
    return fail(new BusinessError(
      message,
      errorCode,
      500,
      details ? { ...details, originalError: String(error) } : undefined
    ));
  }
}

export function tryCatch<T>(
  fn: () => T,
  onError: (error: Error) => T
): T {
  try {
    return fn();
  } catch (error) {
    return onError(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function tryCatchAsync<T>(
  fn: () => Promise<T>,
  onError: (error: Error) => Promise<T> | T
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    return onError(error instanceof Error ? error : new Error(String(error)));
  }
}

export class ResultPromise<T, E = BusinessError> {
  constructor(private promise: Promise<Result<T, E>>) {}

  static async from<T>(promise: Promise<T>): Promise<Result<T, BusinessError>> {
    return safeAsync(() => promise);
  }

  async then<TResult1 = Result<T, E>, TResult2 = never>(
    onfulfilled?: ((value: Result<T, E>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    try {
      const result = await this.promise;
      if (onfulfilled) {
        return onfulfilled(result);
      }
      return result as TResult1;
    } catch (reason) {
      if (onrejected) {
        return onrejected(reason);
      }
      throw reason;
    }
  }

  async catch<TResult = never>(
    onrejected?: ((reason: E) => TResult | PromiseLike<TResult>) | null
  ): Promise<Result<T, E> | TResult> {
    try {
      const result = await this.promise;
      if (!result.ok && onrejected) {
        return onrejected((result as Fail<E>).error);
      }
      return result;
    } catch (reason) {
      if (onrejected) {
        return onrejected(reason as E);
      }
      throw reason;
    }
  }

  async finally(
    onfinally?: (() => void | PromiseLike<void>) | null
  ): Promise<Result<T, E> | void> {
    try {
      return await this.promise;
    } finally {
      if (onfinally) {
        await onfinally();
      }
    }
  }
}

export function fromPromise<T>(promise: Promise<T>): ResultPromise<T> {
  return new ResultPromise(safeAsync(() => promise));
}
