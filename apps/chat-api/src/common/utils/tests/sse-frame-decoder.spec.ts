import { describe, expect, it } from 'vitest';
import { createSseFrameDecoder } from '../sse-frame-decoder';

const bytes = (text: string) => new TextEncoder().encode(text);

describe('createSseFrameDecoder', () => {
  it('returns the data payload of each completed event', () => {
    const decoder = createSseFrameDecoder(1024);

    expect(decoder.push(bytes('data: {"a":1}\n\ndata: {"b":2}\n\n'))).toEqual({
      events: ['{"a":1}', '{"b":2}'],
      droppedCount: 0,
    });
  });

  it('skips comment lines such as heartbeats', () => {
    const decoder = createSseFrameDecoder(1024);

    expect(
      decoder.push(bytes(': heartbeat\n\ndata: x\n\n: keepalive\n\n')).events,
    ).toEqual(['x']);
  });

  it('joins a frame split across chunks, including a CRLF split between them', () => {
    const decoder = createSseFrameDecoder(1024);

    expect(decoder.push(bytes('data: {"a"')).events).toEqual([]);
    expect(decoder.push(bytes(':1}\r')).events).toEqual([]);
    expect(decoder.push(bytes('\n\r\n')).events).toEqual(['{"a":1}']);
  });

  it('joins multi-line data with a newline', () => {
    const decoder = createSseFrameDecoder(1024);

    expect(decoder.push(bytes('data: one\ndata: two\n\n')).events).toEqual([
      'one\ntwo',
    ]);
  });

  it('drops an oversize event and resumes at the next one', () => {
    const decoder = createSseFrameDecoder(16);

    const first = decoder.push(bytes(`data: ${'x'.repeat(40)}`));
    const second = decoder.push(bytes(`${'y'.repeat(40)}\n\ndata: ok\n\n`));

    expect(first).toEqual({ events: [], droppedCount: 1 });
    expect(second).toEqual({ events: ['ok'], droppedCount: 0 });
  });
});
