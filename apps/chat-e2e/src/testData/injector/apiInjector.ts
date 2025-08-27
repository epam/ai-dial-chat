import { Conversation } from '@/chat/types/chat';
import { Prompt } from '@/chat/types/prompt';
import { ItemApiHelper } from '@/src/testData/api';
import { DataInjectorInterface } from '@/src/testData/injector/dataInjectorInterface';

export class ApiInjector implements DataInjectorInterface {
  private itemApiHelper: ItemApiHelper;

  constructor(conversationApiHelper: ItemApiHelper) {
    this.itemApiHelper = conversationApiHelper;
  }

  async createPrompts(prompts: Prompt[]): Promise<void> {
    await this.itemApiHelper.createPrompts(prompts);
  }

  async updateConversations(conversations: Conversation[]): Promise<void> {
    for (const conversation of conversations) {
      await this.itemApiHelper.createItem(conversation);
    }
  }

  async updatePrompts(prompts: Prompt[]): Promise<void> {
    await this.itemApiHelper.createPrompts(prompts);
  }

  async createConversations(conversations: Conversation[]) {
    await this.itemApiHelper.createConversations(conversations);
  }

  async deleteAllData() {
    await this.itemApiHelper.deleteAllData();
  }
}
