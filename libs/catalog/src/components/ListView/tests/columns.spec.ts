import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import { CATALOG_COLUMNS } from '../columns';

describe('CATALOG_COLUMNS', () => {
  it('shares spare width between Name, Folder and Tags, Name taking twice the rest', () => {
    const columns = CATALOG_COLUMNS(CatalogEntityType.Model);
    const byField = Object.fromEntries(columns.map((c) => [c.field, c]));

    expect(byField.name?.flex).toBe(2);
    expect(byField.name?.width).toBeUndefined();

    expect(byField.folder?.flex).toBe(1);
    expect(byField.folder?.width).toBeUndefined();

    expect(byField.topics?.flex).toBe(1);
    expect(byField.topics?.width).toBeUndefined();
  });

  it('keeps Type and Favorite at a fixed pixel width', () => {
    const columns = CATALOG_COLUMNS(CatalogEntityType.Model);
    const byField = Object.fromEntries(columns.map((c) => [c.field, c]));

    expect(byField.type?.flex).toBeUndefined();
    expect(byField.type?.width).toBeTypeOf('number');

    expect(byField.isStarred?.flex).toBeUndefined();
    expect(byField.isStarred?.width).toBeTypeOf('number');
  });

  it('gives every flexing column a minimum width to fall back on', () => {
    const columns = CATALOG_COLUMNS(CatalogEntityType.Prompt);

    for (const column of columns.filter((c) => c.flex != null)) {
      expect(column.minWidth).toBeTypeOf('number');
    }
  });

  it('gives the favorite column a visible header, a fixed width, and right-aligned header text', () => {
    const favColumn = CATALOG_COLUMNS(CatalogEntityType.Model).find(
      (c) => c.field === 'isStarred',
    );

    expect(favColumn?.headerName).toBe('Favorite');
    /* Wide enough that the "Favorite" header itself is not truncated. */
    expect(favColumn?.width).toBe(88);
    expect(favColumn?.resizable).toBe(false);
    expect(favColumn?.headerClass).toBeTruthy();
  });

  it('shows the Folder column for prompts and hides it only for models', () => {
    const folderOf = (type: CatalogEntityType) =>
      CATALOG_COLUMNS(type).find((c) => c.field === 'folder');

    expect(folderOf(CatalogEntityType.Prompt)?.hide).toBe(false);
    expect(folderOf(CatalogEntityType.Model)?.hide).toBe(true);
  });

  it('shows the Favorite column by default, independent of isFavoriteVisible', () => {
    const favColumn = CATALOG_COLUMNS(CatalogEntityType.Model).find(
      (c) => c.field === 'isStarred',
    );
    expect(favColumn?.hide).toBeFalsy();
  });

  it('lets columnVisibility hide the Favorite column for a tab', () => {
    const hiddenFavorite = CATALOG_COLUMNS(CatalogEntityType.Model, false, {
      favorite: (type) => type !== CatalogEntityType.Model,
    }).find((c) => c.field === 'isStarred');
    expect(hiddenFavorite?.hide).toBe(true);
  });

  it("lets columnVisibility override the Folder column's default rule", () => {
    const forcedHiddenFolder = CATALOG_COLUMNS(CatalogEntityType.Prompt, false, {
      folder: () => false,
    }).find((c) => c.field === 'folder');
    expect(forcedHiddenFolder?.hide).toBe(true);
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
