/* eslint-disable no-restricted-globals */
import { Observable, map } from 'rxjs';

import { Conversation } from '@/src/types/chat';
import { FolderInterface } from '@/src/types/folder';
import { Prompt } from '@/src/types/prompt';
import { Theme } from '@/src/types/settings';
import { DialStorage } from '@/src/types/storage';

import { ApiMockStorage } from './storages/api-mock-storage';
import { ApiStorage } from './storages/api-storage';
import { BrowserStorage } from './storages/browser-storage';

export class DataService {
  private static dataStorage: DialStorage;

  public static init(storageType?: string) {
    BrowserStorage.init();
    this.setDataStorage(storageType);
  }

  public static getConversationsFolders(): Observable<FolderInterface[]> {
    return this.getDataStorage().getConversationsFolders();
  }

  public static setConversationFolders(
    folders: FolderInterface[],
  ): Observable<void> {
    return this.getDataStorage().setConversationsFolders(folders);
  }

  public static getPromptsFolders(): Observable<FolderInterface[]> {
    return this.getDataStorage().getPromptsFolders();
  }
  public static setPromptFolders(folders: FolderInterface[]): Observable<void> {
    return this.getDataStorage().setPromptsFolders(folders);
  }

  public static getPrompts(): Observable<Prompt[]> {
    return this.getDataStorage().getPrompts();
  }

  public static setPrompts(prompts: Prompt[]): Observable<void> {
    return this.getDataStorage().setPrompts(prompts);
  }

  public static getConversations(): Observable<Conversation[]> {
    return this.getDataStorage().getConversations();
  }
  public static setConversations(
    conversations: Conversation[],
  ): Observable<void> {
    return this.getDataStorage().setConversations(conversations);
  }
  public static getSelectedConversationsIds(): Observable<string[]> {
    return BrowserStorage.getData('selectedConversationIds', []);
  }
  public static setSelectedConversationsIds(
    selectedConversationsIds: string[],
  ): Observable<void> {
    return BrowserStorage.setData(
      'selectedConversationIds',
      selectedConversationsIds,
    );
  }
  public static getRecentModelsIds(): Observable<string[]> {
    return BrowserStorage.getData('recentModelsIds', []);
  }
  public static setRecentModelsIds(
    recentModelsIds: string[],
  ): Observable<void> {
    return BrowserStorage.setData('recentModelsIds', recentModelsIds);
  }

  public static getRecentAddonsIds(): Observable<string[]> {
    return BrowserStorage.getData('recentAddonsIds', []);
  }
  public static setRecentAddonsIds(
    recentAddonsIds: string[],
  ): Observable<void> {
    return BrowserStorage.setData('recentAddonsIds', recentAddonsIds);
  }

  public static getTheme(): Observable<Theme> {
    return BrowserStorage.getData('settings', { theme: 'dark' as Theme }).pipe(
      map((settings) => settings.theme),
    );
  }
  public static setTheme(theme: Theme): Observable<void> {
    return BrowserStorage.setData('settings', { theme });
  }
  public static getShowChatbar(): Observable<boolean> {
    return BrowserStorage.getData('showChatbar', true);
  }
  public static setShowChatbar(showChatbar: boolean): Observable<void> {
    return BrowserStorage.setData('showChatbar', showChatbar);
  }
  public static getShowPromptbar(): Observable<boolean> {
    return BrowserStorage.getData('showPromptbar', true);
  }
  public static setShowPromptbar(showPromptbar: boolean): Observable<void> {
    return BrowserStorage.setData('showPromptbar', showPromptbar);
  }
  public static getOpenedFolderIds(): Observable<string[]> {
    return BrowserStorage.getData('openedFoldersIds', []);
  }
  public static setOpenedFolderIds(
    openedFolderIds: string[],
  ): Observable<void> {
    return BrowserStorage.setData('openedFoldersIds', openedFolderIds);
  }

  private static getDataStorage(): DialStorage {
    if (!this.dataStorage) {
      this.setDataStorage();
    }
    return this.dataStorage;
  }

  private static setDataStorage(dataStorageType?: string): void {
    switch (dataStorageType) {
      case 'api':
        this.dataStorage = new ApiStorage();
        break;
      case 'apiMock':
        this.dataStorage = new ApiMockStorage();
        break;
      case 'browserStorage':
      default:
        this.dataStorage = new BrowserStorage();
    }
  }
}
