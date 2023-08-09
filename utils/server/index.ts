import { Message } from '@/types/chat';
import {
  OpenAIEntityAddonID,
  OpenAIEntityApplicationType,
  OpenAIEntityAssistantType,
  OpenAIEntityModel,
  OpenAIEntityModelID,
  OpenAIEntityModelType,
} from '@/types/openai';

import {
  DEFAULT_ASSISTANT_SUBMODEL,
  OPENAI_API_HOST,
  OPENAI_API_VERSION,
} from '../app/const';
import { getApiHeaders } from './getHeaders';

import {
  ParsedEvent,
  ReconnectInterval,
  createParser,
} from 'eventsource-parser';
import fetch from 'node-fetch';

export class OpenAIError extends Error {
  type: string;
  param: string;
  code: string;

  constructor(message: string, type: string, param: string, code: string) {
    super(message);
    this.name = 'OpenAIError';
    this.type = type;
    this.param = param;
    this.code = code;
  }
}

function getUrl(
  modelId: string,
  modelType:
    | OpenAIEntityModelType
    | OpenAIEntityApplicationType
    | OpenAIEntityAssistantType,
  isAddonsAdded: boolean,
): string {
  if (modelType === 'model' && isAddonsAdded) {
    return `${OPENAI_API_HOST}/openai/deployments/assistant/chat/completions?api-version=${OPENAI_API_VERSION}`;
  }

  return `${OPENAI_API_HOST}/openai/deployments/${modelId}/chat/completions?api-version=${OPENAI_API_VERSION}`;
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
  key,
  messages,
  selectedAddons,
  assistantModelId,
  chatId,
  userJWT,
}: {
  model: OpenAIEntityModel;
  systemPrompt: string | undefined;
  temperature: number | undefined;
  key: string;
  messages: Message[];
  selectedAddons: OpenAIEntityAddonID[] | undefined;
  assistantModelId: OpenAIEntityModelID | undefined;
  userJWT: string;
  chatId: string;
}) => {
  const isAddonsAdded: boolean =
    Array.isArray(selectedAddons) && selectedAddons?.length > 0;

  const url = getUrl(model.id, model.type, isAddonsAdded);
  const apiKey = key ? key : process.env.OPENAI_API_KEY;
  const requestHeaders = getApiHeaders({
    chatId,
    key: apiKey,
    jwt: userJWT,
  });

  const body = JSON.stringify({
    messages:
      !systemPrompt || systemPrompt.trim().length === 0
        ? messages
        : [
            {
              role: 'system',
              content: systemPrompt,
            },
            ...messages,
          ],
    temperature,
    stream: true,
    model:
      model.type !== 'assistant'
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
    let result: any;
    try {
      result = await res.json();
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
        result.error.message,
        result.error.type,
        result.error.param,
        result.error.code ?? res.status.toString(10),
      );
    } else {
      throw new Error(
        `OpenAI API returned an error: ${
          decoder.decode(result?.value) || result.statusText
        }`,
      );
    }
  }
  let idSend = false;
  const stream = new ReadableStream({
    async start(controller) {
      const onParse = (event: ParsedEvent | ReconnectInterval) => {
        if (event.type === 'event') {
          if (event.data === '[DONE]') {
            controller.close();
            return;
          }
          const data = event.data;
          try {
            const json = JSON.parse(data);
            if (!idSend) {
              appendChunk(controller, { responseId: json.id });
              idSend = true;
            }

            appendChunk(controller, json.choices[0].delta);

            if (json.choices[0].finish_reason != null) {
              controller.close();
              return;
            }
          } catch (e) {
            controller.error(e);
          }
        }
      };

      const parser = createParser(onParse);

      for await (const chunk of res.body as any) {
        parser.feed(decoder.decode(chunk));
      }
    },
  });

  return stream;
};
