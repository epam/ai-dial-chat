import { Conversation } from '@/chat/types/chat';
import { BackendDataEntity, BackendDataNodeType } from '@/chat/types/common';
import { FolderInterface } from '@/chat/types/folder';
import { Prompt } from '@/chat/types/prompt';
import { API } from '@/src/testData';
import { BaseApiHelper } from '@/src/testData/api/baseApiHelper';
import { BucketUtil, ConversationUtil } from '@/src/utils';
import { expect } from '@playwright/test';

export class ItemApiHelper extends BaseApiHelper {
  public async deleteAllData() {
    const conversations = await this.listItems(API.conversationsListingHost());
    const prompts = await this.listItems(API.promptsListingHost());
    await this.deleteBackendItem(...conversations, ...prompts);
  }

  public async listItems(url: string) {
    const response = await this.request.get(url, {
      params: {
        filter: BackendDataNodeType.ITEM,
        bucket: BucketUtil.getBucket(),
        recursive: true,
      },
    });
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

  public async createConversations(
    conversations: Conversation[],
    ...folders: FolderInterface[]
  ) {
    for (const conversation of conversations) {
      const path = await this.getItemPath(conversation, ...folders);
      conversation.id =
        path.length === 0
          ? ConversationUtil.getApiConversationId(conversation)
          : `${path}/${ConversationUtil.getApiConversationId(conversation)}`;
      await this.createItem(API.conversationsHost, conversation);
    }
  }

  public async createPrompts(prompts: Prompt[], ...folders: FolderInterface[]) {
    for (const prompt of prompts) {
      const path = await this.getItemPath(prompt, ...folders);
      prompt.id = path.length === 0 ? prompt.name : `${path}/${prompt.name}`;
      await this.createItem(API.promptsHost, prompt);
    }
  }

  private async createItem(host: string, item: Prompt | Conversation) {
    const url = `${host}/${BucketUtil.getBucket()}/${item.id}`;
    const response = await this.request.put(url, {
      data: item,
    });
    expect(
      response.status(),
      `Item created with data: ${JSON.stringify(item)}`,
    ).toBe(200);
  }

  private async getItemPath(
    item: Prompt | Conversation,
    ...folders: FolderInterface[]
  ) {
    let path = '';
    const itemFolderId = item.folderId;
    if (itemFolderId) {
      let itemFolder = folders.find((f) => f.id === itemFolderId);
      path = itemFolder!.name;
      while (itemFolder!.folderId) {
        itemFolder = folders.find((f) => f.id === itemFolder?.folderId);
        path = `${itemFolder?.name}/${path}`;
      }
      item.folderId = path;
    }
    return path;
  }
}
