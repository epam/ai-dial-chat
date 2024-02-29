import { Message } from '@/src/types/chat';
import { EntityType } from '@/src/types/common';
import { DialAIError } from '@/src/types/error';
import { DialAIEntityModel } from '@/src/types/models';

import {
  DIAL_API_HOST,
  DIAL_API_VERSION,
} from '../../constants/default-server-settings';
import { errorsMessages } from '@/src/constants/errors';

import { getApiHeaders } from './get-headers';

import {
  ParsedEvent,
  ReconnectInterval,
  createParser,
} from 'eventsource-parser';
import fetch from 'node-fetch';

export { DialAIError };

interface DialAIErrorResponse extends Response {
  error?: DialAIError;
}

function getUrl(
  modelId: string,
  modelType: EntityType,
  selectedAddonsIds: string[] | undefined,
): string {
  const isAddonsAdded: boolean = Array.isArray(selectedAddonsIds);
  if (modelType === EntityType.Model && isAddonsAdded) {
    return `${DIAL_API_HOST}/openai/deployments/assistant/chat/completions?api-version=${DIAL_API_VERSION}`;
  }

  return `${DIAL_API_HOST}/openai/deployments/${modelId}/chat/completions?api-version=${DIAL_API_VERSION}`;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const appendChunk = <T extends object>(
  stream: ReadableStreamDefaultController,
  obj: T,
) => {
  const text = JSON.stringify(obj);
  const queue = encoder.encode(text + '\0');

  stream.enqueue(queue);
};

export const OpenAIStream = async ({
  model,
  temperature,
  messages,
  selectedAddonsIds,
  assistantModelId,
  chatId,
  userJWT,
  jobTitle,
  maxRequestTokens,
}: {
  model: DialAIEntityModel;
  temperature: number | undefined;
  messages: Message[];
  selectedAddonsIds: string[] | undefined;
  assistantModelId: string | undefined;
  userJWT: string;
  chatId: string;
  jobTitle: string | undefined;
  maxRequestTokens: number | undefined;
}) => {
  const url = getUrl(model.id, model.type, selectedAddonsIds);

  const requestHeaders = getApiHeaders({
    chatId,
    jwt: userJWT,
    jobTitle,
  });

  const body = JSON.stringify({
    messages,
    temperature,
    stream: true,
    model: assistantModelId ?? model.id,
    addons: selectedAddonsIds?.map((addonId) => ({ name: addonId })),
    max_prompt_tokens: maxRequestTokens,
  });

  const res = await fetch(url, {
    headers: requestHeaders,
    method: 'POST',
    body,
  });

  if (res.status !== 200) {
    let result: DialAIErrorResponse;
    try {
      result = (await res.json()) as DialAIErrorResponse;
    } catch (e) {
      throw new DialAIError(
        `Chat Server error: ${res.statusText}`,
        '',
        '',
        res.status + '',
      );
    }
    if (result.error) {
      throw new DialAIError(
        result.error.message ?? '',
        result.error.type ?? '',
        result.error.param ?? '',
        result.error.code ?? res.status.toString(10),
      );
    } else {
      throw new Error(
        `Core API returned an error: ${JSON.stringify(result, null, 2)}`,
      );
    }
  }
  let idSend = false;
  let isFinished = false;
  const stream = new ReadableStream({
    async start(controller) {
      const onParse = (event: ParsedEvent | ReconnectInterval) => {
        if (isFinished) {
          return;
        }

        if (event.type === 'event') {
          try {
            if (event.data === '[DONE]') {
              controller.close();
              isFinished = true;
              return;
            }
            const data = event.data;
            const json = JSON.parse(data);
            if (json.error) {
              throw new DialAIError(
                json.error.message,
                json.error.type,
                json.error.param,
                json.error.code,
              );
            }
            if (!idSend) {
              appendChunk(controller, { responseId: json.id });
              idSend = true;
            }

            if (json.choices?.[0].delta) {
              if (json.choices[0].finish_reason === 'content_filter') {
                throw new DialAIError(
                  errorsMessages.contentFiltering,
                  '',
                  '',
                  'content_filter',
                );
              }

              appendChunk(controller, json.choices[0].delta);
            }
          } catch (e) {
            controller.error(e);
          }
        }
      };

      const parser = createParser(onParse);
      if (res.body) {
        for await (const chunk of res.body) {
          if (isFinished) {
            return;
          }
          parser.feed(decoder.decode(chunk as Buffer));
        }
      }
    },
  });

  return stream;
};
