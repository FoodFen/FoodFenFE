/**
 * A minimal Server-Sent-Events frame parser.
 *
 * Frames are separated by a blank line; each frame is `event:`/`data:` lines.
 * Used against a plain POST's streamed response body (not a real
 * `EventSource`, which is GET-only) — see `streamChatReply` in
 * `./endpoints/chat.ts` for the caller.
 */
export interface SseFrame {
  event: string;
  data: string;
}

/**
 * Splits accumulated stream text into complete frames plus whatever
 * incomplete text remains for the next chunk. A chunk boundary can land
 * mid-frame, so the caller must keep feeding `remainder` back in as more
 * text arrives.
 */
export function parseSseFrames(buffer: string): { frames: SseFrame[]; remainder: string } {
  const parts = buffer.split('\n\n');
  const remainder = parts.pop() ?? '';

  const frames = parts.map((part): SseFrame => {
    let event = 'message';
    let data = '';

    for (const line of part.split('\n')) {
      if (line.startsWith('event:')) event = line.slice('event:'.length).trim();
      else if (line.startsWith('data:')) data = line.slice('data:'.length).trim();
    }

    return { event, data };
  });

  return { frames, remainder };
}
