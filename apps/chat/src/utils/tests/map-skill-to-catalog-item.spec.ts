import { CatalogEntityType } from '@epam/ai-dial-catalog';
import {
  SkillMetadataItemDtoNodeTypeEnum,
  type SkillMetadataItemDto,
} from '@epam/ai-dial-chat-api-client';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import { CatalogI18nKeys } from '../../constants/translation-keys';
import { SkillSource } from '../../types/skill';
import { mapSkillToCatalogItem } from '../map-skill-to-catalog-item';

const LABELS: Partial<Record<string, string>> = {
  [CatalogI18nKeys.FolderPersonal]: 'Personal',
  [CatalogI18nKeys.FolderPublic]: 'Organization',
};

const t = ((key: string) => LABELS[key] ?? key) as unknown as TFunction;

const makeSkill = (
  overrides?: Partial<SkillMetadataItemDto>,
): SkillMetadataItemDto => ({
  name: 'revenue-skill',
  path: 'revenue-skill',
  url: 'skills/my-bucket/revenue-skill',
  bucket: 'my-bucket',
  nodeType: SkillMetadataItemDtoNodeTypeEnum.Item,
  updatedAt: Date.now(),
  ...overrides,
});

const mapPersonal = (
  skill?: Partial<SkillMetadataItemDto>,
  favoriteIds: ReadonlySet<string> = new Set(),
) =>
  mapSkillToCatalogItem(makeSkill(skill), {
    t,
    source: SkillSource.Personal,
    favoriteIds,
  });

describe('mapSkillToCatalogItem', () => {
  it('uses the resource URL as the catalog item id', () => {
    expect(mapPersonal().id).toBe('skills/my-bucket/revenue-skill');
  });

  it('maps a personal skill as owned but not editable', () => {
    const item = mapPersonal();

    expect(item.type).toBe(CatalogEntityType.Skill);
    expect(item.isMyApp).toBe(true);
    expect(item.isEditable).toBe(false);
    expect(item.sharedWithMe).toBe(false);
  });

  it('maps an organisation skill as not owned', () => {
    const item = mapSkillToCatalogItem(
      makeSkill({ url: 'skills/public/shared-skill' }),
      { t, source: SkillSource.Public, favoriteIds: new Set() },
    );

    expect(item.isMyApp).toBe(false);
    expect(item.isEditable).toBe(false);
  });

  it('marks the item favourite when the set contains its resource URL', () => {
    const item = mapPersonal(
      undefined,
      new Set(['skills/my-bucket/revenue-skill']),
    );

    expect(item.isUserFavorite).toBe(true);
    expect(item.isStarred).toBe(true);
  });

  it('leaves the item unstarred when the set does not contain it', () => {
    const item = mapPersonal(undefined, new Set(['skills/other/thing']));

    expect(item.isUserFavorite).toBe(false);
    expect(item.isStarred).toBe(false);
  });

  it('leaves description and version empty rather than fabricating them', () => {
    const item = mapPersonal();

    expect(item.description).toBe('');
    expect(item.version).toBe('');
    expect(item.topics).toEqual([]);
  });

  it('prefixes a nested folder path with the Personal label', () => {
    const item = mapPersonal({ parentPath: 'analysis/finance/' });

    expect(item.folder).toEqual(['Personal', 'analysis', 'finance']);
  });

  it('gives a root-level organisation skill only the Public label', () => {
    const item = mapSkillToCatalogItem(makeSkill({ parentPath: undefined }), {
      t,
      source: SkillSource.Public,
      favoriteIds: new Set(),
    });

    expect(item.folder).toEqual(['Organization']);
  });

  it('decodes percent-encoded folder segments', () => {
    const item = mapPersonal({ parentPath: 'my%20folder/' });

    expect(item.folder).toEqual(['Personal', 'my folder']);
  });

  it('carries the metadata timestamps through for sorting', () => {
    const item = mapPersonal({ createdAt: 1000, updatedAt: 2000 });

    expect(item.createdAt).toBe(1000);
    expect(item.updatedAt).toBe(2000);
  });
});
