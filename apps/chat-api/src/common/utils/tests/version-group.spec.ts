import { describe, expect, it } from 'vitest';
import { getVersionGroupId } from '../version-group';

describe('getVersionGroupId', () => {
  it('gives every version of one resource in one folder the same group', () => {
    expect(getVersionGroupId('applications/abc/Design/Review__1.0.0')).toBe(
      getVersionGroupId('applications/abc/Design/Review__1.1.0'),
    );
  });

  it('separates the same name in another folder', () => {
    expect(
      getVersionGroupId('applications/abc/Research/Review__1.0.0'),
    ).not.toBe(getVersionGroupId('applications/abc/Design/Review__1.0.0'));
  });

  it.each([
    [
      'splits at the last separator so a name containing the separator keeps it',
      { id: 'applications/abc/Design/a__b__2.0', expected: 'abc/Design/a__b' },
    ],
    [
      'decodes percent-encoded segments before building the key',
      {
        id: 'applications/abc/My%20Folder/My%20App__1.0%2Bbuild5',
        expected: 'abc/My Folder/My App',
      },
    ],
    [
      'keeps a raw plus sign of the version out of the key',
      { id: 'applications/abc/App__1.0+build5', expected: 'abc/App' },
    ],
    [
      'is built from the stored path, so a changed display name or version does not move it',
      {
        id: 'applications/abc/Design/Review__1.0.0',
        expected: 'abc/Design/Review',
      },
    ],
    [
      'uses the owner and the bare name at the bucket root',
      { id: 'toolsets/abc/Search__2.0.0', expected: 'abc/Search' },
    ],
  ])('%s', (_name, { id, expected }) => {
    expect(getVersionGroupId(id)).toBe(expected);
  });

  it('is the same for a raw and an encoded plus sign', () => {
    expect(getVersionGroupId('toolsets/abc/Tool__1.0+b1')).toBe(
      getVersionGroupId('toolsets/abc/Tool__1.0%2Bb1'),
    );
  });

  it('separates two owners that saved the same folder and name', () => {
    expect(getVersionGroupId('applications/alice/Design/Review__1')).not.toBe(
      getVersionGroupId('applications/bob/Design/Review__2'),
    );
  });

  it.each([
    'applications/abc/Design/Review',
    'toolsets/abc/Search__',
    'toolsets/abc/__1.0',
    'gpt-4o',
    'models/gpt-4o',
  ])('returns no group for %s', (id) => {
    expect(getVersionGroupId(id)).toBeUndefined();
  });
});
