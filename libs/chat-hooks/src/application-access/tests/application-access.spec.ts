import {
  ResourceDependencyAccess,
  type ApplicationResourceDependencyDto,
} from '@epam/ai-dial-chat-api-client';
import { describe, expect, it } from 'vitest';
import {
  APPLICATION_ACCESS_CONTENT_TYPES,
  areResourceDependenciesEqual,
  buildApplicationAccessLinkId,
  changeApplicationAccessContentType,
  getAllowedAccessLevels,
  mergeApplicationAccess,
  partitionResourceDependencies,
} from '../application-access';
import {
  ApplicationAccessContentType as Type,
  ApplicationAccessLevel as Level,
} from '../types';

const { Read, Write } = ResourceDependencyAccess;

const dep = (
  linkId: string,
  url: string,
  access: ResourceDependencyAccess[] = [Read],
  required?: boolean,
): ApplicationResourceDependencyDto => ({
  linkId,
  target: { url },
  access,
  ...(required == null ? {} : { required }),
});

const FILES = dep('f', 'files/{current-user}/');
const POLICIES = dep('p', 'files/public/policies/');

describe('partitionResourceDependencies', () => {
  it('shows a Files read entry as editable', () => {
    expect(partitionResourceDependencies([FILES])).toEqual({
      entries: [{ contentType: Type.Files, accessLevel: Level.Read }],
      preserved: [],
    });
  });

  it('treats a missing required as false and shows read and write', () => {
    const { entries } = partitionResourceDependencies([
      dep('p', 'prompts/{current-user}/', [Read, Write], false),
      dep('c', 'conversations/{current-user}/', [Write, Read]),
    ]);
    expect(entries).toEqual([
      { contentType: Type.Prompts, accessLevel: Level.ReadWrite },
      { contentType: Type.Conversations, accessLevel: Level.ReadWrite },
    ]);
  });

  it('compares access as a set', () => {
    const { entries, preserved } = partitionResourceDependencies([
      dep('f', 'files/{current-user}/', [Read, Read]),
    ]);
    expect(entries).toHaveLength(1);
    expect(preserved).toHaveLength(0);
  });

  it('preserves a fixed bucket entry', () => {
    const { entries, preserved } = partitionResourceDependencies([POLICIES]);
    expect(entries).toEqual([]);
    expect(preserved).toEqual([
      {
        index: 0,
        linkId: 'p',
        url: 'files/public/policies/',
        access: [Read],
        level: Level.Read,
        isRequired: false,
      },
    ]);
  });

  it.each([
    ['Read', [Read], Level.Read],
    ['Read and Write', [Read, Write], Level.ReadWrite],
    ['Write and Read in another order', [Write, Read], Level.ReadWrite],
  ])('gives a preserved entry with %s rights its level', (_, access, level) => {
    const { preserved } = partitionResourceDependencies([
      dep('x', 'files/public/x/', access),
    ]);
    expect(preserved[0].level).toBe(level);
  });

  it('gives a preserved entry that is kept only for being required its level', () => {
    const { preserved } = partitionResourceDependencies([
      dep('x', 'files/{current-user}/', [Read, Write], true),
    ]);
    expect(preserved[0].level).toBe(Level.ReadWrite);
  });

  it('leaves the level out for write-only and unknown rights', () => {
    const { preserved } = partitionResourceDependencies([
      dep('w', 'files/public/w/', [Write]),
      dep('s', 'files/public/s/', ['SHARE' as ResourceDependencyAccess]),
    ]);
    expect(preserved.map((item) => item.level)).toEqual([undefined, undefined]);
  });

  it('preserves a path below the bucket root and a url that differs by one byte', () => {
    const { preserved } = partitionResourceDependencies([
      dep('a', 'files/{current-user}/docs/'),
      dep('b', 'files/{current-user}'),
      dep('c', 'Files/{current-user}/'),
    ]);
    expect(preserved.map((item) => item.linkId)).toEqual(['a', 'b', 'c']);
  });

  it('preserves a required entry', () => {
    const { entries, preserved } = partitionResourceDependencies([
      dep('f', 'files/{current-user}/', [Read], true),
    ]);
    expect(entries).toEqual([]);
    expect(preserved[0].isRequired).toBe(true);
  });

  it('preserves a write-only entry', () => {
    const { entries, preserved } = partitionResourceDependencies([
      dep('f', 'files/{current-user}/', [Write]),
    ]);
    expect(entries).toEqual([]);
    expect(preserved).toHaveLength(1);
  });

  it('preserves the second entry for a type already shown', () => {
    const { entries, preserved } = partitionResourceDependencies([
      FILES,
      dep('f2', 'files/{current-user}/', [Read, Write]),
    ]);
    expect(entries).toHaveLength(1);
    expect(preserved.map((item) => item.linkId)).toEqual(['f2']);
  });

  it('preserves an entry for a type the lib has no content type for', () => {
    const { entries, preserved } = partitionResourceDependencies([
      dep('x', 'models/{current-user}/'),
    ]);
    expect(entries).toEqual([]);
    expect(preserved).toHaveLength(1);
  });

  it('preserves a Projects entry when the host does not offer Projects', () => {
    const { entries, preserved } = partitionResourceDependencies(
      [dep('pr', 'projects/{current-user}/')],
      [Type.Files],
    );
    expect(entries).toEqual([]);
    expect(preserved.map((item) => item.linkId)).toEqual(['pr']);
  });

  it('round-trips a Projects entry with read and write and its stored link id', () => {
    const stored = [dep('keep-pr', 'projects/{current-user}/', [Read, Write])];
    const { entries } = partitionResourceDependencies(stored);
    expect(entries).toEqual([
      { contentType: Type.Projects, accessLevel: Level.ReadWrite },
    ]);
    const merged = mergeApplicationAccess(stored, entries);
    expect(areResourceDependenciesEqual(merged, stored)).toBe(true);
    expect(merged[0].linkId).toBe('keep-pr');
  });

  it('builds a new Projects entry as projects/{current-user}/', () => {
    expect(
      mergeApplicationAccess(
        [],
        [{ contentType: Type.Projects, accessLevel: Level.Read }],
      ),
    ).toEqual([
      {
        linkId: 'access-projects',
        target: { url: 'projects/{current-user}/' },
        access: [Read],
        required: false,
      },
    ]);
  });

  it('preserves a type the host does not offer', () => {
    const { entries, preserved } = partitionResourceDependencies(
      [FILES, dep('s', 'skills/{current-user}/')],
      [Type.Files],
    );
    expect(entries).toHaveLength(1);
    expect(preserved.map((item) => item.linkId)).toEqual(['s']);
  });

  it('preserves write on applications and toolsets', () => {
    const { entries, preserved } = partitionResourceDependencies([
      dep('a', 'applications/{current-user}/', [Read, Write]),
      dep('t', 'toolsets/{current-user}/', [Read]),
    ]);
    expect(entries).toEqual([
      { contentType: Type.Toolsets, accessLevel: Level.Read },
    ]);
    expect(preserved.map((item) => item.linkId)).toEqual(['a']);
  });
});

describe('mergeApplicationAccess', () => {
  const stored = [FILES, POLICIES];

  it('returns an unchanged mixed list in its original order', () => {
    const { entries } = partitionResourceDependencies(stored);
    const merged = mergeApplicationAccess(stored, entries);
    expect(areResourceDependenciesEqual(merged, stored)).toBe(true);
    expect(merged.map((item) => item.linkId)).toEqual(['f', 'p']);
  });

  it('round-trips an entry with its stored link id', () => {
    const merged = mergeApplicationAccess(
      [dep('keep-me', 'prompts/{current-user}/', [Read, Write])],
      [{ contentType: Type.Prompts, accessLevel: Level.ReadWrite }],
    );
    expect(merged).toEqual([
      {
        linkId: 'keep-me',
        target: { url: 'prompts/{current-user}/' },
        access: [Read, Write],
        required: false,
      },
    ]);
  });

  it('edits an entry in place and never moves a preserved one', () => {
    const merged = mergeApplicationAccess(
      [POLICIES, FILES, dep('s', 'skills/{current-user}/')],
      [
        { contentType: Type.Files, accessLevel: Level.ReadWrite },
        { contentType: Type.Skills, accessLevel: Level.Read },
      ],
    );
    expect(merged.map((item) => item.linkId)).toEqual(['p', 'f', 's']);
    expect(merged[0]).toBe(POLICIES);
    expect(merged[1].access).toEqual([Read, Write]);
  });

  it('drops a removed entry and keeps the others in place', () => {
    const merged = mergeApplicationAccess([FILES, POLICIES], []);
    expect(merged).toEqual([POLICIES]);
  });

  it('appends a new entry last, after preserved ones', () => {
    const merged = mergeApplicationAccess(
      [POLICIES],
      [{ contentType: Type.Prompts, accessLevel: Level.Read }],
    );
    expect(merged.map((item) => item.linkId)).toEqual(['p', 'access-prompts']);
    expect(merged[1]).toEqual({
      linkId: 'access-prompts',
      target: { url: 'prompts/{current-user}/' },
      access: [Read],
      required: false,
    });
  });

  it('suffixes a new link id that collides with a preserved entry', () => {
    const merged = mergeApplicationAccess(
      [
        dep('access-files', 'files/public/x/'),
        dep('access-files-2', 'files/public/y/'),
      ],
      [{ contentType: Type.Files, accessLevel: Level.Read }],
    );
    expect(merged[2].linkId).toBe('access-files-3');
  });

  it('never produces write for applications or toolsets', () => {
    const merged = mergeApplicationAccess(
      [],
      [
        { contentType: Type.Applications, accessLevel: Level.ReadWrite },
        { contentType: Type.Toolsets, accessLevel: Level.ReadWrite },
      ],
    );
    expect(merged.map((item) => item.access)).toEqual([[Read], [Read]]);
  });

  it('keeps only the first entry per type', () => {
    const merged = mergeApplicationAccess(
      [],
      [
        { contentType: Type.Files, accessLevel: Level.Read },
        { contentType: Type.Files, accessLevel: Level.ReadWrite },
      ],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].access).toEqual([Read]);
  });

  it('clears to an empty list when no preserved entry remains', () => {
    expect(mergeApplicationAccess([FILES], [])).toEqual([]);
  });
});

describe('buildApplicationAccessLinkId', () => {
  it('uses access-<type> when free', () => {
    expect(buildApplicationAccessLinkId(Type.Files, new Set())).toBe(
      'access-files',
    );
  });

  it('adds a numeric suffix on collision', () => {
    expect(
      buildApplicationAccessLinkId(
        Type.Files,
        new Set(['access-files', 'access-files-2']),
      ),
    ).toBe('access-files-3');
  });
});

describe('allowed rights', () => {
  it('lists read and write for four types and read only for applications and toolsets', () => {
    for (const type of APPLICATION_ACCESS_CONTENT_TYPES) {
      const isReadOnly = type === Type.Applications || type === Type.Toolsets;
      expect(getAllowedAccessLevels(type)).toEqual(
        isReadOnly ? [Level.Read] : [Level.Read, Level.ReadWrite],
      );
    }
  });

  it('resets to read when the new type does not allow the level', () => {
    expect(
      changeApplicationAccessContentType(
        { contentType: Type.Files, accessLevel: Level.ReadWrite },
        Type.Toolsets,
      ),
    ).toEqual({ contentType: Type.Toolsets, accessLevel: Level.Read });
  });

  it('keeps the level when the new type allows it', () => {
    expect(
      changeApplicationAccessContentType(
        { contentType: Type.Files, accessLevel: Level.ReadWrite },
        Type.Prompts,
      ),
    ).toEqual({ contentType: Type.Prompts, accessLevel: Level.ReadWrite });
  });
});

describe('areResourceDependenciesEqual', () => {
  it('ignores access order and a missing required', () => {
    expect(
      areResourceDependenciesEqual(
        [dep('a', 'files/b/', [Read, Write])],
        [dep('a', 'files/b/', [Write, Read], false)],
      ),
    ).toBe(true);
  });

  it('is sensitive to order, url bytes and rights', () => {
    const a = dep('a', 'files/b/');
    const b = dep('b', 'files/c/');
    expect(areResourceDependenciesEqual([a, b], [b, a])).toBe(false);
    expect(areResourceDependenciesEqual([a], [dep('a', 'files/B/')])).toBe(
      false,
    );
    expect(
      areResourceDependenciesEqual([a], [dep('a', 'files/b/', [Read, Write])]),
    ).toBe(false);
  });
});
