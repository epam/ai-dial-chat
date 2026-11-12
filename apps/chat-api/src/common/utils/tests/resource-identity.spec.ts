import { describe, expect, it } from 'vitest';
import { ResourceNameConflictCode } from '../../types/resource-name-conflict-code';
import {
  ResourceIdentityKind,
  ResourceIdentityTab,
  buildResourceNameConflict,
  findDuplicateIdentity,
  getResourceIdentityFolder,
  getResourceIdentityTabs,
  resolveDisplayedName,
  type ResourceIdentityEntry,
} from '../resource-identity';

const app = (
  id: string,
  displayName: ResourceIdentityEntry['displayName'],
  displayVersion: string | undefined,
  interfaces?: string[],
  isMy = true,
): ResourceIdentityEntry => ({
  id,
  kind: ResourceIdentityKind.Application,
  displayName,
  displayVersion,
  interfaces,
  isMy,
});

const toolset = (
  id: string,
  displayName: ResourceIdentityEntry['displayName'],
  displayVersion: string | undefined,
  isMy = true,
): ResourceIdentityEntry => ({
  id,
  kind: ResourceIdentityKind.Toolset,
  displayName,
  displayVersion,
  isMy,
});

describe('getResourceIdentityTabs', () => {
  it.each([
    [ResourceIdentityKind.Toolset, undefined, [ResourceIdentityTab.Toolsets]],
    [ResourceIdentityKind.Application, ['mcp'], [ResourceIdentityTab.Toolsets]],
    [
      ResourceIdentityKind.Application,
      ['mcp', 'chat'],
      [ResourceIdentityTab.Agents, ResourceIdentityTab.Toolsets],
    ],
    [
      ResourceIdentityKind.Application,
      ['mcp', 'custom_ui'],
      [ResourceIdentityTab.Agents, ResourceIdentityTab.Toolsets],
    ],
    [ResourceIdentityKind.Application, ['chat'], [ResourceIdentityTab.Agents]],
    [
      ResourceIdentityKind.Application,
      ['custom_ui'],
      [ResourceIdentityTab.Agents],
    ],
    [ResourceIdentityKind.Application, [], [ResourceIdentityTab.Agents]],
    [
      ResourceIdentityKind.Application,
      ['openaiResponses'],
      [ResourceIdentityTab.Agents],
    ],
    [ResourceIdentityKind.Application, undefined, [ResourceIdentityTab.Agents]],
  ])('classifies %s with interfaces %j', (kind, interfaces, expected) => {
    expect(getResourceIdentityTabs(kind, interfaces)).toEqual(expected);
  });
});

describe('resolveDisplayedName', () => {
  it('returns a plain string trimmed', () => {
    expect(resolveDisplayedName('  Search ')).toBe('Search');
  });

  it('prefers the en entry of a locale map', () => {
    expect(resolveDisplayedName({ de: 'Suche', en: 'Search' })).toBe('Search');
  });

  it('falls back to the first entry when a locale map has no en', () => {
    expect(resolveDisplayedName({ de: 'Suche', fr: 'Recherche' })).toBe(
      'Suche',
    );
  });

  it('returns an empty string for a missing name', () => {
    expect(resolveDisplayedName(undefined)).toBe('');
  });
});

describe('getResourceIdentityFolder', () => {
  it('is empty for an entity in the bucket root', () => {
    expect(getResourceIdentityFolder('applications/b/x__1.0.0')).toBe('');
  });

  it('joins the decoded folder segments', () => {
    expect(
      getResourceIdentityFolder('applications/b/Team%20A/Q%26A/x__1.0.0'),
    ).toBe('Team A/Q&A');
  });
});

describe('findDuplicateIdentity', () => {
  const agentsTab = [ResourceIdentityTab.Agents];
  const toolsetsTab = [ResourceIdentityTab.Toolsets];

  it('finds an own agent with the same folder, name and version', () => {
    const existing = app('applications/b/X__1.0.0', 'X', '1.0.0', ['chat']);
    expect(
      findDuplicateIdentity({
        candidate: { folder: '', name: 'X', version: '1.0.0' },
        tabs: agentsTab,
        entries: [existing],
      }),
    ).toBe(existing);
  });

  it('treats an absent version on either side as the default version', () => {
    const existing = app('applications/b/X__1.0.0', 'X', undefined, ['chat']);
    expect(
      findDuplicateIdentity({
        candidate: { folder: '', name: 'X' },
        tabs: agentsTab,
        entries: [existing],
      }),
    ).toBe(existing);
  });

  it('does not match a different folder', () => {
    const existing = app('applications/b/Design/X__1.0.0', 'X', '1.0.0');
    expect(
      findDuplicateIdentity({
        candidate: { folder: 'Research', name: 'X', version: '1.0.0' },
        tabs: agentsTab,
        entries: [existing],
      }),
    ).toBeUndefined();
  });

  it('matches a folder with spaces and reserved characters', () => {
    const existing = app(
      'applications/b/Team%20A/Q%26A/X__1.0.0',
      'X',
      '1.0.0',
    );
    expect(
      findDuplicateIdentity({
        candidate: { folder: 'Team A/Q&A', name: 'X', version: '1.0.0' },
        tabs: agentsTab,
        entries: [existing],
      }),
    ).toBe(existing);
  });

  it('does not match a different version', () => {
    const existing = toolset('toolsets/b/X__1.0.0', 'X', '1.0.0');
    expect(
      findDuplicateIdentity({
        candidate: { folder: '', name: 'X', version: '1.1.0' },
        tabs: toolsetsTab,
        entries: [existing],
      }),
    ).toBeUndefined();
  });

  it('ignores an entity that is not owned by the caller', () => {
    const existing = app(
      'applications/other/X__1.0.0',
      'X',
      '1.0.0',
      ['chat'],
      false,
    );
    expect(
      findDuplicateIdentity({
        candidate: { folder: '', name: 'X', version: '1.0.0' },
        tabs: agentsTab,
        entries: [existing],
      }),
    ).toBeUndefined();
  });

  it('skips the entity being written', () => {
    const existing = app('applications/b/X__1.0.0', 'X', '1.0.0');
    expect(
      findDuplicateIdentity({
        candidate: { folder: '', name: 'X', version: '1.0.0' },
        tabs: agentsTab,
        entries: [existing],
        selfId: 'applications/b/X__1.0.0',
      }),
    ).toBeUndefined();
  });

  it('matches a toolset against an MCP-capable agent', () => {
    const existing = app('applications/b/X__1.0.0', 'X', '1.0.0', [
      'chat',
      'mcp',
    ]);
    expect(
      findDuplicateIdentity({
        candidate: { folder: '', name: 'X', version: '1.0.0' },
        tabs: toolsetsTab,
        entries: [existing],
      }),
    ).toBe(existing);
  });

  it('does not match a toolset against a chat-only agent', () => {
    const existing = app('applications/b/X__1.0.0', 'X', '1.0.0', ['chat']);
    expect(
      findDuplicateIdentity({
        candidate: { folder: '', name: 'X', version: '1.0.0' },
        tabs: toolsetsTab,
        entries: [existing],
      }),
    ).toBeUndefined();
  });

  it('does not match an agent against a toolset', () => {
    const existing = toolset('toolsets/b/X__1.0.0', 'X', '1.0.0');
    expect(
      findDuplicateIdentity({
        candidate: { folder: '', name: 'X', version: '1.0.0' },
        tabs: agentsTab,
        entries: [existing],
      }),
    ).toBeUndefined();
  });

  it('compares names after trimming and by the en entry of a locale map', () => {
    const existing = toolset(
      'toolsets/b/Search__1.0.0',
      { en: 'Search', de: 'Suche' },
      '1.0.0',
    );
    expect(
      findDuplicateIdentity({
        candidate: { folder: '', name: ' Search ', version: '1.0.0' },
        tabs: toolsetsTab,
        entries: [existing],
      }),
    ).toBe(existing);
  });

  it('uses the first entry of a locale map without en', () => {
    const existing = app('applications/b/S__1.0.0', { de: 'Suche' }, '1.0.0');
    expect(
      findDuplicateIdentity({
        candidate: { folder: '', name: 'Suche', version: '1.0.0' },
        tabs: agentsTab,
        entries: [existing],
      }),
    ).toBe(existing);
  });

  it('is case sensitive', () => {
    const existing = app('applications/b/x__1.0.0', 'x', '1.0.0');
    expect(
      findDuplicateIdentity({
        candidate: { folder: '', name: 'X', version: '1.0.0' },
        tabs: agentsTab,
        entries: [existing],
      }),
    ).toBeUndefined();
  });

  it('ignores hidden folder marker entries', () => {
    const marker = app('applications/b/Design/.dial_folder', 'X', '1.0.0');
    expect(
      findDuplicateIdentity({
        candidate: { folder: 'Design', name: 'X', version: '1.0.0' },
        tabs: agentsTab,
        entries: [marker],
      }),
    ).toBeUndefined();
  });
});

describe('buildResourceNameConflict', () => {
  const agents = [ResourceIdentityTab.Agents];
  const toolsets = [ResourceIdentityTab.Toolsets];
  const both = [ResourceIdentityTab.Agents, ResourceIdentityTab.Toolsets];

  it('names an agent and carries the agent code when an agent write meets an agent', () => {
    const error = buildResourceNameConflict(
      app('applications/b/X__1.0.0', 'X', '1.0.0'),
      agents,
    );
    expect(error.getStatus()).toBe(409);
    expect(error.getResponse()).toEqual({
      statusCode: 409,
      message:
        'An agent with this name and version already exists in this folder',
      error: 'Conflict',
      code: ResourceNameConflictCode.NameTakenAgent,
    });
  });

  it('names a toolset when a toolset resource holds the identity', () => {
    const error = buildResourceNameConflict(
      toolset('toolsets/b/X__1.0.0', 'X', '1.0.0'),
      both,
    );
    expect(error.getResponse()).toMatchObject({
      message:
        'A toolset with this name and version already exists in this folder',
      code: ResourceNameConflictCode.NameTakenToolset,
    });
  });

  it('names a toolset for a Toolsets-only write even when an application holds the identity', () => {
    const error = buildResourceNameConflict(
      app('applications/b/X__1.0.0', 'X', '1.0.0'),
      toolsets,
    );
    expect(error.getResponse()).toMatchObject({
      message:
        'A toolset with this name and version already exists in this folder',
      code: ResourceNameConflictCode.NameTakenToolset,
    });
  });

  it('keeps naming the holder for a write that is also an agent', () => {
    const error = buildResourceNameConflict(
      app('applications/b/X__1.0.0', 'X', '1.0.0'),
      both,
    );
    expect(error.getResponse()).toMatchObject({
      code: ResourceNameConflictCode.NameTakenAgent,
    });
  });
});
