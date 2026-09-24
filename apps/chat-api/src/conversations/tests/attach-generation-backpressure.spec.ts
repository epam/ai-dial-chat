import { EventEmitter } from 'node:events';
import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthSource } from '../../auth/auth-source.enum';
import { SSE_RELEASE_TIMEOUT_MS } from '../../common/utils/sse';
import type { EnvironmentVariables } from '../../config/environment.config';
import { ConversationGenerationService } from '../conversation-generation.service';
import { ConversationController } from '../conversation.controller';
import { ConversationService } from '../conversation.service';
import {
  ConversationMessageDto,
  ConversationMessageRole,
} from '../dto/conversation-message.dto';

/**
 * A minimal `Response`-shaped `EventEmitter` whose `writableLength` is
 * driven manually per instance: `drains: true` resets it to 0 after every
 * write (a well-behaved subscriber), `drains: false` accumulates it (a
 * subscriber whose connection cannot keep up), mirroring how a real
 * `Writable` would behave under those two conditions.
 *
 * `flushesOnEnd` models the other axis the release path turns on: a real
 * `Writable` emits `'finish'` asynchronously once its queue has drained, and
 * never emits it at all while the peer has stopped reading. With
 * `flushesOnEnd: false` the subscriber is terminated by the bounded
 * `destroy()` fallback instead of by `end()`.
 */
class FakeAttachResponse extends EventEmitter {
  writableEnded = false;
  writableFinished = false;
  destroyed = false;
  writableLength = 0;
  setHeader = vi.fn();
  flushHeaders = vi.fn();
  end = vi.fn(() => {
    this.writableEnded = true;
    if (this.flushesOnEnd) {
      setImmediate(() => {
        this.writableFinished = true;
        this.emit('finish');
      });
    }
    return this;
  });
  destroy = vi.fn(() => {
    this.destroyed = true;
    this.writableLength = 0;
    this.emit('close');
    return this;
  });
  write = vi.fn((chunk: unknown) => {
    if (this.writableEnded) return false;
    if (this.drains) {
      this.writableLength = 0;
    } else {
      this.writableLength += Buffer.byteLength(String(chunk));
    }
    return true;
  });

  constructor(
    private readonly drains: boolean,
    private readonly flushesOnEnd = true,
  ) {
    super();
  }
}

const SID = 'test-sid';
const OWNER_KEY = `c:${SID}`;
const PATH = 'test-bucket/gpt-4o__Hello__uuid';
const GEN_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

const makeMessage = (content: string): ConversationMessageDto => ({
  role: ConversationMessageRole.Assistant,
  content,
  timestamp: '2026-01-01T00:00:00.000Z',
});

const makeController = (): {
  controller: ConversationController;
  generationService: ConversationGenerationService;
} => {
  const generationService = new ConversationGenerationService({
    get: () => undefined,
  } as unknown as ConfigService<EnvironmentVariables>);
  const controller = new ConversationController(
    {} as unknown as ConversationService,
    generationService,
  );
  return { controller, generationService };
};

afterEach(() => {
  vi.useRealTimers();
});

describe('attachToGeneration — per-subscriber backpressure', () => {
  it('detaches a slow subscriber once its buffered output exceeds the limit, while a well-behaved concurrent subscriber and the generation continue unaffected', async () => {
    const { controller, generationService } = makeController();
    const lease = generationService.register(OWNER_KEY, PATH, GEN_ID);
    generationService.seedAssembledMessage(lease, makeMessage(''));

    const slowRes = new FakeAttachResponse(false);
    const fastRes = new FakeAttachResponse(true);
    const req = {
      user: { sid: SID },
      authSource: AuthSource.Cookie,
    } as unknown as Request;

    await Promise.all([
      controller.attachToGeneration(req, slowRes as unknown as Response, {
        path: PATH,
      }),
      controller.attachToGeneration(req, fastRes as unknown as Response, {
        path: PATH,
      }),
    ]);

    // 12 * 100 KiB = 1.17 MiB, past the 1 MiB per-subscriber limit.
    const bigChunk = 'x'.repeat(100 * 1024);
    for (let i = 0; i < 12; i += 1) {
      generationService.applyChunk(
        lease,
        { choices: [{ delta: { content: bigChunk } }] },
        makeMessage(bigChunk),
      );
    }

    expect(slowRes.writableEnded).toBe(true);
    expect(slowRes.end).toHaveBeenCalledOnce();
    expect(fastRes.writableEnded).toBe(false);

    generationService.complete(lease);

    expect(fastRes.writableEnded).toBe(true);
    expect(
      fastRes.write.mock.calls.some(([chunk]) =>
        String(chunk).includes('"type":"done"'),
      ),
    ).toBe(true);
    // The detached slow subscriber never received the terminal event — its
    // listener was removed before `complete()` emitted it.
    expect(
      slowRes.write.mock.calls.some(([chunk]) =>
        String(chunk).includes('"type":"done"'),
      ),
    ).toBe(false);

    /*
     * The detached subscriber's response must also reach a terminal state,
     * not merely stop receiving events: this one accepted `end()` and
     * flushed, so the bounded `destroy()` fallback is never needed.
     */
    await new Promise((resolve) => setImmediate(resolve));
    expect(slowRes.writableFinished).toBe(true);
    expect(slowRes.destroy).not.toHaveBeenCalled();
  });

  it('destroys a detached subscriber that cannot flush, once the release bound elapses, without touching the generation or other subscribers', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    const { controller, generationService } = makeController();
    const lease = generationService.register(OWNER_KEY, PATH, GEN_ID);
    generationService.seedAssembledMessage(lease, makeMessage(''));

    const stalledRes = new FakeAttachResponse(false, false);
    const fastRes = new FakeAttachResponse(true);
    const req = {
      user: { sid: SID },
      authSource: AuthSource.Cookie,
    } as unknown as Request;

    await Promise.all([
      controller.attachToGeneration(req, stalledRes as unknown as Response, {
        path: PATH,
      }),
      controller.attachToGeneration(req, fastRes as unknown as Response, {
        path: PATH,
      }),
    ]);

    const bigChunk = 'x'.repeat(100 * 1024);
    for (let i = 0; i < 12; i += 1) {
      generationService.applyChunk(
        lease,
        { choices: [{ delta: { content: bigChunk } }] },
        makeMessage(bigChunk),
      );
    }

    expect(stalledRes.end).toHaveBeenCalledOnce();
    expect(stalledRes.destroy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(SSE_RELEASE_TIMEOUT_MS);

    expect(stalledRes.destroy).toHaveBeenCalledOnce();
    expect(stalledRes.writableLength).toBe(0);

    // The generation and the well-behaved subscriber are unaffected.
    generationService.complete(lease);
    expect(fastRes.destroy).not.toHaveBeenCalled();
    expect(
      fastRes.write.mock.calls.some(([chunk]) =>
        String(chunk).includes('"type":"done"'),
      ),
    ).toBe(true);
  });

  it('does not re-end or re-destroy a subscriber whose cleanup already ran', async () => {
    const { controller, generationService } = makeController();
    const lease = generationService.register(OWNER_KEY, PATH, GEN_ID);
    generationService.seedAssembledMessage(lease, makeMessage(''));

    const slowRes = new FakeAttachResponse(false);
    const req = {
      user: { sid: SID },
      authSource: AuthSource.Cookie,
    } as unknown as Request;

    await controller.attachToGeneration(req, slowRes as unknown as Response, {
      path: PATH,
    });

    const bigChunk = 'x'.repeat(100 * 1024);
    for (let i = 0; i < 12; i += 1) {
      generationService.applyChunk(
        lease,
        { choices: [{ delta: { content: bigChunk } }] },
        makeMessage(bigChunk),
      );
    }
    await new Promise((resolve) => setImmediate(resolve));
    expect(slowRes.end).toHaveBeenCalledOnce();

    // A late disconnect, then the generation's terminal event: both route
    // through the same `cleanup()`, which must stay a no-op after the first.
    slowRes.emit('close');
    generationService.complete(lease);
    await new Promise((resolve) => setImmediate(resolve));

    expect(slowRes.end).toHaveBeenCalledOnce();
    expect(slowRes.destroy).not.toHaveBeenCalled();
  });
});
