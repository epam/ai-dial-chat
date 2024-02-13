import { Conversation } from '@/chat/types/chat';
import { FolderInterface } from '@/chat/types/folder';
import { Prompt } from '@/chat/types/prompt';
import { LocalStorageManager } from '@/src/core/localStorageManager';
import { DataInjectorInterface } from '@/src/testData/injector/dataInjectorInterface';

export class BrowserStorageInjector implements DataInjectorInterface {
  private readonly localStorageManager: LocalStorageManager;

  constructor(localStorageManager: LocalStorageManager) {
    this.localStorageManager = localStorageManager;
  }

  async createConversations(
    conversations: Conversation[],
    ...folders: FolderInterface[]
  ): Promise<void> {
    await this.localStorageManager.setFolders(...folders);
    await this.localStorageManager.setConversationHistory(...conversations);
  }

  async updateConversations(
    conversations: Conversation[],
    ...folders: FolderInterface[]
  ) {
    await this.localStorageManager.updateConversationHistory(...conversations);
    await this.localStorageManager.updateFolders(...folders);
  }

  async createPrompts(prompts: Prompt[], ...folders: FolderInterface[]) {
    await this.localStorageManager.setFolders(...folders);
    await this.localStorageManager.setPrompts(...prompts);
  }

  async updatePrompts(prompts: Prompt[], ...folders: FolderInterface[]) {
    await this.localStorageManager.updatePrompts(...prompts);
    await this.localStorageManager.updateFolders(...folders);
  }

  async deleteAllData() {
    return Promise.resolve();
  }
}
