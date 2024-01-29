import { Observable, from, mergeMap, of } from 'rxjs';

import { Conversation, ConversationInfo } from '@/src/types/chat';
import { FolderInterface } from '@/src/types/folder';
import { Prompt, PromptInfo } from '@/src/types/prompt';
import { DialStorage } from '@/src/types/storage';

import { ConversationApiStorage } from './conversation-api-storage';
import { PromptApiStorage } from './prompt-api-storage';

export class ApiStorage implements DialStorage {
  private _conversationApiStorage = new ConversationApiStorage();
  private _promptApiStorage = new PromptApiStorage();

  getConversationsFolders(): Observable<FolderInterface[]> {
    return of(); //TODO
  }

  setConversationsFolders(_folders: FolderInterface[]): Observable<void> {
    return of(); //TODO
  }

  getPromptsFolders(): Observable<FolderInterface[]> {
    return of(); //TODO
  }

  setPromptsFolders(_folders: FolderInterface[]): Observable<void> {
    return of(); //TODO
  }

  getConversations(path?: string): Observable<ConversationInfo[]> {
    return this._conversationApiStorage.getEntities(path);
  }

  getConversation(info: ConversationInfo): Observable<Conversation> {
    return this._conversationApiStorage.getEntity(info);
  }

  setConversations(_conversations: Conversation[]): Observable<void> {
    return from(_conversations).pipe(
      mergeMap((conversation) =>
        this._conversationApiStorage.createEntity(conversation),
      ),
    );
  }

  getPrompts(path?: string): Observable<Prompt[]> {
    return this._promptApiStorage.getEntities(path);
  }

  getPrompt(info: PromptInfo): Observable<Prompt> {
    return this._promptApiStorage.getEntity(info);
  }

  setPrompts(_prompts: Prompt[]): Observable<void> {
    return from(_prompts).pipe(
      mergeMap((prompt) => this._promptApiStorage.createEntity(prompt)),
    );
  }
}
