import { ConversationApiStorage } from './conversation-api-storage';
import { PromptApiStorage } from './prompt-api-storage';

import { Conversation, ConversationInfo } from '@/src/types/chat';
import { Entity } from '@/src/types/common';
import { FolderInterface } from '@/src/types/folder';
import { Prompt, PromptInfo } from '@/src/types/prompt';
import { DialStorage } from '@/src/types/storage';
import { EMPTY, Observable, from, mergeMap } from 'rxjs';

export class ApiStorage implements DialStorage {
  private _conversationApiStorage = new ConversationApiStorage();
  private _promptApiStorage = new PromptApiStorage();

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
      mergeMap((conversation) =>
        this._conversationApiStorage.createEntity(conversation),
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
      mergeMap((prompt) => this._promptApiStorage.createEntity(prompt)),
    );
  }
}
