import {
  EMPTY,
  Observable,
  catchError,
  concatMap,
  from,
  throwError,
} from 'rxjs';

import { ApiEntityStorage } from '@/src/utils/app/data/storages/api-entity-storage';
import { generateNextName } from '@/src/utils/app/folders';

import { Conversation, ConversationInfo } from '@/src/types/chat';
import { Entity } from '@/src/types/common';
import { FolderInterface } from '@/src/types/folder';
import { Prompt, PromptInfo } from '@/src/types/prompt';
import { DialStorage } from '@/src/types/storage';

import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-settings';

import { ConversationApiStorage } from './conversation-api-storage';
import { PromptApiStorage } from './prompt-api-storage';

export class ApiStorage implements DialStorage {
  private _conversationApiStorage = new ConversationApiStorage();
  private _promptApiStorage = new PromptApiStorage();

  private tryCreateEntity<T extends Conversation | Prompt>(
    entity: T,
    entities: T[],
    apiStorage: ApiEntityStorage<PromptInfo | ConversationInfo, T>,
  ): Observable<void> {
    return apiStorage.createEntity(entity).pipe(
      catchError((err) => {
        if (err.message === 'Conflict') {
          const updatedEntity = {
            ...entity,
            name: generateNextName(
              DEFAULT_CONVERSATION_NAME,
              entity.name,
              entities,
            ),
          };

          return this.tryCreateEntity(updatedEntity, entities, apiStorage);
        }

        return throwError(() => err);
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

  getConversations(path?: string): Observable<ConversationInfo[]> {
    return this._conversationApiStorage.getEntities(path);
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

  getPrompts(path?: string): Observable<Prompt[]> {
    return this._promptApiStorage.getEntities(path);
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
