import { describe, expect, it } from 'vitest';
import { resolveCallbackUrl } from './callback-url.util';

const OPTIONS = {
  authCallbackBaseUrl: 'http://localhost:5000',
  corsOrigin: 'http://localhost:4207',
};

describe('resolveCallbackUrl', () => {
  it('resolves a missing callbackUrl to the configured app root', () => {
    expect(resolveCallbackUrl(undefined, OPTIONS)).toBe(
      'http://localhost:4207/',
    );
  });

  it('resolves a relative callbackUrl against the configured app origin', () => {
    expect(resolveCallbackUrl('/conversation?x=1#last', OPTIONS)).toBe(
      'http://localhost:4207/conversation?x=1#last',
    );
  });

  it('accepts an absolute callbackUrl from the configured app origin', () => {
    expect(
      resolveCallbackUrl('http://localhost:4207/conversation', OPTIONS),
    ).toBe('http://localhost:4207/conversation');
  });

  it('accepts an absolute callbackUrl from the callback base origin', () => {
    expect(resolveCallbackUrl('http://localhost:5000/', OPTIONS)).toBe(
      'http://localhost:5000/',
    );
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
