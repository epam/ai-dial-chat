import { describe, expect, it } from 'vitest';
import { SkillFileNodeKind } from '../../types/skill-file-node-kind';
import { buildDialFileTree } from '../file-tree';

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
