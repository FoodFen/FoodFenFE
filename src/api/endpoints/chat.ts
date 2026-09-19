import { fetch as expoFetch } from 'expo/fetch';

import { api, getAccessToken, notifySessionExpired, refreshAccessToken } from '@/api/client';
import { ApiError, statusToKind } from '@/api/errors';
import { chatHistoryResponseSchema, chatMessageSchema } from '@/api/schemas';
import type { RemoteChatHistoryResponse, RemoteChatMessage } from '@/api/schemas';
import { env } from '@/lib/env';

import { parseSseFrames } from '../sse';

/**
 * Chat endpoints.
 *
 * `getHistory` goes through the normal `request()` pipeline like every other
 * read in this app. `streamChatReply` cannot: its response arrives as a
 * partial `text/event-stream` body, not one parsed JSON value, so it is a
 * hand-rolled function built directly on `expo/fetch` — the one fetch
 * implementation in this stack whose `Response.body` is a real readable
 * stream backed by native networking (as of Expo SDK 56, `expo/fetch`
 * replaces the global `fetch` on Android/iOS, and this project is on SDK 57,
 * so the global `fetch` already streams too — this import is kept explicit
 * for clarity at the one call site that depends on it).
 *
 * See `docs/superpowers/specs/2026-09-19-ai-chat-design.md` for the full
 * wire contract this is built against.
 */

export const chatApi = {
  getHistory: (before?: string, limit = 30): Promise<RemoteChatHistoryResponse> =>
    api.get('chat/messages', {
      schema: chatHistoryResponseSchema,
      query: { before, limit },
    }),
};

export interface StreamReplyHandlers {
  onToken: (delta: string) => void;
  onDone: (message: RemoteChatMessage) => void;
  onError: (message: string) => void;
  signal?: AbortSignal;
}

function chatUrl(): string {
  if (!env.apiUrl) {
    throw new ApiError('not_configured', 'No server is configured for this build.');
  }

  const base = env.apiUrl.endsWith('/') ? env.apiUrl : `${env.apiUrl}/`;

  return new URL('chat/messages', base).toString();
}

function sendChatRequest(url: string, message: string, token: string | null, signal?: AbortSignal) {
  return expoFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message }),
    signal,
  });
}

/**
 * Sends one user message and streams the assistant's reply, calling
 * `handlers` as frames arrive. Resolves once the stream ends (successfully
 * or with an error) — callers do not need to await anything further.
 */
export async function streamChatReply(
  message: string,
  handlers: StreamReplyHandlers,
): Promise<void> {
  let url: string;

  try {
    url = chatUrl();
  } catch (error) {
    handlers.onError(error instanceof ApiError ? error.userMessage : 'Something went wrong.');
    return;
  }

  try {
    let response = await sendChatRequest(url, message, getAccessToken(), handlers.signal);

    if (response.status === 401) {
      const refreshed = await refreshAccessToken();

      if (!refreshed) {
        notifySessionExpired();
        handlers.onError(new ApiError('unauthorized', 'Session expired.').userMessage);
        return;
      }

      response = await sendChatRequest(url, message, refreshed, handlers.signal);

      // Same as `request()`: a second 401 after a successful refresh means
      // the new token is bad too, so we stop rather than loop.
      if (response.status === 401) {
        notifySessionExpired();
        handlers.onError(new ApiError('unauthorized', 'Session expired.').userMessage);
        return;
      }
    }

    if (!response.ok || !response.body) {
      handlers.onError(
        new ApiError(statusToKind(response.status), 'The assistant could not reply.').userMessage,
      );
      return;
    }

    const reader = response.body.getReader();
    // `TextDecoder` ships as a global on this project's RN/Hermes version; if
    // this throws on the device it's built for, that's the one runtime
    // assumption in this function worth checking first.
    const decoder = new TextDecoder();
    let buffer = '';

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const { frames, remainder } = parseSseFrames(buffer);
      buffer = remainder;

      for (const frame of frames) {
        if (frame.event === 'token') {
          const parsed = JSON.parse(frame.data) as { delta: string };
          handlers.onToken(parsed.delta);
        } else if (frame.event === 'done') {
          const parsed = JSON.parse(frame.data) as { message: unknown };
          const result = chatMessageSchema.safeParse(parsed.message);

          if (result.success) handlers.onDone(result.data);
          else handlers.onError('The server returned an unexpected reply.');
          return;
        } else if (frame.event === 'error') {
          const parsed = JSON.parse(frame.data) as { message: string };
          handlers.onError(parsed.message);
          return;
        }
      }
    }
  } catch (error) {
    // Covers a rejected `expoFetch` call (network drop, timeout, caller
    // abort), a rejected `reader.read()`, and a malformed frame's
    // `JSON.parse` throwing — none of these may escape as an unhandled
    // rejection; the contract is that this function always resolves and
    // reports failure through `onError`, exactly like `request()` in
    // `client.ts` turns every failure into an `ApiError`.
    if (error instanceof ApiError) {
      handlers.onError(error.userMessage);
    } else if (error instanceof Error && error.name === 'AbortError') {
      handlers.onError(new ApiError('canceled', 'Request canceled.', { cause: error }).userMessage);
    } else if (error instanceof SyntaxError) {
      handlers.onError(
        new ApiError('parse', 'The server returned an unexpected reply.', { cause: error })
          .userMessage,
      );
    } else {
      handlers.onError(
        new ApiError('network', 'Unable to reach the server.', { cause: error }).userMessage,
      );
    }
  }
}
