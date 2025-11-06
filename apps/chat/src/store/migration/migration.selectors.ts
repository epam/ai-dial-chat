import { createSelector } from '@reduxjs/toolkit';

import { RootState } from '@/src/types/store';

const rootSelector = (state: RootState) => state.migration;

const selectConversationsToMigrateAndMigratedCount = createSelector(
  [rootSelector],
  (state) => ({
    conversationsToMigrateCount: state.conversationsToMigrateCount,
    migratedConversationsCount: state.migratedConversationsCount,
  }),
);

const selectFailedMigratedConversations = (state: RootState) =>
  rootSelector(state).failedMigratedConversations;

const selectIsChatsBackedUp = (state: RootState) =>
  rootSelector(state).isChatsBackedUp;

const selectPromptsToMigrateAndMigratedCount = createSelector(
  [rootSelector],
  (state) => ({
    promptsToMigrateCount: state.promptsToMigrateCount,
    migratedPromptsCount: state.migratedPromptsCount,
  }),
);

const selectFailedMigratedPrompts = (state: RootState) =>
  rootSelector(state).failedMigratedPrompts;

const selectIsPromptsBackedUp = (state: RootState) =>
  rootSelector(state).isPromptsBackedUp;

const selectInitialized = (state: RootState) => rootSelector(state).initialized;

export const MigrationSelectors = {
  selectConversationsToMigrateAndMigratedCount,
  selectFailedMigratedConversations,
  selectIsChatsBackedUp,
  selectPromptsToMigrateAndMigratedCount,
  selectFailedMigratedPrompts,
  selectIsPromptsBackedUp,
  selectInitialized,
};
