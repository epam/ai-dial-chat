import { Observable, from, map, mergeMap, of } from 'rxjs';

import { ApiKeys, ApiUtils } from '@/src/utils/server/api';

import { Conversation, ConversationInfo } from '@/src/types/chat';
import { BackendChatEntity, DialChatEntity } from '@/src/types/common';
import { FolderInterface } from '@/src/types/folder';
import { Prompt, PromptInfo } from '@/src/types/prompt';
import { DialStorage } from '@/src/types/storage';

import { constructPath } from '../../file';
import { DataService } from '../data-service';
import { ConversationApiStorage } from './conversation-api-storage';
import { PromptApiStorage } from './prompt-api-storage';

export class ApiStorage implements DialStorage {
  private conversationStorage = new ConversationApiStorage();
  private promptStorage = new PromptApiStorage();

  static setData(
    entity: Conversation | Prompt,
    entityType: ApiKeys,
    relativePath: string | undefined,
    entityId: string,
  ): Observable<{ result?: DialChatEntity }> {
    const resultPath = encodeURI(
      `${entityType}/${DataService.getBucket()}/${
        relativePath ? `${relativePath}/` : ''
      }${entityId}`,
    );

    return ApiUtils.requestOld({
      url: `api/${entityType}/${resultPath}`,
      method: 'PUT',
      async: true,
      body: JSON.stringify(entity),
    }).pipe(
      map(({ result }: { result?: unknown }): { result?: DialChatEntity } => {
        if (!result) {
          return {};
        }

        const typedResult = result as BackendChatEntity;
        const relativePath = typedResult.parentPath || undefined;

        return {
          result: {
            id: constructPath(relativePath, typedResult.name),
            name: typedResult.name,
            absolutePath: constructPath(
              entityType,
              typedResult.bucket,
              relativePath,
            ),
            relativePath: relativePath,
            folderId: relativePath,
            updatedAt: typedResult.updatedAt,
            serverSynced: true,
          },
        };
      }),
    );
  }

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

  getConversation(info: ConversationInfo): Observable<Conversation> {
    return this.conversationStorage.getEntity(info);
  }

  setConversations(_conversations: Conversation[]): Observable<void> {
    return from(_conversations).pipe(
      mergeMap((conversation) =>
        this.conversationStorage.createEntity(conversation),
      ),
    );
  }

  getPrompts(path?: string): Observable<Prompt[]> {
    return this.promptStorage.getEntities(path);
  }

  getPrompt(info: PromptInfo): Observable<Prompt> {
    return this.promptStorage.getEntity(info);
  }

  setPrompts(_prompts: Prompt[]): Observable<void> {
    return from(_prompts).pipe(
      mergeMap((prompt) => this.promptStorage.createEntity(prompt)),
    );
  }
}
