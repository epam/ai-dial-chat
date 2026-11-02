import { createServer } from 'node:http';
import { describe, expect, it } from 'vitest';
import { UPLOAD_MAX_DURATION_MS } from '../../files/upload/upload-watchdog';
import { configureHttpServerTimeouts } from './http-server-timeouts';

describe('configureHttpServerTimeouts', () => {
  it('lets a request body arrive for as long as the upload ceiling', () => {
    const server = createServer();

    configureHttpServerTimeouts(server);

    expect(server.requestTimeout).toBe(UPLOAD_MAX_DURATION_MS);
  });

  it("raises the limit above Node's 5-minute default", () => {
    const server = createServer();
    const nodeDefault = server.requestTimeout;

    configureHttpServerTimeouts(server);

    expect(nodeDefault).toBe(300_000);
    expect(server.requestTimeout).toBeGreaterThan(nodeDefault);
  });

  it('keeps the default header timeout', () => {
    const server = createServer();
    const { headersTimeout } = server;

    configureHttpServerTimeouts(server);

    expect(server.headersTimeout).toBe(headersTimeout);
  });
});
