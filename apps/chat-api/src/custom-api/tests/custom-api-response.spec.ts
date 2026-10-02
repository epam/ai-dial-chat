import { describe, expect, it } from 'vitest';
import {
  CUSTOM_API_JSON_MAX_DEPTH,
  CustomApiTransportError,
  assertJsonDepthWithinLimit,
  isAcceptableJsonContentType,
  readBoundedJson,
} from '../custom-api-response';

/*
 * A string body makes the Fetch API set a default `text/plain;charset=UTF-8`
 * Content-Type, which would defeat the "absent Content-Type" test cases. An
 * encoded byte body sets no default, matching an Admin static JSON Response
 * that omits the header entirely.
 */
const bytesResponse = (
  text: string,
  headers?: Record<string, string>,
): Response => new Response(new TextEncoder().encode(text), { headers });

const streamResponse = (
  chunks: string[],
  headers?: Record<string, string>,
): Response => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  });
  return new Response(stream, { headers });
};

describe('isAcceptableJsonContentType', () => {
  it.each([null, undefined, '', '   '])(
    'accepts an absent Content-Type (%p)',
    (value) => {
      expect(isAcceptableJsonContentType(value)).toBe(true);
    },
  );

  it.each([
    'application/json',
    'application/json; charset=utf-8',
    'application/vnd.api+json',
    'APPLICATION/JSON',
  ])('accepts %p', (value) => {
    expect(isAcceptableJsonContentType(value)).toBe(true);
  });

  it.each([
    'text/html',
    'text/plain',
    'application/xml',
    'application/octet-stream',
  ])('rejects %p', (value) => {
    expect(isAcceptableJsonContentType(value)).toBe(false);
  });
});

describe('assertJsonDepthWithinLimit', () => {
  it('accepts JSON at exactly the configured depth', () => {
    const value =
      '['.repeat(CUSTOM_API_JSON_MAX_DEPTH) +
      ']'.repeat(CUSTOM_API_JSON_MAX_DEPTH);
    expect(() =>
      assertJsonDepthWithinLimit(value, CUSTOM_API_JSON_MAX_DEPTH),
    ).not.toThrow();
  });

  it('rejects JSON exceeding the configured depth', () => {
    const value =
      '['.repeat(CUSTOM_API_JSON_MAX_DEPTH + 1) +
      ']'.repeat(CUSTOM_API_JSON_MAX_DEPTH + 1);
    expect(() =>
      assertJsonDepthWithinLimit(value, CUSTOM_API_JSON_MAX_DEPTH),
    ).toThrow(CustomApiTransportError);
  });

  it('ignores brackets inside string contents', () => {
    const value = '{"a":"[[[[[["}';
    expect(() => assertJsonDepthWithinLimit(value, 2)).not.toThrow();
  });

  it('handles escaped quotes inside strings without miscounting depth', () => {
    const value = String.raw`{"a":"\"[[[["}`;
    expect(() => assertJsonDepthWithinLimit(value, 2)).not.toThrow();
  });
});

describe('readBoundedJson', () => {
  it('parses a static Admin JSON response with no Content-Type', async () => {
    const response = bytesResponse('{"data":[1,2,3]}');
    const result = await readBoundedJson(response, { maxBytes: 1024 });
    expect(result.value).toEqual({ data: [1, 2, 3] });
  });

  it('parses application/json and application/*+json upstream responses', async () => {
    const json = bytesResponse('[1,2,3]', {
      'Content-Type': 'application/json',
    });
    const plusJson = bytesResponse('[1,2,3]', {
      'Content-Type': 'application/vnd.api+json; charset=utf-8',
    });
    await expect(
      readBoundedJson(json, { maxBytes: 1024 }),
    ).resolves.toMatchObject({
      value: [1, 2, 3],
    });
    await expect(
      readBoundedJson(plusJson, { maxBytes: 1024 }),
    ).resolves.toMatchObject({
      value: [1, 2, 3],
    });
  });

  it('rejects an explicit non-JSON MIME type', async () => {
    const response = bytesResponse('<html></html>', {
      'Content-Type': 'text/html',
    });
    await expect(readBoundedJson(response, { maxBytes: 1024 })).rejects.toThrow(
      CustomApiTransportError,
    );
  });

  it('rejects malformed JSON', async () => {
    const response = bytesResponse('{not json');
    await expect(readBoundedJson(response, { maxBytes: 1024 })).rejects.toThrow(
      CustomApiTransportError,
    );
  });

  it('rejects an empty body', async () => {
    const response = bytesResponse('');
    await expect(readBoundedJson(response, { maxBytes: 1024 })).rejects.toThrow(
      CustomApiTransportError,
    );
  });

  it('rejects JSON exceeding the configured depth', async () => {
    const value =
      '['.repeat(CUSTOM_API_JSON_MAX_DEPTH + 1) +
      ']'.repeat(CUSTOM_API_JSON_MAX_DEPTH + 1);
    const response = bytesResponse(value);
    await expect(readBoundedJson(response, { maxBytes: 1024 })).rejects.toThrow(
      CustomApiTransportError,
    );
  });

  it('rejects a chunked/streamed response once decoded bytes exceed the limit, ignoring a misleading Content-Length', async () => {
    const chunks = Array.from({ length: 10 }, () => '"aaaaaaaaaa"');
    const response = streamResponse(chunks, {
      'Content-Length': '1',
    });
    await expect(readBoundedJson(response, { maxBytes: 20 })).rejects.toThrow(
      CustomApiTransportError,
    );
  });

  it('counts actual decoded bytes on success', async () => {
    const text = '[1,2,3]';
    const response = bytesResponse(text);
    const result = await readBoundedJson(response, { maxBytes: 1024 });
    expect(result.bytes).toBe(Buffer.byteLength(text, 'utf8'));
  });

  it('never leaks response content in a thrown error message', async () => {
    const response = bytesResponse('not-json-but-has-a-secret-token-abc123');
    let thrown: unknown;
    try {
      await readBoundedJson(response, { maxBytes: 1024 });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(CustomApiTransportError);
    expect((thrown as Error).message).not.toContain('secret-token-abc123');
  });
});
