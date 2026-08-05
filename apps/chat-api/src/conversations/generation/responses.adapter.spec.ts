import { describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../dial/dial-client.service';
import { ConversationMessageRole } from '../dto/conversation-message.dto';
import { ResponsesAdapter } from './responses.adapter';

const makeMockRes = () => {
  const written: string[] = [];
  return {
    write: vi.fn((chunk: string) => {
      written.push(chunk);
    }),
    getWritten: () => written.join(''),
  };
};

const textToStream = (chunks: string[]): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
};

describe('ResponsesAdapter', () => {
  const makeAdapter = () => {
    const mockDialClient = {
      client: { createResponse: vi.fn() },
    } as unknown as DialClientService;
    return { adapter: new ResponsesAdapter(mockDialClient), mockDialClient };
  };

  describe('buildRequest', () => {
    it('maps the full turn history to input in order with no previous_response_id/conversation keys', () => {
      const { adapter } = makeAdapter();
      const request = adapter.buildRequest({
        model: 'gpt-4o',
        startConversation: {
          prompt: 'You are helpful.',
        } as never,
        messagesForCompletion: [
          { role: ConversationMessageRole.User, content: 'Hi' } as never,
          {
            role: ConversationMessageRole.Assistant,
            content: 'Hello!',
          } as never,
          {
            role: ConversationMessageRole.User,
            content: 'How are you?',
          } as never,
        ],
      });

      expect(request.input).toEqual([
        { role: 'system', content: 'You are helpful.' },
        { role: ConversationMessageRole.User, content: 'Hi' },
        { role: ConversationMessageRole.Assistant, content: 'Hello!' },
        { role: ConversationMessageRole.User, content: 'How are you?' },
      ]);
      expect(request).not.toHaveProperty('previous_response_id');
      expect(request).not.toHaveProperty('conversation');
    });

    it('omits the system input item when the conversation has no prompt', () => {
      const { adapter } = makeAdapter();
      const request = adapter.buildRequest({
        model: 'gpt-4o',
        startConversation: { prompt: '' } as never,
        messagesForCompletion: [
          { role: ConversationMessageRole.User, content: 'Hi' } as never,
        ],
      });

      expect(request.input).toEqual([
        { role: ConversationMessageRole.User, content: 'Hi' },
      ]);
    });

    it('always sets store: false', () => {
      const { adapter } = makeAdapter();
      const request = adapter.buildRequest({
        model: 'gpt-4o',
        startConversation: { prompt: '' } as never,
        messagesForCompletion: [],
      });

      expect(request.store).toBe(false);
      expect(request.stream).toBe(true);
    });
  });

  describe('relay', () => {
    const relay = async (
      adapter: ResponsesAdapter,
      mockDialClient: DialClientService,
      streamChunks: string[],
      status = 200,
    ) => {
      vi.spyOn(mockDialClient.client, 'createResponse').mockResolvedValue({
        response: new Response(textToStream(streamChunks), {
          status,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      } as never);
      const res = makeMockRes();
      const result = await adapter.relay(
        { model: 'gpt-4o', input: [], stream: true, store: false },
        'test-token',
        new AbortController().signal,
        res as never,
        { role: ConversationMessageRole.Assistant, content: '' } as never,
      );
      return { result, res };
    };

    it('assembles text deltas into the assistant message and sets responseId on completion', async () => {
      const { adapter, mockDialClient } = makeAdapter();
      const { result } = await relay(adapter, mockDialClient, [
        'data: {"type":"response.created","response":{"id":"resp-1"}}\n\n',
        'data: {"type":"response.output_text.delta","delta":"Hello"}\n\n',
        'data: {"type":"response.output_text.delta","delta":" there"}\n\n',
        'data: {"type":"response.completed","response":{"id":"resp-1","status":"completed"}}\n\n',
      ]);

      expect(result.outcome).toBe('completed');
      if (result.outcome === 'completed') {
        expect(result.assembledMessage.content).toBe('Hello there');
        expect(result.assembledMessage.responseId).toBe('resp-1');
      }
    });

    it('preserves partial text and ends in error on response.incomplete', async () => {
      const { adapter, mockDialClient } = makeAdapter();
      const { result } = await relay(adapter, mockDialClient, [
        'data: {"type":"response.output_text.delta","delta":"Partial"}\n\n',
        'data: {"type":"response.incomplete","response":{"id":"resp-2"}}\n\n',
      ]);

      expect(result.outcome).toBe('error');
      if (result.outcome === 'error') {
        expect(result.assembledMessage.content).toBe('Partial');
      }
    });

    it('ends the stream via the error path on an in-band error event, without retrying Chat Completions', async () => {
      const { adapter, mockDialClient } = makeAdapter();
      const { result } = await relay(adapter, mockDialClient, [
        'data: {"type":"error","error":{"message":"Upstream failed"}}\n\n',
      ]);

      expect(result.outcome).toBe('error');
      if (result.outcome === 'error') {
        expect(result.error).toBeInstanceOf(Error);
        expect((result.error as Error).message).toBe('Upstream failed');
      }
      expect(mockDialClient.client.createResponse).toHaveBeenCalledOnce();
    });

    it('skips unknown event types without forwarding them or breaking the stream', async () => {
      const { adapter, mockDialClient } = makeAdapter();
      const { result, res } = await relay(adapter, mockDialClient, [
        'data: {"type":"response.some_future_event","payload":"secret"}\n\n',
        'data: {"type":"response.output_text.delta","delta":"Hi"}\n\n',
        'data: {"type":"response.completed","response":{"id":"resp-3","status":"completed"}}\n\n',
      ]);

      expect(result.outcome).toBe('completed');
      if (result.outcome === 'completed') {
        expect(result.assembledMessage.content).toBe('Hi');
      }
      expect(res.getWritten()).not.toContain('secret');
    });

    it('treats a non-"completed" status on response.completed as a non-terminal-success outcome', async () => {
      const { adapter, mockDialClient } = makeAdapter();
      const { result } = await relay(adapter, mockDialClient, [
        'data: {"type":"response.completed","response":{"id":"resp-4","status":"failed"}}\n\n',
      ]);

      expect(result.outcome).toBe('error');
    });

    it('returns rejected when DIAL Core responds with a non-ok status', async () => {
      const { adapter, mockDialClient } = makeAdapter();
      vi.spyOn(mockDialClient.client, 'createResponse').mockResolvedValue({
        response: new Response(null, { status: 400 }),
      } as never);
      const res = makeMockRes();

      const result = await adapter.relay(
        { model: 'gpt-4o', input: [], stream: true, store: false },
        'test-token',
        new AbortController().signal,
        res as never,
        { role: ConversationMessageRole.Assistant, content: '' } as never,
      );

      expect(result.outcome).toBe('rejected');
    });

    it('returns aborted when the signal aborts mid-stream', async () => {
      const { adapter, mockDialClient } = makeAdapter();
      vi.spyOn(mockDialClient.client, 'createResponse').mockImplementation(
        () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          return Promise.reject(err);
        },
      );
      const res = makeMockRes();

      const result = await adapter.relay(
        { model: 'gpt-4o', input: [], stream: true, store: false },
        'test-token',
        new AbortController().signal,
        res as never,
        { role: ConversationMessageRole.Assistant, content: '' } as never,
      );

      expect(result.outcome).toBe('aborted');
    });
  });
});
