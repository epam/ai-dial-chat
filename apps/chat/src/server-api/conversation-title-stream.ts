import {
  type ConversationTitleStreamEventDto,
  ConversationTitleStreamDoneEventDtoTypeEnum,
  ConversationTitleStreamDoneReason,
  ConversationTitleStreamErrorCode,
  ConversationTitleStreamErrorEventDtoTypeEnum,
  ConversationTitleStreamItemErrorCode,
  ConversationTitleStreamItemErrorEventDtoTypeEnum,
  ConversationTitleStreamTitleEventDtoTypeEnum,
  ConversationTitleStreamUnavailableEventDtoTypeEnum,
  ResponseError,
} from '@epam/ai-dial-chat-api-client';

/* Request bounds enforced by `POST /conversations/titles/stream`. */
export const CONVERSATION_TITLE_STREAM_MAX_IDS = 500;
export const CONVERSATION_TITLE_STREAM_MAX_ID_BYTES = 256 * 1024;
/** No single event (data lines plus an unterminated line) may exceed this. */
export const CONVERSATION_TITLE_STREAM_MAX_FRAME_BYTES = 64 * 1024;

/** The stream broke its contract; the attempt must stop without retrying. */
export class ConversationTitleStreamProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConversationTitleStreamProtocolError';
  }
}

const ERROR_CODE_BY_STATUS: Record<number, ConversationTitleStreamErrorCode> = {
  401: ConversationTitleStreamErrorCode.Unauthenticated,
  502: ConversationTitleStreamErrorCode.UpstreamError,
  503: ConversationTitleStreamErrorCode.Unavailable,
};

const utf8Length = (text: string): number => {
  let bytes = 0;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      index++;
    } else bytes += 3;
  }
  return bytes;
};

const isString = (value: unknown): value is string => typeof value === 'string';
const isCount = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 0;
const includes = <T>(values: Record<string, T>, value: unknown) =>
  Object.values(values).includes(value as T);

/** Validates one `data:` payload against the generated event union. */
export const parseConversationTitleStreamEvent = (
  data: string,
): ConversationTitleStreamEventDto => {
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(data);
  } catch {
    throw new ConversationTitleStreamProtocolError('Malformed event JSON');
  }
  if (event == null || typeof event !== 'object') {
    throw new ConversationTitleStreamProtocolError('Event is not an object');
  }
  switch (event.type) {
    case ConversationTitleStreamTitleEventDtoTypeEnum.Title:
      if (isString(event.id) && isString(event.title)) {
        return { type: event.type, id: event.id, title: event.title };
      }
      break;
    case ConversationTitleStreamUnavailableEventDtoTypeEnum.Unavailable:
      if (isString(event.id)) return { type: event.type, id: event.id };
      break;
    case ConversationTitleStreamItemErrorEventDtoTypeEnum.ItemError:
      if (
        isString(event.id) &&
        includes(ConversationTitleStreamItemErrorCode, event.code)
      ) {
        return {
          type: event.type,
          id: event.id,
          code: event.code as ConversationTitleStreamItemErrorCode,
        };
      }
      break;
    case ConversationTitleStreamDoneEventDtoTypeEnum.Done:
      if (
        includes(ConversationTitleStreamDoneReason, event.reason) &&
        isCount(event.processed) &&
        isCount(event.total) &&
        event.processed <= event.total
      ) {
        return {
          type: event.type,
          reason: event.reason as ConversationTitleStreamDoneReason,
          processed: event.processed,
          total: event.total,
        };
      }
      break;
    case ConversationTitleStreamErrorEventDtoTypeEnum.Error:
      if (
        typeof event.status === 'number' &&
        ERROR_CODE_BY_STATUS[event.status] === event.code
      ) {
        return {
          type: event.type,
          status: event.status as 401 | 502 | 503,
          code: event.code as ConversationTitleStreamErrorCode,
        };
      }
      break;
  }
  throw new ConversationTitleStreamProtocolError('Unknown or invalid event');
};

/**
 * Incremental SSE framing for already-decoded text: CR, LF and CRLF line
 * endings, comment lines, and multi-line `data:` fields joined by `\n`.
 * Returns the `data` payload of every event completed by `text`.
 */
export const createSseFrameDecoder = (
  maxFrameBytes = CONVERSATION_TITLE_STREAM_MAX_FRAME_BYTES,
) => {
  let buffer = '';
  let dataLines: string[] = [];
  let frameBytes = 0;
  let isFirstLine = true;

  const assertBounded = (bytes: number) => {
    if (bytes > maxFrameBytes) {
      throw new ConversationTitleStreamProtocolError('Event exceeds 64 KiB');
    }
  };

  const takeLine = (line: string, payloads: string[]) => {
    if (isFirstLine) {
      isFirstLine = false;
      if (line.startsWith('﻿')) line = line.slice(1);
    }
    if (line === '') {
      if (dataLines.length > 0) payloads.push(dataLines.join('\n'));
      dataLines = [];
      frameBytes = 0;
      return;
    }
    if (line.startsWith(':')) return;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    if (field !== 'data') return;
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    frameBytes += utf8Length(value) + 1;
    assertBounded(frameBytes);
    dataLines.push(value);
  };

  return {
    push: (text: string): string[] => {
      const payloads: string[] = [];
      buffer += text;
      for (;;) {
        const match = /\r\n|\r|\n/.exec(buffer);
        /* A trailing CR may be the first half of a CRLF split across chunks. */
        if (
          !match ||
          (match[0] === '\r' && match.index === buffer.length - 1)
        ) {
          break;
        }
        takeLine(buffer.slice(0, match.index), payloads);
        buffer = buffer.slice(match.index + match[0].length);
      }
      assertBounded(frameBytes + utf8Length(buffer));
      return payloads;
    },
  };
};

/**
 * Reads a title stream body as validated events. The reader is cancelled
 * when iteration stops early (a terminal event, an abort, a protocol error)
 * and released on every exit.
 */
export const readConversationTitleStream = (
  body: ReadableStream<Uint8Array>,
): AsyncIterable<ConversationTitleStreamEventDto> => ({
  async *[Symbol.asyncIterator]() {
    const reader = body.getReader();
    const textDecoder = new TextDecoder();
    const frames = createSseFrameDecoder();
    let isDrained = false;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          isDrained = true;
          /* An event without its closing blank line was never dispatched. */
          for (const data of frames.push(textDecoder.decode())) {
            yield parseConversationTitleStreamEvent(data);
          }
          return;
        }
        const text = textDecoder.decode(value, { stream: true });
        for (const data of frames.push(text)) {
          yield parseConversationTitleStreamEvent(data);
        }
      }
    } finally {
      if (!isDrained) await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
  },
});

/**
 * True when an older backend lacks the stream route — the only failure that
 * may switch an identity session to the JSON titles endpoint.
 */
export const isConversationTitleStreamUnsupported = (error: unknown) =>
  error instanceof ResponseError &&
  (error.response.status === 404 || error.response.status === 405);
