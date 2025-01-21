import { Conversation } from '@/chat/types/chat';
import { FolderInterface } from '@/chat/types/folder';
import { DialAIEntityModel } from '@/chat/types/models';
import { Prompt } from '@/chat/types/prompt';
import { Settings } from '@/chat/types/settings';
import { CollapsedSections } from '@/src/testData';
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

  private setChatCollapsedSectionKey = () => (collapsed: string) => {
    window.localStorage.setItem('chatCollapsedSections', collapsed);
  };

  private setPromptCollapsedSectionKey = () => (collapsed: string) => {
    window.localStorage.setItem('promptCollapsedSections', collapsed);
  };

  setSettingsKey = () => (settings: string) => {
    window.localStorage.setItem('settings', settings);
  };

  setRecentModelsIdsKey = () => (modelIds: string) => {
    window.localStorage.setItem('recentModelsIds', modelIds);
  };

  setRecentAddonsIdsKey = () => (addonIds: string) => {
    window.localStorage.setItem('recentAddonsIds', addonIds);
  };

  setChatbarWidthKey = () => (width: string) => {
    window.localStorage.setItem('chatbarWidth', width);
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

  async setChatCollapsedSection(...sections: CollapsedSections[]) {
    await this.page.addInitScript(
      this.setChatCollapsedSectionKey(),
      JSON.stringify(sections),
    );
  }

  async setPromptCollapsedSection(...sections: CollapsedSections[]) {
    await this.page.addInitScript(
      this.setPromptCollapsedSectionKey(),
      JSON.stringify(sections),
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

  async setRecentModelsIds(...models: DialAIEntityModel[]) {
    await this.page.addInitScript(
      this.setRecentModelsIdsKey(),
      JSON.stringify(models.map((m) => m.id)),
    );
  }

  async setRecentModelsIdsOnce(...models: DialAIEntityModel[]) {
    const uniqueKey = `recentModelsSet_${Date.now()}`;
    await this.page.addInitScript(
      (data) => {
        const { modelIds, key } = data;
        if (!sessionStorage.getItem(key)) {
          localStorage.setItem('recentModelsIds', modelIds);
          sessionStorage.setItem(key, 'true');
        }
      },
      {
        modelIds: JSON.stringify(models.map((m) => m.id)),
        key: uniqueKey,
      },
    );
  }

  async setRecentAddonsIds(...addons: DialAIEntityModel[]) {
    await this.page.addInitScript(
      this.setRecentAddonsIdsKey(),
      JSON.stringify(addons.map((a) => a.id)),
    );
  }

  async setChatbarWidth(width: string) {
    await this.page.addInitScript(this.setChatbarWidthKey(), width);
  }

  async getSelectedConversationIds(originHost?: string) {
    let selectedConversationIds;
    const storage = await this.page.context().storageState();
    let origin;
    if (originHost) {
      origin = storage.origins.find((o) => o.origin === originHost);
    } else {
      origin = storage.origins[0];
    }
    if (origin) {
      selectedConversationIds = origin.localStorage.find(
        (s) => s.name === 'selectedConversationIds',
      )?.value;
    }
    return selectedConversationIds ? JSON.parse(selectedConversationIds) : '';
  }
}
