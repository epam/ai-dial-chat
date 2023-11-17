import { Observable, of } from 'rxjs';

import { Conversation } from '@/src/types/chat';
import { FolderInterface } from '@/src/types/folder';
import { Prompt } from '@/src/types/prompt';
import { DialStorage } from '@/src/types/storage';

export class ApiMockStorage implements DialStorage {
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
          type: 'model',
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
          type: 'model',
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
        type: 'chat',
      },
      {
        id: 'Some prompt folder id 2',
        name: 'Folder name 2',
        type: 'chat',
      },
      {
        id: 'Some prompt folder id 3',
        name: 'Folder name 3',
        type: 'chat',
      },
    ];

    return of(folders);
  }
  getConversationsFolders() {
    const folders: FolderInterface[] = [
      {
        id: 'Some chat folder id 1',
        name: 'Folder name 1',
        type: 'chat',
      },
      {
        id: 'Some chat folder id 2',
        name: 'Folder name 2',
        type: 'chat',
      },
      {
        id: 'Some chat folder id 3',
        name: 'Folder name 3',
        type: 'chat',
      },
    ];

    return of(folders);
  }
}
