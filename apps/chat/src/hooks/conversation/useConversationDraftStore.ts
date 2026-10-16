import {
  type ConversationDraftStore,
  createWebStorageConversationDraftStore,
} from '@epam/ai-dial-chat-hooks/conversation';
import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { useEffect, useMemo } from 'react';
import { normalizeConversationId } from '../../constants/routes';
import { useUser } from '../../context/auth/UserContext';
import { StorageKey } from '../../types/storage-key';
import { useUiFeature } from '../useUiFeature';

/*
 * Returns the signed-in user's conversation-draft store, or `undefined` while
 * nobody is signed in or the `conversation-drafts` UI feature is off.
 *
 * The draft logic lives in `@epam/ai-dial-chat-hooks`; the facts below are
 * host-owned and so live here: drafts are tab-scoped (`sessionStorage`), keyed
 * per user so another account on the same tab never sees them, and indexed by
 * the canonical conversation id so route and API id forms share one entry.
 * The store is stateless over storage, so every caller can build its own.
 *
 * An `undefined` store turns every draft handler into a no-op, so the feature
 * flag gates saving, restoring and eviction in one place. Drafts left from
 * while the feature was on are discarded, so turning it back on in the same
 * tab never brings stale text back.
 */
export const useConversationDraftStore = ():
  ConversationDraftStore | undefined => {
  const { user } = useUser();
  const sub = user?.sub;
  const isEnabled = useUiFeature(OverlayFeature.ConversationDrafts);

  const store = useMemo(
    () =>
      sub
        ? createWebStorageConversationDraftStore({
            getStorage: () => window.sessionStorage,
            storageKey: `${StorageKey.ConversationDrafts}:${sub}`,
            normalizeId: normalizeConversationId,
          })
        : undefined,
    [sub],
  );

  useEffect(() => {
    if (!isEnabled) store?.clear();
  }, [isEnabled, store]);

  return isEnabled ? store : undefined;
};
