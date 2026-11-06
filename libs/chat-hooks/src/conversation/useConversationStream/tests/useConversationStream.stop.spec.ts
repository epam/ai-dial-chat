import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StopCompletionError } from '../../create-chat-stream-api';
import type {
  ConversationStreamTransport,
  StreamCompletionOptions,
} from '../useConversationStream';
import {
  createStreamTestTransport,
  useHookHarness,
} from './conversation-stream-harness';

describe('useConversationStream', () => {
  let capturedOptions: StreamCompletionOptions | undefined;
  let transport: ConversationStreamTransport;

  beforeEach(() => {
    capturedOptions = undefined;
    transport = createStreamTestTransport((options) => {
      capturedOptions = options;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Stop with generations running in two conversations', () => {
    /* A streams, the user switches to B and starts B, then returns to A. */
    const startAThenB = async () => {
      const view = renderHook(
        (props: { conversationId: string }) =>
          useHookHarness({ transport, conversationId: props.conversationId }),
        { initialProps: { conversationId: 'bucket/convA' } },
      );
      await act(async () => {
        view.result.current.stream.startStream(
          'bucket/convA',
          'A?',
          0,
          'gpt-4o',
          undefined,
          'gen-A',
        );
      });
      const optionsA = capturedOptions;
      view.rerender({ conversationId: 'bucket/convB' });
      await act(async () => {
        view.result.current.stream.startStream(
          'bucket/convB',
          'B?',
          0,
          'gpt-4o',
          undefined,
          'gen-B',
        );
      });
      const optionsB = capturedOptions;
      view.rerender({ conversationId: 'bucket/convA' });
      return { ...view, optionsA, optionsB };
    };

    it("stops A's own generation, not B's, after returning to A", async () => {
      const { result } = await startAThenB();

      expect(result.current.stream.canStopStreaming).toBe(true);
      act(() => result.current.stream.handleStop());

      expect(transport.stopCompletion).toHaveBeenCalledOnce();
      expect(transport.stopCompletion).toHaveBeenCalledWith({
        generationId: 'gen-A',
        path: 'convA',
      });
    });

    it('keeps A stoppable after B finishes', async () => {
      const { result, optionsB } = await startAThenB();

      await act(async () => {
        await optionsB?.onComplete();
      });

      expect(result.current.stream.canStopStreaming).toBe(true);
      act(() => result.current.stream.handleStop());
      expect(transport.stopCompletion).toHaveBeenCalledWith({
        generationId: 'gen-A',
        path: 'convA',
      });
    });

    it("keeps B stoppable after A finishes, and A's end clears only A", async () => {
      const { result, rerender, optionsA } = await startAThenB();

      await act(async () => {
        await optionsA?.onComplete();
      });
      expect(result.current.stream.canStopStreaming).toBe(false);

      rerender({ conversationId: 'bucket/convB' });
      expect(result.current.stream.canStopStreaming).toBe(true);
      act(() => result.current.stream.handleStop());
      expect(transport.stopCompletion).toHaveBeenCalledWith({
        generationId: 'gen-B',
        path: 'convB',
      });
    });
  });

  describe('Stop racing the end of a generation', () => {
    const NOT_FOUND = new StopCompletionError(404);
    const startGen = async (
      result: { current: ReturnType<typeof useHookHarness> },
      genId = 'gen-1',
    ) => {
      await act(async () => {
        result.current.stream.startStream(
          'bucket/conv',
          'hi',
          0,
          'gpt-4o',
          undefined,
          genId,
        );
      });
      await waitFor(() => expect(capturedOptions).toBeDefined());
    };

    it('sends one stop request per generation while the first is outstanding or done', async () => {
      const { result } = renderHook(() =>
        useHookHarness({ transport, conversationId: 'bucket/conv' }),
      );
      await startGen(result);

      await act(async () => {
        result.current.stream.handleStop();
        result.current.stream.handleStop();
        await Promise.resolve();
      });
      act(() => result.current.stream.handleStop());

      expect(transport.stopCompletion).toHaveBeenCalledOnce();
    });

    it('lets Stop be retried after a failure that is not a 404', async () => {
      const onStopError = vi.fn();
      transport.stopCompletion = vi
        .fn()
        .mockRejectedValueOnce(new StopCompletionError(503))
        .mockResolvedValue(undefined);
      const { result } = renderHook(() =>
        useHookHarness({
          transport,
          conversationId: 'bucket/conv',
          onStopError,
        }),
      );
      await startGen(result);

      act(() => result.current.stream.handleStop());
      await waitFor(() => expect(onStopError).toHaveBeenCalledOnce());
      act(() => result.current.stream.handleStop());

      expect(transport.stopCompletion).toHaveBeenCalledTimes(2);
    });

    it('stays silent on a 404 when the generation has already completed', async () => {
      const onStopError = vi.fn();
      transport.stopCompletion = vi.fn().mockRejectedValue(NOT_FOUND);
      const { result } = renderHook(() =>
        useHookHarness({
          transport,
          conversationId: 'bucket/conv',
          onStopError,
        }),
      );
      await startGen(result);
      await act(async () => {
        await capturedOptions?.onComplete();
      });

      await act(async () => {
        result.current.stream.handleStop();
        await Promise.resolve();
      });

      expect(onStopError).not.toHaveBeenCalled();
    });

    it('stays silent on a 404 that lands before the stream end is seen, once the stream ends within the grace window', async () => {
      const onStopError = vi.fn();
      transport.stopCompletion = vi.fn().mockRejectedValue(NOT_FOUND);
      const { result } = renderHook(() =>
        useHookHarness({
          transport,
          conversationId: 'bucket/conv',
          onStopError,
        }),
      );
      await startGen(result);
      vi.useFakeTimers();

      await act(async () => {
        result.current.stream.handleStop();
        await vi.advanceTimersByTimeAsync(300);
      });
      await act(async () => {
        await capturedOptions?.onComplete();
        await vi.advanceTimersByTimeAsync(3000);
      });

      expect(onStopError).not.toHaveBeenCalled();
    });

    it('still reports a 404 when the generation keeps running past the grace window', async () => {
      const onStopError = vi.fn();
      transport.stopCompletion = vi.fn().mockRejectedValue(NOT_FOUND);
      const { result } = renderHook(() =>
        useHookHarness({
          transport,
          conversationId: 'bucket/conv',
          onStopError,
        }),
      );
      await startGen(result);
      vi.useFakeTimers();

      await act(async () => {
        result.current.stream.handleStop();
        await vi.advanceTimersByTimeAsync(5000);
      });

      expect(onStopError).toHaveBeenCalledWith(NOT_FOUND);
    });
  });
});
