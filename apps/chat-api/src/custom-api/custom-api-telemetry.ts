import { metrics } from '@opentelemetry/api';
import packageJson from '../../package.json';
import { CustomApiMethod } from './custom-api-registry.service';

const meter = metrics.getMeter('dial-chat-api', packageJson.version);

/*
 * Attribute keys for the custom API instruments. The operation id attribute
 * value is bounded: only ids actually present in the configured registry are
 * ever recorded verbatim (the registry caps at 64 entries, operator-owned).
 * Any other id — an unregistered guess, a path-traversal attempt — collapses
 * to UNKNOWN_CUSTOM_API_OPERATION so a scanner cannot grow this attribute's
 * cardinality. The method attribute is bounded the same way: the four
 * configurable verbs, else `other`. No token, cookie, body, config content,
 * query value or full URL is ever recorded here.
 */
export const CUSTOM_API_OPERATION_ATTRIBUTE = 'dial.chat.custom_api.operation';
export const CUSTOM_API_RESULT_ATTRIBUTE = 'dial.chat.custom_api.result';
export const CUSTOM_API_METHOD_ATTRIBUTE = 'dial.chat.custom_api.method';

export const UNKNOWN_CUSTOM_API_OPERATION = 'unknown';
/** Method label for any verb outside the configurable set (HEAD, PATCH, …). */
export const OTHER_CUSTOM_API_METHOD = 'other';

const CONFIGURABLE_METHODS: ReadonlySet<string> = new Set(
  Object.values(CustomApiMethod),
);

/** Bounded terminal result category for one custom API call. */
export enum CustomApiResultCategory {
  Success = 'success',
  AdmissionRejected = 'admission_rejected',
  NotFound = 'not_found',
  UnsupportedMethod = 'unsupported_method',
  UpstreamClientError = 'upstream_client_error',
  UpstreamError = 'upstream_error',
  Unavailable = 'unavailable',
  Timeout = 'timeout',
  ClientClosed = 'client_closed',
  InternalError = 'internal_error',
}

/* Matches the `dial.chat.auth.*` family's explicit bucket boundaries up to
 * the 10 s default deadline; the buckets above it cover operations that opt
 * in to a longer deadline (at most 300 s). */
export const CUSTOM_API_DURATION_BOUNDARIES = [
  0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 10, 30, 60, 120, 300,
];

export const customApiCallDuration = meter.createHistogram(
  'dial.chat.custom_api.call.duration',
  {
    description:
      'Duration of one BFF-to-Core custom API call, by registered operation id and bounded result category.',
    unit: 's',
    advice: { explicitBucketBoundaries: CUSTOM_API_DURATION_BOUNDARIES },
  },
);

export const customApiResponseBytes = meter.createHistogram(
  'dial.chat.custom_api.response.bytes',
  {
    description:
      'Decoded response byte count for one successful BFF-to-Core custom API call.',
    unit: 'By',
  },
);

/** Resolves the bounded operation-id attribute value for telemetry. */
export const resolveCustomApiOperationLabel = (
  operationId: string | undefined,
  known: boolean,
): string =>
  known && operationId ? operationId : UNKNOWN_CUSTOM_API_OPERATION;

/** Resolves the bounded method attribute value: one of the configurable verbs, else `other`. */
export const resolveCustomApiMethodLabel = (method: string): string => {
  const upper = method.toUpperCase();
  return CONFIGURABLE_METHODS.has(upper) ? upper : OTHER_CUSTOM_API_METHOD;
};

/** Records one completed custom API call. `bytes` is omitted for non-success results. */
export const recordCustomApiCall = (params: {
  operationId: string | undefined;
  known: boolean;
  /** The request's HTTP method; recorded through resolveCustomApiMethodLabel. */
  method: string;
  result: CustomApiResultCategory;
  durationSeconds: number;
  bytes?: number;
}): void => {
  const attributes = {
    [CUSTOM_API_OPERATION_ATTRIBUTE]: resolveCustomApiOperationLabel(
      params.operationId,
      params.known,
    ),
    [CUSTOM_API_METHOD_ATTRIBUTE]: resolveCustomApiMethodLabel(params.method),
    [CUSTOM_API_RESULT_ATTRIBUTE]: params.result,
  };

  customApiCallDuration.record(params.durationSeconds, attributes);
  if (params.bytes !== undefined) {
    customApiResponseBytes.record(params.bytes, attributes);
  }
};
