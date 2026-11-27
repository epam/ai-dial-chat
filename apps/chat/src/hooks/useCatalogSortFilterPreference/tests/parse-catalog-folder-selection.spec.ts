import { CatalogFolderRootKind } from '@epam/ai-dial-catalog';
import { describe, expect, it } from 'vitest';
import { parseCatalogFolderSelection } from '../parse-catalog-folder-selection';

describe('parseCatalogFolderSelection', () => {
  it('returns a well-formed selection unchanged', () => {
    expect(
      parseCatalogFolderSelection({
        root: 'organization',
        path: ['Design Assets', 'Icons'],
      }),
    ).toEqual({
      root: CatalogFolderRootKind.Organization,
      path: ['Design Assets', 'Icons'],
    });
  });

  it('returns All entities for a selection without a root', () => {
    expect(parseCatalogFolderSelection({ path: [] })).toEqual({ path: [] });
  });

  it.each([
    ['null', null],
    ['a string', 'personal'],
    ['an unknown root', { root: 'nope', path: [] }],
    ['a non-array path', { root: 'personal', path: 'x' }],
    ['a non-string segment', { root: 'personal', path: [1] }],
    ['a missing path', { root: 'personal' }],
  ])('returns All entities for %s', (_, value) => {
    expect(parseCatalogFolderSelection(value)).toEqual({ path: [] });
  });
});
