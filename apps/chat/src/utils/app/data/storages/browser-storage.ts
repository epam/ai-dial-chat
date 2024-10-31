/* eslint-disable no-restricted-globals */
import toast from 'react-hot-toast';

import {
  Observable,
  forkJoin,
  from,
  map,
  of,
  switchMap,
  throwError,
} from 'rxjs';

import {
  ApplicationInfo,
  CustomApplicationModel,
} from '@/src/types/applications';
import { Conversation } from '@/src/types/chat';
import { MoveModel } from '@/src/types/common';
import {
  FolderInterface,
  FolderType,
  FoldersAndEntities,
} from '@/src/types/folder';
import { Prompt, PromptInfo } from '@/src/types/prompt';
import {
  DialStorage,
  MigrationStorageKeys,
  UIStorageKeys,
} from '@/src/types/storage';

import { errorsMessages } from '@/src/constants/errors';

import { cleanConversationHistory } from '../../clean';

import { ConversationInfo, Entity } from '@epam/ai-dial-shared';

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

  getMultipleFoldersConversations(paths: string[]): Observable<Conversation[]> {
    return this.getConversations().pipe(
      map((conversations) => {
        return conversations.filter((conv) =>
          paths.some((path) => conv.id.startsWith(`${path}/`)),
        );
      }),
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

  createConversation(conversation: Conversation): Observable<ConversationInfo> {
    return BrowserStorage.getData(UIStorageKeys.ConversationHistory, []).pipe(
      switchMap((conversations: Conversation[]) => {
        BrowserStorage.setData(UIStorageKeys.ConversationHistory, [
          ...conversations,
          conversation,
        ]);

        return of(conversation);
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

  setConversations(
    conversations: Conversation[],
  ): Observable<ConversationInfo> {
    return from(conversations).pipe(
      switchMap((conv) => this.createConversation(conv)),
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

  getMultipleFoldersPrompts(paths: string[]): Observable<Prompt[]> {
    return this.getPrompts().pipe(
      map((prompts) => {
        return prompts.filter((prompt) =>
          paths.some((path) => prompt.id.startsWith(`${path}/`)),
        );
      }),
    );
  }

  getPrompt(info: PromptInfo): Observable<Prompt | null> {
    return BrowserStorage.getData(UIStorageKeys.Prompts, []).pipe(
      map(
        (prompts: Prompt[]) =>
          prompts.find((prompt) => prompt.id === info.id) || null,
      ),
    );
  }

  createPrompt(prompt: Prompt): Observable<PromptInfo> {
    return BrowserStorage.getData(UIStorageKeys.Prompts, []).pipe(
      switchMap((prompts: Prompt[]) => {
        BrowserStorage.setData(UIStorageKeys.Prompts, [...prompts, prompt]);

        return of(prompt);
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

  setPrompts(prompts: Prompt[]): Observable<PromptInfo> {
    return from(prompts).pipe(switchMap((prompt) => this.createPrompt(prompt)));
  }

  getConversationsFolders(path?: string, recursive?: boolean) {
    return BrowserStorage.getData(UIStorageKeys.Folders, []).pipe(
      map((folders: FolderInterface[]) => {
        return folders.filter(
          (folder) =>
            folder.type === FolderType.Chat &&
            (recursive || folder.folderId === path),
        );
      }),
    );
  }

  getPromptsFolders(path?: string, recursive?: boolean) {
    return BrowserStorage.getData(UIStorageKeys.Folders, []).pipe(
      map((folders: FolderInterface[]) => {
        return folders.filter(
          (folder) =>
            folder.type === FolderType.Prompt &&
            (recursive || folder.folderId === path),
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

  public static getFailedMigratedEntityIds(
    key:
      | MigrationStorageKeys.FailedMigratedConversationIds
      | MigrationStorageKeys.FailedMigratedPromptIds,
  ): Observable<string[]> {
    return BrowserStorage.getData(key, []);
  }

  public static setFailedMigratedEntityIds(
    migratedEntityIds: string[],
    key:
      | MigrationStorageKeys.FailedMigratedPromptIds
      | MigrationStorageKeys.FailedMigratedConversationIds,
  ): Observable<void> {
    return BrowserStorage.setData(key, migratedEntityIds);
  }

  public static setEntityBackedUp(
    key:
      | MigrationStorageKeys.ChatsBackedUp
      | MigrationStorageKeys.PromptsBackedUp,
  ): Observable<void> {
    return BrowserStorage.setData(key, true);
  }

  public static getEntityBackedUp(
    key:
      | MigrationStorageKeys.ChatsBackedUp
      | MigrationStorageKeys.PromptsBackedUp,
  ): Observable<boolean> {
    return BrowserStorage.getData(key, false);
  }

  public static setEntitiesMigrationInitialized(): Observable<void> {
    return BrowserStorage.setData(
      MigrationStorageKeys.MigrationInitialized,
      true,
    );
  }

  public static getEntitiesMigrationInitialized(): Observable<boolean> {
    return BrowserStorage.getData(
      MigrationStorageKeys.MigrationInitialized,
      false,
    );
  }

  public static getData<K = undefined>(
    key: UIStorageKeys | MigrationStorageKeys,
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
    key: UIStorageKeys | MigrationStorageKeys,
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

  move(_data: MoveModel): Observable<MoveModel> {
    throw new Error('Method not implemented.');
  }

  createApplication(
    _application: CustomApplicationModel,
  ): Observable<ApplicationInfo> {
    throw new Error('Method not implemented.');
  }
  updateApplication(_application: CustomApplicationModel): Observable<void> {
    throw new Error('Method not implemented.');
  }
  getApplication(
    _applicationId: string,
  ): Observable<CustomApplicationModel | null> {
    throw new Error('Method not implemented.');
  }
  deleteApplication(_applicationId: string): Observable<void> {
    throw new Error('Method not implemented.');
  }

  deployApplication(_name: string): Observable<void> {
    throw new Error('Method not implemented.');
  }

  undeployApplication(_name: string): Observable<void> {
    throw new Error('Method not implemented.');
  }
}
