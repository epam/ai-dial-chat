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
  openLogin: () => void;
} => {
  const { refresh: userRefresh } = useUser();
  const [status, setStatus] = useState(OverlayExternalLoginStatus.Idle);
  const attemptResourcesRef = useRef<AuthWindowAttemptResources | null>(null);
  const attemptIdRef = useRef(0);
  const isMountedRef = useRef(true);

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
      if (isMountedRef.current) {
        setStatus(OverlayExternalLoginStatus.Idle);
      }
    },
    [teardownCurrentAttempt],
  );

  const openLogin = useCallback(() => {
    teardownCurrentAttempt(true);
    attemptIdRef.current += 1;
    const attemptId = attemptIdRef.current;
    setStatus(OverlayExternalLoginStatus.Opening);

    const target = new URL('/login', window.location.origin);
    target.searchParams.set(
      'callbackUrl',
      `${window.location.origin}/overlay-close`,
    );

    const authWindow = window.open(target.toString(), AUTH_WINDOW_TARGET);
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
      if (isMountedRef.current) {
        setStatus(OverlayExternalLoginStatus.TakingLonger);
      }
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
  }, [completeAttempt, teardownCurrentAttempt, userRefresh]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      attemptIdRef.current += 1;
      teardownCurrentAttempt();
    };
  }, [teardownCurrentAttempt]);

  return { status, openLogin };
};
