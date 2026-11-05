import { afterEach, describe, expect, it } from 'vitest';
import { getCurrentRouterState } from '../url-cleanup';

const setUrl = (url: string, state: unknown = null) =>
  window.history.replaceState(state, '', url);

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
