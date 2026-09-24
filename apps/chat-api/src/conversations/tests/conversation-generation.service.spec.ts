import { ConflictException, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import {
  DataPointType,
  MeterProvider,
  MetricReader,
} from '@opentelemetry/sdk-metrics';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../config/environment.config';
import { initializeRuntimeMetrics } from '../../telemetry/runtime-metrics';
import {
  ConversationGenerationService,
  GenerationCancelReason,
  GenerationStatus,
  type GenerationLease,
} from '../conversation-generation.service';
import {
  ConversationMessageDto,
  ConversationMessageRole,
} from '../dto/conversation-message.dto';

/*
 * Opaque principal keys, as `resolvePrincipalKey` produces them — the service
 * never parses them, so their shape matters only to show what it is handed.
 */
const OWNER_KEY = 'c:session-1';
const OTHER_OWNER_KEY = 'h:keycloak:subject-2';
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
  overrides: Partial<EnvironmentVariables> = {},
): ConfigService<EnvironmentVariables> =>
  ({
    get: vi.fn((key: keyof EnvironmentVariables) => overrides[key]),
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
    it('returns a lease carrying an AbortController for a new generation', () => {
      const lease = service.register(OWNER_KEY, PATH, GENERATION_ID);
      expect(lease.abortController).toBeInstanceOf(AbortController);
      expect(service.getStatus(OWNER_KEY, PATH)).toBe(GenerationStatus.Active);
    });

    it('mints a distinct operationId for each registration', () => {
      const first = service.register(OWNER_KEY, PATH, GENERATION_ID);
      service.complete(first);
      const second = service.register(OWNER_KEY, PATH, 'gen-2');
      expect(second.operationId).not.toBe(first.operationId);
    });

    it('throws ConflictException when a generation is already active for the same owner+path', () => {
      service.register(OWNER_KEY, PATH, GENERATION_ID);
      expect(() => service.register(OWNER_KEY, PATH, 'gen-2')).toThrow(
        ConflictException,
      );
    });

    it('seeds an empty placeholder assembled message so an immediate attach is safe', () => {
      service.register(OWNER_KEY, PATH, GENERATION_ID);
      const attachment = service.attach(OWNER_KEY, PATH);
      expect(attachment?.assembledMessage.content).toBe('');
      expect(attachment?.assembledMessage.role).toBe(
        ConversationMessageRole.Assistant,
      );
    });
  });

  describe('owner isolation', () => {
    it('keeps two owner keys on the same path in independent entries', () => {
      const first = service.register(OWNER_KEY, PATH, GENERATION_ID);
      const second = service.register(OTHER_OWNER_KEY, PATH, 'gen-2');

      expect(second.operationId).not.toBe(first.operationId);
      expect(service.getStatus(OWNER_KEY, PATH)).toBe(GenerationStatus.Active);
      expect(service.getStatus(OTHER_OWNER_KEY, PATH)).toBe(
        GenerationStatus.Active,
      );

      service.complete(second);

      expect(service.getStatus(OWNER_KEY, PATH)).toBe(GenerationStatus.Active);
      expect(first.abortController.signal.aborted).toBe(false);
    });

    it('returns false and aborts nothing when abort is called under a non-owning key', () => {
      const lease = service.register(OWNER_KEY, PATH, GENERATION_ID);

      expect(service.abort(OTHER_OWNER_KEY, PATH, GENERATION_ID)).toBe(false);
      expect(lease.abortController.signal.aborted).toBe(false);
      expect(service.getStatus(OWNER_KEY, PATH)).toBe(GenerationStatus.Active);
    });

    it('does not expose another owner’s generation to attach', () => {
      service.register(OWNER_KEY, PATH, GENERATION_ID);

      expect(service.attach(OTHER_OWNER_KEY, PATH)).toBeUndefined();
    });
  });

  describe('attach', () => {
    it('returns undefined when no generation is active for the path', () => {
      expect(service.attach(OWNER_KEY, PATH)).toBeUndefined();
    });

    it('returns undefined after the generation has already finished', () => {
      const lease = service.register(OWNER_KEY, PATH, GENERATION_ID);
      service.complete(lease);
      expect(service.attach(OWNER_KEY, PATH)).toBeUndefined();
    });
  });

  describe('seedAssembledMessage / applyChunk', () => {
    it('applyChunk updates the retained snapshot and emits the raw chunk to attached listeners', () => {
      const lease = service.register(OWNER_KEY, PATH, GENERATION_ID);
      service.seedAssembledMessage(lease, makeMessage(''));

      const attachment = service.attach(OWNER_KEY, PATH)!;
      const onChunk = vi.fn();
      attachment.emitter.on('chunk', onChunk);

      const rawChunk = { choices: [{ delta: { content: 'Hi' } }] };
      service.applyChunk(lease, rawChunk, makeMessage('Hi'));

      expect(onChunk).toHaveBeenCalledExactlyOnceWith(rawChunk);
      expect(service.attach(OWNER_KEY, PATH)?.assembledMessage.content).toBe(
        'Hi',
      );
    });

    it('ignores seedAssembledMessage/applyChunk for a lease whose entry was replaced', () => {
      const staleLease = service.register(OWNER_KEY, PATH, GENERATION_ID);
      service.complete(staleLease);
      service.register(OWNER_KEY, PATH, 'gen-2');

      service.seedAssembledMessage(staleLease, makeMessage('stale'));
      service.applyChunk(staleLease, {}, makeMessage('stale'));

      expect(service.attach(OWNER_KEY, PATH)?.assembledMessage.content).toBe(
        '',
      );
    });
  });

  describe('getCancellation / getAssembledMessage', () => {
    it('reports no cancellation and the current message for an untouched lease', () => {
      const lease = service.register(OWNER_KEY, PATH, GENERATION_ID);
      service.seedAssembledMessage(lease, makeMessage('hello'));

      expect(service.getCancellation(lease)).toEqual({ requested: false });
      expect(service.getAssembledMessage(lease)?.content).toBe('hello');
    });

    it('reports the cancel reason once abort() runs', () => {
      const lease = service.register(OWNER_KEY, PATH, GENERATION_ID);
      service.abort(OWNER_KEY, PATH, GENERATION_ID);

      expect(service.getCancellation(lease)).toEqual({
        requested: true,
        reason: GenerationCancelReason.UserStop,
      });
    });

    it('returns undefined for both once the lease is stale', () => {
      const lease = service.register(OWNER_KEY, PATH, GENERATION_ID);
      service.complete(lease);
      service.register(OWNER_KEY, PATH, 'gen-2');

      expect(service.getCancellation(lease)).toBeUndefined();
      expect(service.getAssembledMessage(lease)).toBeUndefined();
    });
  });

  describe('complete', () => {
    it('emits a done terminal event, clears listeners, and removes the registry entry', () => {
      const lease = service.register(OWNER_KEY, PATH, GENERATION_ID);
      const attachment = service.attach(OWNER_KEY, PATH)!;
      const onTerminal = vi.fn();
      attachment.emitter.on('terminal', onTerminal);

      service.complete(lease);

      expect(onTerminal).toHaveBeenCalledExactlyOnceWith({ type: 'done' });
      expect(attachment.emitter.listenerCount('terminal')).toBe(0);
      expect(service.getStatus(OWNER_KEY, PATH)).toBeUndefined();
    });
  });

  describe('error', () => {
    it('emits an error terminal event carrying the message when no cancellation was requested', () => {
      const lease = service.register(OWNER_KEY, PATH, GENERATION_ID);
      const attachment = service.attach(OWNER_KEY, PATH)!;
      const onTerminal = vi.fn();
      attachment.emitter.on('terminal', onTerminal);

      service.error(lease, 'boom');

      expect(onTerminal).toHaveBeenCalledExactlyOnceWith({
        type: 'error',
        message: 'boom',
      });
    });

    it('emits a stopped terminal event when abort() ran first', () => {
      const lease = service.register(OWNER_KEY, PATH, GENERATION_ID);
      const attachment = service.attach(OWNER_KEY, PATH)!;
      const onTerminal = vi.fn();
      attachment.emitter.on('terminal', onTerminal);

      expect(service.abort(OWNER_KEY, PATH, GENERATION_ID)).toBe(true);
      service.error(lease);

      expect(onTerminal).toHaveBeenCalledExactlyOnceWith({ type: 'stopped' });
    });

    it('emits an error, not stopped, for a stale-expiry cancellation', () => {
      vi.useFakeTimers();
      const lease = service.register(OWNER_KEY, PATH, GENERATION_ID);
      const attachment = service.attach(OWNER_KEY, PATH)!;
      const onTerminal = vi.fn();
      attachment.emitter.on('terminal', onTerminal);

      vi.setSystemTime(Date.now() + 31 * 60 * 1000 + 1000);
      service.register(OTHER_OWNER_KEY, 'another-path', 'gen-2');

      service.error(lease, '');

      expect(onTerminal).toHaveBeenCalledExactlyOnceWith({
        type: 'error',
        message: '',
      });
      vi.useRealTimers();
    });
  });

  describe('abort', () => {
    it('returns false when no matching active generation exists', () => {
      expect(service.abort(OWNER_KEY, PATH, GENERATION_ID)).toBe(false);
    });

    it('returns false for a generationId that does not match the active one', () => {
      service.register(OWNER_KEY, PATH, GENERATION_ID);
      expect(service.abort(OWNER_KEY, PATH, 'other-gen')).toBe(false);
    });
  });

  describe('log redaction', () => {
    const SUBJECT = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    const HEADER_OWNER_KEY = `h:keycloak:${SUBJECT}`;

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    /*
     * Under header authentication the owner half of a registry key is the
     * caller's OIDC subject, so the key must never be logged verbatim
     * (`generation-principal-ownership`).
     */
    it('identifies an expired stale entry by path and digest, never by owner key or subject', () => {
      const warn = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);

      service.register(HEADER_OWNER_KEY, PATH, GENERATION_ID);
      vi.setSystemTime(Date.now() + 31 * 60 * 1000 + 1000);
      /* Any register() sweeps stale entries before doing its own work. */
      service.register(OTHER_OWNER_KEY, 'another-path', 'gen-2');

      expect(warn).toHaveBeenCalledOnce();
      const line = String(warn.mock.calls[0][0]);
      expect(line).toContain('Expiring stale generation entry');
      expect(line).toContain(PATH);
      expect(line).not.toContain(SUBJECT);
      expect(line).not.toContain(HEADER_OWNER_KEY);
      expect(line).not.toContain(`${HEADER_OWNER_KEY}::${PATH}`);
      expect(line).toMatch(/owner=[0-9a-f]{12}\b/);

      warn.mockRestore();
    });

    it('identifies a max-duration abort the same way', () => {
      const warn = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      const timed = new ConversationGenerationService(
        makeConfigService({ MAX_GENERATION_DURATION_MS: 1000 }),
      );

      timed.register(HEADER_OWNER_KEY, PATH, GENERATION_ID);
      vi.advanceTimersByTime(1001);

      expect(warn).toHaveBeenCalledOnce();
      const line = String(warn.mock.calls[0][0]);
      expect(line).toContain('MAX_GENERATION_DURATION_MS');
      expect(line).toContain(PATH);
      expect(line).not.toContain(SUBJECT);
      expect(line).not.toContain(HEADER_OWNER_KEY);
      expect(line).toMatch(/owner=[0-9a-f]{12}\b/);

      timed.onModuleDestroy();
      warn.mockRestore();
    });
  });

  describe('stale expiry cancels, never removes', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('aborts a stale still-running entry without removing it, clearing its timer, or decrementing tracking', async () => {
      const reader = new TestMetricReader();
      const meterProvider = new MeterProvider({ readers: [reader] });
      const stopMetrics = initializeRuntimeMetrics(
        meterProvider.getMeter('test'),
      );

      const timed = new ConversationGenerationService(
        makeConfigService({ MAX_GENERATION_DURATION_MS: 45 * 60 * 1000 }),
      );
      const lease = timed.register(OWNER_KEY, PATH, GENERATION_ID);

      vi.setSystemTime(Date.now() + 46 * 60 * 1000 + 1000);
      /* A later register() from any principal triggers the sweep. */
      timed.register(OTHER_OWNER_KEY, 'another-path', 'gen-2');

      /* Not removed: still owned, still returns 409 for this owner+path. */
      expect(() => timed.register(OWNER_KEY, PATH, 'gen-3')).toThrow(
        ConflictException,
      );
      /* Cancellation was requested and the AbortController was aborted. */
      expect(lease.abortController.signal.aborted).toBe(true);
      expect(timed.getCancellation(lease)).toEqual({
        requested: true,
        reason: GenerationCancelReason.StaleExpiry,
      });
      /* Not double-counted away: the entry is still retained on the gauge. */
      const { resourceMetrics } = await reader.collect();
      const total = resourceMetrics.scopeMetrics
        .flatMap((scope) => scope.metrics)
        .filter(
          (metric) => metric.descriptor.name === 'dial.chat.generations.active',
        )
        .filter((metric) => metric.dataPointType === DataPointType.GAUGE)
        .flatMap((metric) => metric.dataPoints)
        .reduce((sum, point) => sum + point.value, 0);
      expect(total).toBe(2);

      timed.onModuleDestroy();
      stopMetrics();
      await meterProvider.shutdown();
    });

    it('does not re-request cancellation for an entry that already has a reason', () => {
      const lease = service.register(OWNER_KEY, PATH, GENERATION_ID);
      service.abort(OWNER_KEY, PATH, GENERATION_ID);
      const abortSpy = vi.spyOn(lease.abortController, 'abort');

      vi.setSystemTime(Date.now() + 31 * 60 * 1000 + 1000);
      service.register(OTHER_OWNER_KEY, 'another-path', 'gen-2');

      expect(abortSpy).not.toHaveBeenCalled();
    });

    it('leaves the worker to finalize a stale-cancelled entry, releasing it exactly once', () => {
      const lease = service.register(OWNER_KEY, PATH, GENERATION_ID);
      vi.setSystemTime(Date.now() + 31 * 60 * 1000 + 1000);
      service.register(OTHER_OWNER_KEY, 'another-path', 'gen-2');

      expect(lease.abortController.signal.aborted).toBe(true);
      service.error(lease, '');

      expect(service.getStatus(OWNER_KEY, PATH)).toBeUndefined();
      /* A later register for the same owner+path now succeeds. */
      expect(() => service.register(OWNER_KEY, PATH, 'gen-3')).not.toThrow();
    });
  });

  describe('a present entry is always a conflict', () => {
    it('rejects a new registration while a stopped generation’s partial save is still pending', () => {
      const lease = service.register(OWNER_KEY, PATH, GENERATION_ID);
      service.abort(OWNER_KEY, PATH, GENERATION_ID);

      expect(() => service.register(OWNER_KEY, PATH, 'gen-2')).toThrow(
        ConflictException,
      );
      /* The stopped entry keeps its key and its ability to finish its save. */
      expect(service.getStatus(OWNER_KEY, PATH)).toBe(GenerationStatus.Stopped);

      service.error(lease);
      expect(() => service.register(OWNER_KEY, PATH, 'gen-2')).not.toThrow();
    });

    it('rejects a new registration for an entry that is finalizing', () => {
      const lease = service.register(OWNER_KEY, PATH, GENERATION_ID);
      service.beginFinalizing(lease);

      expect(() => service.register(OWNER_KEY, PATH, 'gen-2')).toThrow(
        ConflictException,
      );
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
      service = new ConversationGenerationService(
        makeConfigService({ MAX_GENERATION_DURATION_MS: 1000 }),
      );
      const lease = service.register(OWNER_KEY, PATH, GENERATION_ID);

      vi.advanceTimersByTime(999);
      expect(lease.abortController.signal.aborted).toBe(false);

      vi.advanceTimersByTime(1);
      expect(lease.abortController.signal.aborted).toBe(true);
      expect(service.getCancellation(lease)).toEqual({
        requested: true,
        reason: GenerationCancelReason.MaxDuration,
      });
    });

    it('falls back to the default duration (30 minutes) when MAX_GENERATION_DURATION_MS is not configured', () => {
      service = new ConversationGenerationService(makeConfigService());
      const lease = service.register(OWNER_KEY, PATH, GENERATION_ID);

      vi.advanceTimersByTime(30 * 60 * 1000 - 1);
      expect(lease.abortController.signal.aborted).toBe(false);

      vi.advanceTimersByTime(1);
      expect(lease.abortController.signal.aborted).toBe(true);
    });

    it.each([
      ['below the stale threshold', 10 * 60 * 1000],
      ['equal to the stale threshold floor', 30 * 60 * 1000],
      ['above the stale threshold floor', 45 * 60 * 1000],
    ])(
      'still fires when MAX_GENERATION_DURATION_MS is %s',
      (_label, maxDurationMs) => {
        service = new ConversationGenerationService(
          makeConfigService({ MAX_GENERATION_DURATION_MS: maxDurationMs }),
        );
        const lease = service.register(OWNER_KEY, PATH, GENERATION_ID);

        vi.advanceTimersByTime(maxDurationMs - 1);
        expect(lease.abortController.signal.aborted).toBe(false);

        vi.advanceTimersByTime(1);
        expect(lease.abortController.signal.aborted).toBe(true);
        /* The stale sweep must not have pre-empted this timer. */
        expect(service.getCancellation(lease)?.reason).toBe(
          GenerationCancelReason.MaxDuration,
        );
      },
    );

    it('never fires once the generation completes normally', () => {
      service = new ConversationGenerationService(
        makeConfigService({ MAX_GENERATION_DURATION_MS: 1000 }),
      );
      const lease = service.register(OWNER_KEY, PATH, GENERATION_ID);

      service.complete(lease);
      vi.advanceTimersByTime(1000);

      expect(lease.abortController.signal.aborted).toBe(false);
    });

    it('never fires once the generation errors', () => {
      service = new ConversationGenerationService(
        makeConfigService({ MAX_GENERATION_DURATION_MS: 1000 }),
      );
      const lease = service.register(OWNER_KEY, PATH, GENERATION_ID);

      service.error(lease, 'boom');
      vi.advanceTimersByTime(1000);

      expect(lease.abortController.signal.aborted).toBe(false);
    });

    it('never fires once the generation is stopped by the user', () => {
      service = new ConversationGenerationService(
        makeConfigService({ MAX_GENERATION_DURATION_MS: 1000 }),
      );
      const lease = service.register(OWNER_KEY, PATH, GENERATION_ID);

      service.abort(OWNER_KEY, PATH, GENERATION_ID);
      service.error(lease);
      expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
      expect(lease.abortController.signal.aborted).toBe(true);
    });

    it('cannot abort a later generation that reused the same key and client generationId', () => {
      service = new ConversationGenerationService(
        makeConfigService({ MAX_GENERATION_DURATION_MS: 1000 }),
      );
      const firstLease = service.register(OWNER_KEY, PATH, GENERATION_ID);
      service.complete(firstLease);
      const secondLease = service.register(OWNER_KEY, PATH, GENERATION_ID);

      vi.advanceTimersByTime(1000);

      expect(firstLease.abortController.signal.aborted).toBe(false);
      expect(secondLease.abortController.signal.aborted).toBe(true);
    });
  });

  describe('a throwing terminal listener does not block other listeners or cleanup', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it.each([
      ['complete', (lease: GenerationLease) => service.complete(lease)],
      ['error', (lease: GenerationLease) => service.error(lease, 'boom')],
    ])('for %s', (_label, settle) => {
      const lease = service.register(OWNER_KEY, PATH, GENERATION_ID);
      const attachment = service.attach(OWNER_KEY, PATH)!;
      const subscriberError = new Error('Subscriber failed');
      const throwingSubscriber = vi.fn(() => {
        throw subscriberError;
      });
      const healthySubscriber = vi.fn();
      const disconnectedSubscriber = vi.fn();
      attachment.emitter.on('terminal', throwingSubscriber);
      attachment.emitter.on('terminal', healthySubscriber);
      attachment.emitter.on('terminal', disconnectedSubscriber);
      attachment.emitter.off('terminal', disconnectedSubscriber);
      const logError = vi
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);

      try {
        expect(() => settle(lease)).not.toThrow();

        expect(throwingSubscriber).toHaveBeenCalledOnce();
        expect(healthySubscriber).toHaveBeenCalledOnce();
        expect(disconnectedSubscriber).not.toHaveBeenCalled();
        expect(logError).toHaveBeenCalledExactlyOnceWith(
          'Failed to notify generation subscriber',
          subscriberError.stack,
        );
        expect(attachment.emitter.eventNames()).toEqual([]);
        expect(service.getStatus(OWNER_KEY, PATH)).toBeUndefined();
        expect(vi.getTimerCount()).toBe(0);
      } finally {
        logError.mockRestore();
      }
    });
  });

  describe('many concurrent attach subscribers', () => {
    it('supports more than the default max-listener count without warning', () => {
      const onWarning = vi.fn();
      process.on('warning', onWarning);
      try {
        const lease = service.register(OWNER_KEY, PATH, GENERATION_ID);
        const attachment = service.attach(OWNER_KEY, PATH)!;
        for (let i = 0; i < 20; i += 1) {
          attachment.emitter.on('chunk', vi.fn());
        }
        service.applyChunk(lease, {}, makeMessage(''));
        expect(onWarning).not.toHaveBeenCalled();
      } finally {
        process.off('warning', onWarning);
      }
    });
  });

  describe('finalization bound — subscriber release without ownership release', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('releases subscribers, timer, and tracking on a never-settling write, but retains the registry key', async () => {
      const reader = new TestMetricReader();
      const meterProvider = new MeterProvider({ readers: [reader] });
      const stopMetrics = initializeRuntimeMetrics(
        meterProvider.getMeter('test'),
      );
      const timed = new ConversationGenerationService(
        makeConfigService({ GENERATION_FINALIZE_TIMEOUT_MS: 5000 }),
      );
      const lease = timed.register(OWNER_KEY, PATH, GENERATION_ID);
      const attachment = timed.attach(OWNER_KEY, PATH)!;
      const onTerminal = vi.fn();
      attachment.emitter.on('terminal', onTerminal);

      timed.beginFinalizing(lease);
      vi.advanceTimersByTime(5000);

      expect(onTerminal).toHaveBeenCalledOnce();
      expect(attachment.emitter.eventNames()).toEqual([]);
      expect(vi.getTimerCount()).toBe(0);
      /* Ownership is retained: a new register for this owner+path still 409s. */
      expect(() => timed.register(OWNER_KEY, PATH, 'gen-2')).toThrow(
        ConflictException,
      );

      const { resourceMetrics } = await reader.collect();
      const settling = resourceMetrics.scopeMetrics
        .flatMap((scope) => scope.metrics)
        .find(
          (metric) => metric.descriptor.name === 'dial.chat.generations.active',
        )
        ?.dataPoints.find(
          (point) => point.attributes.state === 'settling',
        )?.value;
      expect(settling).toBe(1);

      /* The real write eventually settles — resolve() calls complete(). */
      timed.complete(lease);
      expect(() => timed.register(OWNER_KEY, PATH, 'gen-2')).not.toThrow();

      timed.onModuleDestroy();
      stopMetrics();
      await meterProvider.shutdown();
    });

    it('does not cancel or duplicate the write when it later succeeds', () => {
      const timed = new ConversationGenerationService(
        makeConfigService({ GENERATION_FINALIZE_TIMEOUT_MS: 5000 }),
      );
      const lease = timed.register(OWNER_KEY, PATH, GENERATION_ID);
      timed.beginFinalizing(lease);
      vi.advanceTimersByTime(5000);

      expect(lease.abortController.signal.aborted).toBe(false);
      timed.complete(lease);
      expect(timed.getStatus(OWNER_KEY, PATH)).toBeUndefined();
      timed.onModuleDestroy();
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
          .filter((metric) => metric.dataPointType === DataPointType.GAUGE)
          .flatMap((metric) => metric.dataPoints),
      );
      expect(dataPoints.length).toBeGreaterThan(0);
      return dataPoints.reduce(
        (sum, point) => sum + (point.value as number),
        0,
      );
    };

    const getAttachment = (ownerKey = OWNER_KEY) => {
      const attachment = service.attach(ownerKey, PATH);
      if (!attachment) {
        throw new Error('Expected an attachment for the registered generation');
      }
      return attachment;
    };

    it('counts concurrent retained generations until each completes or errors', async () => {
      expect(await collectGenerationCount()).toBe(0);

      const first = service.register(OWNER_KEY, PATH, GENERATION_ID);
      const second = service.register(OTHER_OWNER_KEY, PATH, 'gen-2');
      expect(await collectGenerationCount()).toBe(2);

      service.complete(first);
      expect(await collectGenerationCount()).toBe(1);

      service.error(second, 'upstream failed');
      expect(await collectGenerationCount()).toBe(0);
    });

    it('does not count conflicting registrations or finish a stale lease', async () => {
      const lease = service.register(OWNER_KEY, PATH, GENERATION_ID);
      expect(() => service.register(OWNER_KEY, PATH, 'gen-2')).toThrow(
        ConflictException,
      );
      service.complete(lease);
      /* The lease is now stale; re-settling it is a no-op. */
      service.complete(lease);
      service.error(lease);

      expect(await collectGenerationCount()).toBe(0);
    });

    it('keeps a stopped generation counted while final persistence is pending', async () => {
      const lease = service.register(OWNER_KEY, PATH, GENERATION_ID);
      service.abort(OWNER_KEY, PATH, GENERATION_ID);

      expect(await collectGenerationCount()).toBe(1);
      service.error(lease);
      expect(await collectGenerationCount()).toBe(0);
    });

    it('keeps a timed-out generation counted until it leaves the registry', async () => {
      service = new ConversationGenerationService(
        makeConfigService({ MAX_GENERATION_DURATION_MS: 1000 }),
      );
      const lease = service.register(OWNER_KEY, PATH, GENERATION_ID);
      vi.advanceTimersByTime(1000);

      expect(lease.abortController.signal.aborted).toBe(true);
      expect(await collectGenerationCount()).toBe(1);
      service.error(lease);
      expect(await collectGenerationCount()).toBe(0);
    });

    it('does not depend on whether a browser remains attached', async () => {
      service.register(OWNER_KEY, PATH, GENERATION_ID);
      const attachment = getAttachment();
      const onChunk = vi.fn();
      attachment.emitter.on('chunk', onChunk);
      attachment.emitter.off('chunk', onChunk);

      expect(await collectGenerationCount()).toBe(1);
    });

    it('keeps a stale entry counted while its worker is still finalizing', async () => {
      const lease = service.register(OWNER_KEY, PATH, GENERATION_ID);
      vi.setSystemTime(Date.now() + 31 * 60 * 1000 + 1000);

      /* register() for a different owner sweeps but must not remove the entry. */
      service.register(OTHER_OWNER_KEY, 'another-path', 'gen-2');

      expect(service.getStatus(OWNER_KEY, PATH)).toBe(GenerationStatus.Active);
      expect(await collectGenerationCount()).toBe(2);
      service.error(lease, '');
      expect(await collectGenerationCount()).toBe(1);
    });

    it('rejects a registration attempt while a stopped generation’s save is pending, keeping one entry', async () => {
      const lease = service.register(OWNER_KEY, PATH, GENERATION_ID);
      service.abort(OWNER_KEY, PATH, GENERATION_ID);
      expect(() => service.register(OWNER_KEY, PATH, 'gen-2')).toThrow(
        ConflictException,
      );

      expect(await collectGenerationCount()).toBe(1);
      service.error(lease);
      expect(await collectGenerationCount()).toBe(0);
    });

    it('releases retained generations, timers, and listeners on module shutdown', async () => {
      const lease = service.register(OWNER_KEY, PATH, GENERATION_ID);
      const secondLease = service.register(OTHER_OWNER_KEY, PATH, 'gen-2');
      service.abort(OTHER_OWNER_KEY, PATH, 'gen-2');
      const attachment = getAttachment();
      const onTerminal = vi.fn(() => service.attach(OWNER_KEY, PATH));
      const secondOnTerminal = vi.fn();
      attachment.emitter.on('chunk', vi.fn());
      attachment.emitter.on('terminal', onTerminal);
      getAttachment(OTHER_OWNER_KEY).emitter.on('terminal', secondOnTerminal);

      service.onModuleDestroy();
      service.onModuleDestroy();

      expect(lease.abortController.signal.aborted).toBe(true);
      expect(secondLease.abortController.signal.aborted).toBe(true);
      expect(onTerminal).toHaveBeenCalledExactlyOnceWith({ type: 'stopped' });
      expect(onTerminal.mock.results[0].value).toBeDefined();
      expect(secondOnTerminal).toHaveBeenCalledExactlyOnceWith({
        type: 'stopped',
      });
      expect(service.attach(OWNER_KEY, PATH)).toBeUndefined();
      expect(service.attach(OTHER_OWNER_KEY, PATH)).toBeUndefined();
      expect(attachment.emitter.eventNames()).toEqual([]);
      expect(vi.getTimerCount()).toBe(0);
      expect(await collectGenerationCount()).toBe(0);
    });

    it('notifies and cleans up every shutdown attachment even when one subscriber throws', async () => {
      const lease = service.register(OWNER_KEY, PATH, GENERATION_ID);
      const secondLease = service.register(OTHER_OWNER_KEY, PATH, 'gen-2');
      const attachment = getAttachment();
      const secondAttachment = getAttachment(OTHER_OWNER_KEY);
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
          'Failed to notify generation subscriber',
          subscriberError.stack,
        );
        expect(lease.abortController.signal.aborted).toBe(true);
        expect(secondLease.abortController.signal.aborted).toBe(true);
        expect(attachment.emitter.eventNames()).toEqual([]);
        expect(secondAttachment.emitter.eventNames()).toEqual([]);
        expect(service.attach(OWNER_KEY, PATH)).toBeUndefined();
        expect(service.attach(OTHER_OWNER_KEY, PATH)).toBeUndefined();
        expect(vi.getTimerCount()).toBe(0);
        expect(await collectGenerationCount()).toBe(0);
      } finally {
        logError.mockRestore();
      }
    });
  });

  describe('race matrix — overlapping cleanup paths settle an entry exactly once', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it.each([
      [
        'stop then error',
        (lease: GenerationLease) => {
          service.abort(OWNER_KEY, PATH, GENERATION_ID);
          service.error(lease);
        },
      ],
      [
        'expiry then error',
        (lease: GenerationLease) => {
          vi.setSystemTime(Date.now() + 31 * 60 * 1000 + 1000);
          /* Triggers the sweep; settle it too so it doesn't leak into assertions. */
          const sweepTrigger = service.register(
            OTHER_OWNER_KEY,
            'another-path',
            'gen-x',
          );
          service.complete(sweepTrigger);
          service.error(lease, '');
        },
      ],
      [
        'max-duration timeout then error',
        (lease: GenerationLease) => {
          vi.advanceTimersByTime(1000);
          service.error(lease, '');
        },
      ],
      [
        'complete then repeated complete',
        (lease: GenerationLease) => {
          service.complete(lease);
          service.complete(lease);
        },
      ],
      [
        'error then repeated error',
        (lease: GenerationLease) => {
          service.error(lease, 'boom');
          service.error(lease, 'boom');
        },
      ],
      [
        'shutdown after stop',
        (_lease: GenerationLease) => {
          service.abort(OWNER_KEY, PATH, GENERATION_ID);
          service.onModuleDestroy();
        },
      ],
    ])(
      '%s delivers exactly one terminal event and releases once',
      (_label, run) => {
        service = new ConversationGenerationService(
          makeConfigService({ MAX_GENERATION_DURATION_MS: 1000 }),
        );
        const lease = service.register(OWNER_KEY, PATH, GENERATION_ID);
        const attachment = service.attach(OWNER_KEY, PATH)!;
        const onTerminal = vi.fn();
        const disconnected = vi.fn();
        attachment.emitter.on('terminal', onTerminal);
        attachment.emitter.on('terminal', disconnected);
        attachment.emitter.off('terminal', disconnected);

        run(lease);

        expect(onTerminal).toHaveBeenCalledOnce();
        expect(disconnected).not.toHaveBeenCalled();
        expect(service.getStatus(OWNER_KEY, PATH)).toBeUndefined();
        expect(vi.getTimerCount()).toBe(0);
        service.onModuleDestroy();
      },
    );

    it('a late callback from a generation whose client generationId was reused by a new one is a no-op', () => {
      const firstLease = service.register(OWNER_KEY, PATH, GENERATION_ID);
      service.complete(firstLease);
      const secondLease = service.register(OWNER_KEY, PATH, GENERATION_ID);
      const attachment = service.attach(OWNER_KEY, PATH)!;
      const onTerminal = vi.fn();
      attachment.emitter.on('terminal', onTerminal);

      /* The old lease's late callbacks must never touch the replacement. */
      service.complete(firstLease);
      service.error(firstLease, 'late');
      service.seedAssembledMessage(firstLease, makeMessage('late'));
      service.applyChunk(firstLease, {}, makeMessage('late'));

      expect(onTerminal).not.toHaveBeenCalled();
      expect(service.getStatus(OWNER_KEY, PATH)).toBe(GenerationStatus.Active);
      expect(service.attach(OWNER_KEY, PATH)?.assembledMessage.content).toBe(
        '',
      );

      service.complete(secondLease);
    });
  });
});
