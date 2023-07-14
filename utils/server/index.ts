import { Message } from '@/types/chat';
import {
  OpenAIEntityAddonID,
  OpenAIEntityModel,
  OpenAIEntityModelID,
  OpenAIEntityModelType,
} from '@/types/openai';

import {
  DEFAULT_ASSISTANT_SUBMODEL,
  OPENAI_API_HOST,
  OPENAI_API_VERSION,
} from '../app/const';
import { getHeaders } from './getHeaders';

import {
  ParsedEvent,
  ReconnectInterval,
  createParser,
} from 'eventsource-parser';

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
  modelType: OpenAIEntityModelType,
  isAddonsAdded: boolean,
): string {
  if (modelType === 'model' && isAddonsAdded) {
    return `${OPENAI_API_HOST}/openai/deployments/assistant/chat/completions?api-version=${OPENAI_API_VERSION}`;
  }

  return `${OPENAI_API_HOST}/openai/deployments/${modelId}/chat/completions?api-version=${OPENAI_API_VERSION}`;
}

export const OpenAIStream = async ({
  model,
  systemPrompt,
  temperature,
  key,
  messages,
  tokenCount,
  selectedAddons,
  assistantSubModelId,
  userJWT,
}: {
  model: OpenAIEntityModel;
  systemPrompt: string;
  temperature: number;
  key: string;
  messages: Message[];
  tokenCount: number;
  selectedAddons: OpenAIEntityAddonID[];
  assistantSubModelId: OpenAIEntityModelID;
  userJWT: string | null | undefined;
}) => {
  const url = getUrl(model.id, model.type, selectedAddons?.length > 0);
  const apiKey = key ? key : process.env.OPENAI_API_KEY;
  let requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(apiKey && getHeaders(apiKey)),
    // ...(userJWT && { 'Authorization': `Bearer ${userJWT}` }),
  };
  let body: string;

  body = JSON.stringify({
    messages: [
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
        : assistantSubModelId ?? DEFAULT_ASSISTANT_SUBMODEL.id,
    ...(model.tokenLimit && { max_tokens: model.tokenLimit - tokenCount }),
    ...(selectedAddons?.length && {
      addons: selectedAddons?.map((addon) => ({ name: addon })),
    }),
  });

  const res = await fetch(url, {
    headers: requestHeaders,
    method: 'POST',
    body,
  });

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

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
        result.error.code,
      );
    } else {
      throw new Error(
        `OpenAI API returned an error: ${
          decoder.decode(result?.value) || result.statusText
        }`,
      );
    }
  }

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
            const text = JSON.stringify(json.choices[0].delta);
            const queue = encoder.encode(text + '\0');

            controller.enqueue(queue);

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
