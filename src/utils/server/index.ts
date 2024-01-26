import { Message, Role } from '@/src/types/chat';
import { EntityType } from '@/src/types/common';
import {
  OpenAIEntityAddonID,
  OpenAIEntityModel,
  OpenAIEntityModelID,
} from '@/src/types/openai';

import {
  DEFAULT_ASSISTANT_SUBMODEL,
  DIAL_API_HOST,
  DIAL_API_VERSION,
} from '../../constants/default-settings';
import { errorsMessages } from '@/src/constants/errors';

import { getApiHeaders } from './get-headers';
import { OpenAIError } from './types';

import {
  ParsedEvent,
  ReconnectInterval,
  createParser,
} from 'eventsource-parser';
import fetch from 'node-fetch';

export { OpenAIError };

interface OpenAIErrorResponse extends Response {
  error?: OpenAIError;
}

function getUrl(
  modelId: string,
  modelType: EntityType,
  isAddonsAdded: boolean,
): string {
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
  systemPrompt,
  temperature,
  messages,
  selectedAddons,
  assistantModelId,
  chatId,
  userJWT,
  jobTitle,
}: {
  model: OpenAIEntityModel;
  systemPrompt: string | undefined;
  temperature: number | undefined;
  messages: Message[];
  selectedAddons: OpenAIEntityAddonID[] | undefined;
  assistantModelId: OpenAIEntityModelID | undefined;
  userJWT: string;
  chatId: string;
  jobTitle: string | undefined;
}) => {
  const isAddonsAdded: boolean =
    Array.isArray(selectedAddons) && selectedAddons?.length > 0;

  const url = getUrl(model.id, model.type, isAddonsAdded);
  const requestHeaders = getApiHeaders({
    chatId,
    jwt: userJWT,
    jobTitle,
  });

  const body = JSON.stringify({
    messages:
      !systemPrompt || systemPrompt.trim().length === 0
        ? messages
        : [
            {
              role: Role.System,
              content: systemPrompt,
            },
            ...messages,
          ],
    temperature,
    stream: true,
    model:
      model.type !== EntityType.Assistant
        ? model.id
        : assistantModelId ?? DEFAULT_ASSISTANT_SUBMODEL.id,
    ...(selectedAddons?.length && {
      addons: selectedAddons?.map((addon) => ({ name: addon })),
    }),
  });

  const res = await fetch(url, {
    headers: requestHeaders,
    method: 'POST',
    body,
  });

  if (res.status !== 200) {
    let result: OpenAIErrorResponse;
    try {
      result = (await res.json()) as OpenAIErrorResponse;
    } catch (e) {
      throw new OpenAIError(
        `Server error: ${res.statusText}`,
        '',
        '',
        res.status + '',
      );
    }
    if (result.error) {
      throw new OpenAIError(
        result.error.message ?? '',
        result.error.type ?? '',
        result.error.param ?? '',
        result.error.code ?? res.status.toString(10),
      );
    } else {
      throw new Error(
        `OpenAI API returned an error: ${JSON.stringify(result, null, 2)}`,
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
              throw new OpenAIError(
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
                throw new OpenAIError(
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
