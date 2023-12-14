/* eslint-disable no-restricted-globals */
import { Observable, map } from 'rxjs';

import { Conversation } from '@/src/types/chat';
import {
  BackendFile,
  BackendFileFolder,
  DialFile,
  FileFolderInterface,
} from '@/src/types/files';
import { FolderInterface, FolderType } from '@/src/types/folder';
import { Prompt } from '@/src/types/prompt';
import { DialStorage, UIStorageKeys } from '@/src/types/storage';
import { Theme } from '@/src/types/themes';

import { SIDEBAR_MIN_WIDTH } from '@/src/constants/default-ui-settings';

import { getPathNameId, getRelativePath } from '../file';
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

  public static getShowChatbar(): Observable<boolean> {
    return BrowserStorage.getData(UIStorageKeys.ShowChatbar, true);
  }

  public static setShowChatbar(showChatbar: boolean): Observable<void> {
    return BrowserStorage.setData(UIStorageKeys.ShowChatbar, showChatbar);
  }

  public static getShowPromptbar(): Observable<boolean> {
    return BrowserStorage.getData(UIStorageKeys.ShowPromptbar, true);
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

  public static sendFile(
    formData: FormData,
    path?: string | null | undefined,
  ): Observable<{ percent?: number; result?: DialFile }> {
    return ApiStorage.requestOld({
      url: `api/files${path ? '?path=' + path : ''}`,
      method: 'POST',
      async: true,
      body: formData,
    }).pipe(
      map(
        ({
          percent,
          result,
        }: {
          percent?: number;
          result?: BackendFile;
        }): { percent?: number; result?: DialFile } => {
          if (percent) {
            return { percent };
          }

          if (!result) {
            return {};
          }

          const relativePath = getRelativePath(result.path);
          return {
            result: {
              id: getPathNameId(result.name, relativePath),
              name: result.name,
              absolutePath: result.path,
              relativePath: relativePath,
              folderId: relativePath,
              contentLength: result.contentLength,
              contentType: result.contentType,
              serverSynced: true,
            },
          };
        },
      ),
    );
  }

  public static getFileFolders(
    parentPath?: string,
  ): Observable<FileFolderInterface[]> {
    const query = new URLSearchParams({
      filter: 'FOLDER',
      ...(parentPath && { path: parentPath }),
    });
    const resultQuery = query.toString();

    return ApiStorage.request(
      `api/files/listing${resultQuery ? '?' + resultQuery : ''}`,
    ).pipe(
      map((folders: BackendFileFolder[]) => {
        return folders.map((folder): FileFolderInterface => {
          const relativePath = getRelativePath(folder.path);

          return {
            id: getPathNameId(folder.name, relativePath),
            name: folder.name,
            type: FolderType.File,
            absolutePath: folder.path,
            relativePath: relativePath,
            folderId: relativePath,
            serverSynced: true,
          };
        });
      }),
    );
  }

  public static removeFile(filePath: string): Observable<void> {
    const query = new URLSearchParams({
      path: filePath,
    });
    const resultQuery = query.toString();

    return ApiStorage.request(`api/files${'?' + resultQuery}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  public static getFiles(parentPath?: string): Observable<DialFile[]> {
    const query = new URLSearchParams({
      filter: 'FILE',
      ...(parentPath && { path: parentPath }),
    });
    const resultQuery = query.toString();

    return ApiStorage.request(
      `api/files/listing${resultQuery ? '?' + resultQuery : ''}`,
    ).pipe(
      map((files: BackendFile[]) => {
        return files.map((file): DialFile => {
          const relativePath = getRelativePath(file.path);

          return {
            id: getPathNameId(file.name, relativePath),
            name: file.name,
            absolutePath: file.path,
            relativePath: relativePath,
            folderId: relativePath,
            contentLength: file.contentLength,
            contentType: file.contentType,
            serverSynced: true,
          };
        });
      }),
    );
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
