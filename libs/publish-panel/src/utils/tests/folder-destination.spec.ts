import { describe, expect, it } from 'vitest';
import type { FolderDestinationRoot } from '../../models/folder-destination';
import {
  buildRootedFolderTree,
  fromRootedPath,
  joinRootedKeys,
  splitRootedKeys,
  toRootedPath,
} from '../folder-destination';

const roots: FolderDestinationRoot[] = [
  {
    key: 'personal',
    label: 'Personal',
    items: [
      { path: ['b'], name: 'b' },
      { path: ['A'], name: 'A', children: [{ path: ['A', 'x'], name: 'x' }] },
    ],
  },
  { key: 'organization', label: 'Organization', items: [] },
];

describe('folder-destination', () => {
  it('round-trips a destination through a rooted path', () => {
    const destination = { rootKey: 'personal', path: ['A', 'x'] };
    expect(toRootedPath(destination)).toEqual([':personal', 'A', 'x']);
    expect(fromRootedPath(toRootedPath(destination))).toEqual(destination);
  });

  it('returns undefined for a path without a root token', () => {
    expect(fromRootedPath(['A'])).toBeUndefined();
  });

  it('builds one node per root in order, re-pathing and sorting folders', () => {
    const tree = buildRootedFolderTree(roots);
    expect(tree.map((node) => node.path)).toEqual([
      [':personal'],
      [':organization'],
    ]);
    expect(tree[0].children?.map((node) => node.path)).toEqual([
      [':personal', 'A'],
      [':personal', 'b'],
    ]);
    expect(tree[0].children?.[0].children?.[0].path).toEqual([
      ':personal',
      'A',
      'x',
    ]);
  });

  it('joins and splits per-root keys', () => {
    const joined = joinRootedKeys(roots, (root) =>
      root.key === 'personal' ? new Set(['A', 'A/x']) : new Set(['EPAM']),
    );
    expect(joined).toEqual(
      new Set([':personal/A', ':personal/A/x', ':organization/EPAM']),
    );
    const split = splitRootedKeys(roots, new Set([...joined, ':personal']));
    expect(split.get('personal')).toEqual(new Set(['A', 'A/x']));
    expect(split.get('organization')).toEqual(new Set(['EPAM']));
  });
});
