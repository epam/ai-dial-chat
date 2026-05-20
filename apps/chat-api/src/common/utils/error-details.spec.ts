import { describe, expect, it } from 'vitest';
import { getErrorDetails } from './error-details';

describe('getErrorDetails', () => {
  it('returns defaults for non-object values', () => {
    expect(getErrorDetails(null)).toEqual({
      statusCode: 500,
      message: 'Unknown error',
    });
    expect(getErrorDetails('boom')).toEqual({
      statusCode: 500,
      message: 'Unknown error',
    });
  });

  it('extracts status and message when present', () => {
    expect(getErrorDetails({ status: 404, message: 'Not found' })).toEqual({
      statusCode: 404,
      message: 'Not found',
    });
  });

  it('uses fallbacks when fields are missing or invalid', () => {
    expect(getErrorDetails({ status: 'bad', message: 123 })).toEqual({
      statusCode: 500,
      message: 'Unknown error',
    });

    expect(getErrorDetails({}, 418, 'fallback')).toEqual({
      statusCode: 418,
      message: 'fallback',
    });
  });
});
