import {
  type ConversationTitleStreamEventDto,
  ResponseError,
} from '@epam/ai-dial-chat-api-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { conversationsApi } from '../api-client';
import { streamConversationTitles } from '../conversations.api';

const encoder = new TextEncoder();

/* A body whose reader is observable, emitting the given byte chunks. */
const bodyOf = (chunks: Uint8Array[]) => {
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks.shift();
      if (chunk) controller.enqueue(chunk);
      else controller.close();
    },
    cancel,
  });
  return { body, cancel };
};

describe('streamConversationTitles', () => {
  afterEach(() => vi.restoreAllMocks());

  it('forwards exact IDs and cancellation to the generated Raw operation', async () => {
    const { body } = bodyOf([
      encoder.encode('data: {"type":"unavailable","id":"a%255F"}\n\n'),
    ]);
    const spy = vi
      .spyOn(conversationsApi, 'streamConversationTitlesRaw')
      .mockResolvedValue({ raw: new Response(body) } as never);
    const controller = new AbortController();
    const ids = ['a%255F'];
    const events = await streamConversationTitles(ids, controller.signal);
    expect(spy).toHaveBeenCalledWith(
      { streamConversationTitlesBodyDto: { ids } },
      { signal: controller.signal },
    );
    const received: ConversationTitleStreamEventDto[] = [];
    for await (const event of events) received.push(event);
    expect(received).toEqual([{ type: 'unavailable', id: 'a%255F' }]);
  });

  it('propagates a non-2xx generated-client rejection before any event', async () => {
    const error = new ResponseError(new Response(null, { status: 404 }));
    vi.spyOn(conversationsApi, 'streamConversationTitlesRaw').mockRejectedValue(
      error,
    );
    await expect(streamConversationTitles(['a'])).rejects.toBe(error);
  });

  it('propagates an abort from the generated client', async () => {
    vi.spyOn(conversationsApi, 'streamConversationTitlesRaw').mockRejectedValue(
      new DOMException('aborted', 'AbortError'),
    );
    await expect(
      streamConversationTitles(['a'], AbortSignal.abort()),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
