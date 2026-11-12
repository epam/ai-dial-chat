import { Readable, type Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeWebReadableStream } from 'node:stream/web';

/**
 * `Readable.fromWeb()` for a DIAL Core response body, with a permanent
 * `'error'` listener.
 *
 * DIAL Core streaming calls pass an `AbortSignal.timeout(...)` that stays
 * bound to the response body after the headers arrive. A consumer that fails
 * without destroying the `Readable` leaves it alive — `pipeline()` does this
 * when the destination is already destroyed (it rejects with
 * `ERR_STREAM_UNABLE_TO_PIPE` and never touches the source). The timeout
 * later errors that abandoned `Readable`, and Node throws an `'error'` event
 * that has no listener, which kills the process.
 *
 * `pipeline()`, `finished()` and other consumers still see the error through
 * their own listeners; this one only keeps a late error from becoming
 * uncaught. It does not release the upstream connection — the caller must
 * still destroy the `Readable` on failure, as {@link pipeWebBody} does.
 */
export const readableFromWeb = (stream: ReadableStream): Readable => {
  const readable = Readable.fromWeb(
    stream as NodeWebReadableStream<Uint8Array>,
  );
  readable.on('error', () => undefined);
  return readable;
};

/**
 * Pipes a DIAL Core response body to `destination` (an Express `Response`)
 * and destroys both ends when the pipe fails. Never rejects.
 *
 * Destroying the source cancels the web body, which closes the DIAL Core
 * connection at once. Without it, a browser that disconnected before piping
 * started (an HTML preview iframe reload) would hold that connection open
 * until `FILE_TRANSFER_TIMEOUT_MS` fires.
 */
export const pipeWebBody = async (
  stream: ReadableStream,
  destination: Writable,
): Promise<void> => {
  const source = readableFromWeb(stream);
  try {
    await pipeline(source, destination);
  } catch {
    source.destroy();
    destination.destroy();
  }
};
