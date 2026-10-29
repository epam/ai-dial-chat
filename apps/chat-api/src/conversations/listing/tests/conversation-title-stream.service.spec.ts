import { EventEmitter } from 'node:events';
import {
  BadGatewayException,
  HttpException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SSE_DRAIN_TIMEOUT_MS } from '../../../common/utils/sse';
import {
  ConversationTitleResultOutcome,
  recordConversationTitleFirstResult,
  recordConversationTitleResult,
} from '../../../telemetry/conversation-title-metrics';
import { trackSseSubscription } from '../../../telemetry/runtime-metrics';
import { ConversationTitleQueueUnavailableException } from '../conversation-title-cache.service';
import {
  CONVERSATION_TITLE_STREAM_ADMISSION_MS,
  CONVERSATION_TITLE_STREAM_KEEPALIVE_MS,
  CONVERSATION_TITLE_STREAM_LIFETIME_MS,
  CONVERSATION_TITLE_STREAM_MAX_ACTIVE,
  CONVERSATION_TITLE_STREAM_MAX_PENDING_ITEMS,
  ConversationTitleStreamService,
} from '../conversation-title-stream.service';
import {
  ConversationTitleOutcome,
  ConversationTitleOutcomeKind,
  type ConversationTitlesService,
} from '../conversation-titles.service';

vi.mock('../../../telemetry/conversation-title-metrics', async (actual) => ({
  ...(await actual<
    typeof import('../../../telemetry/conversation-title-metrics')
  >()),
  recordConversationTitleFirstResult: vi.fn(),
  recordConversationTitleResult: vi.fn(),
}));
vi.mock('../../../telemetry/runtime-metrics', async (actual) => {
  const module =
    await actual<typeof import('../../../telemetry/runtime-metrics')>();
  return {
    ...module,
    trackSseSubscription: vi.fn(module.trackSseSubscription),
  };
});

/** A `Response`-shaped emitter whose writes can be made to report backpressure. */
class FakeStreamResponse extends EventEmitter {
  writableEnded = false;
  destroyed = false;
  isBackpressured = false;
  setHeader = vi.fn();
  flushHeaders = vi.fn();
  write = vi.fn(() => !this.isBackpressured);
  end = vi.fn(() => {
    this.writableEnded = true;
    return this;
  });
  destroy = vi.fn(() => {
    this.destroyed = true;
    this.emit('close');
    return this;
  });

  get chunks(): string[] {
    return this.write.mock.calls.map((call: unknown[]) => String(call[0]));
  }

  get events(): Array<Record<string, unknown>> {
    return this.chunks
      .filter((chunk) => chunk.startsWith('data: '))
      .map((chunk) => JSON.parse(chunk.slice('data: '.length)));
  }
}

interface PendingRead {
  resolve: (outcome: ConversationTitleOutcome) => void;
  signal: AbortSignal;
}

const idAt = (index: number) => `conversations/bucket/gpt-4o__Chat${index}`;
const ids = (count: number) => Array.from({ length: count }, (_, i) => idAt(i));
const title = (value: string): ConversationTitleOutcome => ({
  kind: ConversationTitleOutcomeKind.Title,
  title: value,
});
const failed = (
  failure: HttpException,
  isTimeout = false,
): ConversationTitleOutcome => ({
  kind: ConversationTitleOutcomeKind.Failed,
  failure,
  isTimeout,
});
const flush = () => vi.advanceTimersByTimeAsync(0);

describe('ConversationTitleStreamService', () => {
  let reads: Map<string, PendingRead>;
  let resolveTitle: ReturnType<typeof vi.fn>;
  let service: ConversationTitleStreamService;
  let res: FakeStreamResponse;

  const run = (requested: string[]) => {
    const admission = service.admit(requested);
    const release = vi.spyOn(admission, 'release');
    const done = service.streamTitles(
      admission,
      'token',
      res as unknown as Response,
    );
    return { done, release };
  };
  const settle = async (index: number, outcome: ConversationTitleOutcome) => {
    reads.get(idAt(index))?.resolve(outcome);
    await flush();
  };
  const activeReads = () =>
    [...reads.values()].filter((read) => !read.signal.aborted).length;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    reads = new Map();
    resolveTitle = vi.fn(
      (
        resource: { requestedId: string },
        _token: string,
        signal: AbortSignal,
      ) =>
        new Promise<ConversationTitleOutcome>((resolve, reject) => {
          reads.set(resource.requestedId, { resolve, signal });
          signal.addEventListener(
            'abort',
            () => reject(new DOMException('cancelled', 'AbortError')),
            { once: true },
          );
        }),
    );
    service = new ConversationTitleStreamService({
      resolveTitle,
    } as unknown as ConversationTitlesService);
    res = new FakeStreamResponse();
  });

  afterEach(() => vi.useRealTimers());

  it('writes a fast title while a slow peer is unresolved and refills the freed slot', async () => {
    const requested = ids(CONVERSATION_TITLE_STREAM_MAX_PENDING_ITEMS + 1);
    const { done } = run(requested);
    await flush();
    expect(res.chunks[0]).toBe(': init\n\n');
    expect(resolveTitle).toHaveBeenCalledTimes(
      CONVERSATION_TITLE_STREAM_MAX_PENDING_ITEMS,
    );

    await settle(1, title('Fast'));
    expect(res.events).toEqual([{ type: 'title', id: idAt(1), title: 'Fast' }]);
    expect(resolveTitle).toHaveBeenCalledTimes(
      CONVERSATION_TITLE_STREAM_MAX_PENDING_ITEMS + 1,
    );
    expect(reads.get(idAt(0))?.signal.aborted).toBe(false);

    for (const [index] of requested.entries()) {
      if (index !== 1) await settle(index, title(`T${index}`));
    }
    await done;
    expect(res.events.at(-1)).toEqual({
      type: 'done',
      reason: 'complete',
      processed: requested.length,
      total: requested.length,
    });
    expect(res.end).toHaveBeenCalledOnce();
  });

  it('never starts every queued ID eagerly', async () => {
    const { done } = run(ids(500));
    await flush();
    expect(resolveTitle).toHaveBeenCalledTimes(
      CONVERSATION_TITLE_STREAM_MAX_PENDING_ITEMS,
    );
    res.emit('close');
    await done;
  });

  it('reports one outcome per distinct ID and counts every outcome kind', async () => {
    const { done } = run([idAt(0), idAt(1), idAt(0), idAt(2)]);
    await flush();
    expect(resolveTitle).toHaveBeenCalledTimes(3);
    await settle(2, { kind: ConversationTitleOutcomeKind.Unavailable });
    await settle(1, failed(new BadGatewayException()));
    await settle(0, title('Named'));
    await done;
    expect(res.events).toEqual([
      { type: 'unavailable', id: idAt(2) },
      { type: 'item_error', id: idAt(1), code: 'upstream_error' },
      { type: 'title', id: idAt(0), title: 'Named' },
      { type: 'done', reason: 'complete', processed: 3, total: 3 },
    ]);
  });

  it('maps a per-read timeout to an item timeout outcome', async () => {
    const { done } = run([idAt(0)]);
    await flush();
    await settle(0, failed(new ServiceUnavailableException(), true));
    await done;
    expect(res.events[0]).toEqual({
      type: 'item_error',
      id: idAt(0),
      code: 'timeout',
    });
  });

  it.each([
    {
      name: 'Core rejects the session',
      outcome: failed(new UnauthorizedException()),
      error: { type: 'error', status: 401, code: 'unauthenticated' },
    },
    {
      name: 'Core rate limits title reads',
      outcome: failed(new HttpException('limited', 429)),
      error: { type: 'error', status: 503, code: 'unavailable' },
    },
    {
      name: 'the read queue is unavailable',
      outcome: failed(new ConversationTitleQueueUnavailableException()),
      error: { type: 'error', status: 503, code: 'unavailable' },
    },
  ])(
    'terminates without done and cancels owned reads when $name',
    async ({ outcome, error }) => {
      const { done } = run(ids(3));
      await flush();
      await settle(0, title('Kept'));
      await settle(1, outcome);
      await done;
      expect(res.events).toEqual([
        { type: 'title', id: idAt(0), title: 'Kept' },
        error,
      ]);
      expect(reads.get(idAt(2))?.signal.aborted).toBe(true);
      expect(res.end).toHaveBeenCalledOnce();
    },
  );

  it('terminates after five consecutive upstream failures', async () => {
    const { done } = run(ids(7));
    await flush();
    for (let index = 0; index < 5; index++) {
      await settle(index, failed(new BadGatewayException()));
    }
    await done;
    const events = res.events;
    expect(events.filter((event) => event.type === 'item_error')).toHaveLength(
      5,
    );
    expect(events.at(-1)).toEqual({
      type: 'error',
      status: 502,
      code: 'upstream_error',
    });
    expect(reads.get(idAt(5))?.signal.aborted).toBe(true);
  });

  it('resets the failure streak after a successful read', async () => {
    const { done } = run(ids(9));
    await flush();
    for (let index = 0; index < 4; index++) {
      await settle(index, failed(new BadGatewayException()));
    }
    await settle(4, title('Recovered'));
    for (let index = 5; index < 9; index++) {
      await settle(index, failed(new BadGatewayException()));
    }
    await done;
    expect(res.events.at(-1)).toMatchObject({
      type: 'done',
      reason: 'complete',
      processed: 9,
    });
  });

  it('keeps missing resources from counting as upstream failures', async () => {
    const { done } = run(ids(6));
    await flush();
    for (let index = 0; index < 6; index++) {
      await settle(index, { kind: ConversationTitleOutcomeKind.Unavailable });
    }
    await done;
    expect(res.events.at(-1)).toMatchObject({ type: 'done', processed: 6 });
  });

  it('pauses admission under backpressure and detaches a stalled receiver', async () => {
    const requested = ids(CONVERSATION_TITLE_STREAM_MAX_PENDING_ITEMS + 5);
    const { done, release } = run(requested);
    await flush();
    res.isBackpressured = true;
    for (
      let index = 0;
      index < CONVERSATION_TITLE_STREAM_MAX_PENDING_ITEMS;
      index++
    ) {
      await settle(index, title(`T${index}`));
    }
    /* Outcomes wait in the bounded buffer; no further ID is admitted. */
    expect(resolveTitle).toHaveBeenCalledTimes(
      CONVERSATION_TITLE_STREAM_MAX_PENDING_ITEMS,
    );
    expect(res.events).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(SSE_DRAIN_TIMEOUT_MS);
    await done;
    expect(res.destroy).toHaveBeenCalledOnce();
    expect(res.end).not.toHaveBeenCalled();
    expect(res.events.some((event) => event.type === 'done')).toBe(false);
    expect(resolveTitle).toHaveBeenCalledTimes(
      CONVERSATION_TITLE_STREAM_MAX_PENDING_ITEMS,
    );
    expect(release).toHaveBeenCalledOnce();
  });

  it('resumes after the receiver drains', async () => {
    const { done } = run(ids(2));
    await flush();
    res.isBackpressured = true;
    await settle(0, title('First'));
    res.isBackpressured = false;
    res.emit('drain');
    await settle(1, title('Second'));
    await done;
    expect(res.events.at(-1)).toMatchObject({ type: 'done', processed: 2 });
  });

  it('stops admitting at the admission window and reports a budget terminal', async () => {
    const requested = ids(CONVERSATION_TITLE_STREAM_MAX_PENDING_ITEMS + 10);
    const { done } = run(requested);
    await flush();
    await vi.advanceTimersByTimeAsync(CONVERSATION_TITLE_STREAM_ADMISSION_MS);
    await settle(0, title('Admitted'));
    expect(resolveTitle).toHaveBeenCalledTimes(
      CONVERSATION_TITLE_STREAM_MAX_PENDING_ITEMS,
    );
    for (
      let index = 1;
      index < CONVERSATION_TITLE_STREAM_MAX_PENDING_ITEMS;
      index++
    ) {
      await settle(index, title(`T${index}`));
    }
    await done;
    expect(res.events.at(-1)).toEqual({
      type: 'done',
      reason: 'budget',
      processed: CONVERSATION_TITLE_STREAM_MAX_PENDING_ITEMS,
      total: requested.length,
    });
  });

  it('times out admitted reads at the hard deadline and cancels them', async () => {
    const { done } = run(ids(3));
    await flush();
    await settle(0, title('Done in time'));
    await vi.advanceTimersByTimeAsync(CONVERSATION_TITLE_STREAM_LIFETIME_MS);
    await done;
    expect(res.events).toEqual([
      { type: 'title', id: idAt(0), title: 'Done in time' },
      { type: 'item_error', id: idAt(1), code: 'timeout' },
      { type: 'item_error', id: idAt(2), code: 'timeout' },
      { type: 'done', reason: 'budget', processed: 3, total: 3 },
    ]);
    expect(reads.get(idAt(1))?.signal.aborted).toBe(true);
  });

  it('reports unavailability instead of a budget when no read settled before the deadline', async () => {
    const { done } = run(ids(2));
    await flush();
    await vi.advanceTimersByTimeAsync(CONVERSATION_TITLE_STREAM_LIFETIME_MS);
    await done;
    expect(res.events.at(-1)).toEqual({
      type: 'error',
      status: 503,
      code: 'unavailable',
    });
  });

  it('writes keepalives through the same writer while reads are pending', async () => {
    const { done } = run(ids(1));
    await flush();
    await vi.advanceTimersByTimeAsync(CONVERSATION_TITLE_STREAM_KEEPALIVE_MS);
    expect(res.chunks).toContain(': keepalive\n\n');
    await settle(0, title('After keepalive'));
    await done;
  });

  it('cancels owned work and releases the admission once when the client closes', async () => {
    const { done, release } = run(ids(30));
    await flush();
    res.emit('close');
    res.emit('close');
    await done;
    expect(activeReads()).toBe(0);
    expect(resolveTitle).toHaveBeenCalledTimes(
      CONVERSATION_TITLE_STREAM_MAX_PENDING_ITEMS,
    );
    expect(res.events).toEqual([]);
    expect(release).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(CONVERSATION_TITLE_STREAM_LIFETIME_MS);
    expect(resolveTitle).toHaveBeenCalledTimes(
      CONVERSATION_TITLE_STREAM_MAX_PENDING_ITEMS,
    );
  });

  describe('admission', () => {
    it('rejects an oversized serialized ID array with 413', () => {
      const long = `conversations/bucket/${'a'.repeat(4000)}`;
      expect(() =>
        service.admit(Array.from({ length: 70 }, (_, i) => `${long}${i}`)),
      ).toThrow(expect.objectContaining({ status: 413 }));
    });

    it('rejects streams beyond the process capacity with 503 until one is released', () => {
      const admissions = Array.from(
        { length: CONVERSATION_TITLE_STREAM_MAX_ACTIVE },
        () => service.admit([idAt(0)]),
      );
      expect(() => service.admit([idAt(0)])).toThrow(
        ServiceUnavailableException,
      );
      admissions[0].release();
      admissions[0].release();
      expect(() => service.admit([idAt(0)])).not.toThrow();
      expect(() => service.admit([idAt(0)])).toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('metrics', () => {
    it('records first-result latency once, at the first written title', async () => {
      const { done } = run(ids(3));
      await flush();
      await settle(0, { kind: ConversationTitleOutcomeKind.Unavailable });
      expect(recordConversationTitleFirstResult).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(250);
      await settle(1, title('First'));
      await settle(2, title('Second'));
      await done;
      expect(recordConversationTitleFirstResult).toHaveBeenCalledOnce();
      expect(recordConversationTitleFirstResult).toHaveBeenCalledWith(
        expect.closeTo(0.25, 1),
      );
      expect(vi.mocked(recordConversationTitleResult).mock.calls).toEqual([
        [ConversationTitleResultOutcome.Unavailable],
        [ConversationTitleResultOutcome.Resolved],
        [ConversationTitleResultOutcome.Resolved],
      ]);
    });

    it('records no first result for a stream without titles', async () => {
      const { done } = run(ids(2));
      await flush();
      await settle(0, { kind: ConversationTitleOutcomeKind.Unavailable });
      await settle(1, failed(new BadGatewayException()));
      await done;
      expect(recordConversationTitleFirstResult).not.toHaveBeenCalled();
      expect(vi.mocked(recordConversationTitleResult).mock.calls).toEqual([
        [ConversationTitleResultOutcome.Unavailable],
        [ConversationTitleResultOutcome.Failed],
      ]);
    });

    it('counts only outcomes the writer accepted, not ones dropped by a disconnect', async () => {
      const { done } = run(ids(2));
      await flush();
      res.emit('close');
      await settle(0, title('Late'));
      await done;
      expect(recordConversationTitleResult).not.toHaveBeenCalled();
      expect(recordConversationTitleFirstResult).not.toHaveBeenCalled();
    });

    it('keeps the stream in the SSE gauge until cleanup settles, and releases it once', async () => {
      const finish = vi.fn();
      vi.mocked(trackSseSubscription).mockReturnValueOnce(finish);
      const admission = service.admit(ids(1));
      expect(trackSseSubscription).toHaveBeenCalledWith('conversation_titles');
      const done = service.streamTitles(
        admission,
        'token',
        res as unknown as Response,
      );
      await flush();
      res.emit('close');
      res.emit('close');
      expect(finish).not.toHaveBeenCalled();
      await done;
      admission.release();
      expect(finish).toHaveBeenCalledOnce();
    });
  });
});
