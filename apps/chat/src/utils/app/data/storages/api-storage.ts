import {
  EMPTY,
  Observable,
  catchError,
  concatMap,
  from,
  switchMap,
  throwError,
} from 'rxjs';

import { regenerateConversationId } from '@/src/utils/app/conversation';
import { ApiEntityStorage } from '@/src/utils/app/data/storages/api/api-entity-storage';
import { generateNextName } from '@/src/utils/app/folders';
import { regeneratePromptId } from '@/src/utils/app/prompts';

import { Conversation, ConversationInfo } from '@/src/types/chat';
import { BackendResourceType, Entity } from '@/src/types/common';
import { FolderInterface, FoldersAndEntities } from '@/src/types/folder';
import { Prompt, PromptInfo } from '@/src/types/prompt';
import { DialStorage } from '@/src/types/storage';

import {
  DEFAULT_CONVERSATION_NAME,
  DEFAULT_PROMPT_NAME,
} from '@/src/constants/default-ui-settings';

import { ConversationApiStorage } from './api/conversation-api-storage';
import { PromptApiStorage } from './api/prompt-api-storage';

const MAX_RETRIES_COUNT = 3;

export class ApiStorage implements DialStorage {
  private _conversationApiStorage = new ConversationApiStorage();
  private _promptApiStorage = new PromptApiStorage();

  private tryCreateEntity<T extends Conversation | Prompt>(
    entity: T,
    entities: T[],
    apiStorage: ApiEntityStorage<T, T>,
    entityType: BackendResourceType,
  ): Observable<T> {
    let retries = 0;

    const retry = (
      entity: T,
      apiStorage: ApiEntityStorage<T, T>,
    ): Observable<T> =>
      apiStorage.createEntity(entity).pipe(
        catchError((err) => {
          if (retries < MAX_RETRIES_COUNT) {
            retries++;

            const defaultName =
              entityType === BackendResourceType.CONVERSATION
                ? DEFAULT_CONVERSATION_NAME
                : DEFAULT_PROMPT_NAME;
            const newName = generateNextName(
              defaultName,
              entity.name,
              entities.filter((e) => e.folderId === entity.folderId),
            );
            const updatedEntity = {
              ...entity,
              name: newName,
            };

            const updatedEntityWithRegeneratedId =
              entityType === BackendResourceType.CONVERSATION
                ? regenerateConversationId(updatedEntity as Conversation)
                : regeneratePromptId(updatedEntity as Prompt);

            return retry(updatedEntityWithRegeneratedId as T, apiStorage);
          }

          return throwError(() => err);
        }),
      );

    return retry(entity, apiStorage);
  }

  getConversationsFolders(path?: string): Observable<FolderInterface[]> {
    return this._conversationApiStorage.getFolders(path);
  }

  setConversationsFolders(_folders: FolderInterface[]): Observable<void> {
    return EMPTY; // don't need to save folders
  }

  getPromptsFolders(path?: string): Observable<FolderInterface[]> {
    return this._promptApiStorage.getFolders(path);
  }

  setPromptsFolders(_folders: FolderInterface[]): Observable<void> {
    return EMPTY; // don't need to save folders
  }

  getConversationsAndFolders(
    path?: string,
  ): Observable<FoldersAndEntities<ConversationInfo>> {
    return this._conversationApiStorage.getFoldersAndEntities(path);
  }

  getConversations(
    path?: string,
    recursive?: boolean,
  ): Observable<ConversationInfo[]> {
    return this._conversationApiStorage.getEntities(path, recursive);
  }

  getConversation(info: ConversationInfo): Observable<Conversation | null> {
    return this._conversationApiStorage.getEntity(info);
  }

  createConversation(
    conversation: Conversation,
  ): Observable<ConversationInfo | null> {
    return this._conversationApiStorage.createEntity(conversation).pipe(
      catchError(() => {
        return this.getConversations(conversation.folderId).pipe(
          switchMap((conversations) => {
            const updatedConv = {
              ...conversation,
              name: generateNextName(
                DEFAULT_CONVERSATION_NAME,
                conversation.name,
                conversations,
              ),
            };

            return this._conversationApiStorage.createEntity(
              regenerateConversationId(updatedConv),
            );
          }),
          switchMap((conversation) => this.getConversation(conversation)),
        );
      }),
    );
  }

  updateConversation(conversation: Conversation): Observable<void> {
    return this._conversationApiStorage.updateEntity(conversation);
  }

  deleteConversation(info: ConversationInfo): Observable<void> {
    return this._conversationApiStorage.deleteEntity(info);
  }

  setConversations(
    conversations: Conversation[],
  ): Observable<ConversationInfo> {
    return from(conversations).pipe(
      concatMap((conv) =>
        this.getConversations(conv.folderId).pipe(
          concatMap((apiConversations) =>
            this.tryCreateEntity(
              conv,
              [...conversations, ...apiConversations],
              this._conversationApiStorage,
              BackendResourceType.CONVERSATION,
            ),
          ),
        ),
      ),
    );
  }

  getPromptsAndFolders(path?: string): Observable<FoldersAndEntities<Entity>> {
    return this._promptApiStorage.getFoldersAndEntities(path);
  }

  getPrompts(path?: string, recursive?: boolean): Observable<Prompt[]> {
    return this._promptApiStorage.getEntities(path, recursive);
  }

  getPrompt(info: PromptInfo): Observable<Prompt | null> {
    return this._promptApiStorage.getEntity(info);
  }

  createPrompt(prompt: Prompt): Observable<PromptInfo | null> {
    return this._promptApiStorage.createEntity(prompt).pipe(
      catchError(() => {
        return this.getPrompts(prompt.folderId).pipe(
          switchMap((prompts) => {
            const updatedPrompt = {
              ...prompt,
              name: generateNextName(DEFAULT_PROMPT_NAME, prompt.name, prompts),
            };

            return this._promptApiStorage.createEntity(
              regeneratePromptId(updatedPrompt),
            );
          }),
          switchMap((prompt) => this.getPrompt(prompt)),
        );
      }),
    );
  }

  updatePrompt(prompt: Prompt): Observable<void> {
    return this._promptApiStorage.updateEntity(prompt);
  }

  deletePrompt(info: Entity): Observable<void> {
    return this._promptApiStorage.deleteEntity(info);
  }

  setPrompts(prompts: Prompt[]): Observable<PromptInfo> {
    return from(prompts).pipe(
      concatMap((prompt) =>
        this.getPrompts(prompt.folderId).pipe(
          concatMap((apiPrompts) =>
            this.tryCreateEntity(
              prompt,
              [...prompts, ...apiPrompts],
              this._promptApiStorage,
              BackendResourceType.PROMPT,
            ),
          ),
        ),
      ),
    );
  }
}
