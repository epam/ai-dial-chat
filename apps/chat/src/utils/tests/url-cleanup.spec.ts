import { afterEach, describe, expect, it } from 'vitest';
import {
  getCleanedLocationTarget,
  getCurrentRouterState,
} from '../url-cleanup';

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

  it('returns an empty search when nothing is left', () => {
    setUrl('/?deployment-id=x');

    expect(getCleanedLocationTarget(['deployment-id']).search).toBe('');
  });

  it('keeps every key when none is requested', () => {
    setUrl('/?a=1&b=2');

    expect(getCleanedLocationTarget([]).search).toBe('?a=1&b=2');
  });

  it('reads the live location, so a second removal sees the first one', () => {
    setUrl('/?a=1&deployment-id=x&skill-id=y');
    setUrl(`/${getCleanedLocationTarget(['deployment-id']).search}`);

    expect(getCleanedLocationTarget(['skill-id']).search).toBe('?a=1');
  });

  it('keeps the raw encoding of the pairs it leaves', () => {
    setUrl('/?skill-id=s&q=a%20b&p=x/y');

    expect(getCleanedLocationTarget(['skill-id']).search).toBe(
      '?q=a%20b&p=x/y',
    );
  });

  it('matches a percent-encoded key and ignores empty pairs', () => {
    setUrl('/?deployment%2Did=x&&a=1');

    expect(getCleanedLocationTarget(['deployment-id']).search).toBe('?a=1');
  });
});

describe('getCurrentRouterState', () => {
  afterEach(() => setUrl('/'));

  it('returns the router state stored for the current entry', () => {
    setUrl('/', { usr: { skillId: 'skills/a/b' }, key: 'k', idx: 0 });

    expect(getCurrentRouterState()).toEqual({ skillId: 'skills/a/b' });
  });

  it('returns null when the entry has no router state', () => {
    setUrl('/', null);

    expect(getCurrentRouterState()).toBeNull();
  });
});
