import { Conversation } from '@/chat/types/chat';
import { BackendDataEntity, BackendDataNodeType } from '@/chat/types/common';
import { Prompt } from '@/chat/types/prompt';
import { API } from '@/src/testData';
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
    return this.getItems(`${url}/${bucket ?? BucketUtil.getBucket()}`);
  }

  public async listItem(itemUrl: string) {
    return this.getItems(`${API.listingHost}/${itemUrl}`);
  }

  public async getItems(url: string) {
    const response = await this.request.get(url, {
      params: {
        filter: BackendDataNodeType.ITEM,
        recursive: true,
      },
    });
    const statusCode = response.status();
    if (statusCode == 200) {
      return (await response.json()) as BackendDataEntity[];
    } else {
      expect(
        statusCode,
        `Received response code: ${statusCode} with body: ${await response.text()}`,
      ).toBe(200);
      return [];
    }
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

  public async deleteConversation(conversation: Conversation) {
    const url = `/api/${conversation.id}`;
    const response = await this.request.delete(url);
    expect(
      response.status(),
      `Conversation with id: ${conversation.name} was successfully deleted`,
    ).toBe(200);
  }

  public async createConversations(
    conversations: Conversation[],
    bucket?: string,
  ) {
    for (const conversation of conversations) {
      conversation.folderId = ItemUtil.getApiConversationFolderId(
        conversation,
        bucket,
      );
      conversation.id = ItemUtil.getApiConversationId(conversation, bucket);
      await this.createItem(conversation);
    }
  }

  public async createPrompts(prompts: Prompt[]) {
    for (const prompt of prompts) {
      prompt.folderId = ItemUtil.getApiPromptFolderId(prompt);
      prompt.id = ItemUtil.getApiPromptId(prompt);
      await this.createItem(prompt);
    }
  }

  public async createItem(item: Prompt | Conversation) {
    const url = `api/${item.id}`;
    const response = await this.request.put(url, {
      data: item,
    });
    expect(
      response.status(),
      `Item created with data: ${JSON.stringify(item)}`,
    ).toBe(200);
  }
}
