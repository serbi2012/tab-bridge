import type { Middleware, MiddlewareContext, ChangeMeta } from '../types';

/**
 * Runs the middleware pipeline for a given hook (`onSet`).
 * Returns the (possibly transformed) value and whether the change was rejected.
 */
export function runMiddleware<TState extends Record<string, unknown>>(
  middlewares: readonly Middleware<TState>[],
  ctx: MiddlewareContext<TState>,
): { value: unknown; rejected: boolean } {
  let currentValue = ctx.value;

  for (const mw of middlewares) {
    const fn = mw.onSet;
    if (!fn) continue;

    const result = fn({ ...ctx, value: currentValue });

    if (result === false) {
      return { value: currentValue, rejected: true };
    }
    if (result && 'value' in result) {
      currentValue = result.value;
    }
  }

  return { value: currentValue, rejected: false };
}

/** Notify all middlewares that a state change has been committed. */
export function notifyMiddleware<TState extends Record<string, unknown>>(
  middlewares: readonly Middleware<TState>[],
  key: keyof TState,
  value: unknown,
  meta: ChangeMeta,
): void {
  for (const mw of middlewares) {
    mw.afterChange?.(key, value, meta);
  }
}

/** Destroy all middlewares. */
export function destroyMiddleware<TState extends Record<string, unknown>>(
  middlewares: readonly Middleware<TState>[],
): void {
  for (const mw of middlewares) {
    mw.onDestroy?.();
  }
}
