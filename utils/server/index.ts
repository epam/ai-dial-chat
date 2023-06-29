import { Message } from '@/types/chat';
import { OpenAIModel, bedrockModels, googleModels, openAIModels } from '@/types/openai';

import {
  BEDROCK_HOST,
  GOOGLE_MAX_OUTPUT_TOKENS,
  GOOGLE_TOP_K,
  GOOGLE_TOP_P,
  OPENAI_API_HOST,
  OPENAI_API_TYPE,
  OPENAI_API_VERSION,
  OPENAI_ORGANIZATION,
} from '../app/const';
import {
  extendWithBedrockHeaders,
  extendWithOpenAIHeaders,
} from './getHeaders';

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

export const OpenAIStream = async (
  model: OpenAIModel,
  systemPrompt: string,
  temperature: number,
  key: string,
  messages: Message[],
  headers: Record<string, string>,
  tokenCount: number,
) => {
  const isGoogle =
    googleModels.includes(model.id as any);

  const isBedrock = bedrockModels.includes(model.id as any);

  const isOpenAI = openAIModels.includes(model.id as any);

  let url = `${OPENAI_API_HOST}/v1/chat/completions`;
  if (isGoogle) {
    url = `${process.env.GOOGLE_AI_HOST ?? OPENAI_API_HOST}/v1/projects/${
      process.env.GOOGLE_AI_PROJECT_ID
    }/locations/${process.env.GOOGLE_AI_LOCATION}/publishers/google/models/${
      process.env.GOOGLE_AI_BARD_MODEL_ID ?? model.id
    }:predict`;
  } else if (isBedrock) {
    url = `${BEDROCK_HOST}/openai/deployments/${model.id}/chat/completions?api-version=${OPENAI_API_VERSION}`;
  } else if (OPENAI_API_TYPE === 'azure') {
    url = `${OPENAI_API_HOST}/openai/deployments/${model.id}/chat/completions?api-version=${OPENAI_API_VERSION}`;
  }

  let requestHeaders: Record<string, string> = {
    ...headers,
    'Content-Type': 'application/json',
  };
  let body: string;

  if (isGoogle) {
    requestHeaders.Authorization = `Bearer ${process.env.GOOGLE_AI_TOKEN}`;

    body = JSON.stringify({
      instances: [
        {
          context: systemPrompt,
          examples: [],
          messages: messages.map((msg) => ({
            author: msg.role === 'assistant' ? 'bot' : 'user',
            content: msg.content,
          })),
        },
      ],
      parameters: {
        temperature,
        topP: GOOGLE_TOP_P,
        topK: GOOGLE_TOP_K,
        maxOutputTokens: GOOGLE_MAX_OUTPUT_TOKENS,
      },
    });
  } else {
    requestHeaders = isBedrock
      ? extendWithBedrockHeaders(key, requestHeaders)
      : extendWithOpenAIHeaders(key, requestHeaders);

    body = JSON.stringify({
      ...((isOpenAI && OPENAI_API_TYPE === 'openai') && { model: model.id }),
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        ...messages,
      ],
      max_tokens: model.tokenLimit - tokenCount,
      temperature,
      stream: true,
    });
  }

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
      if (isGoogle) {
        try {
          const result = await res.json();
          const queue = encoder.encode(
            result.predictions[0]?.candidates?.[0]?.content,
          );
          controller.enqueue(queue);
          controller.close();
        } catch (e) {
          controller.error(e);
        }
      } else {
        const onParse = (event: ParsedEvent | ReconnectInterval) => {
          if (event.type === 'event') {
            if (event.data === '[DONE]') {
              controller.close();
              return;
            }
            const data = event.data;
            try {
              const json = JSON.parse(data);
              if (json.choices[0].finish_reason != null) {
                controller.close();
                return;
              }
              const text = json.choices[0].delta.content;
              const queue = encoder.encode(text);
              controller.enqueue(queue);
            } catch (e) {
              controller.error(e);
            }
          }
        };

        const parser = createParser(onParse);

        for await (const chunk of res.body as any) {
          parser.feed(decoder.decode(chunk));
        }
      }
    },
  });

  return stream;
};
