import { Conversation } from '@/src/types/chat';
import { Prompt } from '@/src/types/prompt';

export interface MigrationState {
  initialized: boolean;
  conversationsToMigrateCount: number;
  migratedConversationsCount: number;
  failedMigratedConversations: Conversation[];
  isChatsBackedUp: boolean;
  promptsToMigrateCount: number;
  migratedPromptsCount: number;
  failedMigratedPrompts: Prompt[];
  isPromptsBackedUp: boolean;
}
