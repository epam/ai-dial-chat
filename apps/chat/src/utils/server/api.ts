import { Observable, from, switchMap, throwError } from 'rxjs';
import { fromFetch } from 'rxjs/fetch';

import { isUuid } from '@/src/utils/app/common';
import { isConversationId } from '@/src/utils/app/id';
import {
  constructPath,
  isPlaybackConversation,
  isReplayConversation,
  splitEntityId,
} from '@/src/utils/app/shared-utils';
import { ServerUtils } from '@/src/utils/server/server';

import { ApplicationInfo } from '@/src/types/applications';
import { Conversation } from '@/src/types/chat';
import { ApiKeys, CoreApiKeys } from '@/src/types/common';
import { HttpErrorStatus } from '@/src/types/error';
import { HTTPMethod } from '@/src/types/http';
import {
  ParseEntityApiKeyOptions,
  ParseEntityApiKeyResult,
} from '@/src/types/parse-entity';
import { PromptInfo } from '@/src/types/prompt';
import { ServerSlugs } from '@/src/types/slugs-types';
import { ToolsetInfo } from '@/src/types/toolsets';

import { EMPTY_MODEL_ID } from '@/src/constants/default-ui-settings';
import { NA_VERSION } from '@/src/constants/publication';
import { validVersionRegEx } from '@/src/constants/versions';

import { ConversationInfo } from '@epam/ai-dial-shared';

export const pathKeySeparator = '__';
const encodedKeySeparator = '%5F%5F';

export enum PseudoModel {
  Replay = 'replay',
  Playback = 'playback',
}

// encoding modelId if it has '__' as part of the modelId to avoid conflict with pathKeySeparator
// conversation modelId: 'gpt-4o__2025-09-20' will be encoded to 'gpt-4o%5F%5F2025-09-20'
// and conversation key will be 'gpt-4o%5F%5F2025-09-20__name__0.0.1' to then properly split apiKey by pathKeySeparator
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
  if (isReplayConversation(conversation)) return PseudoModel.Replay;
  if (isPlaybackConversation(conversation)) return PseudoModel.Playback;
  return conversation.model.id;
};

// Format key: {modelId}__{name} or {modelId}__{name}__{version} if conversation is public
// Format key with UUID: {modelId}__{name}__{uuid} or {modelId}__{name}__{version}__{uuid}
export const getConversationApiKey = (
  conversation: Omit<ConversationInfo, 'id' | 'folderId'>,
): string => {
  if (conversation.model.id === EMPTY_MODEL_ID) {
    return conversation.name;
  }

  // encoding modelId if it has '__' as part of the modelId to avoid conflict with pathKeySeparator
  // conversation modelId: 'gpt-4o__2025-09-20' will be encoded to 'gpt-4o%5F%5F2025-09-20'
  // and conversation key will be 'gpt-4o%5F%5F2025-09-20__name__0.0.1' to then properly split apiKey by pathKeySeparator
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

  // Append UUID if present (should be at the end)
  if (conversation.uuid) {
    keyParts.push(conversation.uuid);
  }

  return keyParts.join(pathKeySeparator);
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

export const parseEntityApiKey = <T extends ParseEntityApiKeyOptions>(
  apiKey: string,
  options?: T,
): ParseEntityApiKeyResult<T> => {
  const parts = apiKey.split(pathKeySeparator);

  const result: ParseEntityApiKeyResult<T> = {} as ParseEntityApiKeyResult<T>;

  if (options?.parseModel) {
    if (parts.length < 2) {
      result.modelInfo = {
        model: { id: EMPTY_MODEL_ID },
        isPlayback: false,
        isReplay: false,
      };
    } else {
      // decoding modelId if it has '%5F%5F' as part of the modelId to avoid conflict with pathKeySeparator
      // conversation key: 'gpt-4o%5F%5F2025-09-20__name__0.0.1' split by pathKeySeparator will be ['gpt-4o%5F%5F2025-09-20', 'name', '0.0.1']
      // after decoding modelId: 'gpt-4o%5F%5F2025-09-20' will be decoded to 'gpt-4o__2025-09-20'
      const modelId = decodeModelId(parts.shift() ?? EMPTY_MODEL_ID);
      result.modelInfo = {
        model: { id: modelId },
        isPlayback: modelId === PseudoModel.Playback,
        isReplay: modelId === PseudoModel.Replay,
      };
    }
  }

  if (options?.parseVersion) {
    if (parts.length < 2) {
      result.version = options?.defaultVersion ?? NA_VERSION;
    } else {
      result.version = parts.pop() ?? options?.defaultVersion ?? NA_VERSION;
    }
  }

  if (result.version?.startsWith('_')) {
    result.version = result.version.replace(/^_/, '');
    parts[parts.length - 1] = `${parts[parts.length - 1]}_`;
  }

  if (isUuid(parts.at(-1))) {
    result.uuid = parts.pop();
  }

  return {
    ...result,
    name: parts.join(pathKeySeparator),
  };
};

// Format key: {name}__{version}
export const getMarketplaceEntityApiKey = (
  entity: Omit<ApplicationInfo | ToolsetInfo, 'folderId' | 'id'>,
): string => {
  if (!entity.version || entity.version === NA_VERSION) {
    return entity.name;
  }
  return [entity.name, entity.version].join(pathKeySeparator);
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

  static decodeApiUrl = (path?: string): string =>
    constructPath(
      ...(path?.split('/').map((part) => decodeURIComponent(part)) || []),
    );

  static request(url: string, options?: RequestInit) {
    return fromFetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    }).pipe(
      switchMap((response) => {
        if (!response.ok) {
          return from(ServerUtils.getErrorMessageFromResponse(response)).pipe(
            switchMap((errorMessage) => {
              const error: HttpErrorStatus = new Error(
                errorMessage || response.status + '',
              );
              error.status = response.status;
              return throwError(() => error);
            }),
          );
        }

        return from(response.json());
      }),
    );
  }

  static requestText(url: string, options?: RequestInit) {
    return fromFetch(constructPath('/api', url), {
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
    signal,
  }: {
    url: string | URL;
    method: HTTPMethod;
    async: boolean;
    body: XMLHttpRequestBodyInit | Document | null | undefined;
    signal?: AbortSignal | null;
  }): Observable<{ percent?: number; result?: unknown }> {
    return new Observable((observer) => {
      const xhr = new XMLHttpRequest();
      let aborted = false;

      xhr.open(method, url, async);

      // Track upload progress
      xhr.upload.onprogress = (event) => {
        if (!aborted && event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
          observer.next({ percent: Math.round(percentComplete) });
        }
      };

      const buildRequestError = () => {
        const rawBody = xhr.responseText;
        let serverMessage: string | undefined;
        if (rawBody) {
          try {
            const parsed = JSON.parse(rawBody);
            serverMessage =
              typeof parsed === 'string' ? parsed : parsed?.message;
          } catch {
            serverMessage = rawBody;
          }
        }
        const error = new Error(serverMessage || 'Request failed');
        (error as HttpErrorStatus).status = xhr.status;
        return error;
      };

      // Handle response
      xhr.onload = () => {
        if (aborted) return;
        if (xhr.status === 200) {
          let result: unknown = xhr.responseText;
          try {
            result = JSON.parse(xhr.responseText);
          } catch {
            // Leave the raw text as the result if it is not JSON.
          }
          observer.next({ result });
          observer.complete();
        } else {
          observer.error(buildRequestError());
        }
      };

      xhr.onerror = () => {
        if (!aborted) {
          observer.error(buildRequestError());
        }
      };

      // attach abort signal
      const abortHandler = () => {
        aborted = true;
        xhr.abort();
        observer.complete();
      };

      if (signal) {
        signal.addEventListener('abort', abortHandler);
      }

      xhr.send(body);

      // Return cleanup function
      return () => {
        aborted = true;
        xhr.abort();
        if (signal) {
          signal.removeEventListener('abort', abortHandler);
        }
      };
    });
  }
}

export const getModelIdWithoutVersion = (id: string) => {
  const parts = id.split(pathKeySeparator);
  if (parts.length < 2) {
    return id;
  }
  const name = parts.slice(0, -1).join(pathKeySeparator);
  const version = parts.at(-1)?.replace(/^_/, '');
  if (!version) {
    return id;
  }
  if (parts.at(-1)?.startsWith('_')) {
    return `${name}_`;
  }
  return name;
};

export const getPublicItemIdWithoutVersion = (version: string, id: string) => {
  if (version === NA_VERSION) {
    return id;
  }

  return getModelIdWithoutVersion(id);
};

export const isValidEntityApiType = (apiKey: string): boolean => {
  return (
    Object.values(ApiKeys).includes(apiKey as ApiKeys) ||
    Object.values(CoreApiKeys).includes(apiKey as CoreApiKeys)
  );
};

export const getIdWithoutVersionFromApiKey = (id: string) => {
  const { version } = parseEntityApiKey(splitEntityId(id).name, {
    parseVersion: true,
    parseModel: isConversationId(id),
  });

  return getPublicItemIdWithoutVersion(version, id);
};

export const getVersionFromId = (id: string) => {
  const parts = id.split(pathKeySeparator);
  if (parts.length < 2) {
    return NA_VERSION;
  }

  // conversations also have model (example: conversations/public/gpt-3.5-turbo__name__0.0.1)
  if (isConversationId(id) && parts.length < 3) {
    return NA_VERSION;
  }

  const version = parts.at(-1)?.replace(/^_/, '');

  return version && validVersionRegEx.test(version) ? version : NA_VERSION;
};

export const getOpsApiUrl = (slug: ServerSlugs, ...params: string[]): string =>
  constructPath('/api/ops', slug, ...params);
