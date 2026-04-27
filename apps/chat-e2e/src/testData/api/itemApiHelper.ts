import { Conversation } from '@/chat/types/chat';
import {
  BackendChatEntity,
  BackendDataNodeType,
  BackendEntity,
} from '@/chat/types/common';
import { Prompt } from '@/chat/types/prompt';
import { API, ExpectedMessages } from '@/src/testData';
import { BaseApiHelper } from '@/src/testData/api/baseApiHelper';
import { BucketUtil, ItemUtil, applicationNamePrefix } from '@/src/utils';
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
    const apps = await this.listItems(API.appsHost(), bucketToUse);
    await this.deleteBackendItem(
      ...conversations,
      ...prompts,
      ...apps.filter((a) =>
        a.name.toLowerCase().includes(applicationNamePrefix.toLowerCase()),
      ),
    );
  }

  public async listItems(
    url: string,
    bucket?: string,
  ): Promise<BackendChatEntity[]> {
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
      ExpectedMessages.apiItemReceived(statusCode, await response.text()),
    ).toBe(200);
    return (await response.json()) as BackendChatEntity[];
  }

  public async getItem<T>(id: string) {
    const response = await this.request.get(this.getHost(`${API.api}/${id}`));
    const statusCode = response.status();
    expect
      .soft(
        statusCode,
        ExpectedMessages.apiItemReceived(statusCode, await response.text()),
      )
      .toBe(200);
    return (await response.json()) as T;
  }

  public async deleteBackendItem(...items: BackendEntity[]) {
    for (const item of items) {
      const path = `${API.api}/${item.url}`;
      const response = await this.request.delete(this.getHost(path));
      expect(
        response.status(),
        ExpectedMessages.apiItemDeleted(item.name),
      ).toBe(200);
    }
  }

  public async deleteEntity(entity: Entity | string) {
    const url = `${API.api}/${typeof entity === 'string' ? entity : entity.id}`;
    const response = await this.request.delete(this.getHost(url));
    expect(
      response.status(),
      ExpectedMessages.apiItemDeleted(
        typeof entity === 'string' ? entity : entity.name,
      ),
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

  public async createPrompts(prompts: Prompt[], bucket?: string) {
    const bucketToUse = this.userBucket ?? bucket;
    for (const prompt of prompts) {
      prompt.folderId = ItemUtil.getApiPromptFolderId(prompt, bucketToUse);
      prompt.id = ItemUtil.getApiPromptId(prompt, bucketToUse);
      await this.createItem(prompt);
    }
  }

  public async createItem(item: Prompt | Conversation) {
    const url = `${API.api}/${ItemUtil.getEncodedItemId(item.id)}`;
    const response = await this.request.put(this.getHost(url), {
      data: item,
    });
    expect(
      response.status(),
      ExpectedMessages.apiItemCreated(JSON.stringify(item)),
    ).toBe(200);
  }
}
