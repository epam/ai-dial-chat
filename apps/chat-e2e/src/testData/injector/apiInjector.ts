import { Conversation } from '@/chat/types/chat';
import { FolderInterface } from '@/chat/types/folder';
import { Prompt } from '@/chat/types/prompt';
import { ItemApiHelper } from '@/src/testData/api';
import { DataInjectorInterface } from '@/src/testData/injector/dataInjectorInterface';

export class ApiInjector implements DataInjectorInterface {
  private itemApiHelper: ItemApiHelper;

  constructor(conversationApiHelper: ItemApiHelper) {
    this.itemApiHelper = conversationApiHelper;
  }

  async createPrompts(
    prompts: Prompt[],
    ...folders: FolderInterface[]
  ): Promise<void> {
    await this.itemApiHelper.createPrompts(prompts, ...folders);
  }

  async updateConversations(
    conversations: Conversation[],
    ...folders: FolderInterface[]
  ): Promise<void> {
    await this.itemApiHelper.createConversations(conversations, ...folders);
  }

  async updatePrompts(
    prompts: Prompt[],
    ...folders: FolderInterface[]
  ): Promise<void> {
    await this.itemApiHelper.createPrompts(prompts, ...folders);
  }

  async createConversations(
    conversations: Conversation[],
    ...folders: FolderInterface[]
  ) {
    await this.itemApiHelper.createConversations(conversations, ...folders);
  }

  async deleteAllData() {
    await this.itemApiHelper.deleteAllData();
  }
}
