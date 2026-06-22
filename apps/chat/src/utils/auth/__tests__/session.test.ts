import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { NextApiRequest, NextApiResponse } from 'next';
import type { Session } from 'next-auth';

import {
  isClientSessionValid,
  isServerSessionValid,
  validateServerSession,
} from '../session';

// Mock auth-providers so we control isAuthDisabled without loading real providers
vi.mock('../auth-providers', () => ({
  isAuthDisabled: false,
  authProviders: [],
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const validSession = { user: { email: 'a@b.com' } } as unknown as Session;

const makeErrorSession = (error: string) =>
  ({ ...validSession, error }) as unknown as Session;

const mockRes = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  } as unknown as NextApiResponse;
  return res;
};

// ---------------------------------------------------------------------------
// isClientSessionValid
// ---------------------------------------------------------------------------

describe('isClientSessionValid', () => {
  it('returns false for null', () => {
    expect(isClientSessionValid(null)).toBeFalsy();
  });

  it('returns true for a session without an error', () => {
    expect(isClientSessionValid({ data: { user: {} } })).toBeTruthy();
  });

  it.each([
    'RefreshAccessTokenError',
    'CredentialsAccessTokenValidationError',
    'CredentialsAccessTokenExpired',
  ])('returns false when data.error is %s', (error) => {
    expect(isClientSessionValid({ data: { error } })).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// isServerSessionValid
// ---------------------------------------------------------------------------

describe('isServerSessionValid', () => {
  const origIframe = process.env.IS_IFRAME;

  beforeEach(() => {
    process.env.IS_IFRAME = 'false';
  });

  afterEach(() => {
    process.env.IS_IFRAME = origIframe;
  });

  it('returns false for null session', () => {
    expect(isServerSessionValid(null)).toBe(false);
  });

  it('returns true for a valid session', () => {
    expect(isServerSessionValid(validSession)).toBe(true);
  });

  it.each([
    'RefreshAccessTokenError',
    'CredentialsAccessTokenValidationError',
    'CredentialsAccessTokenExpired',
  ])('returns false when session.error is %s', (error) => {
    expect(isServerSessionValid(makeErrorSession(error))).toBe(false);
  });

  describe('IS_IFRAME overlay bypass', () => {
    beforeEach(() => {
      process.env.IS_IFRAME = 'true';
    });

    it('bypasses check and returns true for expired session when checkForOverlay is not set', () => {
      // Default (no checkForOverlay arg) – overlay bypass is active
      expect(
        isServerSessionValid(makeErrorSession('RefreshAccessTokenError')),
      ).toBe(true);
    });

    it('returns false for expired session when checkForOverlay=true (strict mode)', () => {
      // Passing true opts out of the bypass – used by validateServerSession
      expect(
        isServerSessionValid(makeErrorSession('RefreshAccessTokenError'), true),
      ).toBe(false);
    });

    it('returns true for a valid session even in strict mode', () => {
      expect(isServerSessionValid(validSession, true)).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// validateServerSession – overlay mode must now check strictly
// ---------------------------------------------------------------------------

describe('validateServerSession', () => {
  const origIframe = process.env.IS_IFRAME;
  const req = {} as NextApiRequest;

  afterEach(() => {
    process.env.IS_IFRAME = origIframe;
  });

  it('returns true and does not call res.status for a valid session', () => {
    const res = mockRes();
    const result = validateServerSession(validSession, req, res);
    expect(result).toBe(true);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns false and sends 401 for a null session outside overlay', () => {
    process.env.IS_IFRAME = 'false';
    const res = mockRes();
    const result = validateServerSession(null, req, res);
    expect(result).toBe(false);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns false and sends 401 for RefreshAccessTokenError even in overlay mode', () => {
    process.env.IS_IFRAME = 'true';
    const res = mockRes();
    const result = validateServerSession(
      makeErrorSession('RefreshAccessTokenError'),
      req,
      res,
    );
    // API routes must reject invalid sessions regardless of IS_IFRAME
    expect(result).toBe(false);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns false and sends 401 for CredentialsAccessTokenExpired in overlay mode', () => {
    process.env.IS_IFRAME = 'true';
    const res = mockRes();
    const result = validateServerSession(
      makeErrorSession('CredentialsAccessTokenExpired'),
      req,
      res,
    );
    expect(result).toBe(false);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns true for a valid session in overlay mode', () => {
    process.env.IS_IFRAME = 'true';
    const res = mockRes();
    const result = validateServerSession(validSession, req, res);
    expect(result).toBe(true);
    expect(res.status).not.toHaveBeenCalled();
  });
});
