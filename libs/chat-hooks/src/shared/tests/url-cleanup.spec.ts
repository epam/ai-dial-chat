import { afterEach, describe, expect, it } from 'vitest';
import { getCleanedLocationTarget } from '../url-cleanup';

const setUrl = (url: string, state: unknown = null) =>
  window.history.replaceState(state, '', url);

describe('getCleanedLocationTarget', () => {
  afterEach(() => setUrl('/'));

  it('drops only the requested keys and keeps the others and the hash', () => {
    setUrl('/?a=1&deployment-id=x&skill-id=y#h');

    expect(getCleanedLocationTarget(['deployment-id', 'skill-id'])).toEqual({
      search: '?a=1',
      hash: '#h',
    });
  });

  it.each([
    [
      'returns an empty search when nothing is left',
      { url: '/?deployment-id=x', keys: ['deployment-id'], expected: '' },
    ],
    [
      'keeps every key when none is requested',
      { url: '/?a=1&b=2', keys: [], expected: '?a=1&b=2' },
    ],
    [
      'keeps the raw encoding of the pairs it leaves',
      {
        url: '/?skill-id=s&q=a%20b&p=x/y',
        keys: ['skill-id'],
        expected: '?q=a%20b&p=x/y',
      },
    ],
    [
      'matches a percent-encoded key and ignores empty pairs',
      {
        url: '/?deployment%2Did=x&&a=1',
        keys: ['deployment-id'],
        expected: '?a=1',
      },
    ],
  ])('%s', (_name, { url, keys, expected }) => {
    setUrl(url);

    expect(getCleanedLocationTarget(keys).search).toBe(expected);
  });

  it('reads the live location, so a second removal sees the first one', () => {
    setUrl('/?a=1&deployment-id=x&skill-id=y');
    setUrl(`/${getCleanedLocationTarget(['deployment-id']).search}`);

    expect(getCleanedLocationTarget(['skill-id']).search).toBe('?a=1');
  });
});
