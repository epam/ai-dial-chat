import { Conversation } from '@/types/chat';
import { FolderInterface } from '@/types/folder';

import { Page } from '@playwright/test';

export class LocalStorageManager {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async setConversationHistory(...conversation: Conversation[]) {
    await this.page.addInitScript((history) => {
      window.localStorage.setItem('conversationHistory', history);
    }, JSON.stringify(conversation));
  }

  async setSelectedConversation(conversation: Conversation) {
    await this.page.addInitScript((selected) => {
      window.localStorage.setItem('selectedConversationIds', selected);
    }, `[${JSON.stringify(conversation.id)}]`);
  }

  async setFolders(...folders: FolderInterface[]) {
    await this.page.addInitScript((folders) => {
      window.localStorage.setItem('folders', folders);
    }, JSON.stringify(folders));
  }
}
