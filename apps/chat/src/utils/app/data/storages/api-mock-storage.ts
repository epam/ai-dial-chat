import { Conversation, ConversationInfo } from '@/src/types/chat';
import { Entity, EntityType } from '@/src/types/common';
import {
  FolderInterface,
  FolderType,
  FoldersAndEntities,
} from '@/src/types/folder';
import { Prompt } from '@/src/types/prompt';
import { DialStorage } from '@/src/types/storage';
import { Observable, of } from 'rxjs';

export class ApiMockStorage implements DialStorage {
  getConversationsAndFolders(
    _path?: string | undefined,
  ): Observable<FoldersAndEntities<ConversationInfo>> {
    throw new Error('Method not implemented.');
  }
  getPromptsAndFolders(
    _path?: string | undefined,
  ): Observable<FoldersAndEntities<Entity>> {
    throw new Error('Method not implemented.');
  }
  getConversation(_info: ConversationInfo): Observable<Conversation | null> {
    throw new Error('Method not implemented.');
  }
  createConversation(_conversation: Conversation): Observable<void> {
    throw new Error('Method not implemented.');
  }
  updateConversation(_conversation: Conversation): Observable<void> {
    throw new Error('Method not implemented.');
  }
  deleteConversation(_info: ConversationInfo): Observable<void> {
    throw new Error('Method not implemented.');
  }
  getPrompt(_info: Entity): Observable<Prompt | null> {
    throw new Error('Method not implemented.');
  }
  createPrompt(_prompt: Prompt): Observable<void> {
    throw new Error('Method not implemented.');
  }
  updatePrompt(_prompt: Prompt): Observable<void> {
    throw new Error('Method not implemented.');
  }
  deletePrompt(_info: Entity): Observable<void> {
    throw new Error('Method not implemented.');
  }
  setConversationsFolders(_folders: FolderInterface[]): Observable<void> {
    return of(undefined);
  }
  setPromptsFolders(_folders: FolderInterface[]): Observable<void> {
    return of(undefined);
  }
  setConversations(_conversations: Conversation[]): Observable<void> {
    return of(undefined);
  }
  setPrompts(_prompts: Prompt[]): Observable<void> {
    return of(undefined);
  }
  getConversations(): Observable<Conversation[]> {
    return of([
      {
        id: 'some conv ID',
        name: 'Mock conversation 1',
        messages: [],
        model: {
          id: 'modelId',
          maxLength: 1000,
          requestLimit: 1000,
          type: EntityType.Model,
          name: 'Some name',
        },
        isMessageStreaming: false,
        prompt: 'Some mock prompt',
        temperature: 1,
        replay: {
          isReplay: false,
          activeReplayIndex: 0,
        },
        selectedAddons: [],
      } as Conversation,
    ]);
  }
  getPrompts(): Observable<Prompt[]> {
    return of([
      {
        id: 'Some mock Prompt id',
        name: 'Mock Prompt 1',
        description: '',
        content: '',
        model: {
          id: 'modelId',
          maxLength: 1000,
          requestLimit: 1000,
          type: EntityType.Model,
          name: 'Some name',
        },
      },
    ]);
  }
  getPromptsFolders() {
    const folders: FolderInterface[] = [
      {
        id: 'Some prompt folder id 1',
        name: 'Folder name 1',
        type: FolderType.Chat,
      },
      {
        id: 'Some prompt folder id 2',
        name: 'Folder name 2',
        type: FolderType.Chat,
      },
      {
        id: 'Some prompt folder id 3',
        name: 'Folder name 3',
        type: FolderType.Chat,
      },
    ];

    return of(folders);
  }
  getConversationsFolders() {
    const folders: FolderInterface[] = [
      {
        id: 'Some chat folder id 1',
        name: 'Folder name 1',
        type: FolderType.Chat,
      },
      {
        id: 'Some chat folder id 2',
        name: 'Folder name 2',
        type: FolderType.Chat,
      },
      {
        id: 'Some chat folder id 3',
        name: 'Folder name 3',
        type: FolderType.Chat,
      },
    ];

    return of(folders);
  }
}
