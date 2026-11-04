import {
  type ConversationTitleStreamEventDto,
  ResponseError,
} from '@epam/ai-dial-chat-api-client';
import { describe, expect, it, vi } from 'vitest';
import {
  CONVERSATION_TITLE_STREAM_MAX_FRAME_BYTES,
  ConversationTitleStreamProtocolError,
  createSseFrameDecoder,
  isConversationTitleStreamUnsupported,
  parseConversationTitleStreamEvent,
  readConversationTitleStream,
} from '../conversation-title-stream';

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

const collect = async (body: ReadableStream<Uint8Array>) => {
  const events: ConversationTitleStreamEventDto[] = [];
  for await (const event of readConversationTitleStream(body)) {
    events.push(event);
  }
  return events;
};

describe('createSseFrameDecoder', () => {
  it('joins multi-line data, skips comments and other fields, and accepts CR, LF and CRLF', () => {
    const decoder = createSseFrameDecoder();
    expect(
      decoder.push(
        ': init\r\n\r\nevent: x\nid: 1\ndata: first\r\ndata:second\r\rdata: third\n\n',
      ),
    ).toEqual(['first\nsecond', 'third']);
  });

  it('completes a CRLF delimiter split across chunks exactly once', () => {
    const decoder = createSseFrameDecoder();
    expect(decoder.push('data: a\r')).toEqual([]);
    /* The trailing CR may still be half of a CRLF blank line. */
    expect(decoder.push('\n\r')).toEqual([]);
    expect(decoder.push('\ndata: b\n\n')).toEqual(['a', 'b']);
  });

  it('rejects an event whose data exceeds the frame bound', () => {
    const decoder = createSseFrameDecoder(16);
    expect(() => decoder.push('data: 0123456789\ndata: 0123456789\n')).toThrow(
      ConversationTitleStreamProtocolError,
    );
  });

  it('rejects an unterminated line that grows past the frame bound', () => {
    const decoder = createSseFrameDecoder(16);
    decoder.push('data: 01234');
    expect(() => decoder.push('56789abcdef')).toThrow(
      ConversationTitleStreamProtocolError,
    );
  });
});

describe('parseConversationTitleStreamEvent', () => {
  it.each([
    { type: 'title', id: 'a', title: 'T' },
    { type: 'unavailable', id: 'a' },
    { type: 'item_error', id: 'a', code: 'timeout' },
    { type: 'done', reason: 'budget', processed: 1, total: 2 },
    { type: 'error', status: 401, code: 'unauthenticated' },
  ])('accepts a valid $type event', (event) => {
    expect(parseConversationTitleStreamEvent(JSON.stringify(event))).toEqual(
      event,
    );
  });

  it.each([
    'not json',
    'null',
    JSON.stringify({ type: 'progress' }),
    JSON.stringify({ type: 'title', id: 'a' }),
    JSON.stringify({ type: 'item_error', id: 'a', code: 'boom' }),
    JSON.stringify({
      type: 'done',
      reason: 'complete',
      processed: 3,
      total: 2,
    }),
    JSON.stringify({ type: 'error', status: 401, code: 'unavailable' }),
  ])('rejects a malformed or unknown event: %s', (data) => {
    expect(() => parseConversationTitleStreamEvent(data)).toThrow(
      ConversationTitleStreamProtocolError,
    );
  });
});

describe('readConversationTitleStream', () => {
  it('decodes a UTF-8 character and an event split across network chunks', async () => {
    const bytes = encoder.encode(
      ': init\n\ndata: {"type":"title","id":"a","title":"Привет 👋"}\r\n\r\n',
    );
    const splitAt = bytes.indexOf(0xd0) + 1;
    const { body } = bodyOf([
      bytes.slice(0, splitAt),
      bytes.slice(splitAt, -3),
      bytes.slice(-3),
    ]);
    expect(await collect(body)).toEqual([
      { type: 'title', id: 'a', title: 'Привет 👋' },
    ]);
  });

  it('drops an event that never received its closing blank line', async () => {
    const { body } = bodyOf([
      encoder.encode('data: {"type":"unavailable","id":"a"}\n'),
    ]);
    expect(await collect(body)).toEqual([]);
  });

  it('cancels the reader when the consumer stops at a terminal event', async () => {
    const { body, cancel } = bodyOf([
      encoder.encode(
        'data: {"type":"done","reason":"complete","processed":0,"total":0}\n\n',
      ),
      encoder.encode(': keepalive\n\n'),
    ]);
    for await (const event of readConversationTitleStream(body)) {
      expect(event.type).toBe('done');
      break;
    }
    expect(cancel).toHaveBeenCalledOnce();
    expect(body.locked).toBe(false);
  });

  it('cancels and releases the reader on a protocol error', async () => {
    const { body, cancel } = bodyOf([
      encoder.encode('data: {"type":"nope"}\n\n'),
    ]);
    await expect(collect(body)).rejects.toBeInstanceOf(
      ConversationTitleStreamProtocolError,
    );
    expect(cancel).toHaveBeenCalledOnce();
    expect(body.locked).toBe(false);
  });

  it('rejects a frame larger than 64 KiB', async () => {
    const { body } = bodyOf([
      encoder.encode(
        `data: ${'x'.repeat(CONVERSATION_TITLE_STREAM_MAX_FRAME_BYTES)}\n\n`,
      ),
    ]);
    await expect(collect(body)).rejects.toBeInstanceOf(
      ConversationTitleStreamProtocolError,
    );
  });
});

describe('isConversationTitleStreamUnsupported', () => {
  it.each([
    { status: 404, expected: true },
    { status: 405, expected: true },
    { status: 401, expected: false },
    { status: 403, expected: false },
    { status: 429, expected: false },
    { status: 503, expected: false },
  ])(
    'treats HTTP $status as unsupported: $expected',
    ({ status, expected }) => {
      expect(
        isConversationTitleStreamUnsupported(
          new ResponseError(new Response(null, { status })),
        ),
      ).toBe(expected);
    },
  );

  it('does not treat a network failure as unsupported', () => {
    expect(isConversationTitleStreamUnsupported(new TypeError('offline'))).toBe(
      false,
    );
  });
});
