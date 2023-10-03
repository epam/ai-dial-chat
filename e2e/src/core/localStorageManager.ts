import { Conversation } from '@/src/types/chat';
import { FolderInterface } from '@/src/types/folder';
import { Prompt } from '@/src/types/prompt';

import { Page } from '@playwright/test';

export class LocalStorageManager {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  setFoldersKey = () => (folders: string) => {
    window.localStorage.setItem('folders', folders);
  };

  setConversationHistoryKey = () => (history: string) => {
    window.localStorage.setItem('conversationHistory', history);
  };

  setPromptsKey = () => (prompt: string) => {
    window.localStorage.setItem('prompts', prompt);
  };

  setSelectedConversationKey = () => (selected: string) => {
    window.localStorage.setItem('selectedConversationIds', selected);
  };

  async setConversationHistory(...conversation: Conversation[]) {
    await this.page.addInitScript(
      this.setConversationHistoryKey(),
      JSON.stringify(conversation),
    );
  }

  async updateConversationHistory(...conversation: Conversation[]) {
    await this.page.evaluate(
      this.setConversationHistoryKey(),
      JSON.stringify(conversation),
    );
  }

  async setSelectedConversation(...conversation: Conversation[]) {
    await this.page.addInitScript(
      this.setSelectedConversationKey(),
      JSON.stringify(conversation.map((c) => c.id)),
    );
  }

  async updateSelectedConversation(...conversation: Conversation[]) {
    await this.page.evaluate(
      this.setSelectedConversationKey(),
      JSON.stringify(conversation.map((c) => c.id)),
    );
  }

  async setFolders(...folders: FolderInterface[]) {
    await this.page.addInitScript(
      this.setFoldersKey(),
      JSON.stringify(folders),
    );
  }

  async updateFolders(...folders: FolderInterface[]) {
    await this.page.evaluate(this.setFoldersKey(), JSON.stringify(folders));
  }

  async setPrompts(...prompt: Prompt[]) {
    await this.page.addInitScript(this.setPromptsKey(), JSON.stringify(prompt));
  }

  async updatePrompts(...prompt: Prompt[]) {
    await this.page.evaluate(this.setPromptsKey(), JSON.stringify(prompt));
  }
}
