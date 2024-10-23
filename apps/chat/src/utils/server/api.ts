import { Observable, from, switchMap, throwError } from 'rxjs';
import { fromFetch } from 'rxjs/fetch';

import { ServerUtils } from '@/src/utils/server/server';

import { ApplicationInfo } from '@/src/types/applications';
import { Conversation } from '@/src/types/chat';
import { HTTPMethod } from '@/src/types/http';
import { PromptInfo } from '@/src/types/prompt';

import { EMPTY_MODEL_ID } from '@/src/constants/default-ui-settings';
import { NA_VERSION } from '@/src/constants/public';
import { validVersionRegEx } from '@/src/constants/versions';

import { constructPath } from '../app/file';

import { ConversationInfo } from '@epam/ai-dial-shared';

export const pathKeySeparator = '__';
const encodedKeySeparator = '%5F%5F';

export enum PseudoModel {
  Replay = 'replay',
  Playback = 'playback',
}

export const encodeModelId = (modelId: string): string =>
  modelId
    .split(pathKeySeparator)
    .map((i) => encodeURI(i))
    .join(encodedKeySeparator);

export const decodeModelId = (modelKey: string): string =>
  modelKey
    .split(encodedKeySeparator)
    .map((i) => decodeURI(i))
    .join(pathKeySeparator);

export const isPseudoModel = (modelId: string | undefined) =>
  modelId ? Object.values(PseudoModel).includes(modelId as PseudoModel) : false;

const getModelApiIdFromConversation = (conversation: Conversation): string => {
  if (conversation.replay?.isReplay ?? conversation.isReplay)
    return PseudoModel.Replay;
  if (conversation.playback?.isPlayback ?? conversation.isPlayback)
    return PseudoModel.Playback;
  return conversation.model.id;
};

// Format key: {modelId}__{name} or {modelId}__{name}__{version} if conversation is public
export const getConversationApiKey = (
  conversation: Omit<ConversationInfo, 'id' | 'folderId'>,
): string => {
  if (conversation.model.id === EMPTY_MODEL_ID) {
    return conversation.name;
  }

  const keyParts = [
    encodeModelId(getModelApiIdFromConversation(conversation as Conversation)),
    conversation.name,
  ];

  if (
    conversation.publicationInfo?.version &&
    conversation.publicationInfo.version !== NA_VERSION
  ) {
    keyParts.push(conversation.publicationInfo.version);
  }

  return keyParts.join(pathKeySeparator);
};

// Format key: {modelId}__{name}
export const parseConversationApiKey = (
  apiKey: string,
  options?: Partial<{ parseVersion: boolean }>,
): Omit<ConversationInfo, 'folderId' | 'id'> => {
  const parts = apiKey.split(pathKeySeparator);

  const [modelId, name] =
    parts.length < 2
      ? [EMPTY_MODEL_ID, apiKey] // receive without prefix with model i.e. {name}
      : [decodeModelId(parts[0]), parts.slice(1).join(pathKeySeparator)]; // receive correct format {modelId}__{name}

  const parsedApiKey: Omit<ConversationInfo, 'folderId' | 'id'> = {
    model: { id: modelId },
    name,
    isPlayback: modelId === PseudoModel.Playback,
    isReplay: modelId === PseudoModel.Replay,
  };

  if (options?.parseVersion) {
    const version = parts.length > 2 && parts.at(-1);

    if (version && validVersionRegEx.test(version)) {
      parsedApiKey.publicationInfo = { version };
      parsedApiKey.name = getPublicItemIdWithoutVersion(version, name);
    } else {
      parsedApiKey.publicationInfo = { version: NA_VERSION };
    }
  }

  return parsedApiKey;
};

// Format key: {name} or {name}__{version} if prompt is public
export const getPromptApiKey = (prompt: Omit<PromptInfo, 'id'>) => {
  if (
    !prompt.publicationInfo ||
    prompt.publicationInfo.version === NA_VERSION
  ) {
    return prompt.name;
  }

  return [prompt.name, prompt.publicationInfo.version].join(pathKeySeparator);
};

// Format key: {name}
export const parsePromptApiKey = (
  apiKey: string,
  options?: Partial<{ parseVersion: boolean }>,
): Omit<PromptInfo, 'folderId' | 'id'> => {
  const parts = apiKey.split(pathKeySeparator);

  const parsedApiKey: Omit<PromptInfo, 'folderId' | 'id'> = {
    name: apiKey,
  };

  if (options?.parseVersion) {
    const version = parts.at(-1);

    if (version && validVersionRegEx.test(version)) {
      parsedApiKey.publicationInfo = { version };
      parsedApiKey.name = getPublicItemIdWithoutVersion(version, apiKey);
    } else {
      parsedApiKey.publicationInfo = { version: NA_VERSION };
    }
  }

  return parsedApiKey;
};

// Format key: {name}__{version}
export const getApplicationApiKey = (
  application: Omit<ApplicationInfo, 'folderId' | 'id'>,
): string => {
  return [application.name, application.version].join(pathKeySeparator);
};

// Format key: {name}__{version}
export const parseApplicationApiKey = (
  apiKey: string,
): Omit<ApplicationInfo, 'folderId' | 'id'> => {
  const parts = apiKey.split(pathKeySeparator);
  const [name, version] =
    parts.length < 2
      ? [apiKey, '1.0.0'] // receive without postfix with version i.e. {name}
      : [
          decodeModelId(
            parts.slice(0, parts.length - 1).join(pathKeySeparator),
          ),
          parts[parts.length - 1],
        ]; // receive correct format {name}__{version}
  return {
    name,
    version,
  };
};

export class ApiUtils {
  static safeEncodeURIComponent = (urlComponent: string) =>
    // eslint-disable-next-line no-misleading-character-class
    urlComponent.replace(/[^\uD800-\uDBFF\uDC00-\uDFFF]+/gm, (match) =>
      encodeURIComponent(match),
    );

  static encodeApiUrl = (path: string): string =>
    constructPath(
      ...path.split('/').map((part) => this.safeEncodeURIComponent(part)),
    );

  static decodeApiUrl = (path: string): string =>
    constructPath(...path.split('/').map((part) => decodeURIComponent(part)));

  static request(url: string, options?: RequestInit) {
    return fromFetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    }).pipe(
      switchMap((response) => {
        if (!response.ok) {
          return from(ServerUtils.getErrorMessageFromResponse(response)).pipe(
            switchMap((errorMessage) => {
              return throwError(
                () => new Error(errorMessage || response.status + ''),
              );
            }),
          );
        }

        return from(response.json());
      }),
    );
  }

  static requestText(url: string, options?: RequestInit) {
    return fromFetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    }).pipe(
      switchMap((response) => {
        if (!response.ok) {
          return from(ServerUtils.getErrorMessageFromResponse(response)).pipe(
            switchMap((errorMessage) => {
              return throwError(
                () => new Error(errorMessage || response.status + ''),
              );
            }),
          );
        }

        return from(response.text());
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
    method: HTTPMethod;
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

export const getPublicItemIdWithoutVersion = (version: string, id: string) => {
  if (version === NA_VERSION) {
    return id;
  }

  return id.split(pathKeySeparator).slice(0, -1).join(pathKeySeparator);
};

export const addVersionToId = (id: string, version: string) =>
  [id, version].join(pathKeySeparator);
