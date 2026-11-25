import { metrics } from '@opentelemetry/api';
import packageJson from '../../package.json';

const meter = metrics.getMeter('dial-chat-api', packageJson.version);

/*
 * The source attribute is bounded: only ids present in the configured registry
 * (at most 64, operator-owned) are recorded verbatim. Any other id — a guess,
 * a traversal attempt — collapses to UNKNOWN_CONTENT_SOURCE so a scanner cannot
 * grow its cardinality. No token, path, query or upstream URL is ever recorded.
 */
export const CONTENT_SOURCE_ATTRIBUTE = 'dial.chat.content_sources.source';
export const CONTENT_SOURCE_OPERATION_ATTRIBUTE =
  'dial.chat.content_sources.operation';
export const CONTENT_SOURCE_RESULT_ATTRIBUTE =
  'dial.chat.content_sources.result';
export const CONTENT_SOURCE_QUEUE_OUTCOME_ATTRIBUTE =
  'dial.chat.content_sources.queue_outcome';

export const UNKNOWN_CONTENT_SOURCE = 'unknown';

export enum ContentSourceOperation {
  List = 'list',
  Document = 'document',
  Asset = 'asset',
}

/** Bounded terminal result category for one content-sources call. */
export enum ContentSourceResult {
  Success = 'success',
  BadRequest = 'bad_request',
  NotFound = 'not_found',
  /** The user already had too many requests doing upstream work. */
  AdmissionRejected = 'admission_rejected',
  /** The upstream pool's wait queue was full. */
  UpstreamQueueFull = 'upstream_queue_full',
  UpstreamCredentials = 'upstream_credentials',
  UpstreamError = 'upstream_error',
  Unavailable = 'unavailable',
  /** The client disconnected before the response was sent. */
  ClientClosed = 'client_closed',
  InternalError = 'internal_error',
}

/** How one upstream call left its pool's wait queue. */
export enum ContentSourceQueueOutcome {
  /** A slot was free or was handed over; the call started. */
  Admitted = 'admitted',
  /** The queue was full; the call was refused without waiting. */
  QueueFull = 'queue_full',
  /** No slot freed within the wait deadline. */
  TimedOut = 'timed_out',
  /** Every consumer left while the call was queued. */
  Cancelled = 'cancelled',
}

export const CONTENT_SOURCES_DURATION_BOUNDARIES = [
  0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 10, 30, 60,
];

export const contentSourcesCallDuration = meter.createHistogram(
  'dial.chat.content_sources.call.duration',
  {
    description:
      'Duration of one content-sources request, by configured source id, operation and bounded result category.',
    unit: 's',
    advice: { explicitBucketBoundaries: CONTENT_SOURCES_DURATION_BOUNDARIES },
  },
);

export const contentSourcesStaleServed = meter.createCounter(
  'dial.chat.content_sources.stale_served',
  {
    description:
      'Times an expired cached value was served because its refresh failed or could not start, by configured source id.',
  },
);

/*
 * One sample per upstream call. Labelled by configured source id only — never
 * by the pool key (host and credential id), which is not a metric dimension.
 */
export const contentSourcesUpstreamQueueDuration = meter.createHistogram(
  'dial.chat.content_sources.upstream.queue.duration',
  {
    description:
      'Seconds one upstream content-source call waited for a slot of its host and credential pool, by configured source id and bounded queue outcome.',
    unit: 's',
    advice: { explicitBucketBoundaries: CONTENT_SOURCES_DURATION_BOUNDARIES },
  },
);

export const resolveContentSourceLabel = (
  sourceId: string | undefined,
  known: boolean,
): string => (known && sourceId ? sourceId : UNKNOWN_CONTENT_SOURCE);

export const recordContentSourceCall = (params: {
  sourceId: string | undefined;
  known: boolean;
  operation: ContentSourceOperation;
  result: ContentSourceResult;
  durationSeconds: number;
}): void => {
  contentSourcesCallDuration.record(params.durationSeconds, {
    [CONTENT_SOURCE_ATTRIBUTE]: resolveContentSourceLabel(
      params.sourceId,
      params.known,
    ),
    [CONTENT_SOURCE_OPERATION_ATTRIBUTE]: params.operation,
    [CONTENT_SOURCE_RESULT_ATTRIBUTE]: params.result,
  });
};

export const recordContentSourceStaleServed = (sourceId: string): void => {
  contentSourcesStaleServed.add(1, { [CONTENT_SOURCE_ATTRIBUTE]: sourceId });
};

export const recordContentSourceQueueWait = (
  sourceId: string,
  waitSeconds: number,
  outcome: ContentSourceQueueOutcome,
): void => {
  contentSourcesUpstreamQueueDuration.record(waitSeconds, {
    [CONTENT_SOURCE_ATTRIBUTE]: sourceId,
    [CONTENT_SOURCE_QUEUE_OUTCOME_ATTRIBUTE]: outcome,
  });
};
