import { Observable, of } from 'rxjs';

import { Conversation, ConversationInfo } from '@/src/types/chat';
import { FolderInterface } from '@/src/types/folder';
import { Prompt, PromptInfo } from '@/src/types/prompt';
import { DialStorage } from '@/src/types/storage';

import { ConversationApiStorage } from './conversation-api-storage';
import { PromptApiStorage } from './prompt-api-storage';

export class ApiStorage implements DialStorage {
  private conversationStorage = new ConversationApiStorage();
  private promptStorage = new PromptApiStorage();

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
    return this.conversationStorage.getEntities(path);
  }
  getConversation(
    info: ConversationInfo,
    _path?: string | undefined,
  ): Observable<Conversation> {
    return this.conversationStorage.getEntity(info);
  }
  setConversations(_conversations: Conversation[]): Observable<void> {
    return of(); //TODO
  }
  getPrompts(path?: string): Observable<Prompt[]> {
    return this.promptStorage.getEntities(path);
  }
  getPrompt(info: PromptInfo, _path?: string | undefined): Observable<Prompt> {
    return this.promptStorage.getEntity(info);
  }
  setPrompts(_prompts: Prompt[]): Observable<void> {
    return of(); //TODO
  }
}
