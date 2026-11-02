import { describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../dial/dial-client.service';
import {
  ConversationMessageRole,
  type ConversationMessageDto,
} from '../dto/conversation-message.dto';
import { ChatCompletionsAdapter } from './chat-completions.adapter';
import type { GenerationRelayOutcome } from './generation.types';

const textToStream = (chunks: string[]): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
};

const makeAdapter = () => {
  const sendChatCompletionRequest = vi.fn();
  const mockDialClient = {
    client: { sendChatCompletionRequest },
    dialApiVersion: '2024-02-01',
  } as unknown as DialClientService;
  return {
    adapter: new ChatCompletionsAdapter(mockDialClient),
    sendChatCompletionRequest,
  };
};

const assistantSeed = {
  role: ConversationMessageRole.Assistant,
  content: '',
} as ConversationMessageDto;

const drain = async (
  iterator: AsyncGenerator<Uint8Array, GenerationRelayOutcome, void>,
): Promise<GenerationRelayOutcome> => {
  let next = await iterator.next();
  while (!next.done) next = await iterator.next();
  return next.value;
};

const sentHeaders = (mock: ReturnType<typeof vi.fn>) =>
  (mock.mock.calls[0][1] as { headers: Record<string, string> }).headers;

describe('ChatCompletionsAdapter', () => {
  describe('buildRequest', () => {
    it('percent-encodes a skill URL that contains a space', () => {
      const { adapter } = makeAdapter();
      const body = adapter.buildRequest({
        startConversation: {} as never,
        messagesForCompletion: [
          {
            role: ConversationMessageRole.User,
            content: 'Hi',
            custom_content: {
              skills: [{ url: 'skills/public/my chats/123' }],
            },
          } as never,
        ],
        temperatureSupported: false,
      });

      expect(body.messages[0].custom_content).toEqual({
        skills: [{ url: 'skills/public/my%20chats/123' }],
      });
    });

    it('sends the given configuration as custom_fields.configuration', () => {
      const { adapter } = makeAdapter();
      const body = adapter.buildRequest({
        startConversation: {} as never,
        messagesForCompletion: [
          {
            role: ConversationMessageRole.User,
            content: 'Hi',
            custom_content: { configuration_value: { stale: true } },
          } as never,
        ],
        temperatureSupported: false,
        configuration: { mode: 'deep' },
      });

      expect(body.custom_fields).toEqual({ configuration: { mode: 'deep' } });
      expect(body.messages[0]).not.toHaveProperty('custom_content');
    });

    it('builds the system message from the conversation prompt only', () => {
      const { adapter } = makeAdapter();
      const params = {
        startConversation: { prompt: 'P' } as never,
        messagesForCompletion: [
          { role: ConversationMessageRole.User, content: 'Hi' } as never,
        ],
        temperatureSupported: false,
      };

      expect(adapter.buildRequest(params)).toEqual({
        messages: [
          { role: 'system', content: 'P' },
          { role: ConversationMessageRole.User, content: 'Hi' },
        ],
        stream: true,
      });
    });

    it('omits custom_fields when no configuration is given', () => {
      const { adapter } = makeAdapter();
      const body = adapter.buildRequest({
        startConversation: {} as never,
        messagesForCompletion: [],
        temperatureSupported: false,
      });

      expect(body).not.toHaveProperty('custom_fields');
    });

    it('forwards temperature only when the deployment supports it', () => {
      const { adapter } = makeAdapter();
      const params = {
        startConversation: { temperature: 0 } as never,
        messagesForCompletion: [],
      };

      expect(
        adapter.buildRequest({ ...params, temperatureSupported: true }),
      ).toHaveProperty('temperature', 0);
      expect(
        adapter.buildRequest({ ...params, temperatureSupported: false }),
      ).not.toHaveProperty('temperature');
    });

    it('drops status messages, stages and attachments without data or url', () => {
      const { adapter } = makeAdapter();
      const body = adapter.buildRequest({
        startConversation: { prompt: 'Be brief.' } as never,
        messagesForCompletion: [
          { role: ConversationMessageRole.Status, content: 'x' } as never,
          {
            role: ConversationMessageRole.Assistant,
            content: 'Answer',
            custom_content: {
              stages: [{ name: 'Search' }],
              attachments: [{ title: 'empty' }, { url: 'files/a/b.png' }],
            },
          } as never,
        ],
        temperatureSupported: false,
      });

      expect(body).toEqual({
        messages: [
          { role: 'system', content: 'Be brief.' },
          {
            role: ConversationMessageRole.Assistant,
            content: 'Answer',
            custom_content: { attachments: [{ url: 'files/a/b.png' }] },
          },
        ],
        stream: true,
      });
    });
  });

  describe('stream', () => {
    const okResponse = (chunks: string[]) => ({
      response: new Response(textToStream(chunks), { status: 200 }),
    });

    it('sends X-Timezone only when a timezone is given', async () => {
      const { adapter, sendChatCompletionRequest } = makeAdapter();
      sendChatCompletionRequest.mockImplementation(async () =>
        okResponse(['data: [DONE]\n\n']),
      );

      await drain(
        adapter.stream(
          'gpt-4o',
          {},
          'token',
          new AbortController().signal,
          assistantSeed,
          undefined,
          'Europe/Berlin',
        ),
      );
      expect(sentHeaders(sendChatCompletionRequest)).toHaveProperty(
        'X-Timezone',
        'Europe/Berlin',
      );

      sendChatCompletionRequest.mockClear();
      await drain(
        adapter.stream(
          'gpt-4o',
          {},
          'token',
          new AbortController().signal,
          assistantSeed,
        ),
      );
      expect(sentHeaders(sendChatCompletionRequest)).not.toHaveProperty(
        'X-Timezone',
      );
    });

    it('adds the extra headers, such as x-project-id, to the model call', async () => {
      const { adapter, sendChatCompletionRequest } = makeAdapter();
      sendChatCompletionRequest.mockImplementation(async () =>
        okResponse(['data: [DONE]\n\n']),
      );

      await drain(
        adapter.stream(
          'gpt-4o',
          {},
          'token',
          new AbortController().signal,
          assistantSeed,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          { extraHeaders: { 'x-project-id': 'projects/a1b2c3/q4' } },
        ),
      );

      expect(sentHeaders(sendChatCompletionRequest)).toHaveProperty(
        'x-project-id',
        'projects/a1b2c3/q4',
      );
    });

    it('calls onChunkApplied with each applied chunk and the updated message', async () => {
      const { adapter, sendChatCompletionRequest } = makeAdapter();
      sendChatCompletionRequest.mockResolvedValue(
        okResponse([
          'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
          'data: [DONE]\n\n',
        ]),
      );
      const onChunkApplied = vi.fn();

      const outcome = await drain(
        adapter.stream(
          'gpt-4o',
          {},
          'token',
          new AbortController().signal,
          assistantSeed,
          undefined,
          undefined,
          undefined,
          undefined,
          onChunkApplied,
        ),
      );

      expect(onChunkApplied).toHaveBeenCalledTimes(2);
      expect(onChunkApplied.mock.calls[1][1]).toMatchObject({
        content: 'Hello',
      });
      expect(outcome).toMatchObject({
        outcome: 'completed',
        assembledMessage: { content: 'Hello' },
      });
    });

    it('returns a rejected outcome with the DIAL error text on a non-2xx response', async () => {
      const { adapter, sendChatCompletionRequest } = makeAdapter();
      sendChatCompletionRequest.mockResolvedValue({
        response: new Response(
          JSON.stringify({ error: { message: 'Model is overloaded' } }),
          { status: 429 },
        ),
      });

      const outcome = await drain(
        adapter.stream(
          'gpt-4o',
          {},
          'token',
          new AbortController().signal,
          assistantSeed,
        ),
      );

      expect(outcome).toEqual({
        outcome: 'rejected',
        status: 429,
        errorMessage: 'Model is overloaded',
        assembledMessage: assistantSeed,
      });
    });
  });
});
