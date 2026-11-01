import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
} from 'react';
import type {
  ConversationDataSource,
  ConversationListSync,
} from '../models/conversation-data-source';
import {
  createRegularConversationDataSource,
  isRegularConversationReadOnly,
} from '../utils/regular-conversation-data-source';
import { useUser } from './auth/UserContext';
import { useConversations } from './ConversationsContext';

/**
 * The data source `ConversationPage` reads, loads and saves through. A
 * project chat provides its own for its subtree; everywhere else the page
 * uses the regular `/conversations/*` source.
 */
export const ConversationDataSourceContext = createContext<
  ConversationDataSource | undefined
>(undefined);

/*
 * The regular source over `ConversationsContext`. Every member keeps a stable
 * identity except `isReadOnly`, which changes with the list exactly when the
 * page's read-only memo used to re-run.
 */
const useRegularConversationDataSource = (): ConversationDataSource => {
  const { user } = useUser();
  const bucket = user?.bucket ?? '';
  const {
    conversations,
    updateConversationTitle,
    bumpConversationActivity,
    markConversationUnread,
    markConversationViewed,
    watchForDisplayNameUpdate,
    removeConversationFromList,
    refreshConversations,
  } = useConversations();

  const isReadOnly = useCallback(
    (id: string) => isRegularConversationReadOnly(id, conversations, bucket),
    [conversations, bucket],
  );
  const listSync = useMemo<ConversationListSync>(
    () => ({
      updateTitle: updateConversationTitle,
      bumpActivity: bumpConversationActivity,
      markUnread: markConversationUnread,
      markViewed: markConversationViewed,
      remove: removeConversationFromList,
      refresh: refreshConversations,
    }),
    [
      updateConversationTitle,
      bumpConversationActivity,
      markConversationUnread,
      markConversationViewed,
      removeConversationFromList,
      refreshConversations,
    ],
  );
  return useMemo(
    () =>
      createRegularConversationDataSource({
        isReadOnly,
        listSync,
        watchTitle: watchForDisplayNameUpdate,
      }),
    [isReadOnly, listSync, watchForDisplayNameUpdate],
  );
};

/** Provides the regular `/conversations/*` data source to its subtree. */
export const ConversationDataSourceProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const value = useRegularConversationDataSource();
  return (
    <ConversationDataSourceContext.Provider value={value}>
      {children}
    </ConversationDataSourceContext.Provider>
  );
};

/**
 * The data source of the nearest provider: a project chat's own, or the
 * regular one `ConversationDataSourceProvider` supplies. Throws outside any
 * provider, like `useConversations` does.
 */
export const useConversationDataSource = (): ConversationDataSource => {
  const value = useContext(ConversationDataSourceContext);
  if (value == null) {
    throw new Error(
      'useConversationDataSource must be used within a ConversationDataSourceProvider',
    );
  }
  return value;
};
