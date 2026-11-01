import { ProjectWatchAction } from '@epam/ai-dial-chat-api-client';
import { ProjectSource, type ProjectItem } from '@epam/ai-dial-projects';
import { describe, expect, it } from 'vitest';
import { applyProjectEvent, parseProjectWatchEvent } from '../project-events';

const items: ProjectItem[] = [
  {
    id: 'projects/b/alpha',
    name: 'alpha',
    source: ProjectSource.Personal,
    updatedAt: 1000,
  },
  { id: 'projects/b/beta', name: 'beta', source: ProjectSource.Shared },
];

describe('parseProjectWatchEvent', () => {
  it('accepts a well-formed event and drops extra fields', () => {
    expect(
      parseProjectWatchEvent({
        id: 'projects/b/alpha',
        action: 'UPDATE',
        timestamp: 5,
        etag: 'e',
      }),
    ).toEqual({
      id: 'projects/b/alpha',
      action: ProjectWatchAction.Update,
      timestamp: 5,
    });
  });

  it.each([
    null,
    'text',
    { id: 'projects/b/alpha', action: 'MOVE', timestamp: 5 },
    { id: 'projects/b/alpha', action: 'UPDATE' },
    { action: 'UPDATE', timestamp: 5 },
  ])('rejects %j', (payload) => {
    expect(parseProjectWatchEvent(payload)).toBeUndefined();
  });
});

describe('applyProjectEvent', () => {
  it('moves the updated time of a listed project forward', () => {
    const next = applyProjectEvent(items, {
      id: 'projects/b/alpha',
      action: ProjectWatchAction.Update,
      timestamp: 5000,
    });

    expect(next[0].updatedAt).toBe(5000);
    expect(next[1]).toBe(items[1]);
  });

  it('dates an undated project from a create', () => {
    const next = applyProjectEvent(items, {
      id: 'projects/b/beta',
      action: ProjectWatchAction.Create,
      timestamp: 7,
    });

    expect(next[1].updatedAt).toBe(7);
  });

  it('keeps the same list for an older event', () => {
    expect(
      applyProjectEvent(items, {
        id: 'projects/b/alpha',
        action: ProjectWatchAction.Update,
        timestamp: 900,
      }),
    ).toBe(items);
  });

  it('removes a deleted project', () => {
    expect(
      applyProjectEvent(items, {
        id: 'projects/b/alpha',
        action: ProjectWatchAction.Delete,
        timestamp: 6000,
      }).map(({ id }) => id),
    ).toEqual(['projects/b/beta']);
  });

  it('ignores an event for a project that is not listed', () => {
    expect(
      applyProjectEvent(items, {
        id: 'projects/b/gamma',
        action: ProjectWatchAction.Delete,
        timestamp: 1,
      }),
    ).toBe(items);
  });
});
