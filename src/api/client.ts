import type { ZodType } from 'zod';

import { env } from '@/lib/env';

import { ApiError, statusToKind } from './errors';

/**
 * The HTTP layer.
 *
 * Responsibilities, and nothing else:
 *   - prefix the base URL and serialize the body
 *   - attach the access token
 *   - refresh once on a 401 and replay the request
 *   - turn every failure into an `ApiError`
 *   - validate the response against a Zod schema when one is supplied
 *
 * Auth lives in `src/features/auth`. Rather than import it here — which would
 * be a cycle, since auth calls the client — the auth feature *injects* its
 * handlers with `configureAuth` at startup.
 */

export interface AuthHandlers {
  /** Current access token, or null when signed out. */
  getAccessToken: () => string | null;
  /**
   * Exchange the refresh token for a new session. Resolves to the new access
   * token, or null when the refresh token is itself no longer valid.
   */
  refreshSession: () => Promise<string | null>;
  /** Called when refresh fails; the app should drop the session and sign out. */
  onSessionExpired: () => void;
}

let authHandlers: AuthHandlers | null = null;

export function configureAuth(handlers: AuthHandlers): void {
  authHandlers = handlers;
}

/**
 * Concurrent 401s must not each fire their own refresh. The first one starts
 * the refresh and every other request awaits the same promise.
 */
let inFlightRefresh: Promise<string | null> | null = null;

function refreshOnce(): Promise<string | null> {
  if (!authHandlers) return Promise.resolve(null);

  inFlightRefresh ??= authHandlers.refreshSession().finally(() => {
    inFlightRefresh = null;
  });

  return inFlightRefresh;
}

/**
 * Exposed for `endpoints/chat.ts`'s hand-rolled streaming request, which
 * cannot go through `request()` (its body is a partial stream, not one
 * parsed JSON value) but still needs the same auth-header-and-refresh-once
 * behavior `request()` gives every other endpoint.
 */
export function getAccessToken(): string | null {
  return authHandlers?.getAccessToken() ?? null;
}

export function refreshAccessToken(): Promise<string | null> {
  return refreshOnce();
}

export function notifySessionExpired(): void {
  authHandlers?.onSessionExpired();
}

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface RequestOptions<TResponse> {
  method?: HttpMethod;
  /** Serialized as JSON. Use `formData` for multipart uploads instead. */
  body?: unknown;
  formData?: FormData;
  /** Appended as a query string; `undefined` and `null` values are dropped. */
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Validates and types the response body. Omit for endpoints returning 204. */
  schema?: ZodType<TResponse>;
  /** Skips the Authorization header — for sign-in and sign-up. */
  skipAuth?: boolean;
  /** Extra request headers, e.g. `X-Device-Id`. */
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * Exposed for `endpoints/chat.ts`'s hand-rolled streaming request, which
 * builds its own URL outside `request()` but still needs the same base-URL
 * and query-string handling every other endpoint gets for free.
 */
export function buildUrl(path: string, query: RequestOptions<unknown>['query']): string {
  if (!env.apiUrl) {
    // Every diary/food read and write is local-first (see `src/data/`) and
    // never reaches this function. Only auth and future sync calls do, so
    // this fires only when someone taps "sign in" with no backend configured.
    throw new ApiError('not_configured', 'No server is configured for this build.');
  }

  const url = new URL(path.replace(/^\//, ''), ensureTrailingSlash(env.apiUrl));

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}

/**
 * Merge the caller's signal with our timeout so whichever fires first aborts
 * the request, and the timer is always cleared.
 */
function withTimeout(
  signal: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; cleanup: () => void; didTimeout: () => boolean } {
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    },
    didTimeout: () => timedOut,
  };
}

/**
 * Exposed for `endpoints/chat.ts`'s non-streaming failure branch, which needs
 * the same error-body parsing `request()` uses but isn't itself going through
 * `request()` (its success path is a stream, not one parsed JSON value).
 */
export async function parseErrorBody(
  response: Response,
): Promise<{ message?: string; code?: string; fieldErrors?: Record<string, string> }> {
  try {
    const body = (await response.json()) as {
      code?: string;
      message?: string;
      error?: string;
      errors?: Record<string, string | string[]>;
    };

    const fieldErrors = body.errors
      ? Object.fromEntries(
          Object.entries(body.errors).map(([field, value]) => [
            field,
            Array.isArray(value) ? (value[0] ?? '') : value,
          ]),
        )
      : undefined;

    return { message: body.message ?? body.error, code: body.code, fieldErrors };
  } catch {
    return {};
  }
}

async function send(
  url: string,
  init: RequestInit,
  timeout: ReturnType<typeof withTimeout>,
): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    // Our own AbortController firing surfaces as a real `AbortError` on iOS,
    // but React Native's Android fetch sometimes rejects a client-aborted
    // request with a generic `TypeError` instead — indistinguishable here
    // from a real connectivity failure unless we check the timer ourselves.
    if (timeout.didTimeout()) {
      throw new ApiError('timeout', 'The request timed out.', { cause: error });
    }

    if (error instanceof Error && error.name === 'AbortError') throw error;

    // 'network' is a catch-all for whatever `fetch` itself threw — log the
    // raw error so a real-device repro (e.g. this exact image-upload bug)
    // shows what actually failed instead of just the generic user message.
    if (env.isDev) console.error('[api] fetch failed, classified as network:', error);

    throw new ApiError('network', 'Unable to reach the server.', { cause: error });
  }
}

export async function request<TResponse = void>(
  path: string,
  options: RequestOptions<TResponse> = {},
): Promise<TResponse> {
  const {
    method = 'GET',
    body,
    formData,
    query,
    schema,
    skipAuth = false,
    headers: extraHeaders,
    signal,
    timeoutMs = env.apiTimeoutMs,
  } = options;

  const url = buildUrl(path, query);
  const timeout = withTimeout(signal, timeoutMs);

  const buildInit = (token: string | null): RequestInit => {
    const headers: Record<string, string> = { Accept: 'application/json', ...extraHeaders };

    // Let fetch set the multipart boundary itself — overriding Content-Type
    // on a FormData body produces an unparseable request.
    if (!formData && body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;

    return {
      method,
      headers,
      body: formData ?? (body === undefined ? undefined : JSON.stringify(body)),
      signal: timeout.signal,
    };
  };

  try {
    const token = skipAuth ? null : (authHandlers?.getAccessToken() ?? null);
    let response = await send(url, buildInit(token), timeout);

    // One refresh-and-replay attempt. A second 401 means the new token is bad
    // too, so we stop rather than loop.
    if (response.status === 401 && !skipAuth && authHandlers) {
      const refreshed = await refreshOnce();

      if (!refreshed) {
        authHandlers.onSessionExpired();
        throw new ApiError('unauthorized', 'Session expired.', { status: 401 });
      }

      response = await send(url, buildInit(refreshed), timeout);

      if (response.status === 401) {
        authHandlers.onSessionExpired();
        throw new ApiError('unauthorized', 'Session expired.', { status: 401 });
      }
    }

    if (!response.ok) {
      const { message, code, fieldErrors } = await parseErrorBody(response);

      throw new ApiError(
        code === 'ai_trial_exhausted' ? 'trial_exhausted' : statusToKind(response.status),
        message ?? `Request failed with status ${response.status}.`,
        { status: response.status, fieldErrors },
      );
    }

    // 204 No Content, or an endpoint whose body we do not care about.
    if (response.status === 204 || !schema) return undefined as TResponse;

    let json: unknown;
    try {
      json = await response.json();
    } catch (error) {
      throw new ApiError('parse', 'The server returned an unreadable response.', {
        cause: error,
      });
    }

    const parsed = schema.safeParse(json);

    if (!parsed.success) {
      // A schema mismatch is a contract bug, not a user error — surface the
      // detail in development and stay generic in production.
      if (env.isDev) {
        console.error(
          `[api] Response validation failed for ${method} ${path}`,
          parsed.error,
        );
      }

      throw new ApiError('parse', 'The server returned unexpected data.', {
        cause: parsed.error,
      });
    }

    return parsed.data;
  } catch (error) {
    if (error instanceof ApiError) throw error;

    if (error instanceof Error && error.name === 'AbortError') {
      throw timeout.didTimeout()
        ? new ApiError('timeout', 'The request timed out.', { cause: error })
        : new ApiError('canceled', 'Request canceled.', { cause: error });
    }

    throw new ApiError('unknown', 'Something went wrong.', { cause: error });
  } finally {
    timeout.cleanup();
  }
}

/** Convenience wrappers so endpoint modules read as one line each. */
export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions<T>, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'GET' }),

  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions<T>, 'method'>) =>
    request<T>(path, { ...options, method: 'POST', body }),

  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions<T>, 'method'>) =>
    request<T>(path, { ...options, method: 'PATCH', body }),

  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions<T>, 'method'>) =>
    request<T>(path, { ...options, method: 'PUT', body }),

  delete: <T = void>(path: string, options?: Omit<RequestOptions<T>, 'method'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};
