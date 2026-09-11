import { ConflictException, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { MeterProvider, MetricReader } from '@opentelemetry/sdk-metrics';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../config/environment.config';
import { initializeRuntimeMetrics } from '../../telemetry/runtime-metrics';
import {
  ConversationGenerationService,
  GenerationStatus,
} from '../conversation-generation.service';
import {
  ConversationMessageDto,
  ConversationMessageRole,
} from '../dto/conversation-message.dto';

const SESSION = 'session-1';
const PATH = 'gpt-4o__Test Chat';
const GENERATION_ID = 'gen-1';

class TestMetricReader extends MetricReader {
  protected async onForceFlush(): Promise<void> {
    /* Metrics are collected directly in assertions. */
  }

  protected async onShutdown(): Promise<void> {
    /* This reader owns no resources. */
  }
}

const makeMessage = (content: string): ConversationMessageDto => ({
  role: ConversationMessageRole.Assistant,
  content,
  timestamp: '2026-01-01T00:00:00.000Z',
});

const makeConfigService = (
  maxGenerationDurationMs?: number,
): ConfigService<EnvironmentVariables> =>
  ({
    get: vi.fn().mockReturnValue(maxGenerationDurationMs),
  }) as unknown as ConfigService<EnvironmentVariables>;

describe('ConversationGenerationService', () => {
  let service: ConversationGenerationService;

  beforeEach(() => {
    service = new ConversationGenerationService(makeConfigService());
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  describe('register', () => {
    it('returns an AbortController for a new generation', () => {
      const controller = service.register(SESSION, PATH, GENERATION_ID);
      expect(controller).toBeInstanceOf(AbortController);
      expect(service.getStatus(SESSION, PATH)).toBe(GenerationStatus.Active);
    });

    it('throws ConflictException when a generation is already active for the same session+path', () => {
      service.register(SESSION, PATH, GENERATION_ID);
      expect(() => service.register(SESSION, PATH, 'gen-2')).toThrow(
        ConflictException,
      );
    });

    it('seeds an empty placeholder assembled message so an immediate attach is safe', () => {
      service.register(SESSION, PATH, GENERATION_ID);
      const attachment = service.attach(SESSION, PATH);
      expect(attachment?.assembledMessage.content).toBe('');
      expect(attachment?.assembledMessage.role).toBe(
        ConversationMessageRole.Assistant,
      );
    });
  });

  describe('attach', () => {
    it('returns undefined when no generation is active for the path', () => {
      expect(service.attach(SESSION, PATH)).toBeUndefined();
    });

    it('returns undefined after the generation has already finished', () => {
      service.register(SESSION, PATH, GENERATION_ID);
      service.complete(SESSION, PATH, GENERATION_ID);
      expect(service.attach(SESSION, PATH)).toBeUndefined();
    });
  });

  describe('seedAssembledMessage / applyChunk', () => {
    it('applyChunk updates the retained snapshot and emits the raw chunk to attached listeners', () => {
      service.register(SESSION, PATH, GENERATION_ID);
      service.seedAssembledMessage(
        SESSION,
        PATH,
        GENERATION_ID,
        makeMessage(''),
      );

      const attachment = service.attach(SESSION, PATH)!;
      const onChunk = vi.fn();
      attachment.emitter.on('chunk', onChunk);

      const rawChunk = { choices: [{ delta: { content: 'Hi' } }] };
      service.applyChunk(
        SESSION,
        PATH,
        GENERATION_ID,
        rawChunk,
        makeMessage('Hi'),
      );

      expect(onChunk).toHaveBeenCalledExactlyOnceWith(rawChunk);
      expect(service.attach(SESSION, PATH)?.assembledMessage.content).toBe(
        'Hi',
      );
    });

    it('ignores applyChunk for a stale generationId', () => {
      service.register(SESSION, PATH, GENERATION_ID);
      service.applyChunk(
        SESSION,
        PATH,
        'stale-gen',
        {},
        makeMessage('ignored'),
      );
      expect(service.attach(SESSION, PATH)?.assembledMessage.content).toBe('');
    });
  });

  describe('complete', () => {
    it('emits a done terminal event, clears listeners, and removes the registry entry', () => {
      service.register(SESSION, PATH, GENERATION_ID);
      const attachment = service.attach(SESSION, PATH)!;
      const onTerminal = vi.fn();
      attachment.emitter.on('terminal', onTerminal);

      service.complete(SESSION, PATH, GENERATION_ID);

      expect(onTerminal).toHaveBeenCalledExactlyOnceWith({ type: 'done' });
      expect(attachment.emitter.listenerCount('terminal')).toBe(0);
      expect(service.getStatus(SESSION, PATH)).toBeUndefined();
    });
  });

  describe('error', () => {
    it('emits an error terminal event carrying the message when the generation was not stopped', () => {
      service.register(SESSION, PATH, GENERATION_ID);
      const attachment = service.attach(SESSION, PATH)!;
      const onTerminal = vi.fn();
      attachment.emitter.on('terminal', onTerminal);

      service.error(SESSION, PATH, GENERATION_ID, 'boom');

      expect(onTerminal).toHaveBeenCalledExactlyOnceWith({
        type: 'error',
        message: 'boom',
      });
    });

    it('emits a stopped terminal event when abort() marked the entry Stopped first', () => {
      service.register(SESSION, PATH, GENERATION_ID);
      const attachment = service.attach(SESSION, PATH)!;
      const onTerminal = vi.fn();
      attachment.emitter.on('terminal', onTerminal);

      expect(service.abort(SESSION, PATH, GENERATION_ID)).toBe(true);
      service.error(SESSION, PATH, GENERATION_ID);

      expect(onTerminal).toHaveBeenCalledExactlyOnceWith({ type: 'stopped' });
    });
  });

  describe('abort', () => {
    it('returns false when no matching active generation exists', () => {
      expect(service.abort(SESSION, PATH, GENERATION_ID)).toBe(false);
    });

    it('returns false for a generationId that does not match the active one', () => {
      service.register(SESSION, PATH, GENERATION_ID);
      expect(service.abort(SESSION, PATH, 'other-gen')).toBe(false);
    });
  });

  describe('max-duration timeout', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    /*
     * No client action — no disconnect, no explicit Stop — is simulated
     * anywhere in this test: the bound fires purely from elapsed time,
     * which is the point. Disconnecting a completion's response no longer
     * has any effect on the generation (see
     * backend-owned-generation-persistence), so this timer is what now
     * bounds a stalled upstream stream that nothing else terminates.
     */
    it('aborts the entry AbortController once MAX_GENERATION_DURATION_MS elapses while still Active', () => {
      service = new ConversationGenerationService(makeConfigService(1000));
      const abortController = service.register(SESSION, PATH, GENERATION_ID);

      vi.advanceTimersByTime(999);
      expect(abortController.signal.aborted).toBe(false);

      vi.advanceTimersByTime(1);
      expect(abortController.signal.aborted).toBe(true);
    });

    it('falls back to the default duration (30 minutes) when MAX_GENERATION_DURATION_MS is not configured', () => {
      service = new ConversationGenerationService(makeConfigService(undefined));
      const abortController = service.register(SESSION, PATH, GENERATION_ID);

      vi.advanceTimersByTime(30 * 60 * 1000 - 1);
      expect(abortController.signal.aborted).toBe(false);

      vi.advanceTimersByTime(1);
      expect(abortController.signal.aborted).toBe(true);
    });

    it('never fires once the generation completes normally', () => {
      service = new ConversationGenerationService(makeConfigService(1000));
      const abortController = service.register(SESSION, PATH, GENERATION_ID);

      service.complete(SESSION, PATH, GENERATION_ID);
      vi.advanceTimersByTime(1000);

      expect(abortController.signal.aborted).toBe(false);
    });

    it('never fires once the generation errors', () => {
      service = new ConversationGenerationService(makeConfigService(1000));
      const abortController = service.register(SESSION, PATH, GENERATION_ID);

      service.error(SESSION, PATH, GENERATION_ID, 'boom');
      vi.advanceTimersByTime(1000);

      expect(abortController.signal.aborted).toBe(false);
    });

    it('never fires once the generation is stopped by the user', () => {
      service = new ConversationGenerationService(makeConfigService(1000));
      service.register(SESSION, PATH, GENERATION_ID);

      service.abort(SESSION, PATH, GENERATION_ID);
      // abort() already aborts synchronously; advancing time must not
      // trigger a second, redundant abort attempt on a cleared timer.
      expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
    });
  });

  describe('many concurrent attach subscribers', () => {
    it('supports more than the default max-listener count without warning', () => {
      const onWarning = vi.fn();
      process.on('warning', onWarning);
      try {
        service.register(SESSION, PATH, GENERATION_ID);
        const attachment = service.attach(SESSION, PATH)!;
        for (let i = 0; i < 20; i += 1) {
          attachment.emitter.on('chunk', vi.fn());
        }
        service.applyChunk(SESSION, PATH, GENERATION_ID, {}, makeMessage(''));
        expect(onWarning).not.toHaveBeenCalled();
      } finally {
        process.off('warning', onWarning);
      }
    });
  });

  describe('generation memory diagnostics', () => {
    let reader: TestMetricReader;
    let meterProvider: MeterProvider;
    let stopMetrics: () => void;

    beforeEach(() => {
      vi.useFakeTimers();
      reader = new TestMetricReader();
      meterProvider = new MeterProvider({ readers: [reader] });
      stopMetrics = initializeRuntimeMetrics(meterProvider.getMeter('test'));
    });

    afterEach(async () => {
      service.onModuleDestroy();
      stopMetrics();
      await meterProvider.shutdown();
      vi.useRealTimers();
    });

    const collectGenerationCount = async () => {
      const { resourceMetrics } = await reader.collect();
      const dataPoints = resourceMetrics.scopeMetrics.flatMap((scope) =>
        scope.metrics
          .filter(
            (metric) =>
              metric.descriptor.name === 'dial.chat.generations.active',
          )
          .flatMap((metric) => metric.dataPoints),
      );
      expect(dataPoints).toHaveLength(1);
      expect(dataPoints[0].attributes).toEqual({});
      return dataPoints[0].value;
    };

    const getAttachment = (sessionId = SESSION) => {
      const attachment = service.attach(sessionId, PATH);
      if (!attachment) {
        throw new Error('Expected an attachment for the registered generation');
      }
      return attachment;
    };

    it('counts concurrent retained generations until each completes or errors', async () => {
      expect(await collectGenerationCount()).toBe(0);

      service.register(SESSION, PATH, GENERATION_ID);
      service.register('session-2', PATH, 'gen-2');
      expect(await collectGenerationCount()).toBe(2);

      service.complete(SESSION, PATH, GENERATION_ID);
      expect(await collectGenerationCount()).toBe(1);

      service.error('session-2', PATH, 'gen-2', 'upstream failed');
      service.error('session-2', PATH, 'gen-2');
      service.complete(SESSION, PATH, GENERATION_ID);
      expect(await collectGenerationCount()).toBe(0);
    });

    it('does not count conflicting registrations or finish a mismatched generation', async () => {
      service.register(SESSION, PATH, GENERATION_ID);
      expect(() => service.register(SESSION, PATH, 'gen-2')).toThrow(
        ConflictException,
      );
      service.complete(SESSION, PATH, 'gen-2');
      service.error(SESSION, PATH, 'gen-2');

      expect(await collectGenerationCount()).toBe(1);
    });

    it('keeps a stopped generation counted while final persistence is pending', async () => {
      service.register(SESSION, PATH, GENERATION_ID);
      service.abort(SESSION, PATH, GENERATION_ID);

      expect(await collectGenerationCount()).toBe(1);
      service.error(SESSION, PATH, GENERATION_ID);
      expect(await collectGenerationCount()).toBe(0);
    });

    it('keeps a timed-out generation counted until it leaves the registry', async () => {
      service = new ConversationGenerationService(makeConfigService(1000));
      const controller = service.register(SESSION, PATH, GENERATION_ID);
      vi.advanceTimersByTime(1000);

      expect(controller.signal.aborted).toBe(true);
      expect(await collectGenerationCount()).toBe(1);
      service.error(SESSION, PATH, GENERATION_ID);
      expect(await collectGenerationCount()).toBe(0);
    });

    it('does not depend on whether a browser remains attached', async () => {
      service.register(SESSION, PATH, GENERATION_ID);
      const attachment = getAttachment();
      const onChunk = vi.fn();
      attachment.emitter.on('chunk', onChunk);
      attachment.emitter.off('chunk', onChunk);

      expect(await collectGenerationCount()).toBe(1);
    });

    it('stops counting a stale entry when a later registration evicts it', async () => {
      service.register(SESSION, PATH, GENERATION_ID);
      vi.setSystemTime(Date.now() + 30 * 60 * 1000 + 1);

      service.register('session-2', PATH, 'gen-2');

      expect(service.getStatus(SESSION, PATH)).toBeUndefined();
      expect(await collectGenerationCount()).toBe(1);
      service.complete(SESSION, PATH, GENERATION_ID);
      expect(await collectGenerationCount()).toBe(1);
    });

    it('counts a replacement once when a stopped generation is overwritten', async () => {
      service.register(SESSION, PATH, GENERATION_ID);
      service.abort(SESSION, PATH, GENERATION_ID);
      service.register(SESSION, PATH, 'gen-2');

      expect(await collectGenerationCount()).toBe(1);
      service.error(SESSION, PATH, GENERATION_ID);
      expect(await collectGenerationCount()).toBe(1);
      service.complete(SESSION, PATH, 'gen-2');
      expect(await collectGenerationCount()).toBe(0);
    });

    it('releases retained generations, timers, and listeners on module shutdown', async () => {
      const controller = service.register(SESSION, PATH, GENERATION_ID);
      const secondController = service.register('session-2', PATH, 'gen-2');
      service.abort('session-2', PATH, 'gen-2');
      const attachment = getAttachment();
      const onTerminal = vi.fn(() => service.attach(SESSION, PATH));
      const secondOnTerminal = vi.fn();
      attachment.emitter.on('chunk', vi.fn());
      attachment.emitter.on('terminal', onTerminal);
      getAttachment('session-2').emitter.on('terminal', secondOnTerminal);

      service.onModuleDestroy();
      service.onModuleDestroy();

      expect(controller.signal.aborted).toBe(true);
      expect(secondController.signal.aborted).toBe(true);
      expect(onTerminal).toHaveBeenCalledExactlyOnceWith({ type: 'stopped' });
      expect(onTerminal.mock.results[0].value).toBeDefined();
      expect(secondOnTerminal).toHaveBeenCalledExactlyOnceWith({
        type: 'stopped',
      });
      expect(service.attach(SESSION, PATH)).toBeUndefined();
      expect(service.attach('session-2', PATH)).toBeUndefined();
      expect(attachment.emitter.eventNames()).toEqual([]);
      expect(vi.getTimerCount()).toBe(0);
      expect(await collectGenerationCount()).toBe(0);
    });

    it('notifies and cleans up every shutdown attachment even when one subscriber throws', async () => {
      const controller = service.register(SESSION, PATH, GENERATION_ID);
      const secondController = service.register('session-2', PATH, 'gen-2');
      const attachment = getAttachment();
      const secondAttachment = getAttachment('session-2');
      const subscriberError = new Error('Subscriber failed');
      const throwingSubscriber = vi.fn(() => {
        throw subscriberError;
      });
      const healthySubscriber = vi.fn(() =>
        attachment.emitter.listeners('terminal').includes(throwingSubscriber),
      );
      const otherGenerationSubscriber = vi.fn();
      attachment.emitter.once('terminal', throwingSubscriber);
      attachment.emitter.once('terminal', healthySubscriber);
      secondAttachment.emitter.on('terminal', otherGenerationSubscriber);
      const logError = vi
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => {
          /* Assert the failure is logged without emitting expected test noise. */
        });

      try {
        expect(() => service.onModuleDestroy()).not.toThrow();
        service.onModuleDestroy();

        expect(throwingSubscriber).toHaveBeenCalledExactlyOnceWith({
          type: 'stopped',
        });
        expect(healthySubscriber).toHaveBeenCalledExactlyOnceWith({
          type: 'stopped',
        });
        expect(healthySubscriber.mock.results[0].value).toBe(false);
        expect(otherGenerationSubscriber).toHaveBeenCalledExactlyOnceWith({
          type: 'stopped',
        });
        expect(logError).toHaveBeenCalledExactlyOnceWith(
          'Failed to notify generation subscriber during shutdown',
          subscriberError.stack,
        );
        expect(controller.signal.aborted).toBe(true);
        expect(secondController.signal.aborted).toBe(true);
        expect(attachment.emitter.eventNames()).toEqual([]);
        expect(secondAttachment.emitter.eventNames()).toEqual([]);
        expect(service.attach(SESSION, PATH)).toBeUndefined();
        expect(service.attach('session-2', PATH)).toBeUndefined();
        expect(vi.getTimerCount()).toBe(0);
        expect(await collectGenerationCount()).toBe(0);
      } finally {
        logError.mockRestore();
      }
    });
  });
});
