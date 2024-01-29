/* eslint-disable no-restricted-globals */
import { Observable, map } from 'rxjs';

import { isSmallScreen } from '@/src/utils/app/mobile';

import { Conversation } from '@/src/types/chat';
import { FolderInterface } from '@/src/types/folder';
import { Prompt } from '@/src/types/prompt';
import { DialStorage, StorageType, UIStorageKeys } from '@/src/types/storage';
import { Theme } from '@/src/types/themes';

import { SIDEBAR_MIN_WIDTH } from '@/src/constants/default-ui-settings';

import { FileService } from './fileService';
import { ApiStorage } from './storages/api-storage';
import { BrowserStorage } from './storages/browser-storage';

export class DataService extends FileService {
  private static dataStorage: DialStorage;
  private static bucket: string;

  public static init(storageType?: string) {
    BrowserStorage.init();
    this.setDataStorage(storageType);
  }

  public static setBucket(bucket: string): void {
    this.bucket = bucket;
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
    return BrowserStorage.getData(UIStorageKeys.SelectedConversationIds, []);
  }

  public static setSelectedConversationsIds(
    selectedConversationsIds: string[],
  ): Observable<void> {
    return BrowserStorage.setData(
      UIStorageKeys.SelectedConversationIds,
      selectedConversationsIds,
    );
  }

  public static getRecentModelsIds(): Observable<string[]> {
    return BrowserStorage.getData(UIStorageKeys.RecentModelsIds, []);
  }

  public static setRecentModelsIds(
    recentModelsIds: string[],
  ): Observable<void> {
    return BrowserStorage.setData(
      UIStorageKeys.RecentModelsIds,
      recentModelsIds,
    );
  }

  public static getRecentAddonsIds(): Observable<string[]> {
    return BrowserStorage.getData(UIStorageKeys.RecentAddonsIds, []);
  }

  public static setRecentAddonsIds(
    recentAddonsIds: string[],
  ): Observable<void> {
    return BrowserStorage.setData(
      UIStorageKeys.RecentAddonsIds,
      recentAddonsIds,
    );
  }

  public static getTheme(): Observable<string> {
    return BrowserStorage.getData(UIStorageKeys.Settings, { theme: '' }).pipe(
      map((settings) => settings.theme),
    );
  }

  public static setTheme(theme: string): Observable<void> {
    return BrowserStorage.setData(UIStorageKeys.Settings, { theme });
  }

  public static getAvailableThemes(): Observable<Theme[]> {
    return ApiStorage.request('api/themes/listing');
  }

  public static getChatbarWidth(): Observable<number> {
    return BrowserStorage.getData(
      UIStorageKeys.ChatbarWidth,
      SIDEBAR_MIN_WIDTH,
    );
  }

  public static setChatbarWidth(chatBarWidth: number): Observable<void> {
    return BrowserStorage.setData(UIStorageKeys.ChatbarWidth, chatBarWidth);
  }

  public static getPromptbarWidth(): Observable<number> {
    return BrowserStorage.getData(
      UIStorageKeys.PromptbarWidth,
      SIDEBAR_MIN_WIDTH,
    );
  }

  public static setPromptbarWidth(promptBarWidth: number): Observable<void> {
    return BrowserStorage.setData(UIStorageKeys.PromptbarWidth, promptBarWidth);
  }

  public static getIsChatFullWidth(): Observable<boolean> {
    return BrowserStorage.getData(UIStorageKeys.IsChatFullWidth, false);
  }

  public static setIsChatFullWidth(IsChatFullWidth: boolean): Observable<void> {
    return BrowserStorage.setData(
      UIStorageKeys.IsChatFullWidth,
      IsChatFullWidth,
    );
  }

  public static getShowChatbar(): Observable<boolean> {
    return BrowserStorage.getData(UIStorageKeys.ShowChatbar, !isSmallScreen());
  }

  public static setShowChatbar(showChatbar: boolean): Observable<void> {
    return BrowserStorage.setData(UIStorageKeys.ShowChatbar, showChatbar);
  }

  public static getShowPromptbar(): Observable<boolean> {
    return BrowserStorage.getData(
      UIStorageKeys.ShowPromptbar,
      !isSmallScreen(),
    );
  }

  public static setShowPromptbar(showPromptbar: boolean): Observable<void> {
    return BrowserStorage.setData(UIStorageKeys.ShowPromptbar, showPromptbar);
  }

  public static getOpenedFolderIds(): Observable<string[]> {
    return BrowserStorage.getData(UIStorageKeys.OpenedFoldersIds, []);
  }

  public static setOpenedFolderIds(
    openedFolderIds: string[],
  ): Observable<void> {
    return BrowserStorage.setData(
      UIStorageKeys.OpenedFoldersIds,
      openedFolderIds,
    );
  }

  public static getClosedAnnouncement(): Observable<string | undefined> {
    return BrowserStorage.getData(UIStorageKeys.TextOfClosedAnnouncement, '');
  }

  public static setClosedAnnouncement(
    closedAnnouncementText: string | undefined,
  ): Observable<void> {
    return BrowserStorage.setData(
      UIStorageKeys.TextOfClosedAnnouncement,
      closedAnnouncementText || '',
    );
  }

  public static requestBucket(): Observable<{ bucket: string }> {
    return ApiStorage.request(`api/bucket`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  public static getBucket(): string {
    return this.bucket;
  }

  private static getDataStorage(): DialStorage {
    if (!this.dataStorage) {
      this.setDataStorage();
    }
    return this.dataStorage;
  }

  private static setDataStorage(dataStorageType?: string): void {
    switch (dataStorageType) {
      case StorageType.API:
        this.dataStorage = new ApiStorage();
        break;
      case StorageType.BrowserStorage:
      default:
        this.dataStorage = new BrowserStorage();
    }
  }
}
