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
  AdmissionRejected = 'admission_rejected',
  UpstreamCredentials = 'upstream_credentials',
  UpstreamError = 'upstream_error',
  Unavailable = 'unavailable',
  InternalError = 'internal_error',
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
      'Times an expired cached value was served because its refresh failed, by configured source id.',
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
