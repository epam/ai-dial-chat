import { type MutableRefObject, useCallback, useRef, useState } from 'react';
import { getConversationPath } from './conversation-path';

interface ConversationReloadFailure {
  retry: () => Promise<void>;
  isCurrent: () => boolean;
}

interface UseConversationReloadErrorsParams {
  conversationId: string | undefined;
  /* Owned by `useConversationStream`: no state write after unmount. */
  mountedRef: MutableRefObject<boolean>;
}

/**
 * Terminal-read failures of `useConversationStream`, per conversation path:
 * records a failed read with its retry, clears it on success or a new
 * stream, and retries the displayed conversation's read once at a time. The
 * ref is the source of truth; the state copies re-render the host.
 */
export const useConversationReloadErrors = ({
  conversationId,
  mountedRef,
}: UseConversationReloadErrorsParams) => {
  const reloadFailuresRef = useRef(
    new Map<string, ConversationReloadFailure>(),
  );
  const [reloadFailures, setReloadFailures] = useState(
    reloadFailuresRef.current,
  );
  const retryingRef = useRef(new Set<ConversationReloadFailure>());
  const [retrying, setRetrying] = useState(retryingRef.current);

  const clearReloadError = useCallback(
    (path: string) => {
      if (!reloadFailuresRef.current.has(path)) return;
      const next = new Map(reloadFailuresRef.current);
      next.delete(path);
      reloadFailuresRef.current = next;
      if (mountedRef.current) setReloadFailures(next);
    },
    [mountedRef],
  );

  const reportReloadError = useCallback(
    (path: string, retry: () => Promise<void>, isCurrent: () => boolean) => {
      if (!mountedRef.current || !isCurrent()) return;
      const next = new Map(reloadFailuresRef.current);
      next.set(path, { retry, isCurrent });
      reloadFailuresRef.current = next;
      setReloadFailures(next);
    },
    [mountedRef],
  );

  const retryConversationReload = useCallback(async () => {
    if (!conversationId) return;
    const failure = reloadFailuresRef.current.get(
      getConversationPath(conversationId),
    );
    if (!failure || !failure.isCurrent() || retryingRef.current.has(failure))
      return;
    retryingRef.current.add(failure);
    setRetrying(new Set(retryingRef.current));
    try {
      await failure.retry();
    } finally {
      retryingRef.current.delete(failure);
      if (mountedRef.current) setRetrying(new Set(retryingRef.current));
    }
  }, [conversationId, mountedRef]);

  return {
    reloadFailuresRef,
    reloadFailures,
    retrying,
    clearReloadError,
    reportReloadError,
    retryConversationReload,
  };
};
