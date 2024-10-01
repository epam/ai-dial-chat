import { EntityType } from '@/src/types/common';
import { DialAIError } from '@/src/types/error';
import { HTTPMethod } from '@/src/types/http';
import { DialAIEntityModel } from '@/src/types/models';

import {
  DIAL_API_HOST,
  DIAL_API_VERSION,
} from '../../constants/default-server-settings';
import { errorsMessages } from '@/src/constants/errors';

import { hardLimitMessages } from './chat';
import { getApiHeaders } from './get-headers';
import { logger } from './logger';

import { Message } from '@epam/ai-dial-shared';
import {
  ParsedEvent,
  ReconnectInterval,
  createParser,
} from 'eventsource-parser';
import fetch, { Response } from 'node-fetch';

interface DialAIErrorResponse extends Response {
  error?: {
    message: string;
    type: string;
    param: string;
    code: string;

    // Message for end user
    display_message: string | undefined;
  };
}

function getUrl(
  model: DialAIEntityModel,
  selectedAddonsIds: string[] | undefined,
): string {
  const isAddonsAdded: boolean = Array.isArray(selectedAddonsIds);
  const { type, id } = model;
  if (type === EntityType.Model && isAddonsAdded) {
    return `${DIAL_API_HOST}/openai/deployments/assistant/chat/completions?api-version=${DIAL_API_VERSION}`;
  }

  return `${DIAL_API_HOST}/openai/deployments/${id}/chat/completions?api-version=${DIAL_API_VERSION}`;
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
  let messagesToSend = messages;
  const url = getUrl(model, selectedAddonsIds);

  const requestHeaders = getApiHeaders({
    chatId,
    jwt: userJWT,
    jobTitle,
  });

  let retries = 0;
  let body;
  let res: Response;
  do {
    body = JSON.stringify({
      messages: messagesToSend,
      temperature,
      stream: true,
      model: assistantModelId ?? model.reference,
      addons: selectedAddonsIds?.map((addonId) => ({ name: addonId })),
      max_prompt_tokens: retries === 0 ? maxRequestTokens : undefined,
    });

    res = await fetch(url, {
      headers: requestHeaders,
      method: HTTPMethod.POST,
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

      if (!result.error) {
        throw new Error(
          `Core API returned an error: ${JSON.stringify(result, null, 2)}`,
        );
      }

      const dial_error = new DialAIError(
        result.error.message ?? '',
        result.error.type ?? '',
        result.error.param ?? '',
        result.error.code ?? res.status.toString(10),
        result.error.display_message,
      );

      if (
        res.status === 400 &&
        dial_error.code === 'truncate_prompt_error' &&
        retries === 0 &&
        model.limits?.isMaxRequestTokensCustom
      ) {
        retries += 1;
        const json = await res.json();
        logger.info(
          json,
          `Getting error with status ${res.status} and code '${dial_error.code}'. Retrying chat request to ${model.id} model`,
        );
        messagesToSend = hardLimitMessages(messagesToSend);
        continue;
      }

      throw dial_error;
    }

    break;
    // eslint-disable-next-line no-constant-condition
  } while (true);

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
                json.error.display_message,
              );
            }
            if (!idSend) {
              appendChunk(controller, { responseId: json.id });
              idSend = true;
            }

            if (json.choices?.[0]?.delta) {
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
