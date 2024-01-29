import { Observable, from, map, of, switchMap, throwError } from 'rxjs';
import { fromFetch } from 'rxjs/fetch';

import {
  ApiKeys,
  getConversationApiKeyFromConversationInfo,
  getPromptApiKey,
  parseConversationApiKey,
  parsePromptApiKey,
} from '@/src/utils/server/api';

import { Conversation, ConversationInfo } from '@/src/types/chat';
import { BackendChatEntity, BackendDataNodeType } from '@/src/types/common';
import { FolderInterface } from '@/src/types/folder';
import { Prompt, PromptInfo } from '@/src/types/prompt';
import { DialStorage } from '@/src/types/storage';

import { constructPath } from '../../file';
import { DataService } from '../data-service';

export class ApiStorage implements DialStorage {
  static request(url: string, options?: RequestInit) {
    return fromFetch(url, options).pipe(
      switchMap((response) => {
        if (!response.ok) {
          return throwError(() => new Error(response.statusText));
        }

        return from(response.json());
      }),
    );
  }
  static requestOld({
    url,
    method,
    async,
    body,
  }: {
    url: string | URL;
    method: string;
    async: boolean;
    body: XMLHttpRequestBodyInit | Document | null | undefined;
  }): Observable<{ percent?: number; result?: unknown }> {
    return new Observable((observer) => {
      const xhr = new XMLHttpRequest();

      xhr.open(method, url, async);
      xhr.responseType = 'json';

      // Track upload progress
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
          observer.next({ percent: Math.round(percentComplete) });
        }
      };

      // Handle response
      xhr.onload = () => {
        if (xhr.status === 200) {
          observer.next({ result: xhr.response });
          observer.complete();
        } else {
          observer.error('Request failed');
        }
      };

      xhr.onerror = () => {
        observer.error('Request failed');
      };

      xhr.send(body);

      // Return cleanup function
      return () => {
        xhr.abort();
      };
    });
  }
  getConversationsFolders(): Observable<FolderInterface[]> {
    return of(); //TODO
  }
  setConversationsFolders(_folders: FolderInterface[]): Observable<void> {
    const resultPath = encodeURI(constructPath(DataService.getBucket(), ''));

    const response = ApiStorage.request(
      `api/${ApiKeys.Conversations}/${resultPath}`,
    );

    // eslint-disable-next-line no-console
    console.log(response);

    return response;
  }
  getPromptsFolders(): Observable<FolderInterface[]> {
    const resultPath = encodeURI(constructPath(DataService.getBucket(), ''));

    const response = ApiStorage.request(`api/${ApiKeys.Prompts}/${resultPath}`);

    // eslint-disable-next-line no-console
    console.log(response);

    return response;
  }
  setPromptsFolders(_folders: FolderInterface[]): Observable<void> {
    return of(); //TODO
  }
  getConversations(path?: string): Observable<ConversationInfo[]> {
    const filter = BackendDataNodeType.ITEM;

    const query = new URLSearchParams({
      filter,
      bucket: DataService.getBucket(),
      ...(path && { path }),
    });
    const resultQuery = query.toString();

    return ApiStorage.request(
      `api/${ApiKeys.Conversations}/listing?${resultQuery}`,
    ).pipe(
      map((conversations: BackendChatEntity[]) => {
        return conversations.map((conversation): ConversationInfo => {
          const relativePath = conversation.parentPath || undefined;
          const conversationInfo = parseConversationApiKey(conversation.name);

          return {
            ...conversationInfo,
            folderId: relativePath,
          };
        });
      }),
    );
  }
  getConversation(
    info: ConversationInfo,
    _path?: string | undefined,
  ): Observable<Conversation> {
    const key = getConversationApiKeyFromConversationInfo(info);
    return ApiStorage.request(
      `api/${ApiKeys.Conversations}/${DataService.getBucket()}/${key}`,
    ).pipe(
      map((conversation: Conversation) => {
        return {
          ...info,
          ...conversation,
          uploaded: true,
        };
      }),
    );
  }
  setConversations(_conversations: Conversation[]): Observable<void> {
    return of(); //TODO
  }
  getPrompts(path?: string): Observable<Prompt[]> {
    const filter = BackendDataNodeType.ITEM;

    const query = new URLSearchParams({
      filter,
      bucket: DataService.getBucket(),
      ...(path && { path }),
    });
    const resultQuery = query.toString();

    return ApiStorage.request(
      `api/${ApiKeys.Prompts}/listing?${resultQuery}`,
    ).pipe(
      map((prompts: BackendChatEntity[]) => {
        return prompts.map((prompt): PromptInfo => {
          const relativePath = prompt.parentPath || undefined;
          const promptInfo = parsePromptApiKey(prompt.name);

          return {
            ...promptInfo,
            folderId: relativePath,
          };
        });
      }),
    );
  }
  getPrompt(info: PromptInfo, _path?: string | undefined): Observable<Prompt> {
    const key = getPromptApiKey(info);
    return ApiStorage.request(
      `api/${ApiKeys.Prompts}/${DataService.getBucket()}/${key}`,
    ).pipe(
      map((prompt: Prompt) => {
        return {
          ...info,
          ...prompt,
          uploaded: true,
        };
      }),
    );
  }
  setPrompts(_prompts: Prompt[]): Observable<void> {
    return of(); //TODO
  }
}
