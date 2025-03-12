import { createSelector } from '@reduxjs/toolkit';

import { RootState } from '@/src/types/store';

import { MigrationState } from './migration.types';

const rootSelector = (state: RootState): MigrationState => state.migration;

export const selectConversationsToMigrateAndMigratedCount = createSelector(
  [rootSelector],
  (state) => ({
    conversationsToMigrateCount: state.conversationsToMigrateCount,
    migratedConversationsCount: state.migratedConversationsCount,
  }),
);

export const selectFailedMigratedConversations = (state: RootState) =>
  rootSelector(state).failedMigratedConversations;

export const selectIsChatsBackedUp = (state: RootState) =>
  rootSelector(state).isChatsBackedUp;

export const selectPromptsToMigrateAndMigratedCount = createSelector(
  [rootSelector],
  (state) => ({
    promptsToMigrateCount: state.promptsToMigrateCount,
    migratedPromptsCount: state.migratedPromptsCount,
  }),
);

export const selectFailedMigratedPrompts = (state: RootState) =>
  rootSelector(state).failedMigratedPrompts;

export const selectIsPromptsBackedUp = (state: RootState) =>
  rootSelector(state).isPromptsBackedUp;

export const selectInitialized = (state: RootState) =>
  rootSelector(state).initialized;
