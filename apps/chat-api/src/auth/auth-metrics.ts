import {
  BadGatewayException,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { metrics } from '@opentelemetry/api';
import packageJson from '../../package.json';
import { AuthSource } from './auth-source.enum';
import { AuthProviderId } from './providers/provider.types';
import { AuthErrorCode } from './session/auth-error-code.enum';

const meter = metrics.getMeter('dial-chat-api', packageJson.version);

/*
 * Attribute keys for the auth instruments. Dotted here, underscored by the Prometheus
 * exporter (`dial.chat.auth.outcome` becomes `dial_chat_auth_outcome`), matching the
 * `dial.chat.http.*` family's convention. Every value below comes from a fixed enum:
 * no provider-supplied string, subject, session id, token, redirect URL, or exception
 * message ever becomes an attribute value.
 */
export const AUTH_PROVIDER_ATTRIBUTE = 'dial.chat.auth.provider';
export const AUTH_OUTCOME_ATTRIBUTE = 'dial.chat.auth.outcome';
export const AUTH_SOURCE_ATTRIBUTE = 'dial.chat.auth.source';
export const AUTH_REASON_ATTRIBUTE = 'dial.chat.auth.reason';
export const AUTH_RESULT_ATTRIBUTE = 'dial.chat.auth.result';
export const AUTH_REVOCATION_ATTRIBUTE = 'dial.chat.auth.revocation';

export const UNKNOWN_AUTH_PROVIDER = 'unknown';

const KNOWN_AUTH_PROVIDERS = new Set<string>(Object.values(AuthProviderId));

/*
 * A provider id reaches these instruments from a URL path parameter or from a decrypted
 * session payload, so it is never trusted as an attribute value directly. Only the ids
 * this build can actually construct a provider for (`AuthProviderId`) pass through; every
 * other value collapses to `unknown` so a scanner probing `/auth/login/<random>` cannot
 * grow the attribute's cardinality.
 */
export const resolveAuthProvider = (id: string | undefined): string =>
  id != null && KNOWN_AUTH_PROVIDERS.has(id) ? id : UNKNOWN_AUTH_PROVIDER;

/*
 * Terminal outcome of one OIDC callback the BFF processed. It measures the BFF's own
 * callback handling — the user's time on the identity provider's pages is not part of it,
 * because the BFF only sees the redirect back.
 */
export enum AuthCallbackOutcome {
  /** A session cookie was issued and the browser was redirected to the app. */
  Success = 'success',
  /** The callback was refused before the code exchange: IdP-reported error, missing code/state, missing or unusable transaction cookie, state/provider/issuer mismatch, or an unknown provider. */
  ValidationRejected = 'validation_rejected',
  /** The authorization-code exchange with the identity provider failed. */
  ExchangeFailed = 'exchange_failed',
  /** Any other failure after validation passed — a BFF-side fault, not a rejected request. */
  InternalError = 'internal_error',
}

/*
 * Terminal outcome of one real refresh-token exchange. A caller that joined an already
 * running exchange is counted by `authRefreshCoalesced` instead and contributes no
 * duration observation, so this histogram's count is the number of exchanges actually
 * performed against the identity provider, not the number of requests that needed one.
 */
export enum AuthRefreshOutcome {
  /** The identity provider returned a new token set. */
  Refreshed = 'refreshed',
  /** `invalid_grant` arrived while this payload's access token was still valid — a lost rotation race absorbed without forcing a logout. This is neither a refresh success nor a session loss. */
  RaceAbsorbed = 'race_absorbed',
  /** `invalid_grant` after access-token or session expiry: the session cannot be recovered. */
  InvalidGrant = 'invalid_grant',
  /** Any other failure of the exchange, including an unresolvable provider. */
  UpstreamError = 'upstream_error',
}

/*
 * Which credential the `SessionGuard` decision was made about: the matching strategy's
 * own `AuthSource` (`cookie` / `header`), or this value when no strategy claimed the
 * request at all. Reusing `AuthSource` keeps the label's values from drifting away from
 * the sources the guard actually iterates.
 */
export const NO_AUTH_SOURCE = 'none';

export type AuthAuthorizationSource = AuthSource | typeof NO_AUTH_SOURCE;

export enum AuthAuthorizationOutcome {
  Accepted = 'accepted',
  Rejected = 'rejected',
}

/*
 * Bounded reason for one `SessionGuard` decision. Rejection reasons are derived from the
 * `AuthErrorCode` the strategies already attach to their `UnauthorizedException` bodies,
 * so the metric never carries a free-form exception message.
 */
export enum AuthAuthorizationReason {
  /** Paired with `accepted`: a strategy returned a principal. */
  Accepted = 'accepted',
  /** No strategy supported the request, or a supported one returned no principal. */
  NoCredentials = 'no_credentials',
  /** A session cookie was present but could not be decrypted, or its refresh failed. */
  SessionInvalid = 'session_invalid',
  TokenExpired = 'token_expired',
  TokenInvalid = 'token_invalid',
  UntrustedIssuer = 'untrusted_issuer',
  ProviderNotFound = 'provider_not_found',
  Malformed = 'malformed',
  /** The credential itself was fine; resolving the user's DIAL Core bucket failed. */
  BucketUnavailable = 'bucket_unavailable',
  /** An unexpected strategy failure — a BFF-side fault, not a bad credential. */
  InternalError = 'internal_error',
}

/** What the BFF itself did about the caller's local session on logout. */
export enum AuthLogoutResult {
  /** The session cookie was cleared. This does not confirm a federated logout at the identity provider. */
  CookieCleared = 'cookie_cleared',
  /** A header-authenticated caller had no session to clear. */
  HeaderNoop = 'header_noop',
  /** The logout was refused by the origin check. */
  OriginRejected = 'origin_rejected',
}

/** Result of the separate, best-effort refresh-token revocation attempt. */
export enum AuthLogoutRevocation {
  Success = 'success',
  Failed = 'failed',
  /** No revocation endpoint, no refresh token, no readable session, or the logout was refused. */
  NotAttempted = 'not_attempted',
}

/*
 * Explicit boundaries in seconds. The SDK defaults start at 5s, which is unusable for an
 * exchange with an identity provider on the same network. The largest finite bound is 60s,
 * matching `dial.chat.http.response.duration`, so the same last-finite-bucket guard idiom
 * works across dashboards. Changing these under the same metric name would mix bucket
 * layouts during a rolling deploy — a new layout needs a new family.
 */
export const AUTH_DURATION_BOUNDARIES = [
  0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 10, 30, 60,
];

export const authLoginStarted = meter.createCounter(
  'dial.chat.auth.login.started',
  {
    description:
      'Login redirects the BFF issued to an identity provider, counted when the redirect is sent. Not a count of successful sign-ins: the user may never return.',
    unit: '{operation}',
  },
);

export const authCallbackDuration = meter.createHistogram(
  'dial.chat.auth.callback.duration',
  {
    description:
      "Duration of the BFF's own OIDC callback processing, from entering the callback route to issuing the session cookie and redirect, or to the terminal failure. Excludes the time the user spent on the identity provider.",
    unit: 's',
    advice: { explicitBucketBoundaries: AUTH_DURATION_BOUNDARIES },
  },
);

export const authRefreshDuration = meter.createHistogram(
  'dial.chat.auth.refresh.duration',
  {
    description:
      'Duration of one real refresh-token exchange performed against the identity provider. Callers that joined an in-flight exchange are not observed here.',
    unit: 's',
    advice: { explicitBucketBoundaries: AUTH_DURATION_BOUNDARIES },
  },
);

export const authRefreshCoalesced = meter.createCounter(
  'dial.chat.auth.refresh.coalesced',
  {
    description:
      'Requests that joined a refresh-token exchange already in flight for the same session on this pod, instead of starting their own.',
    unit: '{request}',
  },
);

export const authAuthorization = meter.createCounter(
  'dial.chat.auth.authorization',
  {
    description:
      'SessionGuard authorization decisions on protected routes, by credential source, outcome, and bounded reason. One decision per guarded request — not a count of users or sessions.',
    unit: '{request}',
  },
);

export const authLogout = meter.createCounter('dial.chat.auth.logout', {
  description:
    "Logout operations, by what the BFF did locally and by the outcome of its separate best-effort token revocation. A redirect to the identity provider's end-session endpoint is not a confirmed federated logout.",
  unit: '{operation}',
});

/** Seconds elapsed since a `process.hrtime.bigint()` reading. */
export const elapsedSeconds = (startedAt: bigint): number =>
  Number(process.hrtime.bigint() - startedAt) / 1e9;

/**
 * Classifies a failure thrown while processing an OIDC callback. A refused request
 * (`BadRequestException`, or `NotFoundException` for an unconfigured provider) is kept
 * distinct from a failed code exchange (`BadGatewayException`) and from a BFF-side fault,
 * so an identity-provider outage never looks like a spike in malformed callbacks.
 */
export const classifyCallbackFailure = (
  error: unknown,
): AuthCallbackOutcome => {
  if (
    error instanceof BadRequestException ||
    error instanceof NotFoundException
  ) {
    return AuthCallbackOutcome.ValidationRejected;
  }
  if (error instanceof BadGatewayException) {
    return AuthCallbackOutcome.ExchangeFailed;
  }
  return AuthCallbackOutcome.InternalError;
};

const REASON_BY_ERROR_CODE: Record<AuthErrorCode, AuthAuthorizationReason> = {
  [AuthErrorCode.HeaderTokenExpired]: AuthAuthorizationReason.TokenExpired,
  [AuthErrorCode.HeaderTokenInvalid]: AuthAuthorizationReason.TokenInvalid,
  [AuthErrorCode.HeaderTokenUntrustedIssuer]:
    AuthAuthorizationReason.UntrustedIssuer,
  [AuthErrorCode.HeaderProviderNotFound]:
    AuthAuthorizationReason.ProviderNotFound,
  [AuthErrorCode.HeaderMalformed]: AuthAuthorizationReason.Malformed,
  [AuthErrorCode.NoCredentials]: AuthAuthorizationReason.NoCredentials,
};

const readErrorCode = (error: UnauthorizedException): AuthErrorCode | null => {
  const body = error.getResponse();
  if (typeof body !== 'object' || body == null) {
    return null;
  }
  const code = (body as { code?: unknown }).code;
  return typeof code === 'string' && code in REASON_BY_ERROR_CODE
    ? (code as AuthErrorCode)
    : null;
};

/**
 * Classifies a failure thrown by an auth strategy into a bounded rejection reason. An
 * `UnauthorizedException` carrying an `AuthErrorCode` keeps that code's meaning; a bare
 * one comes from the cookie strategy (undecryptable cookie or an unrecoverable refresh)
 * and reads as `session_invalid`. A bucket-resolution failure is reported separately
 * because the credential was valid and DIAL Core, not the caller, is at fault.
 */
export const classifyAuthorizationFailure = (
  error: unknown,
): AuthAuthorizationReason => {
  if (error instanceof ServiceUnavailableException) {
    return AuthAuthorizationReason.BucketUnavailable;
  }
  if (error instanceof UnauthorizedException) {
    const code = readErrorCode(error);
    return code != null
      ? REASON_BY_ERROR_CODE[code]
      : AuthAuthorizationReason.SessionInvalid;
  }
  return AuthAuthorizationReason.InternalError;
};
