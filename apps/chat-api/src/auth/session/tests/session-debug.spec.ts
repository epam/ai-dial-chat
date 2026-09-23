import { describe, expect, it } from 'vitest';
import { getSessionDebugMetadata } from '../session-debug';
import type { SessionPayload } from '../session.types';

describe('session debug metadata', () => {
  it('exposes deadlines and correlation IDs without credentials or profile data', () => {
    const payload: SessionPayload = {
      v: 2,
      sid: 'session-1',
      providerId: 'keycloak',
      sub: 'private-user',
      at: 'secret-access-token',
      rt: 'secret-refresh-token',
      it: 'secret-id-token',
      csrf: 'secret-csrf-token',
      bucket: 'private-bucket',
      claims: { email: 'private@example.com' },
      at_exp: 1700000300,
      session_exp: 1702592000,
      iat: 1700000000,
    };
    const metadata = getSessionDebugMetadata(payload);
    expect(metadata).toMatchObject({
      sessionId: payload.sid,
      sessionExpiresAt: payload.session_exp,
      refreshTokenExpiresAt: null,
      hasRefreshToken: true,
    });
    const output = JSON.stringify(metadata);
    for (const value of [
      payload.at,
      payload.rt,
      payload.it,
      payload.csrf,
      payload.sub,
      payload.bucket,
      payload.claims['email'],
    ]) {
      expect(output).not.toContain(value);
    }
  });
});
