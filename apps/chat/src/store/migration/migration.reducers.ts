import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { Conversation } from '@/src/types/chat';
import { Prompt } from '@/src/types/prompt';

import * as MigrationSelectors from './migration.selectors';
import { MigrationState } from './migration.types';

export { MigrationSelectors };

const initialState: MigrationState = {
  initialized: false,
  conversationsToMigrateCount: 0,
  migratedConversationsCount: 0,
  failedMigratedConversations: [],
  isChatsBackedUp: false,
  promptsToMigrateCount: 0,
  migratedPromptsCount: 0,
  failedMigratedPrompts: [],
  isPromptsBackedUp: false,
};

export const migrationSlice = createSlice({
  name: 'migration',
  initialState,
  reducers: {
    init: (state) => state,
    initFinish: (state) => {
      state.initialized = true;
    },
    migrateConversationsIfRequired: (state) => state,
    initConversationsMigration: (
      state,
      {
        payload,
      }: PayloadAction<{
        conversationsToMigrateCount: number;
      }>,
    ) => {
      state.conversationsToMigrateCount = payload.conversationsToMigrateCount;
    },
    migrateConversationFinish: (
      state,
      {
        payload,
      }: PayloadAction<{
        migratedConversationsCount: number;
      }>,
    ) => {
      state.migratedConversationsCount = payload.migratedConversationsCount;
    },
    setFailedMigratedConversations: (
      state,
      {
        payload,
      }: PayloadAction<{
        failedMigratedConversations: Conversation[];
      }>,
    ) => {
      state.failedMigratedConversations = payload.failedMigratedConversations;
    },
    setIsChatsBackedUp: (
      state,
      {
        payload,
      }: PayloadAction<{
        isChatsBackedUp: boolean;
      }>,
    ) => {
      state.isChatsBackedUp = payload.isChatsBackedUp;
    },
    skipFailedMigratedConversations: (
      state,
      _action: PayloadAction<{ idsToMarkAsMigrated: string[] }>,
    ) => state,
    migratePromptsIfRequired: (state) => state,
    skipFailedMigratedPrompts: (
      state,
      _action: PayloadAction<{ idsToMarkAsMigrated: string[] }>,
    ) => state,
    initPromptsMigration: (
      state,
      {
        payload,
      }: PayloadAction<{
        promptsToMigrateCount: number;
      }>,
    ) => {
      state.promptsToMigrateCount = payload.promptsToMigrateCount;
    },
    migratePromptFinish: (
      state,
      {
        payload,
      }: PayloadAction<{
        migratedPromptsCount: number;
      }>,
    ) => {
      state.migratedPromptsCount = payload.migratedPromptsCount;
    },
    setFailedMigratedPrompts: (
      state,
      {
        payload,
      }: PayloadAction<{
        failedMigratedPrompts: Prompt[];
      }>,
    ) => {
      state.failedMigratedPrompts = payload.failedMigratedPrompts;
    },
    setIsPromptsBackedUp: (
      state,
      {
        payload,
      }: PayloadAction<{
        isPromptsBackedUp: boolean;
      }>,
    ) => {
      state.isPromptsBackedUp = payload.isPromptsBackedUp;
    },
  },
});

export const MigrationActions = migrationSlice.actions;
