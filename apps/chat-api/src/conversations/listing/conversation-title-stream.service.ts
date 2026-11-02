import {
  BadRequestException,
  Injectable,
  Logger,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  SSE_DRAIN_TIMEOUT_MS,
  SSE_KEEPALIVE_PAYLOAD,
  startSseResponse,
  waitForDrain,
  writeSseChunk,
} from '../../common/utils/sse';
import {
  ConversationTitleResultOutcome,
  recordConversationTitleFirstResult,
  recordConversationTitleResult,
  secondsSince,
} from '../../telemetry/conversation-title-metrics';
import {
  SseSubscriptionKind,
  trackSseSubscription,
} from '../../telemetry/runtime-metrics';
import {
  CONVERSATION_TITLE_STREAM_MAX_ID_BYTES,
  ConversationTitleStreamDoneReason,
  ConversationTitleStreamErrorCode,
  ConversationTitleStreamEventDto,
  ConversationTitleStreamEventType,
  ConversationTitleStreamItemErrorCode,
} from '../dto/stream-conversation-titles.dto';
import { parseConversationResourceId } from '../utils/conversation-resource-id';
import { ConversationTitleQueueUnavailableException } from './conversation-title-cache.service';
import {
  ConversationTitleOutcome,
  ConversationTitleOutcomeKind,
  ConversationTitleResource,
  ConversationTitlesService,
} from './conversation-titles.service';

/** Title streams retained per process, including setup and cleanup. */
export const CONVERSATION_TITLE_STREAM_MAX_ACTIVE = 16;
/**
 * Items in flight plus outcomes waiting for the writer, per stream. Actual
 * Core reads are additionally bounded process-wide by the title cache gate.
 */
export const CONVERSATION_TITLE_STREAM_MAX_PENDING_ITEMS = 25;
/** After this, no new ID is admitted; admitted work drains. */
export const CONVERSATION_TITLE_STREAM_ADMISSION_MS = 45_000;
/** Hard lifetime; outstanding items become `timeout` outcomes. */
export const CONVERSATION_TITLE_STREAM_LIFETIME_MS = 60_000;
export const CONVERSATION_TITLE_STREAM_MAX_FRAME_BYTES = 64 * 1024;
export const CONVERSATION_TITLE_STREAM_MAX_CONSECUTIVE_FAILURES = 5;
export const CONVERSATION_TITLE_STREAM_KEEPALIVE_MS = 15_000;

type StreamFatal = Extract<
  ConversationTitleStreamEventDto,
  { type: ConversationTitleStreamEventType.Error }
>;

const FATAL_UNAUTHENTICATED: StreamFatal = {
  type: ConversationTitleStreamEventType.Error,
  status: 401,
  code: ConversationTitleStreamErrorCode.Unauthenticated,
};
const FATAL_UNAVAILABLE: StreamFatal = {
  type: ConversationTitleStreamEventType.Error,
  status: 503,
  code: ConversationTitleStreamErrorCode.Unavailable,
};
const FATAL_UPSTREAM: StreamFatal = {
  type: ConversationTitleStreamEventType.Error,
  status: 502,
  code: ConversationTitleStreamErrorCode.UpstreamError,
};

const RESULT_OUTCOME_BY_TYPE: Partial<
  Record<ConversationTitleStreamEventType, ConversationTitleResultOutcome>
> = {
  [ConversationTitleStreamEventType.Title]:
    ConversationTitleResultOutcome.Resolved,
  [ConversationTitleStreamEventType.Unavailable]:
    ConversationTitleResultOutcome.Unavailable,
  [ConversationTitleStreamEventType.ItemError]:
    ConversationTitleResultOutcome.Failed,
};

/** An item outcome frame waiting for the writer. */
interface ReadyOutcome {
  frame: string;
  outcome: ConversationTitleResultOutcome;
}

const toFrame = (event: ConversationTitleStreamEventDto): string =>
  `data: ${JSON.stringify(event)}\n\n`;

type ConversationTitleStreamResource = ConversationTitleResource & {
  requestedId: string;
};

/** A stream that passed pre-header admission and owns a capacity slot. */
export interface ConversationTitleStreamAdmission {
  resources: ConversationTitleStreamResource[];
  /** `performance.now()` at admission, the origin of first-result latency. */
  admittedAt: number;
  /** Releases the capacity slot; idempotent. */
  release: () => void;
}

/**
 * Streams conversation titles over SSE as each read settles. One request owns
 * a finite ID queue, admits the next ID whenever an item outcome is written,
 * and serializes every frame through a single writer, so a fast title never
 * waits for a slower peer and output never outgrows a fixed number of items.
 */
@Injectable()
export class ConversationTitleStreamService {
  private readonly logger = new Logger(ConversationTitleStreamService.name);
  private activeStreams = 0;

  constructor(private readonly titlesService: ConversationTitlesService) {}

  /**
   * Pre-header checks: input byte bound (413) and stream capacity (503).
   * `ids` already passed DTO validation for count and resource-URL shape.
   */
  admit(ids: string[]): ConversationTitleStreamAdmission {
    if (
      Buffer.byteLength(JSON.stringify(ids), 'utf8') >
      CONVERSATION_TITLE_STREAM_MAX_ID_BYTES
    ) {
      throw new PayloadTooLargeException(
        'Conversation title stream request is too large',
      );
    }
    const resources = [...new Set(ids)].map((requestedId) => {
      const resource = parseConversationResourceId(requestedId);
      if (!resource) {
        throw new BadRequestException('Invalid conversation resource URL');
      }
      return { ...resource, requestedId };
    });
    if (this.activeStreams >= CONVERSATION_TITLE_STREAM_MAX_ACTIVE) {
      throw new ServiceUnavailableException(
        'Too many concurrent conversation title streams',
      );
    }
    this.activeStreams++;
    /* Counted from admission until request-owned cleanup releases it. */
    const finishTracking = trackSseSubscription(
      SseSubscriptionKind.ConversationTitles,
    );
    let isReleased = false;
    return {
      resources,
      admittedAt: performance.now(),
      release: () => {
        if (isReleased) return;
        isReleased = true;
        this.activeStreams--;
        finishTracking();
      },
    };
  }

  /**
   * Opens SSE on `res` and runs the stream to a terminal frame, an
   * interruption, or client closure. Resolves only after request-owned work
   * has settled, then releases the admission.
   */
  async streamTitles(
    admission: ConversationTitleStreamAdmission,
    token: string,
    res: Response,
  ): Promise<void> {
    const { resources } = admission;
    const startedAt = Date.now();
    /* Ownership of this request's shared title reads. */
    const ownership = new AbortController();
    const connection = new AbortController();
    /* Admitted IDs whose outcome is not yet known. */
    const inFlight = new Set<string>();
    const tasks = new Set<Promise<void>>();
    /* Item outcome frames waiting for the single writer. */
    const ready: ReadyOutcome[] = [];
    let isFirstTitleRecorded = false;
    let next = 0;
    /* Admitted items until their outcome is written or discarded. */
    let pending = 0;
    let processed = 0;
    /* Outcomes manufactured by the hard deadline rather than by a read. */
    let deadlineTimeouts = 0;
    let consecutiveFailures = 0;
    let fatal: StreamFatal | undefined;
    let isAdmissionOpen = true;
    let isPastDeadline = false;
    let isKeepaliveDue = false;
    let wake: (() => void) | undefined;

    const notify = () => {
      const resume = wake;
      wake = undefined;
      resume?.();
    };

    const settle = (id: string, event: ConversationTitleStreamEventDto) => {
      if (!inFlight.delete(id)) return;
      const frame = toFrame(event);
      if (
        Buffer.byteLength(frame, 'utf8') <=
        CONVERSATION_TITLE_STREAM_MAX_FRAME_BYTES
      ) {
        ready.push({
          frame,
          outcome:
            RESULT_OUTCOME_BY_TYPE[event.type] ??
            ConversationTitleResultOutcome.Failed,
        });
        return;
      }
      ready.push({
        frame: toFrame({
          type: ConversationTitleStreamEventType.ItemError,
          id,
          code: ConversationTitleStreamItemErrorCode.UpstreamError,
        }),
        outcome: ConversationTitleResultOutcome.Failed,
      });
    };

    const discard = (id: string) => {
      if (inFlight.delete(id)) pending--;
    };

    const classify = (
      id: string,
      outcome: ConversationTitleOutcome,
    ): ConversationTitleStreamEventDto | undefined => {
      if (outcome.kind === ConversationTitleOutcomeKind.Title) {
        consecutiveFailures = 0;
        return {
          type: ConversationTitleStreamEventType.Title,
          id,
          title: outcome.title,
        };
      }
      if (outcome.kind === ConversationTitleOutcomeKind.Unavailable) {
        return { type: ConversationTitleStreamEventType.Unavailable, id };
      }
      const { failure, isTimeout } = outcome;
      if (failure instanceof UnauthorizedException) {
        fatal = FATAL_UNAUTHENTICATED;
        return undefined;
      }
      if (
        failure.getStatus() === 429 ||
        failure instanceof ConversationTitleQueueUnavailableException
      ) {
        fatal = FATAL_UNAVAILABLE;
        return undefined;
      }
      consecutiveFailures++;
      if (
        consecutiveFailures >=
        CONVERSATION_TITLE_STREAM_MAX_CONSECUTIVE_FAILURES
      ) {
        fatal =
          isTimeout || failure instanceof ServiceUnavailableException
            ? FATAL_UNAVAILABLE
            : FATAL_UPSTREAM;
      }
      return {
        type: ConversationTitleStreamEventType.ItemError,
        id,
        code: isTimeout
          ? ConversationTitleStreamItemErrorCode.Timeout
          : ConversationTitleStreamItemErrorCode.UpstreamError,
      };
    };

    const start = (resource: ConversationTitleStreamResource) => {
      const id = resource.requestedId;
      pending++;
      inFlight.add(id);
      const task = (async () => {
        let event: ConversationTitleStreamEventDto | undefined;
        try {
          const outcome = await this.titlesService.resolveTitle(
            resource,
            token,
            ownership.signal,
          );
          if (inFlight.has(id) && !fatal) event = classify(id, outcome);
        } catch {
          /* Only ownership cancellation rejects; the outcome is discarded. */
        }
        if (event) settle(id, event);
        else discard(id);
        /* A fatal failure cancels every read still owned by this stream. */
        if (fatal) ownership.abort();
        notify();
      })();
      tasks.add(task);
      void task.finally(() => tasks.delete(task));
    };

    const admitWork = () => {
      while (
        isAdmissionOpen &&
        !fatal &&
        !connection.signal.aborted &&
        next < resources.length &&
        pending < CONVERSATION_TITLE_STREAM_MAX_PENDING_ITEMS
      ) {
        start(resources[next++]);
      }
    };

    /* Resolves false when the receiver is gone, stalled, or out of time. */
    const write = async (chunk: string): Promise<boolean> => {
      if (connection.signal.aborted) return false;
      const { written, needsDrain } = writeSseChunk(res, chunk);
      if (!written) return false;
      if (!needsDrain) return true;
      const remaining =
        CONVERSATION_TITLE_STREAM_LIFETIME_MS - (Date.now() - startedAt);
      if (remaining <= 0) return false;
      const drain = await waitForDrain(
        res,
        connection.signal,
        Math.min(SSE_DRAIN_TIMEOUT_MS, remaining),
      );
      return drain === 'drained';
    };

    const terminalEvent = (): ConversationTitleStreamEventDto | undefined => {
      if (fatal) return fatal;
      const isDrained =
        pending === 0 && (next >= resources.length || !isAdmissionOpen);
      if (!isDrained) return undefined;
      /* No read settled within the budget: a continuation would only stall again. */
      if (processed === deadlineTimeouts) return FATAL_UNAVAILABLE;
      return {
        type: ConversationTitleStreamEventType.Done,
        reason:
          processed === resources.length && !isPastDeadline
            ? ConversationTitleStreamDoneReason.Complete
            : ConversationTitleStreamDoneReason.Budget,
        processed,
        total: resources.length,
      };
    };

    const handleClose = () => {
      connection.abort();
      ownership.abort();
      notify();
    };
    res.on('close', handleClose);

    const admissionTimer = setTimeout(() => {
      isAdmissionOpen = false;
      notify();
    }, CONVERSATION_TITLE_STREAM_ADMISSION_MS);
    const deadlineTimer = setTimeout(() => {
      isPastDeadline = true;
      isAdmissionOpen = false;
      for (const id of [...inFlight]) {
        deadlineTimeouts++;
        settle(id, {
          type: ConversationTitleStreamEventType.ItemError,
          id,
          code: ConversationTitleStreamItemErrorCode.Timeout,
        });
      }
      ownership.abort();
      notify();
    }, CONVERSATION_TITLE_STREAM_LIFETIME_MS);
    const keepaliveTimer = setInterval(() => {
      isKeepaliveDue = true;
      notify();
    }, CONVERSATION_TITLE_STREAM_KEEPALIVE_MS);

    let isInterrupted = false;
    try {
      startSseResponse(res);
      for (;;) {
        admitWork();
        if (connection.signal.aborted) {
          isInterrupted = true;
          break;
        }
        const outcome = ready.shift();
        if (outcome !== undefined) {
          if (!(await write(outcome.frame))) {
            isInterrupted = true;
            break;
          }
          processed++;
          pending--;
          recordConversationTitleResult(outcome.outcome);
          if (
            outcome.outcome === ConversationTitleResultOutcome.Resolved &&
            !isFirstTitleRecorded
          ) {
            isFirstTitleRecorded = true;
            recordConversationTitleFirstResult(
              secondsSince(admission.admittedAt),
            );
          }
          continue;
        }
        const terminal = terminalEvent();
        if (terminal) {
          if (!(await write(toFrame(terminal)))) isInterrupted = true;
          break;
        }
        if (isKeepaliveDue) {
          isKeepaliveDue = false;
          if (!(await write(SSE_KEEPALIVE_PAYLOAD))) {
            isInterrupted = true;
            break;
          }
          continue;
        }
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      }
    } catch (error) {
      isInterrupted = true;
      this.logger.error(
        'Conversation title stream failed',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      clearTimeout(admissionTimer);
      clearTimeout(deadlineTimer);
      clearInterval(keepaliveTimer);
      ownership.abort();
      res.off('close', handleClose);
      /* An interrupted stream must not look complete: close without a terminal frame. */
      if (isInterrupted) {
        if (!res.destroyed) res.destroy();
      } else if (!res.writableEnded) {
        res.end();
      }
      await Promise.allSettled([...tasks]);
      admission.release();
    }
  }
}
