import { describe, expect, it, vi } from 'vitest';
import {
  getApiErrorDetails,
  getApiErrorMessage,
  isConversationNotFoundError,
} from '../api-error';

const VALID_TRACEPARENT =
  '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
const VALID_TRACE_ID = '4bf92f3577b34da6a3ce929d0e0e4736';

describe('isConversationNotFoundError', () => {
  it('returns true for a 404 API response', () => {
    expect(
      isConversationNotFoundError({ response: { status: 404, json: vi.fn() } }),
    ).toBe(true);
  });

  it('returns false for a 502 API response', () => {
    expect(
      isConversationNotFoundError({ response: { status: 502, json: vi.fn() } }),
    ).toBe(false);
  });

  it('returns false for other statuses', () => {
    expect(
      isConversationNotFoundError({ response: { status: 400, json: vi.fn() } }),
    ).toBe(false);
  });
});

describe('getApiErrorMessage', () => {
  it('joins validation messages from API error responses', async () => {
    const error = {
      response: {
        json: vi.fn().mockResolvedValue({
          message: ['First validation error', 'Second validation error'],
          error: 'Bad Request',
          statusCode: 400,
        }),
      },
    };

    await expect(getApiErrorMessage(error)).resolves.toBe(
      'First validation error\nSecond validation error',
    );
  });

  it('returns string messages from API error responses', async () => {
    const error = {
      response: {
        json: vi.fn().mockResolvedValue({
          message: 'Deployment is not available',
          error: 'Bad Request',
          statusCode: 400,
        }),
      },
    };

    await expect(getApiErrorMessage(error)).resolves.toBe(
      'Deployment is not available',
    );
  });

  it('falls back to normal Error messages', async () => {
    await expect(getApiErrorMessage(new Error('Network error'))).resolves.toBe(
      'Network error',
    );
  });
});

describe('getApiErrorDetails', () => {
  it('resolves message and traceId from a generated-client ResponseError-shaped body', async () => {
    const response = new Response(
      JSON.stringify({
        message: 'Deployment is not available',
        error: 'Bad Request',
        statusCode: 400,
        traceparent: VALID_TRACEPARENT,
      }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );

    await expect(getApiErrorDetails({ response })).resolves.toEqual({
      status: 400,
      message: 'Deployment is not available',
      traceId: VALID_TRACE_ID,
    });
  });

  it('falls back to the response header when the body has no traceparent', async () => {
    const response = new Response(
      JSON.stringify({ message: 'Deployment is not available' }),
      {
        status: 400,
        headers: {
          'content-type': 'application/json',
          traceparent: VALID_TRACEPARENT,
        },
      },
    );

    await expect(getApiErrorDetails({ response })).resolves.toEqual({
      status: 400,
      message: 'Deployment is not available',
      traceId: VALID_TRACE_ID,
    });
  });

  it('resolves a base.ts-shaped error (only a header traceparent) identically', async () => {
    const response = new Response('plain text error', {
      status: 500,
      headers: { traceparent: VALID_TRACEPARENT },
    });

    await expect(getApiErrorDetails({ response })).resolves.toEqual({
      status: 500,
      message: null,
      traceId: VALID_TRACE_ID,
    });
  });

  it('resolves the message unchanged when no trace context exists anywhere', async () => {
    const response = new Response(
      JSON.stringify({ message: 'Deployment is not available' }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );

    await expect(getApiErrorDetails({ response })).resolves.toEqual({
      status: 400,
      message: 'Deployment is not available',
      traceId: undefined,
    });
  });

  it('rejects an all-zero trace ID', async () => {
    const response = new Response(
      JSON.stringify({
        message: 'Deployment is not available',
        traceparent: '00-00000000000000000000000000000000-00f067aa0ba902b7-01',
      }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );

    await expect(getApiErrorDetails({ response })).resolves.toMatchObject({
      traceId: undefined,
    });
  });

  it('rejects a truncated or uppercase traceparent without throwing', async () => {
    const response = new Response(
      JSON.stringify({
        message: 'Deployment is not available',
        traceparent: '00-4BF92F3577B34DA6A3CE929D0E0E4736-00f067aa0ba902b7-01',
      }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );

    await expect(getApiErrorDetails({ response })).resolves.toMatchObject({
      traceId: undefined,
    });
  });

  it('returns null message without throwing when the body is not JSON', async () => {
    const response = new Response('not json', { status: 502 });

    await expect(getApiErrorDetails({ response })).resolves.toEqual({
      status: 502,
      message: null,
      traceId: undefined,
    });
  });

  it('does not double-consume the response stream', async () => {
    const response = new Response(
      JSON.stringify({ message: 'Deployment is not available' }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );

    await getApiErrorDetails({ response });

    await expect(response.clone().json()).resolves.toEqual({
      message: 'Deployment is not available',
    });
  });
});
