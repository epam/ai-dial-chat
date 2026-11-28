import { describe, expect, it } from 'vitest';
import { resolveCallbackUrl } from './callback-url.util';

const OPTIONS = {
  authCallbackBaseUrl: 'http://localhost:5000',
  corsOrigin: 'http://localhost:4207',
};

describe('resolveCallbackUrl', () => {
  it.each([
    [
      'resolves a missing callbackUrl to the configured app root',
      { callbackUrl: undefined, expected: 'http://localhost:4207/' },
    ],
    [
      'resolves a relative callbackUrl against the configured app origin',
      {
        callbackUrl: '/conversation?x=1#last',
        expected: 'http://localhost:4207/conversation?x=1#last',
      },
    ],
    [
      'accepts an absolute callbackUrl from the configured app origin',
      {
        callbackUrl: 'http://localhost:4207/conversation',
        expected: 'http://localhost:4207/conversation',
      },
    ],
    [
      'accepts an absolute callbackUrl from the callback base origin',
      {
        callbackUrl: 'http://localhost:5000/',
        expected: 'http://localhost:5000/',
      },
    ],
  ])('%s', (_name, { callbackUrl, expected }) => {
    expect(resolveCallbackUrl(callbackUrl, OPTIONS)).toBe(expected);
  });

  it.each([
    'https://evil.example.com',
    'javascript:alert(1)',
    '//evil.example.com/path',
    'http://user:pass@localhost:4207/conversation',
  ])('rejects unsafe callbackUrl %s', (callbackUrl) => {
    expect(() => resolveCallbackUrl(callbackUrl, OPTIONS)).toThrow(
      'Invalid callbackUrl',
    );
  });
});
