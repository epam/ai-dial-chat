import { Conversation } from '@/chat/types/chat';
import { FolderInterface } from '@/chat/types/folder';
import { Prompt } from '@/chat/types/prompt';

export interface DataInjectorInterface {
  createConversations(
    conversations: Conversation[],
    ...folders: FolderInterface[]
  ): Promise<void>;
  updateConversations(
    conversations: Conversation[],
    ...folders: FolderInterface[]
  ): Promise<void>;
  createPrompts(
    prompts: Prompt[],
    ...folders: FolderInterface[]
  ): Promise<void>;
  updatePrompts(
    prompts: Prompt[],
    ...folders: FolderInterface[]
  ): Promise<void>;
  deleteAllData(): Promise<void>;
}
