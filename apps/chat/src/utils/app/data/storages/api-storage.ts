import {
  EMPTY,
  Observable,
  catchError,
  concatMap,
  from,
  throwError,
} from 'rxjs';

import { ApiEntityStorage } from '@/src/utils/app/data/storages/api/api-entity-storage';
import { constructPath } from '@/src/utils/app/file';
import { generateNextName } from '@/src/utils/app/folders';

import { Conversation, ConversationInfo } from '@/src/types/chat';
import { Entity } from '@/src/types/common';
import { FolderInterface, FoldersAndEntities } from '@/src/types/folder';
import { Prompt, PromptInfo } from '@/src/types/prompt';
import { DialStorage } from '@/src/types/storage';

import {
  DEFAULT_CONVERSATION_NAME,
  DEFAULT_PROMPT_NAME,
} from '@/src/constants/default-settings';

import { ConversationApiStorage } from './api/conversation-api-storage';
import { PromptApiStorage } from './api/prompt-api-storage';

const MAX_RETRIES_COUNT = 3;

export class ApiStorage implements DialStorage {
  private _conversationApiStorage = new ConversationApiStorage();
  private _promptApiStorage = new PromptApiStorage();

  private tryCreateEntity<T extends Conversation | Prompt>(
    entity: T,
    entities: T[],
    apiStorage: ApiEntityStorage<PromptInfo | ConversationInfo, T>,
  ): Observable<void> {
    return this.getConversations(entity.folderId).pipe(
      concatMap((receivedEntities) => {
        const apiEntities: PromptInfo[] | ConversationInfo[] = receivedEntities;
        let retries = 0;

        const retry = (
          entity: T,
          entities: T[],
          apiStorage: ApiEntityStorage<PromptInfo | ConversationInfo, T>,
        ): Observable<void> =>
          apiStorage.createEntity(entity).pipe(
            catchError((err) => {
              if (retries < MAX_RETRIES_COUNT) {
                retries++;

                const defaultName =
                  'messages' in entity
                    ? DEFAULT_CONVERSATION_NAME
                    : DEFAULT_PROMPT_NAME;
                const newName = generateNextName(defaultName, entity.name, [
                  ...entities,
                  ...apiEntities,
                ]);

                const updatedEntity = {
                  ...entity,
                  id: constructPath(entity.folderId, newName),
                  name: newName,
                };

                return retry(updatedEntity, entities, apiStorage);
              }

              return throwError(() => err);
            }),
          );

        return retry(entity, entities, apiStorage);
      }),
    );
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
    path?: string | undefined,
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

  createConversation(conversation: Conversation): Observable<void> {
    return this._conversationApiStorage.createEntity(conversation);
  }

  updateConversation(conversation: Conversation): Observable<void> {
    return this._conversationApiStorage.updateEntity(conversation);
  }

  deleteConversation(info: ConversationInfo): Observable<void> {
    return this._conversationApiStorage.deleteEntity(info);
  }

  setConversations(conversations: Conversation[]): Observable<void> {
    return from(conversations).pipe(
      concatMap((conversation) =>
        this.tryCreateEntity(
          conversation,
          conversations,
          this._conversationApiStorage,
        ),
      ),
    );
  }

  getPromptsAndFolders(
    path?: string | undefined,
  ): Observable<FoldersAndEntities<Entity>> {
    return this._promptApiStorage.getFoldersAndEntities(path);
  }

  getPrompts(path?: string, recursive?: boolean): Observable<Prompt[]> {
    return this._promptApiStorage.getEntities(path, recursive);
  }

  getPrompt(info: PromptInfo): Observable<Prompt | null> {
    return this._promptApiStorage.getEntity(info);
  }

  createPrompt(prompt: Prompt): Observable<void> {
    return this._promptApiStorage.createEntity(prompt);
  }

  updatePrompt(prompt: Prompt): Observable<void> {
    return this._promptApiStorage.updateEntity(prompt);
  }

  deletePrompt(info: Entity): Observable<void> {
    return this._promptApiStorage.deleteEntity(info);
  }

  setPrompts(prompts: Prompt[]): Observable<void> {
    return from(prompts).pipe(
      concatMap((prompt) =>
        this.tryCreateEntity(prompt, prompts, this._promptApiStorage),
      ),
    );
  }
}
