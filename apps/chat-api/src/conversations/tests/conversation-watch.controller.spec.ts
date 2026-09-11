import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversationController } from '../conversation.controller';

class TestResponse extends EventEmitter {
  writableEnded = false;
  setHeader = vi.fn();
  flushHeaders = vi.fn();
  write = vi.fn().mockReturnValue(true);
  end = vi.fn(() => {
    this.writableEnded = true;
    return this;
  });
}

const request = {
  user: { at: 'test-token', bucket: 'test-bucket' },
} as unknown as Request;

describe('ConversationController.watchConversation — early close and backpressure', () => {
  let controller: ConversationController;
  let response: TestResponse;
  let watchConversation: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    response = new TestResponse();
    watchConversation = vi.fn();
    controller = new ConversationController(
      { watchConversation } as never,
      {} as never,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('propagates the AbortSignal to ConversationService.watchConversation and aborts it on early close', async () => {
    let capturedSignal: AbortSignal | undefined;
    const cancel = vi.fn();
    watchConversation.mockImplementation(
      (_path: string, _at: string, _bucket: string, signal: AbortSignal) => {
        capturedSignal = signal;
        return new Promise((resolve) => {
          signal.addEventListener('abort', () => {
            resolve(new ReadableStream({ cancel }));
          });
        });
      },
    );

    const pending = controller.watchConversation(
      request,
      response as unknown as Response,
      { path: 'test-path' },
    );

    response.emit('close');
    await pending;

    expect(capturedSignal?.aborted).toBe(true);
    expect(watchConversation).toHaveBeenCalledWith(
      'test-path',
      'test-token',
      'test-bucket',
      expect.any(AbortSignal),
    );
    expect(response.flushHeaders).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('closes a stalled watch connection after the drain timeout, clearing the keepalive timer and cancelling the reader', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    response.write = vi.fn().mockReturnValue(false);
    const cancel = vi.fn().mockResolvedValue(undefined);
    const stream = new ReadableStream<Uint8Array>({
      pull(streamController) {
        streamController.enqueue(
          new TextEncoder().encode('data: {"action":"UPDATE"}\n\n'),
        );
      },
      cancel,
    });
    watchConversation.mockResolvedValue(stream);
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

    const pending = controller.watchConversation(
      request,
      response as unknown as Response,
      { path: 'test-path' },
    );

    await vi.waitFor(() =>
      expect(response.write.mock.calls.length).toBeGreaterThanOrEqual(2),
    );
    await vi.advanceTimersByTimeAsync(5000);
    await pending;

    expect(cancel).toHaveBeenCalledOnce();
    expect(response.end).toHaveBeenCalledOnce();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
