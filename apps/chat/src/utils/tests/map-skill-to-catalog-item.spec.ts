import {
  SkillMetadataItemDtoNodeTypeEnum,
  type SkillMetadataItemDto,
} from '@epam/ai-dial-chat-api-client';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import { CatalogI18nKeys } from '../../constants/translation-keys';
import { SkillSource } from '../../types/skill';
import {
  buildSkillContentFiles,
  buildSkillOverview,
  mapSkillToCatalogItem,
} from '../map-skill-to-catalog-item';

const LABELS: Partial<Record<string, string>> = {
  [CatalogI18nKeys.FolderPersonal]: 'Personal',
  [CatalogI18nKeys.FolderShared]: 'Shared with me',
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

  it('maps a personal skill as owned and editable', () => {
    const item = mapPersonal();

    expect(item.type).toBe(CatalogEntityType.Skill);
    expect(item.isMyApp).toBe(true);
    expect(item.isEditable).toBe(true);
    expect(item.sharedWithMe).toBe(false);
  });

  it('maps a writable shared skill as editable but never owned', () => {
    const item = mapSkillToCatalogItem(
      makeSkill({
        url: 'skills/owner-bucket/revenue-skill',
        isMy: true,
        canEdit: true,
        sharedWithMe: true,
      }),
      { t, source: SkillSource.SharedWithMe, favoriteIds: new Set() },
    );

    expect(item.isMyApp).toBe(false);
    expect(item.sharedWithMe).toBe(true);
    expect(item.isEditable).toBe(true);
    expect(item.folder[0]).toBe('Shared with me');
  });

  it('maps an organisation skill as not owned even when metadata claims ownership', () => {
    const item = mapSkillToCatalogItem(
      makeSkill({
        url: 'skills/public/shared-skill',
        isMy: true,
        canEdit: true,
      }),
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

const makeFile = (
  path: string,
  nodeType: SkillMetadataItemDtoNodeTypeEnum = SkillMetadataItemDtoNodeTypeEnum.Item,
): SkillMetadataItemDto =>
  makeSkill({ name: path, path, nodeType, url: `skills/my-bucket/${path}` });

const readSection = (
  overview: ReturnType<typeof buildSkillOverview>,
  title: string,
) => overview.sections.find((section) => section.title === title);

const specificationOf = (overview: ReturnType<typeof buildSkillOverview>) =>
  readSection(overview, CatalogI18nKeys.DetailsSkillSpecificationSection);

const detailsOf = (overview: ReturnType<typeof buildSkillOverview>) =>
  readSection(overview, CatalogI18nKeys.DetailsSkillSection);

describe('buildSkillOverview', () => {
  it('builds a Specification section from the parsed frontmatter', () => {
    const overview = buildSkillOverview(
      makeSkill(),
      [],
      {
        whenToUse: 'For research tasks',
        allowedTools: ['search', 'fetch'],
        bundledResources: ['scripts/run.py'],
      },
      t,
    );

    expect(specificationOf(overview)?.specs).toEqual([
      {
        label: CatalogI18nKeys.DetailsSkillWhenToUse,
        value: 'For research tasks',
      },
      {
        label: CatalogI18nKeys.DetailsSkillAllowedTools,
        value: 'search · fetch',
      },
      {
        label: CatalogI18nKeys.DetailsSkillBundledResources,
        value: 'scripts/run.py',
      },
    ]);
  });

  it('places Specification before Details', () => {
    const overview = buildSkillOverview(
      makeSkill(),
      [],
      { whenToUse: 'For research' },
      t,
    );

    expect(overview.sections.map((section) => section.title)).toEqual([
      CatalogI18nKeys.DetailsSkillSpecificationSection,
      CatalogI18nKeys.DetailsSkillSection,
    ]);
  });

  it('omits absent Specification rows rather than rendering them empty', () => {
    const overview = buildSkillOverview(
      makeSkill(),
      [],
      { allowedTools: ['search'] },
      t,
    );

    expect(specificationOf(overview)?.specs).toHaveLength(1);
  });

  it('omits the Specification section when no frontmatter resolved', () => {
    const overview = buildSkillOverview(makeSkill(), [], undefined, t);

    expect(specificationOf(overview)).toBeUndefined();
    expect(overview.sections).toHaveLength(1);
  });

  it('omits the Specification section when every about field is empty', () => {
    const overview = buildSkillOverview(
      makeSkill(),
      [],
      { allowedTools: [], bundledResources: [] },
      t,
    );

    expect(specificationOf(overview)).toBeUndefined();
  });

  /* The skill prompt repeats the manifest body the Content tab already shows. */
  it('never renders the skill prompt as a Specification row', () => {
    const overview = buildSkillOverview(
      makeSkill(),
      [],
      { skillPrompt: 'Follow the steps' },
      t,
    );

    expect(specificationOf(overview)).toBeUndefined();
  });

  it('omits the author row when the metadata carries none', () => {
    const overview = buildSkillOverview(makeSkill(), [], undefined, t);

    expect(
      detailsOf(overview)?.specs.some(
        (spec) => spec.label === CatalogI18nKeys.DetailsSkillAuthor,
      ),
    ).toBe(false);
  });

  it('includes the author row when the metadata carries one', () => {
    const overview = buildSkillOverview(
      makeSkill({ author: 'ada' }),
      [],
      undefined,
      t,
    );

    expect(detailsOf(overview)?.specs[0]).toEqual({
      label: CatalogI18nKeys.DetailsSkillAuthor,
      value: 'ada',
    });
  });

  it('counts only files, excluding grouping folders', () => {
    const overview = buildSkillOverview(
      makeSkill(),
      [
        makeFile('SKILL.md'),
        makeFile('scripts', SkillMetadataItemDtoNodeTypeEnum.Folder),
        makeFile('scripts/run.py'),
      ],
      undefined,
      t,
    );

    expect(
      detailsOf(overview)?.specs.find(
        (spec) => spec.label === CatalogI18nKeys.DetailsSkillFileCount,
      )?.value,
    ).toBe('2');
  });

  it('renders no per-file rows — the files live in the Content tab picker', () => {
    const overview = buildSkillOverview(
      makeSkill(),
      [makeFile('SKILL.md'), makeFile('scripts/run.py')],
      undefined,
      t,
    );

    const labels = detailsOf(overview)?.specs.map((spec) => spec.label);
    expect(labels).toEqual([
      CatalogI18nKeys.DetailsSkillUpdated,
      CatalogI18nKeys.DetailsSkillFileCount,
    ]);
  });
});

describe('buildSkillContentFiles', () => {
  it('excludes grouping folders', () => {
    const files = buildSkillContentFiles([
      makeFile('SKILL.md'),
      makeFile('scripts', SkillMetadataItemDtoNodeTypeEnum.Folder),
    ]);

    expect(files).toEqual([{ id: 'SKILL.md', name: 'SKILL.md' }]);
  });

  /* The manifest is the file the panel opens on, so it heads the list. */
  it('lists the manifest first, then the rest alphabetically', () => {
    const files = buildSkillContentFiles([
      makeFile('scripts/run.py'),
      makeFile('analyzer.md'),
      makeFile('SKILL.md'),
    ]);

    expect(files.map((file) => file.id)).toEqual([
      'SKILL.md',
      'analyzer.md',
      'scripts/run.py',
    ]);
  });

  /* The id must round-trip to downloadSkillFile without being re-derived. */
  it('uses the listing entry path verbatim as both id and name', () => {
    const files = buildSkillContentFiles([makeFile('scripts/run.py')]);

    expect(files[0]).toEqual({
      id: 'scripts/run.py',
      name: 'scripts/run.py',
    });
  });

  it('returns no options for an empty listing', () => {
    expect(buildSkillContentFiles([])).toEqual([]);
  });
});
