import { healthApi } from './api-client';

/**
 * Fetches the backend's health/build status, including the `buildId` used to
 * detect that a new deployment has replaced the running application. Skips
 * HTTP caches so a cached response never hides a new deployment.
 */
export const checkHealth = (signal?: AbortSignal) =>
  healthApi.check({ cache: 'no-store', signal });
