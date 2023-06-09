import { Message } from '@/types/chat';
import { OpenAIModel, OpenAIModelID } from '@/types/openai';

import {
  OPENAI_API_HOST,
  OPENAI_API_TYPE,
  OPENAI_API_VERSION,
  OPENAI_ORGANIZATION,
} from '../app/const';

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
  headers: HeadersInit,
  tokenCount: number,
) => {
  const isGoogle =
    model.id === OpenAIModelID.BISON_001 && !!process.env.GOOGLE_AI_TOKEN;

  let url = `${OPENAI_API_HOST}/v1/chat/completions`;
  if (isGoogle) {
    url = `${process.env.GOOGLE_AI_HOST ?? OPENAI_API_HOST}/v1/projects/${
      process.env.GOOGLE_AI_PROJECT_ID
    }/locations/${process.env.GOOGLE_AI_LOCATION}/publishers/google/models/${
      process.env.GOOGLE_AI_BARD_MODEL_ID ?? model.id
    }:predict`;
  } else if (OPENAI_API_TYPE === 'azure') {
    url = `${OPENAI_API_HOST}/openai/deployments/${model.id}/chat/completions?api-version=${OPENAI_API_VERSION}`;
  }

  const requestHeaders = {
    ...headers,
    'Content-Type': 'application/json',
  } as Record<string, string>;
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
        maxDecodeSteps: 200,
        topP: 0.8,
        topK: 40,
      },
    });
  } else {
    if (OPENAI_API_TYPE === 'openai') {
      requestHeaders.Authorization = `Bearer ${
        key ? key : process.env.OPENAI_API_KEY
      }`;
    }
    if (OPENAI_API_TYPE === 'azure') {
      requestHeaders['api-key'] = `${key ? key : process.env.OPENAI_API_KEY}`;
    }
    if (OPENAI_API_TYPE === 'openai' && OPENAI_ORGANIZATION) {
      requestHeaders['OpenAI-Organization'] = OPENAI_ORGANIZATION;
    }
    body = JSON.stringify({
      ...(OPENAI_API_TYPE === 'openai' && { model: model.id }),
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
