import { describe, expect, it } from 'vitest';
import { ROUTES } from '../../types/routes';
import { SettingsTabs } from '../../types/settings-tabs';
import {
  getConversationRoute,
  getProjectConversationRoute,
  getProjectEditRoute,
  getProjectViewRoute,
  isConversationPagePath,
  parseProjectConversationRouteParams,
  getScheduledTaskDetailRoute,
  getScheduledTaskEditRoute,
  getSettingsTabRoute,
  normalizeConversationId,
  parseProjectRouteParams,
} from '../routes';

describe('normalizeConversationId', () => {
  it.each([
    [
      'keeps plain conversation id',
      { id: 'tenant/path', expected: 'tenant/path' },
    ],
    [
      'strips conversations prefix with leading slash',
      { id: '/conversations/tenant/path', expected: 'tenant/path' },
    ],
    [
      'strips conversations prefix without leading slash',
      { id: 'conversations/tenant/path', expected: 'tenant/path' },
    ],
  ])('%s', (_name, { id, expected }) => {
    expect(normalizeConversationId(id)).toBe(expected);
  });
});

describe('getConversationRoute', () => {
  it.each([
    [
      'builds route for plain conversation id',
      { id: 'tenant/path', expected: '/conversations/tenant/path' },
    ],
    [
      'does not duplicate conversations prefix with leading slash',
      {
        id: '/conversations/tenant/path',
        expected: '/conversations/tenant/path',
      },
    ],
    [
      'does not duplicate conversations prefix without leading slash',
      {
        id: 'conversations/tenant/path',
        expected: '/conversations/tenant/path',
      },
    ],
    /*
     * The backend concatenates a Quick App's (possibly percent-encoded)
     * deployment id directly into the conversation id. Each URL segment is
     * decoded first (undoing any pre-existing encoding) before being
     * re-encoded exactly once, so the router's single automatic decode on
     * navigation lands back on the fully raw, correctly single-encoded value
     * — not a double-encoded one.
     */
    [
      'decodes an already-percent-encoded segment before re-encoding it once',
      {
        id: 'tenant/applications/catalog/Team%2FApp%20One__0.0.1__title',
        expected:
          '/conversations/tenant/applications/catalog/Team%2FApp%20One__0.0.1__title',
      },
    ],
    [
      'leaves a literal, non-percent-encoding "%" in a segment unchanged when decoding fails',
      {
        id: 'tenant/gpt-4o__50% off__title',
        expected: '/conversations/tenant/gpt-4o__50%25%20off__title',
      },
    ],
    [
      'falls back to root when a segment is a parent-directory traversal',
      { id: 'tenant/../../evil', expected: '/' },
    ],
    [
      'falls back to root when a segment is the current-directory dot',
      { id: 'tenant/./path', expected: '/' },
    ],
    [
      'falls back to root when a segment is empty (double slash)',
      { id: 'tenant//path', expected: '/' },
    ],
  ])('%s', (_name, { id, expected }) => {
    expect(getConversationRoute(id)).toBe(expected);
  });
});

describe('getScheduledTaskDetailRoute', () => {
  it('builds the detail route for a plain scheduleId', () => {
    expect(getScheduledTaskDetailRoute('sched_123')).toBe(
      '/scheduled-tasks/sched_123',
    );
  });

  it('percent-encodes a scheduleId that needs encoding', () => {
    expect(getScheduledTaskDetailRoute('sched 123/x')).toBe(
      '/scheduled-tasks/sched%20123%2Fx',
    );
  });
});

describe('getScheduledTaskEditRoute', () => {
  it('builds the edit route for a plain scheduleId', () => {
    expect(getScheduledTaskEditRoute('sched_123')).toBe(
      '/scheduled-tasks/sched_123/edit',
    );
  });

  it('percent-encodes a scheduleId that needs encoding', () => {
    expect(getScheduledTaskEditRoute('sched 123/x')).toBe(
      '/scheduled-tasks/sched%20123%2Fx/edit',
    );
  });
});

describe('getSettingsTabRoute', () => {
  const allTabs = Object.values(SettingsTabs);

  it('puts the tab in a path segment, never a query parameter', () => {
    const route = getSettingsTabRoute(SettingsTabs.Usage);

    expect(route).toBe('/settings/usage');
    expect(route).not.toContain('?');
  });

  it('nests every tab under the settings route', () => {
    for (const tab of allTabs) {
      expect(getSettingsTabRoute(tab).startsWith(`${ROUTES.Settings}/`)).toBe(
        true,
      );
    }
  });

  /*
   * The guard that matters: the segment is the enum value verbatim, so a
   * future tab id carrying a space or a slash would produce a path that does
   * not resolve back to it.
   */
  it.each(allTabs)('round-trips the %s tab through its path', (tab) => {
    const segments = new URL(
      getSettingsTabRoute(tab),
      'https://example.test',
    ).pathname.split('/');

    expect(decodeURIComponent(segments[segments.length - 1])).toBe(tab);
  });
});

describe('getProjectViewRoute', () => {
  it.each([
    [
      'encodes each segment of a nested project id',
      {
        id: 'projects/a1b2c3/marketing/Q4 launch',
        expected: '/projects/view/a1b2c3/marketing/Q4%20launch',
      },
    ],
    [
      'does not double-encode an already encoded segment',
      {
        id: 'projects/a1b2c3/Q4%20launch',
        expected: '/projects/view/a1b2c3/Q4%20launch',
      },
    ],
    [
      'ignores the folder-shaped trailing slash DIAL Core may return',
      {
        id: 'projects/a1b2c3/Q4%20launch/',
        expected: '/projects/view/a1b2c3/Q4%20launch',
      },
    ],
  ])('%s', (_name, { id, expected }) => {
    expect(getProjectViewRoute(id)).toBe(expected);
  });

  it.each([
    'projects/a1b2c3/../x',
    'projects/a1b2c3',
    'projects/a1b2c3/',
    'skills/a1b2c3/q4',
    'projects/a1b2c3//q4',
  ])('falls back to the Projects list for %s', (id) => {
    expect(getProjectViewRoute(id)).toBe(ROUTES.Projects);
  });
});

describe('getProjectEditRoute', () => {
  it('builds the edit URL of a project', () => {
    expect(getProjectEditRoute('projects/a1b2c3/q4')).toBe(
      '/projects/edit/a1b2c3/q4',
    );
  });

  it('falls back to the Projects list for an unsafe id', () => {
    expect(getProjectEditRoute('projects/a1b2c3/../x')).toBe(ROUTES.Projects);
  });
});

describe('parseProjectRouteParams', () => {
  it('rebuilds the project id from the bucket and the decoded splat', () => {
    expect(
      parseProjectRouteParams({ bucket: 'a1b2c3', '*': 'marketing/Q4 launch' }),
    ).toBe('projects/a1b2c3/marketing/Q4 launch');
  });

  it.each([
    [{ bucket: 'a1b2c3' }],
    [{ '*': 'q4' }],
    [{ bucket: 'a1b2c3', '*': '../x' }],
    [{ bucket: '..', '*': 'q4' }],
    [{ bucket: 'a1b2c3', '*': 'q4/' }],
  ])('returns null for %j', (params) => {
    expect(parseProjectRouteParams(params)).toBeNull();
  });

  it('round-trips with getProjectViewRoute', () => {
    const id = 'projects/a1b2c3/marketing/Q4 launch';
    const [, , , bucket, ...rest] = getProjectViewRoute(id).split('/');

    expect(
      parseProjectRouteParams({
        bucket: decodeURIComponent(bucket),
        '*': rest.map(decodeURIComponent).join('/'),
      }),
    ).toBe(id);
  });
});

describe('getProjectConversationRoute', () => {
  it('builds the project chat route, re-encoding every segment', () => {
    expect(
      getProjectConversationRoute(
        'projects/a1b2c3/marketing/Q4 launch/conversations/gpt-4o__Summary__1b2c',
      ),
    ).toBe(
      '/projects/chat/a1b2c3/marketing/Q4%20launch/conversations/gpt-4o__Summary__1b2c',
    );
  });

  it.each([
    'projects/a1b2c3/q4/context/x',
    'projects/a1b2c3/conversations/x',
    'projects/a1b2c3/q4/conversations/..',
    'conversations/a1b2c3/x',
  ])('falls back to the projects list for %s', (id) => {
    expect(getProjectConversationRoute(id)).toBe(ROUTES.Projects);
  });
});

describe('parseProjectConversationRouteParams', () => {
  it('splits the project and the conversation', () => {
    expect(
      parseProjectConversationRouteParams({
        bucket: 'a1b2c3',
        '*': 'q4/conversations/x',
      }),
    ).toEqual({
      projectId: 'projects/a1b2c3/q4',
      conversationId: 'projects/a1b2c3/q4/conversations/x',
    });
  });

  it('keeps a project folder named conversations unambiguous', () => {
    expect(
      parseProjectConversationRouteParams({
        bucket: 'a1b2c3',
        '*': 'conversations/team/conversations/gpt-4o__Plan__9f',
      }),
    ).toEqual({
      projectId: 'projects/a1b2c3/conversations/team',
      conversationId:
        'projects/a1b2c3/conversations/team/conversations/gpt-4o__Plan__9f',
    });
  });

  it.each([
    [{ bucket: 'a1b2c3', '*': 'q4-launch' }],
    [{ bucket: 'a1b2c3', '*': 'conversations/x' }],
    [{ bucket: 'a1b2c3', '*': 'q4/conversations/..' }],
    [{ bucket: 'a1b2c3' }],
    [{ '*': 'q4/conversations/x' }],
  ])('returns null for %j', (params) => {
    expect(parseProjectConversationRouteParams(params)).toBeNull();
  });

  it('round-trips with getProjectConversationRoute', () => {
    const id = 'projects/a1b2c3/marketing/Q4 launch/conversations/gpt-4o__A__1';
    const [, , , bucket, ...rest] = getProjectConversationRoute(id).split('/');

    expect(
      parseProjectConversationRouteParams({
        bucket: decodeURIComponent(bucket),
        '*': rest.map(decodeURIComponent).join('/'),
      })?.conversationId,
    ).toBe(id);
  });
});

describe('isConversationPagePath', () => {
  it.each([
    ['/conversations/a1b2c3/x', true],
    ['/conversations', true],
    ['/conversationsx', false],
    ['/projects/chat/a1b2c3/q4/conversations/x', true],
    ['/projects/view/a1b2c3/q4', false],
    ['/', false],
  ])('treats %s as a conversation page: %s', (pathname, expected) => {
    expect(isConversationPagePath(pathname)).toBe(expected);
  });
});
