/**
 * Every failure the API layer can produce, as one discriminated type.
 *
 * UI code should switch on `kind` rather than sniffing status codes, so a
 * change in backend conventions stays confined to `client.ts`.
 */
export type ApiErrorKind =
  | 'not_configured' // No backend URL in this build — offline-only install.
  | 'network' // Request never reached the server.
  | 'timeout' // Server did not answer in time.
  | 'unauthorized' // 401 — token missing, expired or rejected.
  | 'forbidden' // 403 — authenticated but not allowed.
  | 'not_found' // 404
  | 'validation' // 422 / 400 with field errors.
  | 'rate_limited' // 429
  | 'trial_exhausted' // Free AI trials used up — body code `ai_trial_exhausted`.
  | 'server' // 5xx
  | 'parse' // Response body was not the shape we expected.
  | 'canceled' // Caller aborted the request.
  | 'unknown';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  /** Field-level messages from a validation failure, keyed by field name. */
  readonly fieldErrors?: Record<string, string>;
  // `Error.cause` exists in the base type, so this narrowing needs `override`.
  override readonly cause?: unknown;

  constructor(
    kind: ApiErrorKind,
    message: string,
    options: {
      status?: number;
      fieldErrors?: Record<string, string>;
      cause?: unknown;
    } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = options.status;
    this.fieldErrors = options.fieldErrors;
    this.cause = options.cause;
  }

  /** True when retrying the same request could plausibly succeed. */
  get isRetryable(): boolean {
    return (
      this.kind === 'network' ||
      this.kind === 'timeout' ||
      this.kind === 'server' ||
      this.kind === 'rate_limited'
    );
  }

  /** A message safe to show the user — never leaks internals. */
  get userMessage(): string {
    switch (this.kind) {
      case 'not_configured':
        return 'Accounts are not available in this build. Your diary works offline without one.';
      case 'network':
        return 'No connection. Your changes are saved and will sync when you are back online.';
      case 'timeout':
        return 'That took too long. Please try again.';
      case 'unauthorized':
        return 'Your session has expired. Please sign in again.';
      case 'forbidden':
        return 'You do not have access to that.';
      case 'not_found':
        return 'We could not find that.';
      case 'validation':
        return this.message || 'Please check the highlighted fields.';
      case 'rate_limited':
        return 'Too many requests. Please wait a moment and try again.';
      case 'trial_exhausted':
        return 'You have used your free AI tries. Upgrade to Premium to keep going.';
      case 'server':
        return 'Something went wrong on our side. Please try again shortly.';
      case 'canceled':
        return 'Request canceled.';
      case 'parse':
      case 'unknown':
        return 'Something went wrong. Please try again.';
    }
  }
}

export function statusToKind(status: number): ApiErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 400 || status === 422) return 'validation';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'server';

  return 'unknown';
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
