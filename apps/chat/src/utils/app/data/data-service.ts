/* eslint-disable no-restricted-globals */
import { Observable, map } from 'rxjs';

import { isMediumScreenOrMobile } from '@/src/utils/app/mobile';

import { DialStorage, StorageType, UIStorageKeys } from '@/src/types/storage';
import { Theme } from '@/src/types/themes';

import { SIDEBAR_MIN_WIDTH } from '@/src/constants/default-ui-settings';

import { ApiUtils } from '../../server/api';
import { ApiStorage } from './storages/api-storage';
import { BrowserStorage } from './storages/browser-storage';

export class DataService {
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
      case StorageType.BrowserStorage:
        this.dataStorage = new BrowserStorage();
        break;
      case StorageType.API:
      default:
        this.dataStorage = new ApiStorage();
    }
  }

  // TODO: extract all this methods to separate services to prevent using Data service there
  public static getRecentModelsIds(): Observable<string[] | undefined> {
    return BrowserStorage.getData(UIStorageKeys.RecentModelsIds, undefined);
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
    return BrowserStorage.getData(
      UIStorageKeys.ShowChatbar,
      !isMediumScreenOrMobile(),
    );
  }

  public static setShowChatbar(showChatbar: boolean): Observable<void> {
    return BrowserStorage.setData(UIStorageKeys.ShowChatbar, showChatbar);
  }

  public static getShowPromptbar(): Observable<boolean> {
    return BrowserStorage.getData(
      UIStorageKeys.ShowPromptbar,
      !isMediumScreenOrMobile(),
    );
  }

  public static setShowPromptbar(showPromptbar: boolean): Observable<void> {
    return BrowserStorage.setData(UIStorageKeys.ShowPromptbar, showPromptbar);
  }

  public static getShowMarketplaceFilterbar(): Observable<boolean> {
    return BrowserStorage.getData(
      UIStorageKeys.ShowMarketplaceFilterbar,
      !isMediumScreenOrMobile(),
    );
  }

  public static setShowMarketplaceFilterbar(
    showFilterbar: boolean,
  ): Observable<void> {
    return BrowserStorage.setData(
      UIStorageKeys.ShowMarketplaceFilterbar,
      showFilterbar,
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

  public static getCustomLogo(): Observable<string | undefined> {
    return BrowserStorage.getData(UIStorageKeys.CustomLogo, '');
  }

  public static setCustomLogo(customLogo: string): Observable<void> {
    return BrowserStorage.setData(UIStorageKeys.CustomLogo, customLogo);
  }

  public static getChatCollapsedSections(): Observable<string[]> {
    return BrowserStorage.getData(UIStorageKeys.ChatCollapsedSections, []);
  }

  public static setChatCollapsedSections(
    collapsedSections: string[],
  ): Observable<void> {
    return BrowserStorage.setData(
      UIStorageKeys.ChatCollapsedSections,
      collapsedSections,
    );
  }

  public static getPromptCollapsedSections(): Observable<string[]> {
    return BrowserStorage.getData(UIStorageKeys.PromptCollapsedSections, []);
  }

  public static setPromptCollapsedSections(
    collapsedSections: string[],
  ): Observable<void> {
    return BrowserStorage.setData(
      UIStorageKeys.PromptCollapsedSections,
      collapsedSections,
    );
  }

  public static getFileCollapsedSections(): Observable<string[]> {
    return BrowserStorage.getData(UIStorageKeys.FileCollapsedSections, []);
  }

  public static setFileCollapsedSections(
    collapsedSections: string[],
  ): Observable<void> {
    return BrowserStorage.setData(
      UIStorageKeys.FileCollapsedSections,
      collapsedSections,
    );
  }
}
