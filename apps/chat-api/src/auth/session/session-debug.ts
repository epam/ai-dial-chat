import type { SessionPayload } from './session.types';

/** Allowlisted diagnostics only: never spread the token-bearing session into logs. */
export const getSessionDebugMetadata = (payload: SessionPayload) => ({
  sessionId: payload.sid,
  providerId: payload.providerId,
  sessionExpiresAt: payload.session_exp,
  accessTokenExpiresAt: payload.at_exp,
  refreshTokenExpiresAt: payload.rt_exp ?? null,
  hasRefreshToken: Boolean(payload.rt),
});
