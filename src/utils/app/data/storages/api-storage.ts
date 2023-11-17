import { Observable } from 'rxjs';

import { Conversation } from '@/src/types/chat';
import { FolderInterface } from '@/src/types/folder';
import { Prompt } from '@/src/types/prompt';
import { DialStorage } from '@/src/types/storage';

export class ApiStorage implements DialStorage {
  getConversationsFolders(): Observable<FolderInterface[]> {
    throw new Error('Method not implemented.');
  }
  setConversationsFolders(_folders: FolderInterface[]): Observable<void> {
    throw new Error('Method not implemented.');
  }
  getPromptsFolders(): Observable<FolderInterface[]> {
    throw new Error('Method not implemented.');
  }
  setPromptsFolders(_folders: FolderInterface[]): Observable<void> {
    throw new Error('Method not implemented.');
  }
  getConversations(): Observable<Conversation[]> {
    throw new Error('Method not implemented.');
  }
  setConversations(_conversations: Conversation[]): Observable<void> {
    throw new Error('Method not implemented.');
  }
  getPrompts(): Observable<Prompt[]> {
    throw new Error('Method not implemented.');
  }
  setPrompts(_prompts: Prompt[]): Observable<void> {
    throw new Error('Method not implemented.');
  }
}
