import { EventEmitter } from 'node:events';
import { NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import {
  DataPointType,
  MeterProvider,
  MetricReader,
} from '@opentelemetry/sdk-metrics';
import type { Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSource } from '../../auth/auth-source.enum';
import { SSE_RELEASE_TIMEOUT_MS } from '../../common/utils/sse';
import type { EnvironmentVariables } from '../../config/environment.config';
import {
  initializeRuntimeMetrics,
  SseSubscriptionKind,
} from '../../telemetry/runtime-metrics';
import { ConversationGenerationService } from '../conversation-generation.service';
import { ConversationController } from '../conversation.controller';
import { ConversationService } from '../conversation.service';
import {
  ConversationMessageDto,
  ConversationMessageRole,
} from '../dto/conversation-message.dto';
import { createConversationController } from './conversation-controller.fixture';

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

const makeController = (
  config: Partial<EnvironmentVariables> = {},
): {
  controller: ConversationController;
  generationService: ConversationGenerationService;
} => {
  const generationService = new ConversationGenerationService({
    get: (key: keyof EnvironmentVariables) => config[key],
  } as unknown as ConfigService<EnvironmentVariables>);
  const controller = createConversationController(
    {
      resolveBackgroundAttach: vi.fn().mockResolvedValue(null),
      stopBackgroundGeneration: vi.fn().mockResolvedValue('not_background'),
    } as unknown as ConversationService,
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

class TestMetricReader extends MetricReader {
  protected async onForceFlush(): Promise<void> {
    /* Metrics are collected directly in assertions. */
  }

  protected async onShutdown(): Promise<void> {
    /* This reader owns no resources. */
  }
}

describe('attachToGeneration — retained entry after the finalization bound', () => {
  const FINALIZE_TIMEOUT_MS = 5000;
  const req = {
    user: { sid: SID },
    authSource: AuthSource.Cookie,
  } as unknown as Request;
  let reader: TestMetricReader;
  let meterProvider: MeterProvider;
  let stopMetrics: () => void;

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    });
    reader = new TestMetricReader();
    meterProvider = new MeterProvider({ readers: [reader] });
    stopMetrics = initializeRuntimeMetrics(meterProvider.getMeter('test'));
  });

  afterEach(async () => {
    stopMetrics();
    await meterProvider.shutdown();
  });

  const collectAttachSubscriptions = async () => {
    const { resourceMetrics } = await reader.collect();
    const point = resourceMetrics.scopeMetrics
      .flatMap((scope) => scope.metrics)
      .filter((metric) => metric.descriptor.name === 'dial.chat.sse.active')
      .filter((metric) => metric.dataPointType === DataPointType.GAUGE)
      .flatMap((metric) => metric.dataPoints)
      .find(
        (dataPoint) =>
          dataPoint.attributes.kind === SseSubscriptionKind.GenerationAttach,
      );
    return point?.value;
  };

  const writtenTerminalTypes = (res: FakeAttachResponse): string[] =>
    res.write.mock.calls
      .map(([chunk]) => String(chunk))
      .filter((chunk) => chunk.startsWith('data: '))
      .map((chunk) => JSON.parse(chunk.slice('data: '.length)).type as string)
      .filter((type) => type !== 'snapshot' && type !== 'chunk');

  /* Lets `releaseSseResponse` observe the fake response's `'finish'`. */
  const flushRelease = () => new Promise((resolve) => setImmediate(resolve));

  it.each([
    ['error', false],
    ['stopped', true],
  ])(
    'ends an earlier subscriber with one %s terminal event and releases its keepalive and subscription when the bound elapses',
    async (terminalType, isStoppedByUser) => {
      const { controller, generationService } = makeController({
        GENERATION_FINALIZE_TIMEOUT_MS: FINALIZE_TIMEOUT_MS,
      });
      const baseline = await collectAttachSubscriptions();
      const lease = generationService.register(OWNER_KEY, PATH, GEN_ID);
      generationService.seedAssembledMessage(lease, makeMessage('partial'));
      const res = new FakeAttachResponse(true);
      await controller.attachToGeneration(req, res as unknown as Response, {
        path: PATH,
      });
      expect(await collectAttachSubscriptions()).toBe((baseline ?? 0) + 1);

      if (isStoppedByUser) {
        generationService.abort(OWNER_KEY, PATH, GEN_ID);
      }
      generationService.beginFinalizing(lease);
      vi.advanceTimersByTime(FINALIZE_TIMEOUT_MS);
      await flushRelease();

      expect(writtenTerminalTypes(res)).toEqual([terminalType]);
      expect(res.end).toHaveBeenCalledOnce();
      expect(res.destroy).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
      expect(await collectAttachSubscriptions()).toBe(baseline);

      const writesBeforeSettlement = res.write.mock.calls.length;
      generationService.complete(lease);
      expect(res.write.mock.calls.length).toBe(writesBeforeSettlement);
    },
  );

  it('leaves a subscriber that disconnected before the bound untouched when the bound elapses', async () => {
    const { controller, generationService } = makeController({
      GENERATION_FINALIZE_TIMEOUT_MS: FINALIZE_TIMEOUT_MS,
    });
    const baseline = await collectAttachSubscriptions();
    const lease = generationService.register(OWNER_KEY, PATH, GEN_ID);
    const res = new FakeAttachResponse(true);
    await controller.attachToGeneration(req, res as unknown as Response, {
      path: PATH,
    });
    generationService.beginFinalizing(lease);

    res.emit('close');
    await flushRelease();
    expect(await collectAttachSubscriptions()).toBe(baseline);
    vi.advanceTimersByTime(FINALIZE_TIMEOUT_MS);
    await flushRelease();

    expect(writtenTerminalTypes(res)).toEqual([]);
    expect(res.end).toHaveBeenCalledOnce();
    expect(res.destroy).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(await collectAttachSubscriptions()).toBe(baseline);
  });

  it('rejects a later attach with 404 before opening a stream, arming nothing and leaving earlier responses alone', async () => {
    const { controller, generationService } = makeController({
      GENERATION_FINALIZE_TIMEOUT_MS: FINALIZE_TIMEOUT_MS,
    });
    const baseline = await collectAttachSubscriptions();
    const lease = generationService.register(OWNER_KEY, PATH, GEN_ID);
    const earlyRes = new FakeAttachResponse(true);
    await controller.attachToGeneration(req, earlyRes as unknown as Response, {
      path: PATH,
    });
    generationService.beginFinalizing(lease);
    vi.advanceTimersByTime(FINALIZE_TIMEOUT_MS);
    await flushRelease();
    const earlyWrites = earlyRes.write.mock.calls.length;
    expect(vi.getTimerCount()).toBe(0);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const lateRes = new FakeAttachResponse(true);
      await expect(
        controller.attachToGeneration(req, lateRes as unknown as Response, {
          path: PATH,
        }),
      ).rejects.toThrow(NotFoundException);
      expect(lateRes.setHeader).not.toHaveBeenCalled();
      expect(lateRes.flushHeaders).not.toHaveBeenCalled();
      expect(lateRes.write).not.toHaveBeenCalled();
      expect(lateRes.listenerCount('close')).toBe(0);
    }

    expect(vi.getTimerCount()).toBe(0);
    expect(await collectAttachSubscriptions()).toBe(baseline);

    generationService.complete(lease);
    expect(earlyRes.write.mock.calls.length).toBe(earlyWrites);
    expect(earlyRes.end).toHaveBeenCalledOnce();
  });
});

describe('attachToGeneration — background replay backpressure', () => {
  it('stops a slow reader of a background replay and aborts the DIAL Core replay', async () => {
    const generationService = new ConversationGenerationService({
      get: () => undefined,
    } as unknown as ConfigService<EnvironmentVariables>);
    let replaySignal: AbortSignal | undefined;
    let eventsPulled = 0;
    const events = async function* () {
      for (let i = 0; i < 100; i++) {
        eventsPulled++;
        yield {
          type: 'chunk',
          chunk: { choices: [{ delta: { content: 'x'.repeat(64 * 1024) } }] },
        };
      }
    };
    const controller = createConversationController(
      {
        resolveBackgroundAttach: vi.fn(
          async (
            _path: string,
            _token: string,
            _bucket: string,
            signal: AbortSignal,
          ) => {
            replaySignal = signal;
            return { kind: 'stream', events: events() };
          },
        ),
      } as unknown as ConversationService,
      generationService,
    );
    const slowRes = new FakeAttachResponse(false);

    await controller.attachToGeneration(
      {
        user: { sid: SID, at: 'tok', bucket: 'test-bucket' },
        authSource: AuthSource.Cookie,
      } as unknown as Request,
      slowRes as unknown as Response,
      { path: PATH },
    );

    expect(eventsPulled).toBeLessThan(100);
    expect(replaySignal?.aborted).toBe(true);
    expect(slowRes.end).toHaveBeenCalled();
  });
});
