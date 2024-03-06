import { BackendDataEntity, BackendDataNodeType } from '@/chat/types/common';
import { API, TestConversation, TestFolder, TestPrompt } from '@/src/testData';
import { BaseApiHelper } from '@/src/testData/api/baseApiHelper';
import { BucketUtil, ItemUtil } from '@/src/utils';
import { expect } from '@playwright/test';

export class ItemApiHelper extends BaseApiHelper {
  public async deleteAllData(bucket?: string) {
    const conversations = await this.listItems(API.conversationsHost(), bucket);
    const prompts = await this.listItems(API.promptsHost(), bucket);
    await this.deleteBackendItem(...conversations, ...prompts);
  }

  public async listItems(url: string, bucket?: string) {
    const response = await this.request.get(
      `${url}/${bucket ?? BucketUtil.getBucket()}`,
      {
        params: {
          filter: BackendDataNodeType.ITEM,
          recursive: true,
        },
      },
    );
    const entities = (await response.json()) as BackendDataEntity[];
    expect(
      response.status(),
      `Received items: ${JSON.stringify(entities)}`,
    ).toBe(200);
    return entities;
  }

  public async deleteBackendItem(...items: BackendDataEntity[]) {
    for (const item of items) {
      const url = `/api/${item.url}`;
      const response = await this.request.delete(url);
      expect(
        response.status(),
        `Backend item with id: ${item.name} was successfully deleted`,
      ).toBe(200);
    }
  }

  public async deleteConversation(conversation: TestConversation) {
    const url = `/api/${conversation.id}`;
    const response = await this.request.delete(url);
    expect(
      response.status(),
      `Conversation with id: ${conversation.name} was successfully deleted`,
    ).toBe(200);
  }

  public async createConversations(
    conversations: TestConversation[],
    ...folders: TestFolder[]
  ) {
    for (const conversation of conversations) {
      const path = await this.getItemPath(conversation, ...folders);
      conversation.folderId = ItemUtil.getApiConversationFolderId(path);
      conversation.id = ItemUtil.getApiConversationId(conversation, path);
      await this.createItem(conversation);
    }
  }

  public async createPrompts(prompts: TestPrompt[], ...folders: TestFolder[]) {
    for (const prompt of prompts) {
      const path = await this.getItemPath(prompt, ...folders);
      prompt.folderId = ItemUtil.getApiPromptFolderId(path);
      prompt.id = ItemUtil.getApiPromptId(prompt, path);
      await this.createItem(prompt);
    }
  }

  private async createItem(item: TestPrompt | TestConversation) {
    const url = `api/${item.id}`;
    const response = await this.request.put(url, {
      data: item,
    });
    expect(
      response.status(),
      `Item created with data: ${JSON.stringify(item)}`,
    ).toBe(200);
  }

  private async getItemPath(
    item: TestPrompt | TestConversation,
    ...folders: TestFolder[]
  ) {
    let path = '';
    const itemFolderId = item.folderId;
    if (itemFolderId && folders.length > 0) {
      let itemFolder = folders.find((f) => f.id === itemFolderId);
      path = itemFolder!.name;
      while (itemFolder!.folderId) {
        itemFolder = folders.find((f) => f.id === itemFolder?.folderId);
        path = `${itemFolder?.name}/${path}`;
      }
    }
    return path;
  }
}
