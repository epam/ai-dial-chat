import { Settings } from '@/chat/types/settings';
import { TestConversation, TestFolder, TestPrompt } from '@/src/testData';
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

  setSettingsKey = () => (settings: string) => {
    window.localStorage.setItem('settings', settings);
  };

  async setConversationHistory(...conversation: TestConversation[]) {
    await this.page.addInitScript(
      this.setConversationHistoryKey(),
      JSON.stringify(conversation),
    );
  }

  async updateConversationHistory(...conversation: TestConversation[]) {
    await this.page.evaluate(
      this.setConversationHistoryKey(),
      JSON.stringify(conversation),
    );
  }

  async setSelectedConversation(...conversation: TestConversation[]) {
    await this.page.addInitScript(
      this.setSelectedConversationKey(),
      JSON.stringify(conversation.map((c) => c.id)),
    );
  }

  async updateSelectedConversation(...conversation: TestConversation[]) {
    await this.page.evaluate(
      this.setSelectedConversationKey(),
      JSON.stringify(conversation.map((c) => c.id)),
    );
  }

  async setFolders(...folders: TestFolder[]) {
    await this.page.addInitScript(
      this.setFoldersKey(),
      JSON.stringify(folders),
    );
  }

  async updateFolders(...folders: TestFolder[]) {
    await this.page.evaluate(this.setFoldersKey(), JSON.stringify(folders));
  }

  async setPrompts(...prompt: TestPrompt[]) {
    await this.page.addInitScript(this.setPromptsKey(), JSON.stringify(prompt));
  }

  async updatePrompts(...prompt: TestPrompt[]) {
    await this.page.evaluate(this.setPromptsKey(), JSON.stringify(prompt));
  }

  async getRecentAddons() {
    return this.page.evaluate(
      () => window.localStorage.getItem('recentAddonsIds') ?? undefined,
    );
  }

  async getRecentModels() {
    return this.page.evaluate(
      () => window.localStorage.getItem('recentModelsIds') ?? undefined,
    );
  }

  async setSettings(theme: string) {
    const settings: Settings = { theme };
    await this.page.addInitScript(
      this.setSettingsKey(),
      JSON.stringify(settings),
    );
  }
}
