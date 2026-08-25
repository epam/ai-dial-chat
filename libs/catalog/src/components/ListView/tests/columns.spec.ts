import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import { CATALOG_COLUMNS } from '../columns';

describe('CATALOG_COLUMNS', () => {
  it('flexes only the Name column — every other column is a fixed pixel width', () => {
    const columns = CATALOG_COLUMNS(CatalogEntityType.Model);
    const byField = Object.fromEntries(columns.map((c) => [c.field, c]));

    expect(byField.name?.flex).toBe(1);
    expect(byField.name?.width).toBeUndefined();

    expect(byField.type?.flex).toBeUndefined();
    expect(byField.type?.width).toBeTypeOf('number');

    expect(byField.folder?.flex).toBeUndefined();
    expect(byField.folder?.width).toBeTypeOf('number');

    expect(byField.topics?.flex).toBeUndefined();
    expect(byField.topics?.width).toBeTypeOf('number');

    expect(byField.isStarred?.flex).toBeUndefined();
    expect(byField.isStarred?.width).toBe(72);
  });

  it('gives the favorite column a visible header, a fixed width, and right-aligned header text', () => {
    const favColumn = CATALOG_COLUMNS(CatalogEntityType.Model).find(
      (c) => c.field === 'isStarred',
    );

    expect(favColumn?.headerName).toBe('Favorite');
    expect(favColumn?.width).toBe(72);
    expect(favColumn?.resizable).toBe(false);
    expect(favColumn?.headerClass).toBeTruthy();
  });

  it('shows the Folder column for prompts and hides it only for models', () => {
    const folderOf = (type: CatalogEntityType) =>
      CATALOG_COLUMNS(type).find((c) => c.field === 'folder');

    expect(folderOf(CatalogEntityType.Prompt)?.hide).toBe(false);
    expect(folderOf(CatalogEntityType.Model)?.hide).toBe(true);
  });

  it('disables sorting on Type and Tags, but not on Name and Folder', () => {
    const columns = CATALOG_COLUMNS(CatalogEntityType.Model);
    const byField = Object.fromEntries(columns.map((c) => [c.field, c]));

    expect(byField.type?.sortable).toBe(false);
    expect(byField.topics?.sortable).toBe(false);
    expect(byField.name?.sortable).not.toBe(false);
    expect(byField.folder?.sortable).not.toBe(false);
  });
});
