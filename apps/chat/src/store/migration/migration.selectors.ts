import { createSelector } from '@reduxjs/toolkit';

import { RootState } from '../index';
import { MigrationState } from './migration.types';

const rootSelector = (state: RootState): MigrationState => state.migration;

export const selectConversationsToMigrateAndMigratedCount = createSelector(
  [rootSelector],
  (state) => ({
    conversationsToMigrateCount: state.conversationsToMigrateCount,
    migratedConversationsCount: state.migratedConversationsCount,
  }),
);

export const selectFailedMigratedConversations = createSelector(
  [rootSelector],
  (state) => state.failedMigratedConversations,
);

export const selectIsChatsBackedUp = createSelector(
  [rootSelector],
  (state) => state.isChatsBackedUp,
);

export const selectPromptsToMigrateAndMigratedCount = createSelector(
  [rootSelector],
  (state) => ({
    promptsToMigrateCount: state.promptsToMigrateCount,
    migratedPromptsCount: state.migratedPromptsCount,
  }),
);

export const selectFailedMigratedPrompts = createSelector(
  [rootSelector],
  (state) => state.failedMigratedPrompts,
);

export const selectIsPromptsBackedUp = createSelector(
  [rootSelector],
  (state) => state.isPromptsBackedUp,
);

export const selectInitialized = createSelector(
  [rootSelector],
  (state) => state.initialized,
);
