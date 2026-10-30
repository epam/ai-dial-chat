/** What one {@link SseFrameDecoder.push} produced. */
export interface SseFrameDecodeResult {
  /** The `data` payload of every event the chunk completed. */
  events: string[];
  /** How many events were dropped for growing past the length bound. */
  droppedCount: number;
}

/** Incremental SSE decoder created by {@link createSseFrameDecoder}. */
export interface SseFrameDecoder {
  /** Feeds the next chunk of the upstream byte stream. */
  push: (chunk: Uint8Array) => SseFrameDecodeResult;
}

/**
 * Returns an incremental SSE decoder for an upstream byte stream: CR, LF and
 * CRLF line endings, comment lines, and multi-line `data:` fields joined by
 * `\n`. An event longer than `maxFrameLength` characters is dropped whole,
 * and decoding resumes at the next event.
 */
export const createSseFrameDecoder = (
  maxFrameLength: number,
): SseFrameDecoder => {
  const textDecoder = new TextDecoder();
  let buffer = '';
  let dataLines: string[] = [];
  let frameLength = 0;
  let isDiscarding = false;
  /* A chunk may end between the `\r` and `\n` of one CRLF. */
  let isAfterCarriageReturn = false;

  const push = (chunk: Uint8Array): SseFrameDecodeResult => {
    const events: string[] = [];
    let droppedCount = 0;

    const discardFrame = () => {
      if (!isDiscarding) droppedCount++;
      isDiscarding = true;
      dataLines = [];
    };

    const readLine = (line: string) => {
      if (line === '') {
        if (!isDiscarding && dataLines.length > 0) {
          events.push(dataLines.join('\n'));
        }
        dataLines = [];
        frameLength = 0;
        isDiscarding = false;
        return;
      }
      if (isDiscarding) return;
      frameLength += line.length;
      if (frameLength > maxFrameLength) {
        discardFrame();
        return;
      }
      if (line === 'data' || line.startsWith('data:')) {
        const value = line.slice(5);
        dataLines.push(value.startsWith(' ') ? value.slice(1) : value);
      }
    };

    buffer += textDecoder.decode(chunk, { stream: true });
    let start = 0;
    for (let index = 0; index < buffer.length; index++) {
      const char = buffer[index];
      if (char === '\n' && isAfterCarriageReturn && index === start) {
        isAfterCarriageReturn = false;
        start = index + 1;
        continue;
      }
      isAfterCarriageReturn = false;
      if (char !== '\n' && char !== '\r') continue;
      readLine(buffer.slice(start, index));
      isAfterCarriageReturn = char === '\r';
      start = index + 1;
    }
    buffer = buffer.slice(start);

    /* An unterminated line past the bound is never kept in memory. */
    if (frameLength + buffer.length > maxFrameLength) {
      discardFrame();
      buffer = '';
    }

    return { events, droppedCount };
  };

  return { push };
};
