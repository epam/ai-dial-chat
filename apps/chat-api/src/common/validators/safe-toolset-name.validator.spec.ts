import { describe, expect, it } from 'vitest';
import { isSafeToolsetName } from './safe-toolset-name.validator';

describe('isSafeToolsetName', () => {
  it.each([
    'my-toolset',
    'folder.toolset-v1',
    '@org/toolset:tag',
    'toolsets/bucket/folder/toolset-name',
    'toolsets/bucket/My%20Tool',
    'toolsets%2Fbucket%2Ffolder%2Ftoolset-name',
  ])('accepts the safe toolset name %s', (value) => {
    expect(isSafeToolsetName(value)).toBe(true);
  });

  it.each([
    '',
    '.',
    '..',
    '../etc/passwd',
    'toolsets//toolset-name',
    'toolsets/./toolset-name',
    'toolsets/../toolset-name',
    '..%2Fetc%2Fpasswd',
    '%2E%2E%2Fetc%2Fpasswd',
    'toolsets%2Fbucket%2F..%2Fsecret',
    'bad;toolset',
    'bad toolset',
    String.raw`..\etc\passwd`,
    'bad%GGtoolset',
  ])('rejects the unsafe toolset name %s', (value) => {
    expect(isSafeToolsetName(value)).toBe(false);
  });

  it.each([null, undefined, 42, {}])(
    'rejects the non-string value %s',
    (value) => {
      expect(isSafeToolsetName(value)).toBe(false);
    },
  );
});
