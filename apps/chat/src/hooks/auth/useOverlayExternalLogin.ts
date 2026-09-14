import { useCallback, useEffect, useRef, useState } from 'react';
import { useUser } from '../../context/auth/UserContext';
import { AuthStatus } from '../../types/auth-status';

/*
 * Polling starts after one full interval and each next tick is scheduled only
 * after the previous /auth/me refresh finishes, so there is never more than
 * one in-flight auth poll.
 */
const AUTH_WINDOW_POLL_INTERVAL_MS = 5000;
const AUTH_WINDOW_LONG_WAIT_MS = 120_000;
const AUTH_WINDOW_LONG_WAIT_POLL_INTERVAL_MS = 15_000;
const AUTH_WINDOW_TARGET = '_blank';

export enum OverlayExternalLoginStatus {
  Idle = 'idle',
  Opening = 'opening',
  Waiting = 'waiting',
  Blocked = 'blocked',
  TakingLonger = 'takingLonger',
}

interface AuthWindowAttemptResources {
  attemptId: number;
  authWindow: Window;
  pollTimeoutId: number | null;
  longWaitTimeoutId: number;
  isTakingLonger: boolean;
}

const isAuthWindowClosed = (authWindow: Window): boolean => {
  try {
    return authWindow.closed;
  } catch {
    /* Cross-origin window that is still open; do not treat as closed. */
    return false;
  }
};

/**
 * Opens the existing login flow outside the overlay iframe and polls the BFF
 * from the iframe until the popup-established session cookie is usable there.
 */
export const useOverlayExternalLogin = (): {
  status: OverlayExternalLoginStatus;
  openLogin: (loginUrl?: string) => void;
  cancelLogin: () => void;
} => {
  const { refresh: userRefresh } = useUser();
  const [status, setStatus] = useState(OverlayExternalLoginStatus.Idle);
  const attemptResourcesRef = useRef<AuthWindowAttemptResources | null>(null);
  const attemptIdRef = useRef(0);

  const teardownCurrentAttempt = useCallback((closeAuthWindow = false) => {
    const resources = attemptResourcesRef.current;
    if (!resources) return;

    if (resources.pollTimeoutId !== null) {
      window.clearTimeout(resources.pollTimeoutId);
    }
    window.clearTimeout(resources.longWaitTimeoutId);
    if (closeAuthWindow) {
      try {
        resources.authWindow.close();
      } catch {
        /* Best-effort cleanup after successful login or retry. */
      }
    }
    attemptResourcesRef.current = null;
  }, []);

  const completeAttempt = useCallback(
    (attemptId: number) => {
      if (attemptResourcesRef.current?.attemptId !== attemptId) return;

      teardownCurrentAttempt(true);
      setStatus(OverlayExternalLoginStatus.Idle);
    },
    [teardownCurrentAttempt],
  );

  const openLogin = useCallback(
    (loginUrl?: string) => {
      teardownCurrentAttempt(true);
      attemptIdRef.current += 1;
      const attemptId = attemptIdRef.current;
      setStatus(OverlayExternalLoginStatus.Opening);

      const target = loginUrl
        ? loginUrl
        : `${window.location.origin}/login?callbackUrl=${encodeURIComponent(
            `${window.location.origin}/overlay-close`,
          )}`;

      const authWindow = window.open(target, AUTH_WINDOW_TARGET);
      if (!authWindow || isAuthWindowClosed(authWindow)) {
        setStatus(OverlayExternalLoginStatus.Blocked);
        return;
      }

      try {
        authWindow.opener = null;
      } catch {
        /* Best-effort reverse-tabnabbing protection before provider navigation. */
      }

      const resources: AuthWindowAttemptResources = {
        attemptId,
        authWindow,
        pollTimeoutId: null,
        longWaitTimeoutId: 0,
        isTakingLonger: false,
      };
      resources.longWaitTimeoutId = window.setTimeout(() => {
        if (attemptResourcesRef.current?.attemptId !== attemptId) return;

        resources.isTakingLonger = true;
        setStatus(OverlayExternalLoginStatus.TakingLonger);
      }, AUTH_WINDOW_LONG_WAIT_MS);
      attemptResourcesRef.current = resources;

      const scheduleNextPoll = () => {
        if (attemptResourcesRef.current?.attemptId !== attemptId) return;

        const interval = resources.isTakingLonger
          ? AUTH_WINDOW_LONG_WAIT_POLL_INTERVAL_MS
          : AUTH_WINDOW_POLL_INTERVAL_MS;
        resources.pollTimeoutId = window.setTimeout(() => {
          void pollAuthStatus();
        }, interval);
      };

      const pollAuthStatus = async () => {
        if (attemptResourcesRef.current?.attemptId !== attemptId) return;

        try {
          const nextStatus = await userRefresh({ setLoading: false });
          if (attemptResourcesRef.current?.attemptId !== attemptId) return;

          if (nextStatus === AuthStatus.Authenticated) {
            completeAttempt(attemptId);
            return;
          }
        } catch {
          /* Retry while the login gate is mounted or until a new attempt starts. */
        }

        scheduleNextPoll();
      };

      scheduleNextPoll();
      setStatus(OverlayExternalLoginStatus.Waiting);
    },
    [completeAttempt, teardownCurrentAttempt, userRefresh],
  );

  const cancelLogin = useCallback(() => {
    attemptIdRef.current += 1;
    teardownCurrentAttempt(true);
    setStatus(OverlayExternalLoginStatus.Idle);
  }, [teardownCurrentAttempt]);

  /*
   * On unmount the timers are cleared and the attempt ref nulled, so no
   * attempt callback runs afterwards; the auth window itself is deliberately
   * left open (the user may be mid-login in it). A stray `setStatus` after
   * unmount would be a React 18+ no-op anyway, so it needs no mounted-guard —
   * the attemptId checks below are the real post-unmount protection, not
   * window teardown.
   */
  useEffect(() => {
    return () => {
      attemptIdRef.current += 1;
      teardownCurrentAttempt();
    };
  }, [teardownCurrentAttempt]);

  return { status, openLogin, cancelLogin };
};
