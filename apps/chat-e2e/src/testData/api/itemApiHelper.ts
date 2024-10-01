import { Conversation } from '@/chat/types/chat';
import {
  BackendDataEntity,
  BackendDataNodeType,
  Entity,
} from '@/chat/types/common';
import { Prompt } from '@/chat/types/prompt';
import { API } from '@/src/testData';
import { BaseApiHelper } from '@/src/testData/api/baseApiHelper';
import { BucketUtil, ItemUtil } from '@/src/utils';
import { expect } from '@playwright/test';
import * as process from 'node:process';
import { APIRequestContext } from 'playwright-core';

export class ItemApiHelper extends BaseApiHelper {
  private readonly userBucket?: string;
  constructor(request: APIRequestContext, userBucket?: string) {
    super(request);
    this.userBucket = userBucket;
  }
  public async deleteAllData(bucket?: string, isOverlay = false) {
    const bucketToUse = this.userBucket ?? bucket;
    const conversations = await this.listItems(
      API.conversationsHost(),
      bucketToUse,
      isOverlay,
    );
    const prompts = await this.listItems(
      API.promptsHost(),
      bucketToUse,
      isOverlay,
    );
    await this.deleteBackendItem(isOverlay, ...conversations, ...prompts);
  }

  public async listItems(url: string, bucket?: string, isOverlay?: boolean) {
    const bucketToUse = this.userBucket ?? bucket;
    return this.getItems(
      `${url}/${bucketToUse ?? BucketUtil.getBucket()}`,
      isOverlay,
    );
  }

  public async listItem(itemUrl: string) {
    return this.getItems(`${API.listingHost}/${itemUrl}`);
  }

  public async getItems(url: string, isOverlay?: boolean) {
    const response = await this.request.get(
      isOverlay ? process.env.NEXT_PUBLIC_OVERLAY_HOST + url : url,
      {
        params: {
          filter: BackendDataNodeType.ITEM,
          recursive: true,
        },
      },
    );
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

  public async deleteBackendItem(
    isOverlay?: boolean,
    ...items: BackendDataEntity[]
  ) {
    for (const item of items) {
      const path = `/api/${item.url}`;
      const url = isOverlay
        ? process.env.NEXT_PUBLIC_OVERLAY_HOST + path
        : path;
      const response = await this.request.delete(url);
      expect(
        response.status(),
        `Backend item with id: ${item.name} was successfully deleted`,
      ).toBe(200);
    }
  }

  public async deleteEntity(entity: Entity) {
    const url = `/api/${entity.id}`;
    const response = await this.request.delete(url);
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
    const url = `api/${ItemUtil.getEncodedItemId(item.id)}`;
    const response = await this.request.put(url, {
      data: item,
    });
    expect(
      response.status(),
      `Item created with data: ${JSON.stringify(item)}`,
    ).toBe(200);
  }
}
