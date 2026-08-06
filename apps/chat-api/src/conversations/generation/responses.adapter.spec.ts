import { Logger } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../dial/dial-client.service';
import { ConversationMessageRole } from '../dto/conversation-message.dto';
import { generationUnknownEventsTotal } from './generation-metrics';
import type {
  ResponsesFailedEvent,
  ResponsesTerminalSignal,
} from './generation.types';
import { ResponsesTerminalState } from './generation.types';
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

describe('generation.types — Responses terminal-state types', () => {
  it('constructs a response.failed event and a terminal signal with the expected shape', () => {
    const failedEvent: ResponsesFailedEvent = {
      type: 'response.failed',
      response: { id: 'resp-1', error: { message: 'boom', code: 'x' } },
    };
    const signal: ResponsesTerminalSignal = {
      state: ResponsesTerminalState.Failed,
      message: 'boom',
    };

    expect(failedEvent.type).toBe('response.failed');
    expect(signal.state).toBe(ResponsesTerminalState.Failed);
  });

  it('exposes the four terminal-state enum members', () => {
    expect(Object.values(ResponsesTerminalState)).toEqual([
      'success',
      'failed',
      'incomplete',
      'stream_error',
    ]);
  });
});

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
        temperatureSupported: false,
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
        temperatureSupported: false,
      });

      expect(request.input).toEqual([
        { role: ConversationMessageRole.User, content: 'Hi' },
      ]);
    });

    it('excludes ConversationMessageRole.Status messages from the input array', () => {
      const { adapter } = makeAdapter();
      const request = adapter.buildRequest({
        model: 'gpt-4o',
        startConversation: { prompt: '' } as never,
        messagesForCompletion: [
          { role: ConversationMessageRole.User, content: 'Hi' } as never,
          {
            role: ConversationMessageRole.Status,
            content: 'Model changed to gpt-4o',
          } as never,
          {
            role: ConversationMessageRole.Assistant,
            content: 'Hello!',
          } as never,
        ],
        temperatureSupported: false,
      });

      expect(request.input).toEqual([
        { role: ConversationMessageRole.User, content: 'Hi' },
        { role: ConversationMessageRole.Assistant, content: 'Hello!' },
      ]);
    });

    it('always sets store: false', () => {
      const { adapter } = makeAdapter();
      const request = adapter.buildRequest({
        model: 'gpt-4o',
        startConversation: { prompt: '' } as never,
        messagesForCompletion: [],
        temperatureSupported: false,
      });

      expect(request.store).toBe(false);
      expect(request.stream).toBe(true);
    });

    it('forwards temperature 0 exactly when the deployment supports it', () => {
      const { adapter } = makeAdapter();
      const request = adapter.buildRequest({
        model: 'gpt-4o',
        startConversation: { prompt: '', temperature: 0 } as never,
        messagesForCompletion: [],
        temperatureSupported: true,
      });

      expect(request.temperature).toBe(0);
    });

    it('forwards a non-zero temperature exactly when the deployment supports it', () => {
      const { adapter } = makeAdapter();
      const request = adapter.buildRequest({
        model: 'gpt-4o',
        startConversation: { prompt: '', temperature: 0.7 } as never,
        messagesForCompletion: [],
        temperatureSupported: true,
      });

      expect(request.temperature).toBe(0.7);
    });

    it('omits temperature when the deployment does not support it', () => {
      const { adapter } = makeAdapter();
      const request = adapter.buildRequest({
        model: 'gpt-4o',
        startConversation: { prompt: '', temperature: 0.7 } as never,
        messagesForCompletion: [],
        temperatureSupported: false,
      });

      expect(request).not.toHaveProperty('temperature');
    });

    it('preserves the minimum valid maxOutputTokens value', () => {
      const { adapter } = makeAdapter();
      const request = adapter.buildRequest({
        model: 'gpt-4o',
        startConversation: { prompt: '', maxOutputTokens: 1 } as never,
        messagesForCompletion: [],
        temperatureSupported: false,
      });

      expect(request.max_output_tokens).toBe(1);
    });

    it('preserves a representative larger maxOutputTokens value', () => {
      const { adapter } = makeAdapter();
      const request = adapter.buildRequest({
        model: 'gpt-4o',
        startConversation: { prompt: '', maxOutputTokens: 4096 } as never,
        messagesForCompletion: [],
        temperatureSupported: false,
      });

      expect(request.max_output_tokens).toBe(4096);
    });

    it('omits max_output_tokens when maxOutputTokens is absent', () => {
      const { adapter } = makeAdapter();
      const request = adapter.buildRequest({
        model: 'gpt-4o',
        startConversation: { prompt: '' } as never,
        messagesForCompletion: [],
        temperatureSupported: false,
      });

      expect(request).not.toHaveProperty('max_output_tokens');
    });

    it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
      'omits max_output_tokens for the invalid value %s',
      (invalidValue) => {
        const { adapter } = makeAdapter();
        const request = adapter.buildRequest({
          model: 'gpt-4o',
          startConversation: {
            prompt: '',
            maxOutputTokens: invalidValue,
          } as never,
          messagesForCompletion: [],
          temperatureSupported: false,
        });

        expect(request).not.toHaveProperty('max_output_tokens');
      },
    );

    it('never maps max_output_tokens when Chat Completions capability flags are false', () => {
      const { adapter } = makeAdapter();
      const request = adapter.buildRequest({
        model: 'gpt-4o',
        startConversation: { prompt: '', maxOutputTokens: 2048 } as never,
        messagesForCompletion: [],
        temperatureSupported: false,
      });

      /*
       * max_output_tokens mapping is not gated by any Chat-Completions-scoped
       * capability flag — this test documents that omission of
       * maxTokensSupported/maxCompletionTokensSupported has no bearing on it.
       */
      expect(request.max_output_tokens).toBe(2048);
    });

    it('includes both temperature and max_output_tokens alongside the unchanged base body', () => {
      const { adapter } = makeAdapter();
      const request = adapter.buildRequest({
        model: 'gpt-4o',
        startConversation: {
          prompt: '',
          temperature: 0.4,
          maxOutputTokens: 2048,
        } as never,
        messagesForCompletion: [
          { role: ConversationMessageRole.User, content: 'Hi' } as never,
        ],
        temperatureSupported: true,
      });

      expect(request).toMatchObject({
        model: 'gpt-4o',
        stream: true,
        store: false,
        temperature: 0.4,
        max_output_tokens: 2048,
      });
      expect(request).not.toHaveProperty('previous_response_id');
      expect(request).not.toHaveProperty('conversation');
      expect(request).not.toHaveProperty('max_tokens');
      expect(request).not.toHaveProperty('max_completion_tokens');
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

    it('returns an error outcome and does not retry Chat Completions when response.failed arrives before any text', async () => {
      const { adapter, mockDialClient } = makeAdapter();
      const { result, res } = await relay(adapter, mockDialClient, [
        'data: {"type":"response.failed","response":{"id":"resp-5","error":{"message":"Model overloaded"}}}\n\n',
      ]);

      expect(result.outcome).toBe('error');
      if (result.outcome === 'error') {
        expect((result.error as Error).message).toBe('Model overloaded');
        expect(result.assembledMessage.content).toBe('');
      }
      expect(res.getWritten()).not.toContain('[DONE]');
      expect(mockDialClient.client.createResponse).toHaveBeenCalledOnce();
    });

    it('preserves partial text when response.failed arrives after text deltas', async () => {
      const { adapter, mockDialClient } = makeAdapter();
      const { result } = await relay(adapter, mockDialClient, [
        'data: {"type":"response.output_text.delta","delta":"Partial answer"}\n\n',
        'data: {"type":"response.failed","response":{"id":"resp-6","error":{"message":"Timed out"}}}\n\n',
      ]);

      expect(result.outcome).toBe('error');
      if (result.outcome === 'error') {
        expect(result.assembledMessage.content).toBe('Partial answer');
        expect((result.error as Error).message).toBe('Timed out');
      }
    });

    it('extracts a structured response.failed message without logging the event payload', async () => {
      const { adapter, mockDialClient } = makeAdapter();
      const debugSpy = vi.spyOn(Logger.prototype, 'debug');
      const { result } = await relay(adapter, mockDialClient, [
        'data: {"type":"response.failed","response":{"id":"resp-7","error":{"message":"Secret prompt leaked here","code":"E1"}}}\n\n',
      ]);

      expect(result.outcome).toBe('error');
      if (result.outcome === 'error') {
        expect((result.error as Error).message).toBe(
          'Secret prompt leaked here',
        );
      }
      for (const call of debugSpy.mock.calls) {
        expect(String(call[0])).not.toContain('Secret prompt leaked here');
      }
      debugSpy.mockRestore();
    });

    it('does not count response.failed as an unknown event', async () => {
      const { adapter, mockDialClient } = makeAdapter();
      const addSpy = vi.spyOn(generationUnknownEventsTotal, 'add');
      await relay(adapter, mockDialClient, [
        'data: {"type":"response.failed","response":{"id":"resp-8","error":{"message":"boom"}}}\n\n',
      ]);

      expect(addSpy).not.toHaveBeenCalled();
      addSpy.mockRestore();
    });

    it('returns an error and does not emit downstream [DONE] when the socket closes after deltas without a terminal signal', async () => {
      const { adapter, mockDialClient } = makeAdapter();
      const { result, res } = await relay(adapter, mockDialClient, [
        'data: {"type":"response.output_text.delta","delta":"Partial"}\n\n',
      ]);

      expect(result.outcome).toBe('error');
      if (result.outcome === 'error') {
        expect(result.assembledMessage.content).toBe('Partial');
      }
      expect(res.getWritten()).not.toContain('[DONE]');
    });

    it('returns an error with a stable generic message when the socket closes before any event', async () => {
      const { adapter, mockDialClient } = makeAdapter();
      const { result } = await relay(adapter, mockDialClient, []);

      expect(result.outcome).toBe('error');
      if (result.outcome === 'error') {
        expect((result.error as Error).message).toBe(
          'Responses generation ended before completion',
        );
      }
    });

    it('completes a Core-shaped stream (event: and data: lines) on response.completed alone, without [DONE]', async () => {
      const { adapter, mockDialClient } = makeAdapter();
      const { result, res } = await relay(adapter, mockDialClient, [
        'event: response.created\ndata: {"type":"response.created","response":{"id":"resp-9"}}\n\n',
        'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Hi"}\n\n',
        'event: response.completed\ndata: {"type":"response.completed","response":{"id":"resp-9","status":"completed"}}\n\n',
      ]);

      expect(result.outcome).toBe('completed');
      if (result.outcome === 'completed') {
        expect(result.assembledMessage.content).toBe('Hi');
      }
      expect(res.getWritten()).toContain('[DONE]');
    });

    it('still completes a legacy stream that only sends [DONE], with no response.completed', async () => {
      const { adapter, mockDialClient } = makeAdapter();
      const { result } = await relay(adapter, mockDialClient, [
        'data: {"type":"response.output_text.delta","delta":"Legacy"}\n\n',
        'data: [DONE]\n\n',
      ]);

      expect(result.outcome).toBe('completed');
      if (result.outcome === 'completed') {
        expect(result.assembledMessage.content).toBe('Legacy');
      }
    });

    it('does not let a trailing [DONE] override an earlier response.failed', async () => {
      const { adapter, mockDialClient } = makeAdapter();
      const { result, res } = await relay(adapter, mockDialClient, [
        'data: {"type":"response.failed","response":{"id":"resp-10","error":{"message":"Upstream died"}}}\n\n',
        'data: [DONE]\n\n',
      ]);

      expect(result.outcome).toBe('error');
      if (result.outcome === 'error') {
        expect((result.error as Error).message).toBe('Upstream died');
      }
      expect(res.getWritten()).not.toContain('[DONE]');
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

    it('extracts the DIAL Core error message from the SDK-parsed error on rejection', async () => {
      const { adapter, mockDialClient } = makeAdapter();
      vi.spyOn(mockDialClient.client, 'createResponse').mockResolvedValue({
        response: new Response(null, { status: 400 }),
        error: { message: 'Invalid model' },
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
      if (result.outcome === 'rejected') {
        expect(result.errorMessage).toBe('Invalid model');
      }
    });

    it('extracts the DIAL Core error message from the raw response body when the SDK did not parse it', async () => {
      const { adapter, mockDialClient } = makeAdapter();
      vi.spyOn(mockDialClient.client, 'createResponse').mockResolvedValue({
        response: new Response(JSON.stringify({ message: 'Quota exceeded' }), {
          status: 429,
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

      expect(result.outcome).toBe('rejected');
      if (result.outcome === 'rejected') {
        expect(result.errorMessage).toBe('Quota exceeded');
      }
    });

    it('preserves a non-empty plain-text non-2xx body when the SDK gave no usable message', async () => {
      const { adapter, mockDialClient } = makeAdapter();
      vi.spyOn(mockDialClient.client, 'createResponse').mockResolvedValue({
        response: new Response('Upstream is missing required id', {
          status: 400,
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

      expect(result.outcome).toBe('rejected');
      if (result.outcome === 'rejected') {
        expect(result.errorMessage).toBe('Upstream is missing required id');
      }
    });

    it('keeps the existing generic fallback (empty string) when the non-2xx body is empty', async () => {
      const { adapter, mockDialClient } = makeAdapter();
      vi.spyOn(mockDialClient.client, 'createResponse').mockResolvedValue({
        response: new Response(null, { status: 502 }),
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
      if (result.outcome === 'rejected') {
        expect(result.errorMessage).toBe('');
      }
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
