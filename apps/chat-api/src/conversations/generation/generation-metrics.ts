import { metrics } from '@opentelemetry/api';
import packageJson from '../../../package.json';

const meter = metrics.getMeter('dial-chat-api', packageJson.version);

/*
 * One counter per generation attempt, tagged with the generation API used,
 * the deployment type, and the terminal outcome — never with prompt/response
 * content or the deployment id itself (unbounded cardinality). A no-op when
 * OpenTelemetry metrics are disabled, matching the existing
 * `httpServerRequestDuration` pattern in telemetry/http-metrics.ts.
 */
export const generationRequestsTotal = meter.createCounter(
  'generation.requests',
  {
    description:
      'Number of generation requests routed through a generation API, by API, deployment type, and terminal outcome.',
  },
);

/*
 * Counts DeploymentsService.getDeploymentDetails capability-resolution
 * failures separately from generation outcomes, so a spike here (401/403/
 * 404/5xx) is distinguishable from an upstream generation failure.
 */
export const generationCapabilityResolutionTotal = meter.createCounter(
  'generation.capability_resolution',
  {
    description:
      "Outcome of resolving a deployment's generation-API capability before opening the upstream stream.",
  },
);

/*
 * Responses SSE event types outside the handled allowlist are counted by
 * `type` only — never logged or counted with their payload/content — so an
 * upstream protocol change is visible without risking prompt/response text
 * ending up in metrics labels.
 */
export const generationUnknownEventsTotal = meter.createCounter(
  'generation.responses.unknown_events',
  {
    description:
      'Count of unrecognized Responses API SSE event types encountered, by event type.',
  },
);

export const generationTimeToFirstDelta = meter.createHistogram(
  'generation.time_to_first_delta',
  {
    description:
      'Time from the upstream generation call starting to the first content delta being received.',
    unit: 's',
  },
);

export const generationStreamDuration = meter.createHistogram(
  'generation.stream_duration',
  {
    description:
      'Total duration of a generation stream, from the upstream call starting to its terminal outcome.',
    unit: 's',
  },
);
