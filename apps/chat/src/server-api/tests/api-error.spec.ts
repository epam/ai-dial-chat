import { describe, expect, it, vi } from 'vitest';
import { getApiErrorMessage, isConversationNotFoundError } from '../api-error';

describe('isConversationNotFoundError', () => {
  it('returns true for 404 and 502 API responses', () => {
    expect(
      isConversationNotFoundError({ response: { status: 404, json: vi.fn() } }),
    ).toBe(true);
    expect(
      isConversationNotFoundError({ response: { status: 502, json: vi.fn() } }),
    ).toBe(true);
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
