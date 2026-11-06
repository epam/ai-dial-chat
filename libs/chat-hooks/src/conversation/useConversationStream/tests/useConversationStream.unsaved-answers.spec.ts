import {
  BackgroundGenerationStatus,
  MessageRole,
  type Conversation,
} from '@epam/ai-dial-chat-shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import { StrictMode, useEffect, useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GenerationPersistenceError } from '../../create-chat-stream-api';
import type {
  ConversationStreamChannel,
  ConversationStreamTransport,
  StreamCompletionOptions,
} from '../useConversationStream';
import {
  createStreamTestTransport,
  makeConversation,
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

  describe('unsaved answers', () => {
    const warning = 'Unsaved answer: copy before leaving';
    const placeholder = () =>
      makeConversation({
        messages: [
          {
            role: MessageRole.User,
            content: 'question',
            timestamp: '2026-09-25T00:00:00Z',
          },
          {
            role: MessageRole.Assistant,
            content: '',
            timestamp: '2026-09-25T00:00:01Z',
          },
        ],
      });
    const chunk = {
      id: 'response-1',
      object: 'chat.completion.chunk' as const,
      choices: [
        {
          index: 0,
          finish_reason: null,
          delta: {
            content: 'Visible answer',
            custom_content: {
              stages: [
                {
                  index: 0,
                  name: 'Visible step',
                  content: 'Tool output',
                  status: null,
                },
              ],
              state: { result: 'preserve me' },
            },
          },
        },
      ],
    };

    it.each([false, true])(
      'auto-starts once and retains reload recovery under StrictMode (channelConnected=%s)',
      async (channelConnected) => {
        const initial = placeholder();
        const channel: ConversationStreamChannel = {
          channelId: channelConnected ? 'channel-1' : null,
          ensureConnected: vi.fn(),
          waitForChannel: vi.fn().mockResolvedValue('channel-1'),
        };
        vi.mocked(transport.getConversation).mockRejectedValue(
          new Error('GET blocked'),
        );
        const { result } = renderHook(
          () => {
            const harness = useHookHarness({
              transport,
              channel,
              conversationId: 'bucket/conv',
              initialConversation: initial,
            });
            const started = useRef(false);
            const { startStream } = harness.stream;
            useEffect(() => {
              if (started.current) return;
              started.current = true;
              startStream('bucket/conv', 'question', 1, 'gpt-4o');
            }, [startStream]);
            return harness;
          },
          { wrapper: StrictMode },
        );

        await waitFor(() =>
          expect(transport.streamCompletion).toHaveBeenCalledOnce(),
        );
        expect(result.current.stream.isStreaming).toBe(true);
        await act(async () => {
          capturedOptions?.onChunk(chunk);
          await capturedOptions?.onComplete();
        });
        expect(result.current.conversation?.messages[1].content).toBe(
          'Visible answer',
        );
        expect(result.current.stream.isStreaming).toBe(false);
        expect(result.current.stream.hasConversationReloadError).toBe(true);

        const saved = makeConversation({
          messages: [
            initial.messages[0],
            { ...initial.messages[1], content: 'Server-enriched answer' },
          ],
        });
        vi.mocked(transport.getConversation).mockResolvedValue(saved);
        await act(() => result.current.stream.retryConversationReload());
        expect(result.current.conversation).toEqual(saved);
        expect(result.current.stream.hasConversationReloadError).toBe(false);
        expect(transport.streamCompletion).toHaveBeenCalledOnce();
      },
    );

    it.each([true, false])(
      'preserves text, stages and state after terminal failure (explicit=%s)',
      async (explicit) => {
        const initial = placeholder();
        vi.mocked(transport.getConversation).mockResolvedValue(initial);
        const { result } = renderHook(() =>
          useHookHarness({
            transport,
            conversationId: 'bucket/conv',
            initialConversation: initial,
            generationPersistenceErrorMessage: warning,
          }),
        );
        await act(async () => {
          result.current.stream.startStream(
            'bucket/conv',
            'question',
            1,
            'gpt-4o',
          );
        });
        act(() => capturedOptions?.onChunk(chunk));
        expect(result.current.conversation?.messages[1].content).toBe(
          'Visible answer',
        );
        await act(async () => {
          if (explicit)
            capturedOptions?.onError(new GenerationPersistenceError());
          else await capturedOptions?.onComplete();
        });
        expect(result.current.conversation?.messages[1]).toMatchObject({
          content: 'Visible answer',
          streamErrorMessage: warning,
          custom_content: {
            stages: [{ name: 'Visible step', content: 'Tool output' }],
            state: { result: 'preserve me' },
          },
        });
        expect(result.current.stream.isStreaming).toBe(false);
        expect(result.current.stream.canStopStreaming).toBe(false);
        const restored = result.current.stream.restoreBufferedGeneration(
          'bucket/conv',
          initial,
        );
        expect(restored.messages[1].content).toBe('Visible answer');
        if (explicit) expect(transport.getConversation).not.toHaveBeenCalled();
      },
    );

    it('accepts the saved server answer and enrichment without a warning', async () => {
      const initial = placeholder();
      const saved = makeConversation({
        messages: [
          initial.messages[0],
          {
            role: MessageRole.Assistant,
            content: 'Visible answer',
            timestamp: '2026-09-25T00:00:01Z',
            custom_content: { state: { server: 'enriched' } },
          },
        ],
      });
      vi.mocked(transport.getConversation).mockResolvedValue(saved);
      const { result } = renderHook(() =>
        useHookHarness({
          transport,
          conversationId: 'bucket/conv',
          initialConversation: initial,
        }),
      );
      await act(async () => {
        result.current.stream.startStream(
          'bucket/conv',
          'question',
          1,
          'gpt-4o',
        );
      });
      act(() => capturedOptions?.onChunk(chunk));
      await act(async () => {
        await capturedOptions?.onComplete();
      });
      expect(result.current.conversation).toEqual(saved);
      expect(
        result.current.stream.restoreBufferedGeneration('bucket/conv', saved),
      ).toEqual(saved);
    });

    it.each([true, false])(
      'preserves a stages-only answer when terminal reload fails (%s)',
      async (readFails) => {
        const initial = placeholder();
        if (readFails)
          vi.mocked(transport.getConversation).mockRejectedValue(
            new Error('network unavailable'),
          );
        else vi.mocked(transport.getConversation).mockResolvedValue(initial);
        const { result } = renderHook(() =>
          useHookHarness({
            transport,
            conversationId: 'bucket/conv',
            initialConversation: initial,
            generationPersistenceErrorMessage: warning,
          }),
        );
        await act(async () => {
          result.current.stream.startStream(
            'bucket/conv',
            'question',
            1,
            'gpt-4o',
          );
        });
        act(() =>
          capturedOptions?.onChunk({
            ...chunk,
            choices: [
              {
                ...chunk.choices[0],
                delta: { ...chunk.choices[0].delta, content: '' },
              },
            ],
          }),
        );
        await act(async () => {
          await capturedOptions?.onComplete();
        });
        expect(result.current.conversation?.messages[1]).toMatchObject({
          content: '',
          custom_content: { stages: [{ name: 'Visible step' }] },
        });
        expect(
          result.current.conversation?.messages[1].streamErrorMessage,
        ).toBe(readFails ? undefined : warning);
        expect(result.current.stream.hasConversationReloadError).toBe(
          readFails,
        );
        expect(result.current.stream.isStreaming).toBe(false);
      },
    );

    it.each([true, false])(
      'preserves an attached answer on terminal failure (explicit=%s)',
      async (explicit) => {
        const initial = placeholder();
        vi.mocked(transport.getConversation).mockResolvedValue(initial);
        /* Only the tab that started the generation makes a recovery save. */
        transport.saveConversation = vi.fn();
        transport.attachToGeneration = vi.fn().mockResolvedValue(
          new ReadableStream({
            start(controller) {
              const events = [
                { type: 'snapshot', message: initial.messages[1] },
                { type: 'chunk', chunk },
                explicit
                  ? {
                      type: 'error',
                      errorType: 'conversation_save_failed',
                      message: 'raw detail',
                    }
                  : { type: 'done' },
              ];
              for (const event of events)
                controller.enqueue(
                  new TextEncoder().encode(
                    'data: ' + JSON.stringify(event) + '\n\n',
                  ),
                );
              controller.close();
            },
          }),
        );
        const { result } = renderHook(() =>
          useHookHarness({
            transport,
            conversationId: 'bucket/conv',
            initialConversation: initial,
            generationPersistenceErrorMessage: warning,
          }),
        );
        act(() =>
          result.current.stream.resumeIfAwaitingGeneration(
            'bucket/conv',
            initial,
          ),
        );
        await waitFor(() =>
          expect(
            result.current.conversation?.messages[1].streamErrorMessage,
          ).toBe(warning),
        );
        expect(result.current.conversation?.messages[1]).toMatchObject({
          content: 'Visible answer',
          custom_content: {
            stages: [{ name: 'Visible step' }],
            state: { result: 'preserve me' },
          },
        });
        expect(result.current.stream.isStreaming).toBe(false);
        if (explicit) expect(transport.getConversation).not.toHaveBeenCalled();
        expect(transport.saveConversation).not.toHaveBeenCalled();
      },
    );

    describe.each([false, true])(
      'terminal read recovery (attached=%s)',
      (attached) => {
        const startFailedRead = async (stagesOnly = false) => {
          const initial = placeholder();
          const receivedChunk = stagesOnly
            ? {
                ...chunk,
                choices: [
                  {
                    ...chunk.choices[0],
                    delta: { ...chunk.choices[0].delta, content: '' },
                  },
                ],
              }
            : chunk;
          const onStreamError = vi.fn();
          vi.mocked(transport.getConversation).mockRejectedValue(
            new Error('GET blocked'),
          );
          if (attached) {
            vi.mocked(transport.attachToGeneration).mockResolvedValue(
              new ReadableStream({
                start(controller) {
                  for (const event of [
                    { type: 'snapshot', message: initial.messages[1] },
                    { type: 'chunk', chunk: receivedChunk },
                    { type: 'done' },
                  ]) {
                    controller.enqueue(
                      new TextEncoder().encode(
                        `data: ${JSON.stringify(event)}\n\n`,
                      ),
                    );
                  }
                  controller.close();
                },
              }),
            );
          }
          const view = renderHook(
            ({ conversationId }) =>
              useHookHarness({
                transport,
                conversationId,
                initialConversation: initial,
                onStreamError,
              }),
            { initialProps: { conversationId: 'bucket/conv' } },
          );
          await act(async () => {
            if (attached)
              view.result.current.stream.resumeIfAwaitingGeneration(
                'bucket/conv',
                initial,
              );
            else
              view.result.current.stream.startStream(
                'bucket/conv',
                'question',
                1,
                'gpt-4o',
              );
          });
          if (!attached) {
            await act(async () => {
              capturedOptions?.onChunk(receivedChunk);
              await capturedOptions?.onComplete();
            });
          }
          await waitFor(() =>
            expect(view.result.current.stream.hasConversationReloadError).toBe(
              true,
            ),
          );
          return { ...view, initial, onStreamError };
        };

        it('retains stages-only output without a persistence warning', async () => {
          const { result } = await startFailedRead(true);
          expect(result.current.conversation?.messages[1]).toMatchObject({
            content: '',
            custom_content: { stages: [{ name: 'Visible step' }] },
          });
          expect(
            result.current.conversation?.messages[1].streamErrorMessage,
          ).toBeUndefined();
          expect(result.current.stream.hasConversationReloadError).toBe(true);
        });

        it('invalidates pending and retained retry callbacks on unmount', async () => {
          const { result, unmount, initial } = await startFailedRead();
          let resolveRead!: (value: Conversation) => void;
          vi.mocked(transport.getConversation).mockImplementationOnce(
            () =>
              new Promise((resolve) => {
                resolveRead = resolve;
              }),
          );
          const retry = result.current.stream.retryConversationReload;
          let pending!: Promise<void>;
          act(() => {
            pending = retry();
          });
          unmount();
          await act(async () => {
            resolveRead(initial);
            await pending;
            await retry();
          });
          expect(transport.getConversation).toHaveBeenCalledTimes(2);
        });

        if (!attached) {
          it('resumes pending background work after retry instead of adding a save warning', async () => {
            const { result, initial } = await startFailedRead();
            const pending = makeConversation({
              messages: [
                initial.messages[0],
                {
                  ...initial.messages[1],
                  responseId: 'response-1',
                  backgroundGeneration: {
                    generationId: 'background-1',
                    status: BackgroundGenerationStatus.Pending,
                    startedAt: 1,
                  },
                },
              ],
            });
            vi.mocked(transport.getConversation).mockResolvedValue(pending);
            vi.mocked(transport.attachToGeneration).mockResolvedValue(
              new ReadableStream(),
            );
            await act(() => result.current.stream.retryConversationReload());
            expect(result.current.stream.hasConversationReloadError).toBe(
              false,
            );
            expect(result.current.stream.isStreaming).toBe(true);
            expect(result.current.conversation?.messages[1].content).toBe(
              'Visible answer',
            );
            expect(
              result.current.conversation?.messages[1].streamErrorMessage,
            ).toBeUndefined();
            expect(transport.attachToGeneration).toHaveBeenCalledOnce();
          });
        }

        it('keeps received payload without inventing a stream error and retries only the read', async () => {
          const { result, initial, onStreamError } = await startFailedRead();
          expect(result.current.conversation?.messages[1]).toMatchObject({
            content: 'Visible answer',
            custom_content: { state: { result: 'preserve me' } },
          });
          expect(
            result.current.conversation?.messages[1].streamErrorMessage,
          ).toBeUndefined();
          expect(result.current.stream.isStreaming).toBe(false);
          expect(result.current.stream.canStopStreaming).toBe(false);
          expect(onStreamError).not.toHaveBeenCalled();
          const saved = makeConversation({
            messages: [
              initial.messages[0],
              {
                ...initial.messages[1],
                content: 'Visible answer',
                custom_content: { state: { server: 'enriched' } },
              },
            ],
          });
          vi.mocked(transport.getConversation).mockResolvedValue(saved);
          await act(() => result.current.stream.retryConversationReload());
          expect(result.current.conversation).toEqual(saved);
          expect(result.current.stream.hasConversationReloadError).toBe(false);
          expect(result.current.stream.isReloadingConversation).toBe(false);
          expect(transport.streamCompletion).toHaveBeenCalledTimes(
            attached ? 0 : 1,
          );
          expect(transport.getConversation).toHaveBeenLastCalledWith(
            'bucket/conv',
          );
          expect(
            result.current.stream.restoreBufferedGeneration(
              'bucket/conv',
              saved,
            ),
          ).toEqual(saved);
        });

        it('deduplicates retries and keeps the answer when another GET fails', async () => {
          const { result } = await startFailedRead();
          let rejectRead!: (error: Error) => void;
          vi.mocked(transport.getConversation).mockImplementationOnce(
            () =>
              new Promise((_resolve, reject) => {
                rejectRead = reject;
              }),
          );
          let pending!: Promise<void>;
          act(() => {
            pending = result.current.stream.retryConversationReload();
            void result.current.stream.retryConversationReload();
          });
          expect(transport.getConversation).toHaveBeenCalledTimes(2);
          expect(result.current.stream.isReloadingConversation).toBe(true);
          expect(result.current.stream.hasConversationReloadError).toBe(true);
          await act(async () => {
            rejectRead(new Error('still blocked'));
            await pending;
          });
          expect(result.current.stream.isReloadingConversation).toBe(false);
          expect(result.current.stream.hasConversationReloadError).toBe(true);
          expect(result.current.conversation?.messages[1].content).toBe(
            'Visible answer',
          );
          expect(
            result.current.conversation?.messages[1].streamErrorMessage,
          ).toBeUndefined();
        });

        it('retains placeholder protection after a successful retry', async () => {
          const { result, initial } = await startFailedRead();
          vi.mocked(transport.getConversation).mockResolvedValue(initial);
          await act(() => result.current.stream.retryConversationReload());
          expect(result.current.stream.hasConversationReloadError).toBe(false);
          expect(result.current.conversation?.messages[1].content).toBe(
            'Visible answer',
          );
          expect(
            result.current.conversation?.messages[1].streamErrorMessage,
          ).toContain('could not be saved');
        });

        it.each([false, true])(
          'ignores a superseded retry (readFails=%s)',
          async (readFails) => {
            const { result, initial } = await startFailedRead();
            let resolveRead!: (value: Conversation) => void;
            let rejectRead!: (error: Error) => void;
            vi.mocked(transport.getConversation).mockImplementationOnce(
              () =>
                new Promise((resolve, reject) => {
                  resolveRead = resolve;
                  rejectRead = reject;
                }),
            );
            let pending!: Promise<void>;
            act(() => {
              pending = result.current.stream.retryConversationReload();
            });
            await act(async () => {
              result.current.stream.startStream(
                'bucket/conv',
                'new question',
                1,
                'gpt-4o',
              );
            });
            const newer = result.current.conversation;
            await act(async () => {
              if (readFails) rejectRead(new Error('old read failed'));
              else resolveRead(initial);
              await pending;
            });
            expect(result.current.conversation).toBe(newer);
            expect(result.current.stream.hasConversationReloadError).toBe(
              false,
            );
            expect(result.current.stream.isStreaming).toBe(true);
          },
        );

        it('does not apply a retried conversation after navigation', async () => {
          const { result, rerender, initial } = await startFailedRead();
          let resolveRead!: (value: Conversation) => void;
          vi.mocked(transport.getConversation).mockImplementationOnce(
            () =>
              new Promise((resolve) => {
                resolveRead = resolve;
              }),
          );
          let pending!: Promise<void>;
          act(() => {
            pending = result.current.stream.retryConversationReload();
          });
          rerender({ conversationId: 'bucket/other' });
          const displayed = result.current.conversation;
          expect(result.current.stream.hasConversationReloadError).toBe(false);
          await act(async () => {
            resolveRead(initial);
            await pending;
          });
          expect(result.current.conversation).toBe(displayed);
          expect(result.current.stream.hasConversationReloadError).toBe(false);
        });

        it.each([false, true])(
          'restores the answer and keeps the read error when returning to a stale snapshot (hasNonAssistant=%s)',
          async (hasNonAssistant) => {
            const { result, rerender, initial } = await startFailedRead();
            const stale = makeConversation({
              messages: hasNonAssistant
                ? [initial.messages[0], initial.messages[0]]
                : [initial.messages[0]],
            });
            rerender({ conversationId: 'bucket/other' });
            expect(result.current.stream.hasConversationReloadError).toBe(
              false,
            );
            rerender({ conversationId: 'bucket/conv' });
            let restored!: Conversation;
            act(() => {
              restored = result.current.stream.restoreBufferedGeneration(
                'bucket/conv',
                stale,
              );
            });
            expect(restored.messages[1]).toMatchObject({
              role: MessageRole.Assistant,
              content: 'Visible answer',
              custom_content: {
                stages: [{ name: 'Visible step' }],
                state: { result: 'preserve me' },
              },
            });
            expect(restored.messages[1].streamErrorMessage).toBeUndefined();
            expect(result.current.stream.hasConversationReloadError).toBe(true);
            expect(result.current.stream.isStreaming).toBe(false);
            expect(transport.getConversation).toHaveBeenCalledOnce();
            expect(transport.streamCompletion).toHaveBeenCalledTimes(
              attached ? 0 : 1,
            );
          },
        );

        it('accepts a saved answer when the conversation is loaded again', async () => {
          const { result, initial } = await startFailedRead();
          const saved = makeConversation({
            messages: [
              initial.messages[0],
              { ...initial.messages[1], content: 'Saved and enriched' },
            ],
          });
          let restored!: Conversation;
          act(() => {
            restored = result.current.stream.restoreBufferedGeneration(
              'bucket/conv',
              saved,
            );
          });
          expect(restored).toEqual(saved);
          expect(result.current.stream.hasConversationReloadError).toBe(false);
        });
      },
    );

    it('does not restore a resumed answer over a newer generation while its reload is pending', async () => {
      const initial = placeholder();
      let resolveReload!: (conversation: Conversation) => void;
      transport.getConversation = vi.fn(
        () =>
          new Promise<Conversation>((resolve) => {
            resolveReload = resolve;
          }),
      );
      transport.attachToGeneration = vi.fn().mockResolvedValue(
        new ReadableStream({
          start(controller) {
            for (const event of [
              {
                type: 'snapshot',
                message: { ...initial.messages[1], content: 'Old answer' },
              },
              { type: 'done' },
            ]) {
              controller.enqueue(
                new TextEncoder().encode(
                  'data: ' + JSON.stringify(event) + '\n\n',
                ),
              );
            }
            controller.close();
          },
        }),
      );
      const { result } = renderHook(() =>
        useHookHarness({
          transport,
          conversationId: 'bucket/conv',
          initialConversation: initial,
        }),
      );
      act(() =>
        result.current.stream.resumeIfAwaitingGeneration(
          'bucket/conv',
          initial,
        ),
      );
      await waitFor(() =>
        expect(transport.getConversation).toHaveBeenCalledOnce(),
      );
      await act(async () => {
        result.current.stream.startStream('bucket/conv', 'next', 1, 'gpt-4o');
      });
      act(() => capturedOptions?.onChunk(chunk));
      const newAnswer = result.current.conversation;
      await act(async () => {
        resolveReload(initial);
      });
      expect(result.current.conversation).toEqual(newAnswer);
      expect(result.current.stream.isStreaming).toBe(true);
    });

    describe('a terminal save rejected with 401', () => {
      const deferred = <T>() => {
        let resolve!: (value: T) => void;
        let reject!: (reason: unknown) => void;
        const promise = new Promise<T>((res, rej) => {
          resolve = res;
          reject = rej;
        });
        return { promise, resolve, reject };
      };
      const savedConversation = () => {
        const initial = placeholder();
        return makeConversation({
          messages: [
            initial.messages[0],
            {
              ...initial.messages[1],
              content: 'Visible answer',
              custom_content: { state: { server: 'saved' } },
            },
          ],
        });
      };

      const renderWithSave = (
        saveConversation: ConversationStreamTransport['saveConversation'],
        onStreamError?: (error: Error) => void,
      ) => {
        const initial = placeholder();
        vi.mocked(transport.getConversation).mockResolvedValue(initial);
        const withSave: ConversationStreamTransport = {
          ...transport,
          saveConversation,
        };
        const view = renderHook(
          ({ conversationId }: { conversationId: string }) =>
            useHookHarness({
              transport: withSave,
              conversationId,
              initialConversation: initial,
              generationPersistenceErrorMessage: warning,
              onStreamError,
            }),
          { initialProps: { conversationId: 'bucket/conv' } },
        );
        return { ...view, initial };
      };

      const streamAnswerThenFail = async (
        result: { current: ReturnType<typeof useHookHarness> },
        error: Error = new GenerationPersistenceError(401),
      ) => {
        await act(async () => {
          result.current.stream.startStream(
            'bucket/conv',
            'question',
            1,
            'gpt-4o',
          );
        });
        act(() => capturedOptions?.onChunk(chunk));
        await act(async () => {
          capturedOptions?.onError(error);
        });
      };

      it('saves the received answer once and never shows the warning', async () => {
        const saved = savedConversation();
        const saveConversation = vi.fn().mockResolvedValue(saved);
        const { result, initial } = renderWithSave(saveConversation);

        await streamAnswerThenFail(result);

        await waitFor(() => expect(result.current.conversation).toEqual(saved));
        expect(transport.getConversation).toHaveBeenCalledOnce();
        expect(transport.getConversation).toHaveBeenCalledWith('bucket/conv');
        expect(saveConversation).toHaveBeenCalledOnce();
        const [path, body] = saveConversation.mock.calls[0];
        expect(path).toBe('conv');
        expect(body.messages[1]).toMatchObject({
          content: 'Visible answer',
          custom_content: { state: { result: 'preserve me' } },
        });
        expect(body.messages[1].streamErrorMessage).toBeUndefined();
        expect(
          result.current.conversation?.messages[1].streamErrorMessage,
        ).toBe(undefined);
        expect(
          result.current.stream.restoreBufferedGeneration(
            'bucket/conv',
            initial,
          ),
        ).toEqual(initial);
      });

      it.each([
        ['failed', { streamErrorMessage: 'Rate limit exceeded' }],
        ['stopped', { wasStoppedByUser: true }],
      ])(
        'saves a %s answer with the terminal marker the error carries',
        async (_outcome, terminalMarker) => {
          const saved = savedConversation();
          const saveConversation = vi.fn().mockResolvedValue(saved);
          const { result } = renderWithSave(saveConversation);

          await streamAnswerThenFail(
            result,
            new GenerationPersistenceError(401, terminalMarker),
          );

          await waitFor(() =>
            expect(result.current.conversation).toEqual(saved),
          );
          expect(saveConversation).toHaveBeenCalledOnce();
          expect(saveConversation.mock.calls[0][1].messages[1]).toMatchObject({
            content: 'Visible answer',
            ...terminalMarker,
          });
        },
      );

      it('shows the answer without the warning while the save is pending', async () => {
        const pending = deferred<Conversation>();
        const { result } = renderWithSave(vi.fn(() => pending.promise));

        await streamAnswerThenFail(result);

        expect(result.current.conversation?.messages[1].content).toBe(
          'Visible answer',
        );
        expect(
          result.current.conversation?.messages[1].streamErrorMessage,
        ).toBeUndefined();
        expect(result.current.stream.isStreaming).toBe(false);
        expect(result.current.stream.canStopStreaming).toBe(false);
      });

      it.each(['read', 'save'])(
        'shows the warning once and does not retry when the %s fails',
        async (failing) => {
          const saveConversation = vi
            .fn()
            .mockRejectedValue(new Error('save rejected'));
          const { result, initial } = renderWithSave(saveConversation);
          if (failing === 'read') {
            vi.mocked(transport.getConversation).mockRejectedValue(
              new Error('read rejected'),
            );
          }

          await streamAnswerThenFail(result);

          await waitFor(() =>
            expect(
              result.current.conversation?.messages[1].streamErrorMessage,
            ).toBe(warning),
          );
          expect(result.current.conversation?.messages[1].content).toBe(
            'Visible answer',
          );
          expect(saveConversation).toHaveBeenCalledTimes(
            failing === 'read' ? 0 : 1,
          );
          expect(transport.getConversation).toHaveBeenCalledOnce();
          expect(
            result.current.stream.restoreBufferedGeneration(
              'bucket/conv',
              initial,
            ).messages[1].content,
          ).toBe('Visible answer');
        },
      );

      it.each([
        ['is too short to hold the answer', () => makeConversation()],
        [
          'already holds a different answer at that index',
          () =>
            makeConversation({
              messages: [
                placeholder().messages[0],
                {
                  role: MessageRole.Assistant,
                  content: 'Older answer',
                  timestamp: '2026-09-25T00:00:01Z',
                },
              ],
            }),
        ],
      ])(
        'shows the warning without saving when the stored copy %s',
        async (_label, storedCopy) => {
          const saveConversation = vi.fn();
          const { result, initial } = renderWithSave(saveConversation);
          vi.mocked(transport.getConversation).mockResolvedValue(storedCopy());

          await streamAnswerThenFail(result);

          await waitFor(() =>
            expect(
              result.current.conversation?.messages[1].streamErrorMessage,
            ).toBe(warning),
          );
          expect(saveConversation).not.toHaveBeenCalled();
          expect(
            result.current.stream.restoreBufferedGeneration(
              'bucket/conv',
              initial,
            ).messages[1].content,
          ).toBe('Visible answer');
        },
      );

      it.each([502, undefined])(
        'shows the warning immediately without saving when the status is %s',
        async (status) => {
          const saveConversation = vi.fn();
          const { result } = renderWithSave(saveConversation);

          await streamAnswerThenFail(
            result,
            new GenerationPersistenceError(status),
          );

          expect(
            result.current.conversation?.messages[1].streamErrorMessage,
          ).toBe(warning);
          expect(transport.getConversation).not.toHaveBeenCalled();
          expect(saveConversation).not.toHaveBeenCalled();
        },
      );

      it('shows the warning immediately when the transport cannot save', async () => {
        const { result } = renderWithSave(undefined);

        await streamAnswerThenFail(result);

        expect(
          result.current.conversation?.messages[1].streamErrorMessage,
        ).toBe(warning);
        expect(transport.getConversation).not.toHaveBeenCalled();
      });

      it('leaves a newer generation untouched when the save resolves after it started', async () => {
        const pending = deferred<Conversation>();
        const saveConversation = vi.fn(() => pending.promise);
        const { result } = renderWithSave(saveConversation);

        await streamAnswerThenFail(result);
        await waitFor(() => expect(saveConversation).toHaveBeenCalledOnce());
        await act(async () => {
          result.current.stream.startStream('bucket/conv', 'next', 1, 'gpt-4o');
        });
        const newer = result.current.conversation;
        await act(async () => {
          pending.resolve(savedConversation());
        });

        expect(result.current.conversation).toEqual(newer);
        expect(result.current.stream.isStreaming).toBe(true);
      });

      it('does not save over a newer generation started while the read is pending', async () => {
        const read = deferred<Conversation>();
        const saveConversation = vi.fn();
        const { result, initial } = renderWithSave(saveConversation);
        vi.mocked(transport.getConversation).mockImplementation(
          () => read.promise,
        );

        await streamAnswerThenFail(result);
        await act(async () => {
          result.current.stream.startStream('bucket/conv', 'next', 1, 'gpt-4o');
        });
        await act(async () => {
          read.resolve(initial);
        });

        expect(saveConversation).not.toHaveBeenCalled();
      });

      it('still saves after the user navigates away, without changing the displayed conversation', async () => {
        const read = deferred<Conversation>();
        const saveConversation = vi.fn().mockResolvedValue(savedConversation());
        const { result, rerender, initial } = renderWithSave(saveConversation);
        vi.mocked(transport.getConversation).mockImplementation(
          () => read.promise,
        );

        await streamAnswerThenFail(result);
        rerender({ conversationId: 'bucket/other' });
        const displayed = result.current.conversation;
        await act(async () => {
          read.resolve(initial);
        });

        await waitFor(() => expect(saveConversation).toHaveBeenCalledOnce());
        expect(result.current.conversation).toBe(displayed);
      });

      it('reports the original error to onStreamError once', async () => {
        const onStreamError = vi.fn();
        const error = new GenerationPersistenceError(401);
        const { result } = renderWithSave(
          vi.fn().mockResolvedValue(savedConversation()),
          onStreamError,
        );

        await streamAnswerThenFail(result, error);

        await waitFor(() =>
          expect(result.current.conversation?.messages[1].content).toBe(
            'Visible answer',
          ),
        );
        expect(onStreamError).toHaveBeenCalledOnce();
        expect(onStreamError).toHaveBeenCalledWith(error);
      });
    });
  });
});
