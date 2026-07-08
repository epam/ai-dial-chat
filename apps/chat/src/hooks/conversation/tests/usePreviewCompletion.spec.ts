import { MessageRole, StreamChunk } from '@epam/ai-dial-chat-shared';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  StreamPreviewCompletionOptions,
  streamPreviewCompletion,
} from '../../../server-api/preview-completion.api';
import { usePreviewCompletion } from '../usePreviewCompletion';

vi.mock('../../../server-api/preview-completion.api', () => ({
  streamPreviewCompletion: vi.fn(),
}));

const mockStreamPreviewCompletion = vi.mocked(streamPreviewCompletion);

const makeChunk = (content: string): StreamChunk => ({
  id: 'chunk-id',
  object: 'chat.completion.chunk',
  choices: [{ delta: { content }, finish_reason: null, index: 0 }],
});

describe('usePreviewCompletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('appends a user message and a streamed assistant reply', () => {
    let capturedOptions: StreamPreviewCompletionOptions | undefined;
    mockStreamPreviewCompletion.mockImplementation(
      (_model, _messages, options) => {
        capturedOptions = options;
      },
    );

    const { result } = renderHook(() => usePreviewCompletion('my-app'));

    act(() => {
      result.current.sendMessage('Hello');
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toMatchObject({
      role: MessageRole.User,
      content: 'Hello',
    });
    expect(result.current.isAssistantTyping).toBe(true);

    act(() => {
      capturedOptions?.onChunk(makeChunk('Hi there'));
    });

    expect(result.current.messages[1].content).toBe('Hi there');

    act(() => {
      capturedOptions?.onComplete();
    });

    expect(result.current.isAssistantTyping).toBe(false);
  });

  it('sends the full transcript on the second message', () => {
    mockStreamPreviewCompletion.mockImplementation(
      (_model, _messages, options) => {
        options.onComplete();
      },
    );

    const { result } = renderHook(() => usePreviewCompletion('my-app'));

    act(() => {
      result.current.sendMessage('First');
    });
    act(() => {
      result.current.sendMessage('Second');
    });

    const [, transcript] = mockStreamPreviewCompletion.mock.calls[1];
    expect(transcript).toEqual([
      { role: MessageRole.User, content: 'First' },
      { role: MessageRole.Assistant, content: '' },
      { role: MessageRole.User, content: 'Second' },
    ]);
  });

  it('aborts the in-flight request and marks the message as stopped', () => {
    let capturedSignal: AbortSignal | undefined;
    mockStreamPreviewCompletion.mockImplementation(
      (_model, _messages, options) => {
        capturedSignal = options.signal;
      },
    );

    const { result } = renderHook(() => usePreviewCompletion('my-app'));

    act(() => {
      result.current.sendMessage('Hello');
    });
    act(() => {
      result.current.stop();
    });

    expect(capturedSignal?.aborted).toBe(true);
    expect(result.current.isAssistantTyping).toBe(false);
    expect(
      result.current.messages[result.current.messages.length - 1],
    ).toMatchObject({ wasStoppedByUser: true });
  });

  it('surfaces hasStreamError when the stream fails', () => {
    mockStreamPreviewCompletion.mockImplementation(
      (_model, _messages, options) => {
        options.onError(new Error('boom'));
      },
    );

    const { result } = renderHook(() => usePreviewCompletion('my-app'));

    act(() => {
      result.current.sendMessage('Hello');
    });

    expect(result.current.hasStreamError).toBe(true);
    expect(
      result.current.messages[result.current.messages.length - 1],
    ).toMatchObject({ hasStreamError: true });
  });
});
