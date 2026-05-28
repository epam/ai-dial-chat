import { DialAIError } from '@/src/types/error';
import { HTTPMethod } from '@/src/types/http';
import { DialAIEntityModel } from '@/src/types/models';

import {
  DIAL_API_HOST,
  DIAL_API_VERSION,
} from '@/src/constants/default-server-settings';
import { errorsMessages } from '@/src/constants/errors';
import { HeadersNames } from '@/src/constants/server';

import { ApiUtils } from './api';
import { hardLimitMessages } from './chat';
import { getApiHeaders } from './get-headers';
import { logger } from './logger';

import { Message, MessageFormValue } from '@epam/ai-dial-shared';
import {
  ParsedEvent,
  ReconnectInterval,
  createParser,
} from 'eventsource-parser';
import fetch, { Response } from 'node-fetch';
import { Readable } from 'stream';

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

function getUrl(model: DialAIEntityModel): string {
  const { id } = model;
  return `${DIAL_API_HOST}/openai/deployments/${ApiUtils.encodeApiUrl(id)}/chat/completions?api-version=${DIAL_API_VERSION}`;
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
  chatReference,
  userJWT,
  jobTitle,
  language,
  maxRequestTokens,
  configurationSchemaValue,
  channelId,
}: {
  model: DialAIEntityModel;
  messages: Message[];
  userJWT: string;
  chatReference: string;
  jobTitle: string | undefined;
  language?: string;
  maxRequestTokens: number | undefined;
  configurationSchemaValue?: MessageFormValue;
  temperature?: number;
  channelId?: string;
}) => {
  let messagesToSend = messages;
  const url = getUrl(model);

  const requestHeaders = getApiHeaders({
    chatReference,
    jwt: userJWT,
    jobTitle,
    language,
  });

  if (channelId) {
    requestHeaders[HeadersNames.X_DIAL_CLIENT_CHANNEL_ID] = channelId;
  }

  let retries = 0;
  let body;
  let res: Response;
  const abortController = new AbortController();
  do {
    body = JSON.stringify({
      messages: messagesToSend,
      temperature,
      stream: true,
      model: model.reference,
      max_prompt_tokens: retries === 0 ? maxRequestTokens : undefined,
      ...(configurationSchemaValue && {
        custom_fields: { configuration: configurationSchemaValue },
      }),
    });

    res = await fetch(url, {
      headers: requestHeaders,
      method: HTTPMethod.POST,
      body,
      signal: abortController.signal,
    });

    if (res.status !== 200) {
      let result: DialAIErrorResponse;
      try {
        result = JSON.parse(await res.text()) as DialAIErrorResponse;
      } catch {
        throw new DialAIError(res.statusText, res.status, url, {
          displayMessage: res.statusText,
        });
      }

      if (!result.error) {
        if (!res.statusText || !('detail' in result)) {
          throw new Error(
            `Core API returned an error: ${JSON.stringify(result, null, 2)}`,
          );
        }
        throw new DialAIError(
          res.statusText || (result.detail as string),
          res.status,
          url,
          {
            displayMessage: res.statusText || (result.detail as string),
          },
        );
      }

      const dial_error = new DialAIError(
        result.error.message ?? '',
        result.error.code ?? res.status,
        url,
        {
          type: result.error.type,
          param: result.error.param,
          displayMessage: result.error.display_message || result.error.message,
        },
      );

      if (
        res.status === 400 &&
        dial_error.code === 'truncate_prompt_error' &&
        retries === 0 &&
        model.limits?.isMaxRequestTokensCustom
      ) {
        retries += 1;
        logger.info(
          result,
          `Getting error with status ${res.status} and code '${dial_error.code}'. Retrying chat request to ${model.id} model`,
        );
        messagesToSend = hardLimitMessages(messagesToSend);
        continue;
      }

      throw dial_error;
    }

    break;
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
              throw new DialAIError(json.error.message, json.error.code, url, {
                type: json.error.type,
                param: json.error.param,
                displayMessage: json.error.display_message,
              });
            }
            if (!idSend && json.id) {
              appendChunk(controller, { responseId: json.id });
              idSend = true;
            }

            if (json.choices?.[0]?.delta) {
              if (json.choices[0].finish_reason === 'content_filter') {
                throw new DialAIError(
                  errorsMessages.contentFiltering,
                  'content_filter',
                  url,
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
    cancel() {
      if (isFinished) return;
      isFinished = true;

      try {
        abortController.abort();
      } catch (error) {
        logger.error(
          { error },
          'AbortController: abort was called but the request was already aborted',
        );
      }

      try {
        const nodeBody = res.body as Readable | null;
        nodeBody?.destroy?.();
      } catch (error) {
        logger.error(
          { error },
          'Stream body: destroy was called but the stream was already closed',
        );
      }
    },
  });

  return stream;
};
