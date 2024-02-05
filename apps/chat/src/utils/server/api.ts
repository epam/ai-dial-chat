import { NextApiRequest } from 'next';

import { Observable, from, switchMap, throwError } from 'rxjs';
import { fromFetch } from 'rxjs/fetch';

import { Conversation, ConversationInfo } from '@/src/types/chat';
import { FolderType } from '@/src/types/folder';
import { PromptInfo } from '@/src/types/prompt';

import { EMPTY_MODEL_ID } from '@/src/constants/default-settings';

import { OpenAIError } from './types';

export enum ApiKeys {
  Files = 'files',
  Conversations = 'conversations',
  Prompts = 'prompts',
}

export const getFolderTypeByApiKey = (key: ApiKeys): FolderType => {
  switch (key) {
    case ApiKeys.Conversations:
      return FolderType.Chat;
    case ApiKeys.Prompts:
      return FolderType.Prompt;
    case ApiKeys.Files:
    default:
      return FolderType.File;
  }
};

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

  return `${dialApiHost}/v1/${entityType}/${encodeURI(slugs.join('/'))}`;
};

const pathKeySeparator = '__';

export const combineApiKey = (...args: (string | number)[]) =>
  args.join(pathKeySeparator);

enum PseudoModel {
  Replay = 'replay',
  Playback = 'playback',
}

const getModelApiIdFromConversation = (conversation: Conversation) => {
  if (conversation.replay?.isReplay || conversation.isReplay)
    return PseudoModel.Replay;
  if (conversation.playback?.isPlayback || conversation.isPlayback)
    return PseudoModel.Playback;
  return conversation.model.id;
};

// Format key: {modelId}__{name}
export const getConversationApiKey = (
  conversation: Omit<ConversationInfo, 'id'>,
) => {
  if (conversation.model.id === EMPTY_MODEL_ID) {
    return conversation.name;
  }
  return combineApiKey(
    getModelApiIdFromConversation(conversation as Conversation),
    conversation.name,
  );
};

// Format key: {modelId}__{name}
export const parseConversationApiKey = (apiKey: string): ConversationInfo => {
  const parts = apiKey.split(pathKeySeparator);

  const [modelId, name] =
    parts.length < 2
      ? [EMPTY_MODEL_ID, apiKey] // receive without postfix with model i.e. {name}
      : [parts[0], parts.slice(1).join(pathKeySeparator)]; // receive correct format {modelId}__{name}

  return {
    id: name,
    model: { id: modelId },
    name,
    isPlayback: modelId === PseudoModel.Playback,
    isReplay: modelId === PseudoModel.Replay,
  };
};

// Format key: {name:base64}
export const getPromptApiKey = (prompt: Omit<PromptInfo, 'id'>) => {
  return combineApiKey(prompt.name);
};

// Format key: {name}
export const parsePromptApiKey = (name: string): PromptInfo => {
  return {
    id: name,
    name,
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

export const getParentPath = (parentPath?: string | null) =>
  parentPath ? `/${parentPath}` : '';
