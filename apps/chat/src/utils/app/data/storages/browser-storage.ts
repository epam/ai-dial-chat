/* eslint-disable no-restricted-globals */
import { cleanConversationHistory } from '../../clean';

import { errorsMessages } from '@/src/constants/errors';
import { Conversation, ConversationInfo } from '@/src/types/chat';
import { Entity } from '@/src/types/common';
import {
  FolderInterface,
  FolderType,
  FoldersAndEntities,
} from '@/src/types/folder';
import { Prompt, PromptInfo } from '@/src/types/prompt';
import { DialStorage, UIStorageKeys } from '@/src/types/storage';
import toast from 'react-hot-toast';
import { Observable, forkJoin, map, of, switchMap, throwError } from 'rxjs';

const isLocalStorageEnabled = () => {
  const testData = 'test';
  try {
    localStorage.setItem(testData, testData);
    localStorage.removeItem(testData);
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      toast.error(errorsMessages.localStorageQuotaExceeded);
      return true;
    } else {
      // eslint-disable-next-line no-console
      console.info(
        'Local storage is unavailable and session storage is used for data instead',
      );
      return false;
    }
  }
};

export class BrowserStorage implements DialStorage {
  private static storage: globalThis.Storage | undefined;

  public static init() {
    if (isLocalStorageEnabled()) {
      BrowserStorage.storage = localStorage;
    } else {
      BrowserStorage.storage = sessionStorage;
    }
  }

  getConversationsAndFolders(): Observable<FoldersAndEntities<Conversation>> {
    return forkJoin({
      folders: this.getConversationsFolders(),
      entities: this.getConversations(),
    });
  }

  getConversations(): Observable<Conversation[]> {
    return BrowserStorage.getData(UIStorageKeys.ConversationHistory, []).pipe(
      map((conversations) => cleanConversationHistory(conversations)),
    );
  }

  getConversation(info: ConversationInfo): Observable<Conversation | null> {
    return BrowserStorage.getData(UIStorageKeys.ConversationHistory, []).pipe(
      map((conversations) => {
        const conv = conversations.find(
          (conv: Conversation) => conv.id === info.id,
        );
        return conv ? cleanConversationHistory([conv])[0] : null;
      }),
    );
  }

  createConversation(conversation: Conversation): Observable<void> {
    return BrowserStorage.getData(UIStorageKeys.ConversationHistory, []).pipe(
      map((conversations: Conversation[]) => {
        BrowserStorage.setData(UIStorageKeys.ConversationHistory, [
          ...conversations,
          conversation,
        ]);
      }),
    );
  }
  updateConversation(conversation: Conversation): Observable<void> {
    return BrowserStorage.getData(UIStorageKeys.ConversationHistory, []).pipe(
      map((conversations: Conversation[]) => {
        BrowserStorage.setData(
          UIStorageKeys.ConversationHistory,
          conversations.map((conv) =>
            conv.id === conversation.id ? conversation : conv,
          ),
        );
      }),
    );
  }
  deleteConversation(info: ConversationInfo): Observable<void> {
    return BrowserStorage.getData(UIStorageKeys.ConversationHistory, []).pipe(
      map((conversations: Conversation[]) => {
        BrowserStorage.setData(
          UIStorageKeys.ConversationHistory,
          conversations.filter((conv) => conv.id !== info.id),
        );
      }),
    );
  }

  setConversations(conversations: Conversation[]): Observable<void> {
    return BrowserStorage.setData(
      UIStorageKeys.ConversationHistory,
      conversations,
    );
  }

  getPromptsAndFolders(): Observable<FoldersAndEntities<Prompt>> {
    return forkJoin({
      folders: this.getConversationsFolders(),
      entities: this.getPrompts(),
    });
  }

  getPrompts(): Observable<Prompt[]> {
    return BrowserStorage.getData(UIStorageKeys.Prompts, []);
  }

  getPrompt(info: PromptInfo): Observable<Prompt | null> {
    return BrowserStorage.getData(UIStorageKeys.Prompts, []).pipe(
      map(
        (prompts: Prompt[]) =>
          prompts.find((prompt) => prompt.id === info.id) || null,
      ),
    );
  }

  createPrompt(prompt: Prompt): Observable<void> {
    return BrowserStorage.getData(UIStorageKeys.Prompts, []).pipe(
      map((prompts: Prompt[]) => {
        BrowserStorage.setData(UIStorageKeys.Prompts, [...prompts, prompt]);
      }),
    );
  }
  updatePrompt(prompt: Prompt): Observable<void> {
    return BrowserStorage.getData(UIStorageKeys.Prompts, []).pipe(
      map((prompts: Prompt[]) => {
        BrowserStorage.setData(
          UIStorageKeys.Prompts,
          prompts.map((item) => (prompt.id === item.id ? prompt : item)),
        );
      }),
    );
  }
  deletePrompt(info: Entity): Observable<void> {
    return BrowserStorage.getData(UIStorageKeys.Prompts, []).pipe(
      map((prompts: Prompt[]) => {
        BrowserStorage.setData(
          UIStorageKeys.Prompts,
          prompts.filter((prompt) => prompt.id !== info.id),
        );
      }),
    );
  }

  setPrompts(prompts: Prompt[]): Observable<void> {
    return BrowserStorage.setData(UIStorageKeys.Prompts, prompts);
  }

  getConversationsFolders(path?: string) {
    return BrowserStorage.getData(UIStorageKeys.Folders, []).pipe(
      map((folders: FolderInterface[]) => {
        return folders.filter(
          (folder) =>
            folder.type === FolderType.Chat && folder.folderId === path,
        );
      }),
    );
  }

  getPromptsFolders(path?: string) {
    return BrowserStorage.getData(UIStorageKeys.Folders, []).pipe(
      map((folders: FolderInterface[]) => {
        return folders.filter(
          (folder) =>
            folder.type === FolderType.Prompt && folder.folderId === path,
        );
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
