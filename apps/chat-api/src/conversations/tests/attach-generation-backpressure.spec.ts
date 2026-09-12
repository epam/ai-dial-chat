import { EventEmitter } from 'node:events';
import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
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
 */
class FakeAttachResponse extends EventEmitter {
  writableEnded = false;
  writableLength = 0;
  setHeader = vi.fn();
  flushHeaders = vi.fn();
  end = vi.fn(() => {
    this.writableEnded = true;
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

  constructor(private readonly drains: boolean) {
    super();
  }
}

const SID = 'test-sid';
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
  } as unknown as ConfigService);
  const controller = new ConversationController(
    {} as unknown as ConversationService,
    generationService,
  );
  return { controller, generationService };
};

describe('attachToGeneration — per-subscriber backpressure', () => {
  it('detaches a slow subscriber once its buffered output exceeds the limit, while a well-behaved concurrent subscriber and the generation continue unaffected', async () => {
    const { controller, generationService } = makeController();
    generationService.register(SID, PATH, GEN_ID);
    generationService.seedAssembledMessage(SID, PATH, GEN_ID, makeMessage(''));

    const slowRes = new FakeAttachResponse(false);
    const fastRes = new FakeAttachResponse(true);
    const req = { user: { sid: SID } } as unknown as Request;

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
        SID,
        PATH,
        GEN_ID,
        { choices: [{ delta: { content: bigChunk } }] },
        makeMessage(bigChunk),
      );
    }

    expect(slowRes.writableEnded).toBe(true);
    expect(slowRes.end).toHaveBeenCalledOnce();
    expect(fastRes.writableEnded).toBe(false);

    generationService.complete(SID, PATH, GEN_ID);

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
  });
});
