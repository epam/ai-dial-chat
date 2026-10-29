import { metrics } from '@opentelemetry/api';
import packageJson from '../../package.json';

const meter = metrics.getMeter('dial-chat-api', packageJson.version);

/** Attribute key shared by every conversation title instrument. */
export const CONVERSATION_TITLE_OUTCOME_ATTRIBUTE = 'outcome';

/** Item outcome frames accepted by a title stream's response writer. */
export enum ConversationTitleResultOutcome {
  Resolved = 'resolved',
  Unavailable = 'unavailable',
  Failed = 'failed',
}

/** How one actual SDK title read ended. */
export enum ConversationTitleReadOutcome {
  Success = 'success',
  Failed = 'failed',
  /** Every consumer left, so the read was aborted. */
  Cancelled = 'cancelled',
}

/** How one read left the process-wide title read gate. */
export enum ConversationTitleQueueOutcome {
  Admitted = 'admitted',
  /** The bounded queue was full or the wait timed out. */
  Rejected = 'rejected',
  Cancelled = 'cancelled',
}

/*
 * Delivery and Core-read latency are separate instruments on purpose: the
 * whole-response `dial.chat.http.response.duration` of a title stream says
 * nothing about when its first title arrived. Attributes are the fixed
 * outcome enums above — never an ID, title, token, user or URL. Every
 * instrument is a no-op while OpenTelemetry metrics are disabled.
 */
/*
 * Explicit seconds boundaries: the SDK defaults start at 0/5/10, which would
 * put every cached or typical Core read in one bucket. They cover the 5 s
 * queue wait, the 10 s read timeout and the 60 s stream lifetime. Changing
 * them in place makes old and new samples incomparable; add a new metric
 * name instead.
 */
export const CONVERSATION_TITLE_DURATION_BOUNDARIES = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60,
];

const firstResultDuration = meter.createHistogram(
  'dial.chat.conversation_titles.first_result.duration',
  {
    description:
      'Time from title stream admission until its first title frame was accepted by the response writer.',
    unit: 's',
    advice: {
      explicitBucketBoundaries: CONVERSATION_TITLE_DURATION_BOUNDARIES,
    },
  },
);
const readDuration = meter.createHistogram(
  'dial.chat.conversation_titles.read.duration',
  {
    description:
      'Duration of one actual DIAL Core title read, once per coalesced read, including failures and cancellation.',
    unit: 's',
    advice: {
      explicitBucketBoundaries: CONVERSATION_TITLE_DURATION_BOUNDARIES,
    },
  },
);
const queueDuration = meter.createHistogram(
  'dial.chat.conversation_titles.queue.duration',
  {
    description:
      'Time a title read waited for the process-wide read gate, including rejection and cancellation.',
    unit: 's',
    advice: {
      explicitBucketBoundaries: CONVERSATION_TITLE_DURATION_BOUNDARIES,
    },
  },
);
const results = meter.createCounter('dial.chat.conversation_titles.results', {
  description:
    'Conversation title stream item outcomes accepted by the response writer.',
  unit: '{result}',
});

/* Instrumentation must never change request behaviour. */
const safely = (record: () => void): void => {
  try {
    record();
  } catch {
    /* A failing metrics SDK is not a request failure. */
  }
};

/** Seconds elapsed since a `performance.now()` reading. */
export const secondsSince = (startedAt: number): number =>
  (performance.now() - startedAt) / 1000;

export const recordConversationTitleFirstResult = (seconds: number): void =>
  safely(() => firstResultDuration.record(seconds));

export const recordConversationTitleRead = (
  seconds: number,
  outcome: ConversationTitleReadOutcome,
): void =>
  safely(() =>
    readDuration.record(seconds, {
      [CONVERSATION_TITLE_OUTCOME_ATTRIBUTE]: outcome,
    }),
  );

export const recordConversationTitleQueue = (
  seconds: number,
  outcome: ConversationTitleQueueOutcome,
): void =>
  safely(() =>
    queueDuration.record(seconds, {
      [CONVERSATION_TITLE_OUTCOME_ATTRIBUTE]: outcome,
    }),
  );

export const recordConversationTitleResult = (
  outcome: ConversationTitleResultOutcome,
): void =>
  safely(() =>
    results.add(1, { [CONVERSATION_TITLE_OUTCOME_ATTRIBUTE]: outcome }),
  );
