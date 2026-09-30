import { describe, expect, it } from 'vitest';
import { SkillAddSource } from '../../types/skill-add-source';
import { SkillFileNodeKind } from '../../types/skill-file-node-kind';
import {
  buildDialFileTree,
  joinSkillPath,
  listChildNames,
  resolveAddTarget,
  validateFolderName,
} from '../file-tree';

describe('buildDialFileTree', () => {
  it('returns a single root-level node for a flat file', () => {
    const tree = buildDialFileTree([
      { path: 'SKILL.md', name: 'SKILL.md', kind: SkillFileNodeKind.File },
    ]);

    expect(tree.map((node) => node.path)).toEqual(['SKILL.md']);
  });

  it('synthesises intermediate folders implied by a deep file path', () => {
    const tree = buildDialFileTree([
      {
        path: 'agents/analyzer.md',
        name: 'analyzer.md',
        kind: SkillFileNodeKind.File,
      },
    ]);

    expect(tree.map((node) => node.path)).toEqual(['agents']);
    expect(tree[0]?.items?.map((node) => node.path)).toEqual([
      'agents/analyzer.md',
    ]);
  });

  it('attaches an explicit folder node to its parent, even without files inside it yet', () => {
    const tree = buildDialFileTree([
      { path: 'assets', name: 'assets', kind: SkillFileNodeKind.Folder },
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0]?.items).toEqual([]);
  });

  it('nests a file under its explicit folder node rather than duplicating it', () => {
    const tree = buildDialFileTree([
      { path: 'assets', name: 'assets', kind: SkillFileNodeKind.Folder },
      {
        path: 'assets/logo.png',
        name: 'logo.png',
        kind: SkillFileNodeKind.File,
      },
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0]?.items?.map((node) => node.path)).toEqual([
      'assets/logo.png',
    ]);
  });
});

describe('resolveAddTarget', () => {
  const folder = { path: 'docs', name: 'docs', kind: SkillFileNodeKind.Folder };
  const nestedFile = {
    path: 'docs/a.md',
    name: 'a.md',
    kind: SkillFileNodeKind.File,
  };
  const rootFile = { path: 'b.md', name: 'b.md', kind: SkillFileNodeKind.File };

  it('targets the root from the header when nothing is selected', () => {
    expect(resolveAddTarget(SkillAddSource.Header, undefined)).toBe('');
  });

  it('targets the selected folder from the header', () => {
    expect(resolveAddTarget(SkillAddSource.Header, folder)).toBe('docs');
  });

  it('targets the root from the header when a file is selected', () => {
    expect(resolveAddTarget(SkillAddSource.Header, nestedFile)).toBe('');
  });

  it('adds a child inside the folder', () => {
    expect(resolveAddTarget(SkillAddSource.Child, folder)).toBe('docs');
  });

  it('adds a sibling next to a nested node', () => {
    expect(resolveAddTarget(SkillAddSource.Sibling, nestedFile)).toBe('docs');
  });

  it('adds a sibling of a top-level node at the root', () => {
    expect(resolveAddTarget(SkillAddSource.Sibling, rootFile)).toBe('');
  });
});

describe('joinSkillPath', () => {
  it('leaves a root-level path unprefixed', () => {
    expect(joinSkillPath('', 'a.md')).toBe('a.md');
  });

  it('prefixes a path with its folder', () => {
    expect(joinSkillPath('docs', 'img/a.png')).toBe('docs/img/a.png');
  });
});

describe('listChildNames', () => {
  it('includes folders implied by deeper paths', () => {
    const names = listChildNames(
      [
        { path: 'docs/img/a.png', name: 'a.png', kind: SkillFileNodeKind.File },
        { path: 'docs/b.md', name: 'b.md', kind: SkillFileNodeKind.File },
        { path: 'c.md', name: 'c.md', kind: SkillFileNodeKind.File },
      ],
      'docs',
    );

    expect([...names].sort()).toEqual(['b.md', 'img']);
  });
});

describe('validateFolderName', () => {
  const messages = {
    required: 'required',
    invalid: 'invalid',
    duplicate: 'duplicate',
  };
  const siblings = new Set(['docs', 'SKILL.md']);

  it.each([
    ['   ', 'required'],
    ['a/b', 'invalid'],
    ['a\\b', 'invalid'],
    ['.', 'invalid'],
    ['..', 'invalid'],
    ['docs', 'duplicate'],
    [' docs ', 'duplicate'],
    ['SKILL.md', 'duplicate'],
  ])('rejects %j with the %s message', (name, expected) => {
    expect(validateFolderName(name, siblings, messages)).toBe(expected);
  });

  it('accepts a new unique name', () => {
    expect(validateFolderName('scripts', siblings, messages)).toBeUndefined();
  });
});
