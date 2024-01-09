import { Observable, from, switchMap, throwError } from 'rxjs';
import { fromFetch } from 'rxjs/fetch';

import { Conversation } from '@/src/types/chat';
import { FolderInterface } from '@/src/types/folder';
import { Prompt } from '@/src/types/prompt';
import { DialStorage } from '@/src/types/storage';

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }): Observable<{ percent?: number; result?: any }> {
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
