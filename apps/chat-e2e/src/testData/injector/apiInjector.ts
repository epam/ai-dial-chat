import { TestConversation, TestFolder, TestPrompt } from '@/src/testData';
import { ItemApiHelper } from '@/src/testData/api';
import { DataInjectorInterface } from '@/src/testData/injector/dataInjectorInterface';

export class ApiInjector implements DataInjectorInterface {
  private itemApiHelper: ItemApiHelper;

  constructor(conversationApiHelper: ItemApiHelper) {
    this.itemApiHelper = conversationApiHelper;
  }

  async createPrompts(
    prompts: TestPrompt[],
    ...folders: TestFolder[]
  ): Promise<void> {
    await this.itemApiHelper.createPrompts(prompts, ...folders);
  }

  async updateConversations(
    conversations: TestConversation[],
    ...folders: TestFolder[]
  ): Promise<void> {
    await this.itemApiHelper.createConversations(conversations, ...folders);
  }

  async updatePrompts(
    prompts: TestPrompt[],
    ...folders: TestFolder[]
  ): Promise<void> {
    await this.itemApiHelper.createPrompts(prompts, ...folders);
  }

  async createConversations(
    conversations: TestConversation[],
    ...folders: TestFolder[]
  ) {
    await this.itemApiHelper.createConversations(conversations, ...folders);
  }

  async deleteAllData() {
    await this.itemApiHelper.deleteAllData();
  }
}
