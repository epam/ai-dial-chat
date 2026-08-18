import { describe, expect, it } from 'vitest';
import type { CatalogContentTreeNode } from '../models/item-details-data';
import { CatalogContentNodeType } from '../types/catalog-content-node-type';
import { collectAllFolderIds, countFileNodes } from './catalog-content-tree';

const file = (id: string): CatalogContentTreeNode => ({
  type: CatalogContentNodeType.File,
  id,
  name: id,
});

const folder = (
  id: string,
  items: CatalogContentTreeNode[],
): CatalogContentTreeNode => ({
  type: CatalogContentNodeType.Folder,
  id,
  name: id,
  items,
});

describe('countFileNodes', () => {
  it('returns 0 for an empty tree', () => {
    expect(countFileNodes([])).toBe(0);
  });

  it('counts root-level files only', () => {
    expect(countFileNodes([file('a'), file('b')])).toBe(2);
  });

  it('counts files nested inside folders', () => {
    const tree = [file('a'), folder('dir', [file('b'), file('c')])];

    expect(countFileNodes(tree)).toBe(3);
  });

  it('does not count folders themselves', () => {
    expect(countFileNodes([folder('empty', [])])).toBe(0);
  });

  it('counts files across multiple nesting levels', () => {
    const tree = [folder('a', [folder('b', [file('c')])])];

    expect(countFileNodes(tree)).toBe(1);
  });
});

describe('collectAllFolderIds', () => {
  it('returns an empty set for an empty tree', () => {
    expect(collectAllFolderIds([])).toEqual(new Set());
  });

  it('returns an empty set when the tree has no folders', () => {
    expect(collectAllFolderIds([file('a')])).toEqual(new Set());
  });

  it('collects a root-level folder id', () => {
    expect(collectAllFolderIds([folder('dir', [])])).toEqual(new Set(['dir']));
  });

  it('collects nested folder ids at every depth', () => {
    const tree = [folder('a', [folder('b', [file('c')])])];

    expect(collectAllFolderIds(tree)).toEqual(new Set(['a', 'b']));
  });
});
