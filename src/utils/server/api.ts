import { NextApiRequest } from 'next';

import { Observable, from, switchMap, throwError } from 'rxjs';
import { fromFetch } from 'rxjs/fetch';

import { Conversation, ConversationInfo } from '@/src/types/chat';
import { PromptInfo } from '@/src/types/prompt';

import { OpenAIError } from './types';

export enum ApiKeys {
  Files = 'files',
  Conversations = 'conversations',
  Prompts = 'prompts',
}

export const isValidEntityApiType = (apiKey: string) => {
  return Object.values(ApiKeys).includes(apiKey as ApiKeys);
};

export const getEntityTypeFromPath = (req: NextApiRequest) => {
  return Array.isArray(req.query.entitytype) ? '' : req.query.entitytype;
};

export const getEntityUrlFromSlugs = (
  dialApiHost: string,
  req: NextApiRequest,
) => {
  const entityType = getEntityTypeFromPath(req);
  const slugs = Array.isArray(req.query.slug)
    ? req.query.slug
    : [req.query.slug];

  if (!slugs || slugs.length === 0) {
    throw new OpenAIError(`No ${entityType} path provided`, '', '', '400');
  }

  return `${dialApiHost}/v1/${encodeURI(slugs.join('/'))}`;
};

const pathKeySeparator = '__';

enum PseudoModel {
  Replay = 'replay',
  Playback = 'playback',
}

const getModelApiIdFromConversation = (conversation: Conversation) => {
  if (conversation.replay.isReplay) return PseudoModel.Replay;
  if (conversation.playback?.isPlayback) return PseudoModel.Playback;
  return conversation.model.id;
};

// Format key: {id:guid}__{modelId}__{name:base64}
export const getConversationApiKeyFromConversation = (
  conversation: Conversation,
) => {
  return [
    conversation.id,
    getModelApiIdFromConversation(conversation),
    btoa(conversation.name),
  ].join(pathKeySeparator);
};

// Format key: {id:guid}__{modelId}__{name:base64}
export const getConversationApiKeyFromConversationInfo = (
  conversation: ConversationInfo,
) => {
  return [conversation.id, conversation.model.id, btoa(conversation.name)].join(
    pathKeySeparator,
  );
};

// Format key: {id:guid}__{modelId}__{name:base64}
export const parseConversationApiKey = (apiKey: string): ConversationInfo => {
  const parts = apiKey.split(pathKeySeparator);

  if (parts.length !== 3) throw new Error('Incorrect conversation key');

  const [id, modelId, encodedName] = parts;

  return {
    id,
    model: { id: modelId },
    name: atob(encodedName),
    isPlayback: modelId === PseudoModel.Playback,
    isReplay: modelId === PseudoModel.Replay,
  };
};

// Format key: {id:guid}__{name:base64}
export const getPromptApiKey = (prompt: PromptInfo) => {
  return [prompt.id, btoa(prompt.name)].join(pathKeySeparator);
};

// Format key: {id:guid}__{name:base64}
export const parsePromptApiKey = (apiKey: string): PromptInfo => {
  const parts = apiKey.split(pathKeySeparator);

  if (parts.length !== 2) throw new Error('Incorrect conversation key');

  const [id, encodedName] = parts;

  return {
    id,
    name: atob(encodedName),
  };
};

export class ApiUtils {
  static request(url: string, options?: RequestInit) {
    return fromFetch(url, options).pipe(
      switchMap((response) => {
        if (response.status === 404) {
          return [];
        } else if (!response.ok) {
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
}
