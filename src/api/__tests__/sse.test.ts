import { parseSseFrames } from '../sse';

describe('parseSseFrames', () => {
  it('parses one complete frame and leaves nothing in the remainder', () => {
    const { frames, remainder } = parseSseFrames(
      'event: token\ndata: {"delta":"hi"}\n\n',
    );

    expect(frames).toEqual([{ event: 'token', data: '{"delta":"hi"}' }]);
    expect(remainder).toBe('');
  });

  it('holds back an incomplete trailing frame for the next chunk', () => {
    const { frames, remainder } = parseSseFrames(
      'event: token\ndata: {"delta":"a"}\n\nevent: tok',
    );

    expect(frames).toEqual([{ event: 'token', data: '{"delta":"a"}' }]);
    expect(remainder).toBe('event: tok');
  });

  it('defaults the event name to "message" when no event: line is present', () => {
    const { frames } = parseSseFrames('data: {"x":1}\n\n');

    expect(frames).toEqual([{ event: 'message', data: '{"x":1}' }]);
  });

  it('parses multiple frames arriving in a single chunk, in order', () => {
    const { frames, remainder } = parseSseFrames(
      'event: token\ndata: {"delta":"a"}\n\nevent: token\ndata: {"delta":"b"}\n\n',
    );

    expect(frames).toEqual([
      { event: 'token', data: '{"delta":"a"}' },
      { event: 'token', data: '{"delta":"b"}' },
    ]);
    expect(remainder).toBe('');
  });

  it('returns no frames and the whole buffer as remainder when nothing is complete yet', () => {
    const { frames, remainder } = parseSseFrames('event: tok');

    expect(frames).toEqual([]);
    expect(remainder).toBe('event: tok');
  });

  it('parses a CRLF-terminated frame the same as an LF one', () => {
    const { frames, remainder } = parseSseFrames(
      'event: token\r\ndata: {"delta":"hi"}\r\n\r\n',
    );

    expect(frames).toEqual([{ event: 'token', data: '{"delta":"hi"}' }]);
    expect(remainder).toBe('');
  });
});
