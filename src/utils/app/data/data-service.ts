import { Observable, map } from 'rxjs';

import { isSmallScreen } from '@/src/utils/app/mobile';

import { Conversation, ConversationInfo } from '@/src/types/chat';
import { FolderInterface } from '@/src/types/folder';
import { Prompt, PromptInfo } from '@/src/types/prompt';
import {
  DialStorage,
  MigrationStorageKeys,
  StorageType,
  UIStorageKeys,
} from '@/src/types/storage';
import { Theme } from '@/src/types/themes';

import { SIDEBAR_MIN_WIDTH } from '@/src/constants/default-ui-settings';

import { ApiUtils } from '../../server/api';
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

  public static getPrompts(path?: string): Observable<PromptInfo[]> {
    return this.getDataStorage().getPrompts(path);
  }

  public static getPrompt(info: PromptInfo): Observable<Prompt | null> {
    return this.getDataStorage().getPrompt(info);
  }

  public static createConversation(
    conversation: Conversation,
  ): Observable<void> {
    return this.getDataStorage().createConversation(conversation);
  }

  public static updateConversation(
    conversation: Conversation,
  ): Observable<void> {
    return this.getDataStorage().updateConversation(conversation);
  }

  public static deleteConversation(info: ConversationInfo): Observable<void> {
    return this.getDataStorage().deleteConversation(info);
  }

  public static setPrompts(prompts: Prompt[]): Observable<void> {
    return this.getDataStorage().setPrompts(prompts);
  }

  public static getConversations(
    path?: string,
  ): Observable<ConversationInfo[]> {
    return this.getDataStorage().getConversations(path);
  }

  public static getConversation(
    info: ConversationInfo,
  ): Observable<Conversation | null> {
    return this.getDataStorage().getConversation(info);
  }

  public static createPrompt(prompt: Prompt): Observable<void> {
    return this.getDataStorage().createPrompt(prompt);
  }

  public static updatePrompt(prompt: Prompt): Observable<void> {
    return this.getDataStorage().updatePrompt(prompt);
  }

  public static deletePrompt(info: PromptInfo): Observable<void> {
    return this.getDataStorage().deletePrompt(info);
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
    return ApiUtils.request('api/themes/listing');
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
    return ApiUtils.request(`api/bucket`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  public static getBucket(): string {
    return this.bucket;
  }

  public static getMigratedEntityIds(
    key:
      | MigrationStorageKeys.MigratedConversationIds
      | MigrationStorageKeys.MigratedPromptIds,
  ): Observable<string[]> {
    return BrowserStorage.getData(key, []);
  }

  public static setMigratedEntitiesIds(
    migratedEntityIds: string[],
    key:
      | MigrationStorageKeys.MigratedConversationIds
      | MigrationStorageKeys.MigratedPromptIds,
  ): Observable<void> {
    return BrowserStorage.setData(key, migratedEntityIds);
  }

  public static getIsEntitiesMigrated(
    key:
      | MigrationStorageKeys.IsConversationsMigrated
      | MigrationStorageKeys.IsPromptsMigrated,
  ): Observable<boolean> {
    return BrowserStorage.getData(key, false);
  }

  public static setIsEntitiesMigrated(
    isEntitiesMigrated: boolean,
    key:
      | MigrationStorageKeys.IsConversationsMigrated
      | MigrationStorageKeys.IsPromptsMigrated,
  ): Observable<void> {
    return BrowserStorage.setData(key, isEntitiesMigrated);
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
