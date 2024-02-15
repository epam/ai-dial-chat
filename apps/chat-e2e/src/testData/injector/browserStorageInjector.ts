import { LocalStorageManager } from '@/src/core/localStorageManager';
import { TestConversation, TestFolder, TestPrompt } from '@/src/testData';
import { DataInjectorInterface } from '@/src/testData/injector/dataInjectorInterface';

export class BrowserStorageInjector implements DataInjectorInterface {
  private readonly localStorageManager: LocalStorageManager;

  constructor(localStorageManager: LocalStorageManager) {
    this.localStorageManager = localStorageManager;
  }

  async createConversations(
    conversations: TestConversation[],
    ...folders: TestFolder[]
  ): Promise<void> {
    await this.localStorageManager.setFolders(...folders);
    await this.localStorageManager.setConversationHistory(...conversations);
  }

  async updateConversations(
    conversations: TestConversation[],
    ...folders: TestFolder[]
  ) {
    await this.localStorageManager.updateConversationHistory(...conversations);
    await this.localStorageManager.updateFolders(...folders);
  }

  async createPrompts(prompts: TestPrompt[], ...folders: TestFolder[]) {
    await this.localStorageManager.setFolders(...folders);
    await this.localStorageManager.setPrompts(...prompts);
  }

  async updatePrompts(prompts: TestPrompt[], ...folders: TestFolder[]) {
    await this.localStorageManager.updatePrompts(...prompts);
    await this.localStorageManager.updateFolders(...folders);
  }

  async deleteAllData() {
    return Promise.resolve();
  }
}
