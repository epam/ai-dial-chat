import { describe, expect, it } from 'vitest';
import {
  buildProjectConversationLocator,
  fromStrippedProjectConversationPath,
  isProjectConversationLocator,
  parseProjectConversationLocator,
  stripProjectConversationLocator,
} from '../utils/project-conversation-id.util';
import { parseProjectId } from '../utils/project-id.util';

describe('parseProjectConversationLocator', () => {
  it('parses a nested project path and the conversation file', () => {
    const parsed = parseProjectConversationLocator(
      'projects/a1b2c3/marketing/q4/conversations/gpt-4o__Summary__1b2c',
    );

    expect(parsed).toEqual({
      locator:
        'projects/a1b2c3/marketing/q4/conversations/gpt-4o__Summary__1b2c',
      project: expect.objectContaining({
        id: 'projects/a1b2c3/marketing/q4',
        bucket: 'a1b2c3',
        path: 'marketing/q4',
        name: 'q4',
      }),
      name: 'gpt-4o__Summary__1b2c',
      filePath: 'conversations/gpt-4o__Summary__1b2c',
    });
  });

  it('round-trips through buildProjectConversationLocator', () => {
    const project = parseProjectId('projects/a1b2c3/support-quality')!;
    const locator = buildProjectConversationLocator(project, 'gpt-4o__Hi__1');

    expect(parseProjectConversationLocator(locator)?.project.id).toBe(
      project.id,
    );
    expect(parseProjectConversationLocator(locator)?.name).toBe(
      'gpt-4o__Hi__1',
    );
  });

  it('accepts a deployment id with a colon in the file name', () => {
    const name =
      'dial-chathub-v2-anthropic.claude-haiku-4-5-20251001-v1:0__hey__243cbd90-00e0-424c-8400-b01b41786e82';

    const parsed = parseProjectConversationLocator(
      `projects/a1b2c3/hey/conversations/${name}`,
    );

    expect(parsed?.name).toBe(name);
    expect(parsed?.filePath).toBe(`conversations/${name}`);
  });

  it('accepts a project folder that is itself named conversations', () => {
    const parsed = parseProjectConversationLocator(
      'projects/a1b2c3/conversations/conversations/x',
    );

    expect(parsed?.project.id).toBe('projects/a1b2c3/conversations');
    expect(parsed?.name).toBe('x');
  });

  it.each([
    ['a nested conversation path', 'projects/a1b2c3/q4/conversations/a/b'],
    ['traversal', 'projects/a1b2c3/q4/conversations/..'],
    ['an empty name', 'projects/a1b2c3/q4/conversations/'],
    ['a missing project', 'projects/a1b2c3/conversations/x'],
    ['a top-level conversation', 'conversations/a1b2c3/x'],
    ['traversal in the project path', 'projects/a1b2c3/../conversations/x'],
    ['a backslash', 'projects/a1b2c3/q4/conversations/a\\b'],
    ['a control character', 'projects/a1b2c3/q4/conversations/a\u0001'],
    ['a percent sign', 'projects/a1b2c3/q4/conversations/a%2Fb'],
    ['a reserved name', 'projects/a1b2c3/q4/conversations/.dial-resource'],
    ['the context folder', 'projects/a1b2c3/q4/context/x'],
  ])('rejects %s', (_label, value) => {
    expect(parseProjectConversationLocator(value)).toBeNull();
    expect(isProjectConversationLocator(value)).toBe(false);
  });

  it('rejects a non-string', () => {
    expect(parseProjectConversationLocator(undefined)).toBeNull();
  });
});

describe('stripped completion paths', () => {
  const locator = 'projects/a1b2c3/q4/conversations/x';

  it('strips and restores the projects/ prefix', () => {
    const stripped = stripProjectConversationLocator(locator);

    expect(stripped).toBe('a1b2c3/q4/conversations/x');
    expect(fromStrippedProjectConversationPath(stripped)?.locator).toBe(
      locator,
    );
  });

  it('returns null for a path that is not a project conversation', () => {
    expect(fromStrippedProjectConversationPath('a1b2c3/x')).toBeNull();
    expect(fromStrippedProjectConversationPath(42)).toBeNull();
  });
});
