import { TestConversation, TestFolder, TestPrompt } from '@/src/testData';

export interface DataInjectorInterface {
  createConversations(
    conversations: TestConversation[],
    ...folders: TestFolder[]
  ): Promise<void>;
  updateConversations(
    conversations: TestConversation[],
    ...folders: TestFolder[]
  ): Promise<void>;
  createPrompts(prompts: TestPrompt[], ...folders: TestFolder[]): Promise<void>;
  updatePrompts(prompts: TestPrompt[], ...folders: TestFolder[]): Promise<void>;
  deleteAllData(): Promise<void>;
}
