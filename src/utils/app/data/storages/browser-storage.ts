/* eslint-disable no-restricted-globals */
import toast from 'react-hot-toast';

import { Observable, map, of, switchMap, throwError } from 'rxjs';

import { Conversation } from '@/src/types/chat';
import { FolderInterface, FolderType } from '@/src/types/folder';
import { Prompt } from '@/src/types/prompt';
import { DialStorage } from '@/src/types/storage';

import { errorsMessages } from '@/src/constants/errors';

import { cleanConversationHistory } from '../../clean';
import { isLocalStorageEnabled } from '../storage';

type UIStorageKeys =
  | 'prompts'
  | 'conversationHistory'
  | 'folders'
  | 'selectedConversationIds'
  | 'recentModelsIds'
  | 'recentAddonsIds'
  | 'settings'
  | 'showChatbar'
  | 'showPromptbar'
  | 'openedFoldersIds'
  | 'textOfClosedAnnouncement';

export class BrowserStorage implements DialStorage {
  private static storage: globalThis.Storage | undefined;

  public static init() {
    if (isLocalStorageEnabled()) {
      BrowserStorage.storage = localStorage;
    } else {
      BrowserStorage.storage = sessionStorage;
    }
  }

  getConversations(): Observable<Conversation[]> {
    return BrowserStorage.getData('conversationHistory', []).pipe(
      map((conversations) => cleanConversationHistory(conversations)),
    );
  }

  setConversations(conversations: Conversation[]): Observable<void> {
    return BrowserStorage.setData('conversationHistory', conversations);
  }

  getPrompts(): Observable<Prompt[]> {
    return BrowserStorage.getData('prompts', []);
  }

  setPrompts(prompts: Prompt[]): Observable<void> {
    return BrowserStorage.setData('prompts', prompts);
  }

  getConversationsFolders() {
    return BrowserStorage.getData('folders', []).pipe(
      map((folders: FolderInterface[]) => {
        return folders.filter((folder) => folder.type === FolderType.Chat);
      }),
    );
  }

  getPromptsFolders() {
    return BrowserStorage.getData('folders', []).pipe(
      map((folders: FolderInterface[]) => {
        return folders.filter((folder) => folder.type === FolderType.Prompt);
      }),
    );
  }

  setConversationsFolders(
    conversationFolders: FolderInterface[],
  ): Observable<void> {
    return BrowserStorage.getData('folders', []).pipe(
      map((items: FolderInterface[]) =>
        items.filter((item) => item.type !== FolderType.Chat),
      ),
      map((promptsFolders: FolderInterface[]) => {
        return promptsFolders.concat(conversationFolders);
      }),
      switchMap((folders) => BrowserStorage.setData('folders', folders)),
    );
  }
  setPromptsFolders(promptsFolders: FolderInterface[]): Observable<void> {
    return BrowserStorage.getData('folders', []).pipe(
      map((items: FolderInterface[]) =>
        items.filter((item) => item.type !== FolderType.Prompt),
      ),
      map((convFolders: FolderInterface[]) => {
        return convFolders.concat(promptsFolders);
      }),
      switchMap((folders) => BrowserStorage.setData('folders', folders)),
    );
  }

  public static getData<K = undefined>(
    key: UIStorageKeys,
    defaultValue: K,
  ): Observable<K> {
    try {
      const value = this.storage!.getItem(key);
      return of(
        value === null || value === undefined
          ? defaultValue
          : JSON.parse(value),
      );
    } catch (e: any) {
      console.error(e);
      if (e.name === 'QuotaExceededError') {
        toast.error(errorsMessages.localStorageQuotaExceeded);
      }
      return of(defaultValue);
    }
  }

  public static setData<K = unknown>(
    key: UIStorageKeys,
    value: K,
  ): Observable<void> {
    try {
      this.storage!.setItem(key, JSON.stringify(value));
      return of(undefined);
    } catch (e: any) {
      console.error(e);
      if (e.name === 'QuotaExceededError') {
        toast.error(errorsMessages.localStorageQuotaExceeded);
        return of(undefined);
      } else {
        return throwError(() => e);
      }
    }
  }
}
