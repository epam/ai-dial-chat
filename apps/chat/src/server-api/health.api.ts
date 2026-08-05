import { healthApi } from './api-client';

/**
 * Fetches the backend's health/build status, including the `buildId` used to
 * detect that a new deployment has replaced the running application.
 */
export const checkHealth = () => healthApi.check();
