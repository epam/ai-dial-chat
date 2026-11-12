import { PassThrough } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { describe, expect, it, vi } from 'vitest';
import { pipeWebBody, readableFromWeb } from '../stream';

/*
 * A web body that never produces data and errors when the signal aborts —
 * the shape of a DIAL Core fetch body still bound to `AbortSignal.timeout`.
 */
const createAbortableBody = (
  signal: AbortSignal,
  onCancel: () => void = () => undefined,
): ReadableStream<Uint8Array> =>
  new ReadableStream<Uint8Array>({
    start: (controller) => {
      signal.addEventListener('abort', () => controller.error(signal.reason));
    },
    cancel: onCancel,
  });

const createTextBody = (text: string): ReadableStream<Uint8Array> =>
  new ReadableStream<Uint8Array>({
    start: (controller) => {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });

const createClosedDestination = (): PassThrough => {
  const destination = new PassThrough();
  destination.destroy();
  return destination;
};

const collect = (sink: PassThrough): Buffer[] => {
  const chunks: Buffer[] = [];
  sink.on('data', (chunk: Buffer) => chunks.push(chunk));
  return chunks;
};

/* Resolves with the first `uncaughtException` raised, or `null` after a tick. */
const captureUncaught = async (run: () => Promise<void>): Promise<unknown> => {
  const uncaught: unknown[] = [];
  const listeners = process.listeners('uncaughtException');
  process.removeAllListeners('uncaughtException');
  const onUncaught = (error: unknown) => uncaught.push(error);
  process.on('uncaughtException', onUncaught);
  try {
    await run();
    await new Promise((resolve) => setTimeout(resolve, 20));
  } finally {
    process.off('uncaughtException', onUncaught);
    listeners.forEach((listener) => process.on('uncaughtException', listener));
  }
  return uncaught[0] ?? null;
};

describe('readableFromWeb', () => {
  it('streams the web body to a Node consumer', async () => {
    const sink = new PassThrough();
    const chunks = collect(sink);

    await pipeline(readableFromWeb(createTextBody('<html></html>')), sink);

    expect(Buffer.concat(chunks).toString()).toBe('<html></html>');
  });

  it('keeps a late abort from crashing after pipeline() failed on a closed destination', async () => {
    const abortController = new AbortController();

    const uncaught = await captureUncaught(async () => {
      await expect(
        pipeline(
          readableFromWeb(createAbortableBody(abortController.signal)),
          createClosedDestination(),
        ),
      ).rejects.toMatchObject({ code: 'ERR_STREAM_UNABLE_TO_PIPE' });
      abortController.abort(new DOMException('timeout', 'TimeoutError'));
    });

    expect(uncaught).toBeNull();
  });

  it('still reports an upstream error to pipeline()', async () => {
    const abortController = new AbortController();
    const sink = new PassThrough();
    sink.resume();

    const piping = pipeline(
      readableFromWeb(createAbortableBody(abortController.signal)),
      sink,
    );
    abortController.abort(new DOMException('timeout', 'TimeoutError'));

    await expect(piping).rejects.toMatchObject({ name: 'TimeoutError' });
  });
});

describe('pipeWebBody', () => {
  it('streams the web body to the destination', async () => {
    const sink = new PassThrough();
    const chunks = collect(sink);

    await pipeWebBody(createTextBody('binary-content'), sink);

    expect(Buffer.concat(chunks).toString()).toBe('binary-content');
  });

  it('cancels the web body at once when the destination is already closed', async () => {
    const abortController = new AbortController();
    const onCancel = vi.fn();

    await pipeWebBody(
      createAbortableBody(abortController.signal, onCancel),
      createClosedDestination(),
    );

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('keeps a late abort from crashing after the destination was already closed', async () => {
    const abortController = new AbortController();

    const uncaught = await captureUncaught(async () => {
      await pipeWebBody(
        createAbortableBody(abortController.signal),
        createClosedDestination(),
      );
      abortController.abort(new DOMException('timeout', 'TimeoutError'));
    });

    expect(uncaught).toBeNull();
  });

  it('destroys the destination and resolves when the web body errors', async () => {
    const abortController = new AbortController();
    const sink = new PassThrough();
    sink.resume();

    const piping = pipeWebBody(
      createAbortableBody(abortController.signal),
      sink,
    );
    abortController.abort(new DOMException('timeout', 'TimeoutError'));

    await expect(piping).resolves.toBeUndefined();
    expect(sink.destroyed).toBe(true);
  });
});
