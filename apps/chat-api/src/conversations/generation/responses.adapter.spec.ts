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

    describe('reasoning summaries', () => {
      it('accumulates delta fragments without duplicating a trailing done event', async () => {
        const { adapter, mockDialClient } = makeAdapter();
        const { result } = await relay(adapter, mockDialClient, [
          'data: {"type":"response.reasoning_summary_part.added","item_id":"rs_1","output_index":0,"summary_index":0}\n\n',
          'data: {"type":"response.reasoning_summary_text.delta","item_id":"rs_1","output_index":0,"summary_index":0,"delta":"Checking "}\n\n',
          'data: {"type":"response.reasoning_summary_text.delta","item_id":"rs_1","output_index":0,"summary_index":0,"delta":"sources"}\n\n',
          'data: {"type":"response.reasoning_summary_text.done","item_id":"rs_1","output_index":0,"summary_index":0,"text":"Checking sources"}\n\n',
          'data: {"type":"response.completed","response":{"id":"resp-rs1","status":"completed"}}\n\n',
        ]);

        expect(result.outcome).toBe('completed');
        if (result.outcome === 'completed') {
          const summaries = (
            result.assembledMessage.custom_content as {
              reasoning_summaries?: { text: string }[];
            }
          ).reasoning_summaries;
          expect(summaries).toEqual([
            {
              itemId: 'rs_1',
              outputIndex: 0,
              summaryIndex: 0,
              text: 'Checking sources',
            },
          ]);
        }
      });

      it('accumulates deltas when delivered over Core-shaped SSE (event: and data: lines)', async () => {
        const { adapter, mockDialClient } = makeAdapter();
        const { result } = await relay(adapter, mockDialClient, [
          'event: response.reasoning_summary_part.added\ndata: {"type":"response.reasoning_summary_part.added","item_id":"rs_core","output_index":0,"summary_index":0}\n\n',
          'event: response.reasoning_summary_text.delta\ndata: {"type":"response.reasoning_summary_text.delta","item_id":"rs_core","output_index":0,"summary_index":0,"delta":"Core-shaped"}\n\n',
          'event: response.completed\ndata: {"type":"response.completed","response":{"id":"resp-core","status":"completed"}}\n\n',
        ]);

        expect(result.outcome).toBe('completed');
        if (result.outcome === 'completed') {
          const summaries = (
            result.assembledMessage.custom_content as {
              reasoning_summaries?: { text: string }[];
            }
          ).reasoning_summaries;
          expect(summaries).toEqual([
            {
              itemId: 'rs_core',
              outputIndex: 0,
              summaryIndex: 0,
              text: 'Core-shaped',
            },
          ]);
        }
      });

      it('safely ignores a malformed reasoning-summary event missing key fields', async () => {
        const { adapter, mockDialClient } = makeAdapter();
        const { result } = await relay(adapter, mockDialClient, [
          'data: {"type":"response.reasoning_summary_text.delta","delta":"no key fields"}\n\n',
          'data: {"type":"response.output_text.delta","delta":"still fine"}\n\n',
          'data: {"type":"response.completed","response":{"id":"resp-malformed-rs","status":"completed"}}\n\n',
        ]);

        expect(result.outcome).toBe('completed');
        if (result.outcome === 'completed') {
          expect(result.assembledMessage.content).toBe('still fine');
          const summaries = (
            result.assembledMessage.custom_content as
              | { reasoning_summaries?: unknown[] }
              | undefined
          )?.reasoning_summaries;
          expect(summaries).toBeUndefined();
        }
      });

      it('falls back to the done event text when no delta arrived for that key', async () => {
        const { adapter, mockDialClient } = makeAdapter();
        const { result } = await relay(adapter, mockDialClient, [
          'data: {"type":"response.reasoning_summary_text.done","item_id":"rs_2","output_index":0,"summary_index":0,"text":"Full summary"}\n\n',
          'data: {"type":"response.completed","response":{"id":"resp-rs2","status":"completed"}}\n\n',
        ]);

        expect(result.outcome).toBe('completed');
        if (result.outcome === 'completed') {
          const summaries = (
            result.assembledMessage.custom_content as {
              reasoning_summaries?: { text: string }[];
            }
          ).reasoning_summaries;
          expect(summaries).toEqual([
            {
              itemId: 'rs_2',
              outputIndex: 0,
              summaryIndex: 0,
              text: 'Full summary',
            },
          ]);
        }
      });

      it('emits no chunk entry for empty delta/done text', async () => {
        const { adapter, mockDialClient } = makeAdapter();
        const { result } = await relay(adapter, mockDialClient, [
          'data: {"type":"response.reasoning_summary_text.delta","item_id":"rs_3","output_index":0,"summary_index":0,"delta":""}\n\n',
          'data: {"type":"response.reasoning_summary_text.done","item_id":"rs_3","output_index":0,"summary_index":0,"text":""}\n\n',
          'data: {"type":"response.completed","response":{"id":"resp-rs3","status":"completed"}}\n\n',
        ]);

        expect(result.outcome).toBe('completed');
        if (result.outcome === 'completed') {
          const summaries = (
            result.assembledMessage.custom_content as
              | { reasoning_summaries?: unknown[] }
              | undefined
          )?.reasoning_summaries;
          expect(summaries).toBeUndefined();
        }
      });

      it('preserves distinct summary parts and multiple items keyed by output_index/summary_index', async () => {
        const { adapter, mockDialClient } = makeAdapter();
        const { result } = await relay(adapter, mockDialClient, [
          'data: {"type":"response.reasoning_summary_text.delta","item_id":"rs_4","output_index":0,"summary_index":0,"delta":"Part A"}\n\n',
          'data: {"type":"response.reasoning_summary_text.delta","item_id":"rs_4","output_index":0,"summary_index":1,"delta":"Part B"}\n\n',
          'data: {"type":"response.completed","response":{"id":"resp-rs4","status":"completed"}}\n\n',
        ]);

        expect(result.outcome).toBe('completed');
        if (result.outcome === 'completed') {
          const summaries = (
            result.assembledMessage.custom_content as {
              reasoning_summaries?: { summaryIndex: number; text: string }[];
            }
          ).reasoning_summaries;
          expect(summaries).toEqual([
            { itemId: 'rs_4', outputIndex: 0, summaryIndex: 0, text: 'Part A' },
            { itemId: 'rs_4', outputIndex: 0, summaryIndex: 1, text: 'Part B' },
          ]);
        }
      });

      it('preserves a partial reasoning summary when response.failed terminates the stream', async () => {
        const { adapter, mockDialClient } = makeAdapter();
        const { result } = await relay(adapter, mockDialClient, [
          'data: {"type":"response.reasoning_summary_text.delta","item_id":"rs_5","output_index":0,"summary_index":0,"delta":"Partial thought"}\n\n',
          'data: {"type":"response.failed","response":{"id":"resp-rs5","error":{"message":"boom"}}}\n\n',
        ]);

        expect(result.outcome).toBe('error');
        if (result.outcome === 'error') {
          const summaries = (
            result.assembledMessage.custom_content as {
              reasoning_summaries?: { text: string }[];
            }
          ).reasoning_summaries;
          expect(summaries).toEqual([
            {
              itemId: 'rs_5',
              outputIndex: 0,
              summaryIndex: 0,
              text: 'Partial thought',
            },
          ]);
        }
      });

      it('does not increment the unknown-event metric for any reasoning-summary event', async () => {
        const { adapter, mockDialClient } = makeAdapter();
        const addSpy = vi.spyOn(generationUnknownEventsTotal, 'add');
        await relay(adapter, mockDialClient, [
          'data: {"type":"response.reasoning_summary_part.added","item_id":"rs_6","output_index":0,"summary_index":0}\n\n',
          'data: {"type":"response.reasoning_summary_text.delta","item_id":"rs_6","output_index":0,"summary_index":0,"delta":"Hi"}\n\n',
          'data: {"type":"response.reasoning_summary_text.done","item_id":"rs_6","output_index":0,"summary_index":0,"text":"Hi"}\n\n',
          'data: {"type":"response.completed","response":{"id":"resp-rs6","status":"completed"}}\n\n',
        ]);

        expect(addSpy).not.toHaveBeenCalled();
        addSpy.mockRestore();
      });

      it('never logs the reasoning-summary text itself', async () => {
        const { adapter, mockDialClient } = makeAdapter();
        const debugSpy = vi.spyOn(Logger.prototype, 'debug');
        await relay(adapter, mockDialClient, [
          'data: {"type":"response.reasoning_summary_text.delta","item_id":"rs_7","output_index":0,"summary_index":0,"delta":"Secret reasoning text"}\n\n',
          'data: {"type":"response.completed","response":{"id":"resp-rs7","status":"completed"}}\n\n',
        ]);

        for (const call of debugSpy.mock.calls) {
          expect(String(call[0])).not.toContain('Secret reasoning text');
        }
        debugSpy.mockRestore();
      });
    });

    describe('web_search_call tool stages', () => {
      it('creates one running stage on output_item.added and settles it on web_search_call.completed', async () => {
        const { adapter, mockDialClient } = makeAdapter();
        const { result } = await relay(adapter, mockDialClient, [
          'data: {"type":"response.output_item.added","output_index":0,"item":{"id":"ws_1","type":"web_search_call"}}\n\n',
          'data: {"type":"response.web_search_call.in_progress","item_id":"ws_1"}\n\n',
          'data: {"type":"response.web_search_call.searching","item_id":"ws_1"}\n\n',
          'data: {"type":"response.web_search_call.completed","item_id":"ws_1"}\n\n',
          'data: {"type":"response.completed","response":{"id":"resp-ws1","status":"completed"}}\n\n',
        ]);

        expect(result.outcome).toBe('completed');
        if (result.outcome === 'completed') {
          const stages = (
            result.assembledMessage.custom_content as {
              stages?: {
                index: number;
                status: string | null;
                toolKind?: string;
              }[];
            }
          ).stages;
          expect(stages).toHaveLength(1);
          expect(stages?.[0]).toMatchObject({
            index: 0,
            status: 'completed',
            toolKind: 'web_search',
          });
        }
      });

      it('produces two ordered stages for two web_search_call items', async () => {
        const { adapter, mockDialClient } = makeAdapter();
        const { result } = await relay(adapter, mockDialClient, [
          'data: {"type":"response.output_item.added","output_index":0,"item":{"id":"ws_a","type":"web_search_call"}}\n\n',
          'data: {"type":"response.output_item.added","output_index":1,"item":{"id":"ws_b","type":"web_search_call"}}\n\n',
          'data: {"type":"response.output_item.done","output_index":0,"item":{"id":"ws_a","type":"web_search_call","status":"completed"}}\n\n',
          'data: {"type":"response.output_item.done","output_index":1,"item":{"id":"ws_b","type":"web_search_call","status":"completed"}}\n\n',
          'data: {"type":"response.completed","response":{"id":"resp-ws2","status":"completed"}}\n\n',
        ]);

        expect(result.outcome).toBe('completed');
        if (result.outcome === 'completed') {
          const stages = (
            result.assembledMessage.custom_content as {
              stages?: { index: number }[];
            }
          ).stages;
          expect(stages?.map((s) => s.index)).toEqual([0, 1]);
        }
      });

      it('settles a failed output_item.done status to StageStatus.Failed', async () => {
        const { adapter, mockDialClient } = makeAdapter();
        const { result } = await relay(adapter, mockDialClient, [
          'data: {"type":"response.output_item.added","output_index":0,"item":{"id":"ws_3","type":"web_search_call"}}\n\n',
          'data: {"type":"response.output_item.done","output_index":0,"item":{"id":"ws_3","type":"web_search_call","status":"failed"}}\n\n',
          'data: {"type":"response.completed","response":{"id":"resp-ws3","status":"completed"}}\n\n',
        ]);

        expect(result.outcome).toBe('completed');
        if (result.outcome === 'completed') {
          const stages = (
            result.assembledMessage.custom_content as {
              stages?: { status: string | null }[];
            }
          ).stages;
          expect(stages?.[0].status).toBe('failed');
        }
      });

      it('safely ignores an out-of-order web_search_call.completed for an unseen item_id', async () => {
        const { adapter, mockDialClient } = makeAdapter();
        const { result } = await relay(adapter, mockDialClient, [
          'data: {"type":"response.web_search_call.completed","item_id":"ws_unseen"}\n\n',
          'data: {"type":"response.output_text.delta","delta":"still works"}\n\n',
          'data: {"type":"response.completed","response":{"id":"resp-ws4","status":"completed"}}\n\n',
        ]);

        expect(result.outcome).toBe('completed');
        if (result.outcome === 'completed') {
          expect(result.assembledMessage.content).toBe('still works');
          const stages = (
            result.assembledMessage.custom_content as
              | { stages?: unknown[] }
              | undefined
          )?.stages;
          expect(stages).toBeUndefined();
        }
      });

      it('safely ignores a malformed output_item.done missing item.type/output_index', async () => {
        const { adapter, mockDialClient } = makeAdapter();
        const { result } = await relay(adapter, mockDialClient, [
          'data: {"type":"response.output_item.done","item":{"id":"ws_5"}}\n\n',
          'data: {"type":"response.output_text.delta","delta":"still fine"}\n\n',
          'data: {"type":"response.completed","response":{"id":"resp-ws5","status":"completed"}}\n\n',
        ]);

        expect(result.outcome).toBe('completed');
        if (result.outcome === 'completed') {
          expect(result.assembledMessage.content).toBe('still fine');
        }
      });

      it('never stages reasoning or message output items', async () => {
        const { adapter, mockDialClient } = makeAdapter();
        const { result } = await relay(adapter, mockDialClient, [
          'data: {"type":"response.output_item.added","output_index":0,"item":{"id":"r_1","type":"reasoning"}}\n\n',
          'data: {"type":"response.output_item.added","output_index":1,"item":{"id":"m_1","type":"message"}}\n\n',
          'data: {"type":"response.output_item.done","output_index":0,"item":{"id":"r_1","type":"reasoning"}}\n\n',
          'data: {"type":"response.output_item.done","output_index":1,"item":{"id":"m_1","type":"message"}}\n\n',
          'data: {"type":"response.completed","response":{"id":"resp-ws6","status":"completed"}}\n\n',
        ]);

        expect(result.outcome).toBe('completed');
        if (result.outcome === 'completed') {
          const stages = (
            result.assembledMessage.custom_content as
              | { stages?: unknown[] }
              | undefined
          )?.stages;
          expect(stages).toBeUndefined();
        }
      });

      it('never stages an unsupported output item type (function_call) and does not crash', async () => {
        const { adapter, mockDialClient } = makeAdapter();
        const { result } = await relay(adapter, mockDialClient, [
          'data: {"type":"response.output_item.added","output_index":0,"item":{"id":"fc_1","type":"function_call"}}\n\n',
          'data: {"type":"response.output_item.done","output_index":0,"item":{"id":"fc_1","type":"function_call"}}\n\n',
          'data: {"type":"response.output_text.delta","delta":"ok"}\n\n',
          'data: {"type":"response.completed","response":{"id":"resp-ws7","status":"completed"}}\n\n',
        ]);

        expect(result.outcome).toBe('completed');
        if (result.outcome === 'completed') {
          expect(result.assembledMessage.content).toBe('ok');
          const stages = (
            result.assembledMessage.custom_content as
              | { stages?: unknown[] }
              | undefined
          )?.stages;
          expect(stages).toBeUndefined();
        }
      });

      it.each([
        'file_search_call',
        'code_interpreter_call',
        'image_generation_call',
        'mcp_call',
        'custom_tool_call',
        'computer_call',
        'local_shell_call',
        'apply_patch_call',
      ])(
        'never stages the unsupported output item type %s and does not crash',
        async (itemType) => {
          const { adapter, mockDialClient } = makeAdapter();
          const { result } = await relay(adapter, mockDialClient, [
            `data: {"type":"response.output_item.added","output_index":0,"item":{"id":"item_1","type":"${itemType}"}}\n\n`,
            `data: {"type":"response.output_item.done","output_index":0,"item":{"id":"item_1","type":"${itemType}"}}\n\n`,
            'data: {"type":"response.output_text.delta","delta":"ok"}\n\n',
            'data: {"type":"response.completed","response":{"id":"resp-unsupported","status":"completed"}}\n\n',
          ]);

          expect(result.outcome).toBe('completed');
          if (result.outcome === 'completed') {
            expect(result.assembledMessage.content).toBe('ok');
            const stages = (
              result.assembledMessage.custom_content as
                | { stages?: unknown[] }
                | undefined
            )?.stages;
            expect(stages).toBeUndefined();
          }
        },
      );

      it('settles a still-running stage to Failed when response.failed terminates the stream', async () => {
        const { adapter, mockDialClient } = makeAdapter();
        const { result } = await relay(adapter, mockDialClient, [
          'data: {"type":"response.output_item.added","output_index":0,"item":{"id":"ws_8","type":"web_search_call"}}\n\n',
          'data: {"type":"response.failed","response":{"id":"resp-ws8","error":{"message":"boom"}}}\n\n',
        ]);

        expect(result.outcome).toBe('error');
        if (result.outcome === 'error') {
          const stages = (
            result.assembledMessage.custom_content as {
              stages?: { status: string | null }[];
            }
          ).stages;
          expect(stages?.[0].status).toBe('failed');
        }
      });

      it('settles a still-running stage to Failed even when response.completed succeeds without a tool-done event', async () => {
        const { adapter, mockDialClient } = makeAdapter();
        const { result } = await relay(adapter, mockDialClient, [
          'data: {"type":"response.output_item.added","output_index":0,"item":{"id":"ws_9","type":"web_search_call"}}\n\n',
          'data: {"type":"response.output_text.delta","delta":"final text"}\n\n',
          'data: {"type":"response.completed","response":{"id":"resp-ws9","status":"completed"}}\n\n',
        ]);

        expect(result.outcome).toBe('completed');
        if (result.outcome === 'completed') {
          expect(result.assembledMessage.content).toBe('final text');
          const stages = (
            result.assembledMessage.custom_content as {
              stages?: { status: string | null }[];
            }
          ).stages;
          expect(stages?.[0].status).toBe('failed');
        }
      });

      it('does not increment the unknown-event metric for output_item/web_search_call events', async () => {
        const { adapter, mockDialClient } = makeAdapter();
        const addSpy = vi.spyOn(generationUnknownEventsTotal, 'add');
        await relay(adapter, mockDialClient, [
          'data: {"type":"response.output_item.added","output_index":0,"item":{"id":"ws_10","type":"web_search_call"}}\n\n',
          'data: {"type":"response.web_search_call.in_progress","item_id":"ws_10"}\n\n',
          'data: {"type":"response.web_search_call.searching","item_id":"ws_10"}\n\n',
          'data: {"type":"response.web_search_call.completed","item_id":"ws_10"}\n\n',
          'data: {"type":"response.output_item.done","output_index":0,"item":{"id":"ws_10","type":"web_search_call","status":"completed"}}\n\n',
          'data: {"type":"response.completed","response":{"id":"resp-ws10","status":"completed"}}\n\n',
        ]);

        expect(addSpy).not.toHaveBeenCalled();
        addSpy.mockRestore();
      });
    });

    it('produces byte-for-byte-equivalent output for a text-only stream (no reasoning/tool events)', async () => {
      const { adapter, mockDialClient } = makeAdapter();
      const { result } = await relay(adapter, mockDialClient, [
        'data: {"type":"response.created","response":{"id":"resp-plain"}}\n\n',
        'data: {"type":"response.output_text.delta","delta":"Plain text"}\n\n',
        'data: {"type":"response.completed","response":{"id":"resp-plain","status":"completed"}}\n\n',
      ]);

      expect(result.outcome).toBe('completed');
      if (result.outcome === 'completed') {
        expect(result.assembledMessage.content).toBe('Plain text');
        expect(result.assembledMessage.responseId).toBe('resp-plain');
        expect(result.assembledMessage.custom_content).toBeUndefined();
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
