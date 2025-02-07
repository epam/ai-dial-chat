import { Conversation } from '@/chat/types/chat';
import { BackendChatEntity, BackendDataNodeType } from '@/chat/types/common';
import { Prompt } from '@/chat/types/prompt';
import { API } from '@/src/testData';
import { BaseApiHelper } from '@/src/testData/api/baseApiHelper';
import { BucketUtil, ItemUtil } from '@/src/utils';
import { Entity } from '@epam/ai-dial-shared';
import { expect } from '@playwright/test';

export class ItemApiHelper extends BaseApiHelper {
  public async deleteAllData(bucket?: string) {
    const bucketToUse = this.userBucket ?? bucket;
    const conversations = await this.listItems(
      API.conversationsHost(),
      bucketToUse,
    );
    const prompts = await this.listItems(API.promptsHost(), bucketToUse);
    await this.deleteBackendItem(...conversations, ...prompts);
  }

  public async listItems(url: string, bucket?: string) {
    const bucketToUse = this.userBucket ?? bucket;
    return this.getItems(`${url}/${bucketToUse ?? BucketUtil.getBucket()}`);
  }

  public async listItem(itemUrl: string) {
    return this.getItems(`${API.listingHost}/${itemUrl}`);
  }

  public async getItems(url: string) {
    const response = await this.request.get(this.getHost(url), {
      params: {
        filter: BackendDataNodeType.ITEM,
        recursive: true,
      },
    });
    const statusCode = response.status();
    expect(
      statusCode,
      `Received response code: ${statusCode} with body: ${await response.text()}`,
    ).toBe(200);
    return (await response.json()) as BackendChatEntity[];
  }

  public async getItem(id: string) {
    const response = await this.request.get(this.getHost(`/api/${id}`));
    const statusCode = response.status();
    expect(
      statusCode,
      `Received response code: ${statusCode} with body: ${await response.text()}`,
    ).toBe(200);
    return (await response.json()) as Conversation;
  }

  public async deleteBackendItem(...items: BackendChatEntity[]) {
    for (const item of items) {
      const path = `/api/${item.url}`;
      const response = await this.request.delete(this.getHost(path));
      expect(
        response.status(),
        `Backend item with id: ${item.name} was successfully deleted`,
      ).toBe(200);
    }
  }

  public async deleteEntity(entity: Entity) {
    const url = `/api/${entity.id}`;
    const response = await this.request.delete(this.getHost(url));
    expect(
      response.status(),
      `Entity with id: ${entity.name} was successfully deleted`,
    ).toBe(200);
  }

  public async createConversations(
    conversations: Conversation[],
    bucket?: string,
  ) {
    const bucketToUse = this.userBucket ?? bucket;
    for (const conversation of conversations) {
      conversation.folderId = ItemUtil.getApiConversationFolderId(
        conversation,
        bucketToUse,
      );
      conversation.id = ItemUtil.getApiConversationId(
        conversation,
        bucketToUse,
      );
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
    const url = `/api/${ItemUtil.getEncodedItemId(item.id)}`;
    const response = await this.request.put(this.getHost(url), {
      data: item,
    });
    expect(
      response.status(),
      `Item created with data: ${JSON.stringify(item)}`,
    ).toBe(200);
  }
}
