import { describe, expect, it } from 'vitest';
import { isSafeResourceId } from './safe-resource-id.validator';

describe('isSafeResourceId', () => {
  it.each([
    'my-app__1.0',
    'a.b',
    '__1.0.0__',
    'a..b',
    '@org/app:tag',
    'applications/bucket/folder/my-app__1.0.0',
    'toolsets/bucket/My%20Tool',
    'applications%2Fbucket%2Fmy-app',
  ])('accepts the safe resource id %s', (value) => {
    expect(isSafeResourceId(value)).toBe(true);
  });

  it.each([
    '',
    '.',
    '..',
    'applications/b/../x',
    'applications/b/./x',
    'applications/../x',
    'applications/b/x/..',
    'applications//x',
    'applications/b/',
    'applications/b/%2e%2e/x',
    'applications/b/%2E%2E/x',
    'applications/b/%2e/x',
    '%2e%2e%2Fetc',
    'applications%2Fb%2F..%2Fx',
    'bad;id',
    'bad id',
    String.raw`..\etc\passwd`,
    'bad%GGid',
  ])('rejects the unsafe resource id %s', (value) => {
    expect(isSafeResourceId(value)).toBe(false);
  });

  it.each([null, undefined, 42, {}])(
    'rejects the non-string value %s',
    (value) => {
      expect(isSafeResourceId(value)).toBe(false);
    },
  );
});
