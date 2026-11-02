import type { Server } from 'node:http';
import { UPLOAD_MAX_DURATION_MS } from '../../files/upload/upload-watchdog';

/**
 * Lets a request body keep arriving for up to `UPLOAD_MAX_DURATION_MS`.
 *
 * Node's default `requestTimeout` (300 000 ms) answers `408` and closes the
 * socket when a body takes longer than 5 minutes to arrive, even while it is
 * still flowing, so a large upload over a slow link failed in the browser as a
 * network error. `headersTimeout` keeps Node's default, which still bounds the
 * header phase.
 */
export const configureHttpServerTimeouts = (server: Server): void => {
  server.requestTimeout = UPLOAD_MAX_DURATION_MS;
};
