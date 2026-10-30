import { describe, expect, it, vi } from 'vitest';
import { readSseEvents } from '../read-sse-events';

const streamOf = (chunks: string[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      controller.close();
    },
  });

describe('readSseEvents', () => {
  it('decodes data lines split across chunks and with CRLF endings', async () => {
    const onEvent = vi.fn(() => false);

    await readSseEvents(
      streamOf(['data: {"a"', ':1}\r\n\r\n', 'data: {"b":2}\n\n']),
      onEvent,
    );

    expect(onEvent).toHaveBeenNthCalledWith(1, { a: 1 });
    expect(onEvent).toHaveBeenNthCalledWith(2, { b: 2 });
  });

  it('skips comments, keepalives and malformed lines', async () => {
    const onEvent = vi.fn(() => false);

    await readSseEvents(
      streamOf([
        ': init\n\n',
        ': keepalive\n\n',
        'data: nope\n\n',
        'data: 1\n\n',
      ]),
      onEvent,
    );

    expect(onEvent).toHaveBeenCalledOnce();
    expect(onEvent).toHaveBeenCalledWith(1);
  });

  it('stops reading as soon as the callback returns true', async () => {
    const onEvent = vi.fn(() => true);

    await readSseEvents(streamOf(['data: 1\n\ndata: 2\n\n']), onEvent);

    expect(onEvent).toHaveBeenCalledOnce();
  });

  it('resolves instead of rejecting when the stream errors', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error('network'));
      },
    });

    await expect(readSseEvents(stream, () => false)).resolves.toBeUndefined();
  });
});
