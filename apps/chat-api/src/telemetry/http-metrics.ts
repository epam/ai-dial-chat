import { metrics } from '@opentelemetry/api';
import packageJson from '../../package.json';

export const UNMATCHED_ROUTE = 'unmatched';

const meter = metrics.getMeter('dial-chat-api', packageJson.version);

/*
 * The only HTTP server metric instrument in the app. Its implicit `count` (available via any
 * backend's count-over-time aggregation) already answers "how many requests" for the same
 * attribute set, so a separate `Counter` would just double the maintained instrument surface for
 * no new information — see design.md §4.
 */
export const httpServerRequestDuration = meter.createHistogram(
  'http.server.request.duration',
  {
    description:
      'Duration of inbound HTTP requests handled by the application.',
    unit: 's',
  },
);

interface RequestWithRoute {
  route?: { path?: unknown };
}

/*
 * Returns the matched Express/Nest route template (e.g. `/api/v1/themes/:id`), never the raw
 * incoming path — bounded fallback keeps metric attribute cardinality bounded regardless of what
 * a client sends (unmatched routes, path-traversal attempts, arbitrary IDs in the URL, etc).
 */
export const resolveRouteTemplate = (request: RequestWithRoute): string => {
  const path = request.route?.path;
  return typeof path === 'string' ? path : UNMATCHED_ROUTE;
};
