import { EventEmitter } from 'node:events';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { MeterProvider, MetricReader } from '@opentelemetry/sdk-metrics';
import type { Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeatureGuard } from '../../app-config/feature-flags/feature.guard';
import { ClientChannelController } from '../../client-channel/client-channel.controller';
import { ClientChannelService } from '../../client-channel/client-channel.service';
import { ConversationGenerationService } from '../../conversations/conversation-generation.service';
import { ConversationController } from '../../conversations/conversation.controller';
import { ConversationService } from '../../conversations/conversation.service';
import {
  initializeRuntimeMetrics,
  SseSubscriptionKind,
} from '../runtime-metrics';

class TestMetricReader extends MetricReader {
  protected async onForceFlush(): Promise<void> {
    /* Assertions collect observations directly. */
  }

  protected async onShutdown(): Promise<void> {
    /* This reader owns no external resources. */
  }
}

class TestResponse extends EventEmitter {
  writableEnded = false;
  writableLength = 0;
  setHeader = vi.fn();
  flushHeaders = vi.fn();
  write = vi.fn().mockReturnValue(true);
  end = vi.fn(() => {
    this.writableEnded = true;
    return this;
  });
}

const SSE_ATTACH_MAX_BUFFERED_BYTES = 1024 * 1024;

const request = {
  user: { at: 'test-token', bucket: 'test-bucket', sid: 'test-session' },
} as unknown as Request;

describe('SSE subscription metrics', () => {
  let module: TestingModule;
  let reader: TestMetricReader;
  let provider: MeterProvider;
  let stopMetrics: () => void;
  let response: TestResponse;
  let clientChannel: ClientChannelController;
  let conversations: ConversationController;
  const subscribe = vi.fn();
  const watch = vi.fn();
  const attach = vi.fn();

  beforeEach(async () => {
    vi.resetAllMocks();
    reader = new TestMetricReader();
    provider = new MeterProvider({ readers: [reader] });
    stopMetrics = initializeRuntimeMetrics(
      provider.getMeter('sse-metrics-test'),
    );
    response = new TestResponse();
    module = await Test.createTestingModule({
      controllers: [ClientChannelController, ConversationController],
      providers: [
        { provide: ClientChannelService, useValue: { subscribe } },
        {
          provide: ConversationService,
          useValue: { watchConversation: watch },
        },
        { provide: ConversationGenerationService, useValue: { attach } },
      ],
    })
      .overrideGuard(FeatureGuard)
      .useValue({ canActivate: () => true })
      .compile();
    clientChannel = module.get(ClientChannelController);
    conversations = module.get(ConversationController);
  });

  afterEach(async () => {
    response.emit('close');
    stopMetrics();
    await provider.shutdown();
    await module.close();
  });

  const activeSubscriptions = async (kind: SseSubscriptionKind) => {
    const { resourceMetrics } = await reader.collect();
    return resourceMetrics.scopeMetrics
      .flatMap((scope) => scope.metrics)
      .find((metric) => metric.descriptor.name === 'dial.chat.sse.active')
      ?.dataPoints.find((point) => point.attributes.kind === kind)?.value;
  };

  describe.each([
    SseSubscriptionKind.ClientChannel,
    SseSubscriptionKind.ConversationWatch,
  ])('%s relay', (kind) => {
    const upstream = () =>
      kind === SseSubscriptionKind.ClientChannel ? subscribe : watch;
    const result = (stream: ReadableStream<Uint8Array>) =>
      kind === SseSubscriptionKind.ClientChannel
        ? { stream, channelId: 'test-channel' }
        : stream;
    const invoke = () =>
      kind === SseSubscriptionKind.ClientChannel
        ? clientChannel.subscribe(
            request,
            response as unknown as Response,
            undefined,
          )
        : conversations.watchConversation(
            request,
            response as unknown as Response,
            {
              path: 'test-path',
            },
          );

    it('counts opening and streaming work until upstream completes', async () => {
      let resolveOpening!: (value: unknown) => void;
      upstream().mockReturnValue(
        new Promise((resolve) => {
          resolveOpening = resolve;
        }),
      );
      let streamController!: ReadableStreamDefaultController<Uint8Array>;
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          streamController = controller;
        },
      });

      const pending = invoke();
      expect(await activeSubscriptions(kind)).toBe(1);
      resolveOpening(result(stream));
      await vi.waitFor(() =>
        expect(response.flushHeaders).toHaveBeenCalledOnce(),
      );
      expect(await activeSubscriptions(kind)).toBe(1);

      streamController.close();
      await pending;
      expect(await activeSubscriptions(kind)).toBe(0);
    });

    it('releases the count when opening upstream fails', async () => {
      upstream().mockRejectedValue(new Error('upstream unavailable'));

      await expect(invoke()).rejects.toThrow('upstream unavailable');

      expect(await activeSubscriptions(kind)).toBe(0);
    });

    it('releases the count after disconnect cancels a pending upstream read', async () => {
      const cancel = vi.fn();
      upstream().mockResolvedValue(result(new ReadableStream({ cancel })));
      const pending = invoke();
      await vi.waitFor(() =>
        expect(response.flushHeaders).toHaveBeenCalledOnce(),
      );
      expect(await activeSubscriptions(kind)).toBe(1);

      response.emit('close');
      response.emit('close');
      await pending;

      expect(cancel).toHaveBeenCalledOnce();
      expect(await activeSubscriptions(kind)).toBe(0);
    });

    it('keeps unfinished upstream setup visible after an early client close', async () => {
      let rejectOpening!: (reason: Error) => void;
      upstream().mockReturnValue(
        new Promise((_resolve, reject) => {
          rejectOpening = reject;
        }),
      );
      const pending = invoke();

      response.emit('close');
      expect(await activeSubscriptions(kind)).toBe(1);

      const rejected = expect(pending).rejects.toThrow('upstream unavailable');
      rejectOpening(new Error('upstream unavailable'));
      await rejected;
      expect(await activeSubscriptions(kind)).toBe(0);
    });

    it('aborts the upstream call signal on an early close during pending setup, and still settles the gauge exactly once', async () => {
      let capturedSignal: AbortSignal | undefined;
      let rejectOpening!: (reason: Error) => void;
      upstream().mockImplementation((...args: unknown[]) => {
        capturedSignal = args[args.length - 1] as AbortSignal;
        return new Promise((_resolve, reject) => {
          rejectOpening = reject;
        });
      });

      const pending = invoke();
      expect(await activeSubscriptions(kind)).toBe(1);

      response.emit('close');
      expect(capturedSignal?.aborted).toBe(true);

      const rejected = expect(pending).rejects.toThrow('aborted');
      rejectOpening(new Error('aborted'));
      await rejected;
      expect(await activeSubscriptions(kind)).toBe(0);
    });
  });

  describe('generation attachment', () => {
    const invoke = () =>
      conversations.attachToGeneration(
        request,
        response as unknown as Response,
        {
          path: 'test-path',
        },
      );

    it('counts the live subscription after the controller returns and releases on terminal', async () => {
      const emitter = new EventEmitter();
      attach.mockReturnValue({ emitter, assembledMessage: { content: '' } });

      await invoke();
      expect(
        await activeSubscriptions(SseSubscriptionKind.GenerationAttach),
      ).toBe(1);

      emitter.emit('terminal', { type: 'done' });
      response.emit('close');
      expect(
        await activeSubscriptions(SseSubscriptionKind.GenerationAttach),
      ).toBe(0);
      expect(emitter.listenerCount('chunk')).toBe(0);
      expect(emitter.listenerCount('terminal')).toBe(0);
    });

    it('releases on client close without waiting for generation completion', async () => {
      const emitter = new EventEmitter();
      attach.mockReturnValue({ emitter, assembledMessage: { content: '' } });
      await invoke();

      response.emit('close');
      response.emit('close');

      expect(
        await activeSubscriptions(SseSubscriptionKind.GenerationAttach),
      ).toBe(0);
      expect(emitter.listenerCount('terminal')).toBe(0);
    });

    it('releases the count when a subscriber is detached for backpressure, not just on close/terminal', async () => {
      const emitter = new EventEmitter();
      attach.mockReturnValue({ emitter, assembledMessage: { content: '' } });
      await invoke();
      expect(
        await activeSubscriptions(SseSubscriptionKind.GenerationAttach),
      ).toBe(1);

      response.writableLength = SSE_ATTACH_MAX_BUFFERED_BYTES + 1;
      emitter.emit('chunk', { choices: [{ delta: { content: 'x' } }] });

      expect(
        await activeSubscriptions(SseSubscriptionKind.GenerationAttach),
      ).toBe(0);
      expect(response.writableEnded).toBe(true);
      expect(emitter.listenerCount('chunk')).toBe(0);
      expect(emitter.listenerCount('terminal')).toBe(0);
    });

    it('runs cleanup exactly once when a backpressure-triggered detach races with a terminal event in the same tick', async () => {
      const emitter = new EventEmitter();
      attach.mockReturnValue({ emitter, assembledMessage: { content: '' } });
      await invoke();
      expect(
        await activeSubscriptions(SseSubscriptionKind.GenerationAttach),
      ).toBe(1);

      // The terminal event's own write is what pushes buffered bytes over
      // the limit, so `writeEvent`'s internal backpressure check and
      // `onTerminal`'s own explicit cleanup call both fire in this one tick.
      response.writableLength = SSE_ATTACH_MAX_BUFFERED_BYTES + 1;
      emitter.emit('terminal', { type: 'done' });

      expect(
        await activeSubscriptions(SseSubscriptionKind.GenerationAttach),
      ).toBe(0);
      expect(response.end).toHaveBeenCalledOnce();
      expect(emitter.listenerCount('chunk')).toBe(0);
      expect(emitter.listenerCount('terminal')).toBe(0);
    });

    it('does not count a missing generation as a subscription', async () => {
      attach.mockReturnValue(null);

      await expect(invoke()).rejects.toThrow('No active generation');

      expect(
        await activeSubscriptions(SseSubscriptionKind.GenerationAttach),
      ).toBe(0);
    });

    it('closes live attachments and releases their count when the generation module shuts down', async () => {
      const generationModule = await Test.createTestingModule({
        controllers: [ConversationController],
        providers: [
          ConversationGenerationService,
          { provide: ConfigService, useValue: { get: () => 1_800_000 } },
          { provide: ConversationService, useValue: {} },
        ],
      }).compile();

      try {
        const service = generationModule.get(ConversationGenerationService);
        service.register('test-session', 'test-path', 'test-generation');
        await generationModule
          .get(ConversationController)
          .attachToGeneration(request, response as unknown as Response, {
            path: 'test-path',
          });
        expect(
          await activeSubscriptions(SseSubscriptionKind.GenerationAttach),
        ).toBe(1);

        await generationModule.close();

        expect(response.write).toHaveBeenCalledWith(
          'data: {"type":"stopped"}\n\n',
        );
        expect(response.writableEnded).toBe(true);
        expect(response.listenerCount('close')).toBe(0);
        expect(
          await activeSubscriptions(SseSubscriptionKind.GenerationAttach),
        ).toBe(0);
      } finally {
        await generationModule.close();
      }
    });
  });
});
