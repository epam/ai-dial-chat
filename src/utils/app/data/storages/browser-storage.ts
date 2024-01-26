/* eslint-disable no-restricted-globals */
import toast from 'react-hot-toast';

import { Observable, map, of, switchMap, throwError } from 'rxjs';

import { Conversation } from '@/src/types/chat';
import { FolderInterface, FolderType } from '@/src/types/folder';
import { Prompt } from '@/src/types/prompt';
import { DialStorage, UIStorageKeys } from '@/src/types/storage';

import { errorsMessages } from '@/src/constants/errors';

import { cleanConversationHistory } from '../../clean';
import { isLocalStorageEnabled } from '../storage';

export class BrowserStorage implements DialStorage {
  setBucket(_bucket: string): void {
    return;
  }
  private static storage: globalThis.Storage | undefined;

  public static init() {
    if (isLocalStorageEnabled()) {
      BrowserStorage.storage = localStorage;
    } else {
      BrowserStorage.storage = sessionStorage;
    }
  }

  getConversations(): Observable<Conversation[]> {
    return BrowserStorage.getData(UIStorageKeys.ConversationHistory, []).pipe(
      map((conversations) => cleanConversationHistory(conversations)),
    );
  }

  setConversations(conversations: Conversation[]): Observable<void> {
    return BrowserStorage.setData(
      UIStorageKeys.ConversationHistory,
      conversations,
    );
  }

  getPrompts(): Observable<Prompt[]> {
    return BrowserStorage.getData(UIStorageKeys.Prompts, []);
  }

  setPrompts(prompts: Prompt[]): Observable<void> {
    return BrowserStorage.setData(UIStorageKeys.Prompts, prompts);
  }

  getConversationsFolders() {
    return BrowserStorage.getData(UIStorageKeys.Folders, []).pipe(
      map((folders: FolderInterface[]) => {
        return folders.filter((folder) => folder.type === FolderType.Chat);
      }),
    );
  }

  getPromptsFolders() {
    return BrowserStorage.getData(UIStorageKeys.Folders, []).pipe(
      map((folders: FolderInterface[]) => {
        return folders.filter((folder) => folder.type === FolderType.Prompt);
      }),
    );
  }

  setConversationsFolders(
    conversationFolders: FolderInterface[],
  ): Observable<void> {
    return BrowserStorage.getData(UIStorageKeys.Folders, []).pipe(
      map((items: FolderInterface[]) =>
        items.filter((item) => item.type !== FolderType.Chat),
      ),
      map((promptsFolders: FolderInterface[]) => {
        return promptsFolders.concat(conversationFolders);
      }),
      switchMap((folders) =>
        BrowserStorage.setData(UIStorageKeys.Folders, folders),
      ),
    );
  }
  setPromptsFolders(promptsFolders: FolderInterface[]): Observable<void> {
    return BrowserStorage.getData(UIStorageKeys.Folders, []).pipe(
      map((items: FolderInterface[]) =>
        items.filter((item) => item.type !== FolderType.Prompt),
      ),
      map((convFolders: FolderInterface[]) => {
        return convFolders.concat(promptsFolders);
      }),
      switchMap((folders) =>
        BrowserStorage.setData(UIStorageKeys.Folders, folders),
      ),
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
    } catch (e: unknown) {
      console.error(e);
      if ((e as Error).name === 'QuotaExceededError') {
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
    } catch (e: unknown) {
      console.error(e);
      if ((e as Error).name === 'QuotaExceededError') {
        toast.error(errorsMessages.localStorageQuotaExceeded);
        return of(undefined);
      } else {
        return throwError(() => e);
      }
    }
  }
}
