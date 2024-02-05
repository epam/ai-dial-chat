/* eslint-disable no-restricted-globals */
import { Observable, map } from 'rxjs';

import { isSmallScreen } from '@/src/utils/app/mobile';

import { FeatureType } from '@/src/types/common';
import { DialStorage, StorageType, UIStorageKeys } from '@/src/types/storage';
import { Theme } from '@/src/types/themes';

import { openFoldersInitialState } from '@/src/store/ui/ui.reducers';

import { SIDEBAR_MIN_WIDTH } from '@/src/constants/default-ui-settings';

import { ApiUtils } from '../../server/api';
import { ApiStorage } from './storages/api-storage';
import { BrowserStorage } from './storages/browser-storage';

export class DataService {
  // storage
  private static dataStorage: DialStorage;

  public static init(storageType?: string) {
    BrowserStorage.init();
    this.setDataStorage(storageType);
  }

  public static getDataStorage(): DialStorage {
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

  // other methods
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

  public static getOpenedFolderIds(): Observable<
    Record<FeatureType, string[]>
  > {
    return BrowserStorage.getData(
      UIStorageKeys.OpenedFoldersIds,
      openFoldersInitialState,
    );
  }

  public static setOpenedFolderIds(
    openedFolderIds: Record<FeatureType, string[]>,
  ): Observable<void> {
    return BrowserStorage.setData(
      UIStorageKeys.OpenedFoldersIds,
      openedFolderIds &&
        openedFolderIds[FeatureType.Chat] &&
        openedFolderIds[FeatureType.Prompt]
        ? openedFolderIds
        : openFoldersInitialState,
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
}
