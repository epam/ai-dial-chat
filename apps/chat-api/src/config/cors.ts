import type {
  CorsOptions,
  CorsOptionsDelegate,
} from '@nestjs/common/interfaces/external/cors-options.interface';
import type { Request } from 'express';

/**
 * Routes that must never receive CORS headers. MCP Apps content is fetched
 * and its tool calls forwarded only by same-origin `apps/chat` code — see
 * `design.md` D17. This denies both the resource GET and the tool-call POST
 * explicit defense-in-depth alongside the CSP layered on top of them,
 * independent of the origin/credentials policy the rest of the API uses.
 */
const CORS_DENY_PATH_PATTERNS = [
  /^\/api\/v\d+\/toolsets\/[^/]+\/mcp-app-resource(?:$|[/?])/,
  /^\/api\/v\d+\/toolsets\/[^/]+\/mcp-app-tool-call(?:$|[/?])/,
];

/**
 * Returns whether `path` matches one of the routes CORS must always deny.
 * `path` is expected in the form Express's `req.path` returns — no query
 * string, prefixed with the global API prefix and version.
 */
export const isCorsDeniedPath = (path: string): boolean =>
  CORS_DENY_PATH_PATTERNS.some((pattern) => pattern.test(path));

/**
 * Builds the `enableCors` options delegate for `main.ts`: the configured
 * origin/credentials policy for every route, except the MCP Apps routes
 * matched by `isCorsDeniedPath`, which get an explicit deny-by-default policy
 * (no `Access-Control-Allow-Origin`, no credentials) instead.
 */
export const buildCorsOptionsDelegate =
  (defaultOptions: CorsOptions): CorsOptionsDelegate<Request> =>
  (req, callback) => {
    if (isCorsDeniedPath(req.path)) {
      callback(null, { origin: false, credentials: false });
      return;
    }
    callback(null, defaultOptions);
  };
