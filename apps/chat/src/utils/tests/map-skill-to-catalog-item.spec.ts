import { CatalogContentNodeType } from '@epam/ai-dial-catalog';
import {
  SkillMetadataItemDtoNodeTypeEnum,
  type SkillMetadataItemDto,
} from '@epam/ai-dial-chat-api-client';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import type { TFunction } from 'i18next';
import { describe, expect, it, vi } from 'vitest';
import { CatalogI18nKeys } from '../../constants/translation-keys';
import { SKILL_MANIFEST_MAX_BYTES, SkillSource } from '../../types/skill';
import {
  buildSkillContentTree,
  buildSkillOverview,
  mapSkillToCatalogItem,
  readSkillFileBytes,
  readSkillManifest,
  resolveSkillFileDownloadPath,
  resolveSkillManifestFileId,
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
  makeSkill({
    name: path.includes('/') ? path.slice(path.lastIndexOf('/') + 1) : path,
    path,
    nodeType,
    url: `skills/my-bucket/${path}`,
  });

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

describe('buildSkillContentTree', () => {
  const fileNode = (tree: ReturnType<typeof buildSkillContentTree>[number]) =>
    tree.type === CatalogContentNodeType.File ? tree : undefined;
  const folderNode = (
    tree: ReturnType<typeof buildSkillContentTree>[number],
  ) => (tree.type === CatalogContentNodeType.Folder ? tree : undefined);

  it('returns an empty tree for an empty listing', () => {
    expect(buildSkillContentTree([])).toEqual([]);
  });

  it('places a root-level file directly under the root', () => {
    const tree = buildSkillContentTree([makeFile('SKILL.md')]);

    expect(tree).toEqual([
      { type: CatalogContentNodeType.File, id: 'SKILL.md', name: 'SKILL.md' },
    ]);
  });

  it('builds a two-level tree from a flat listing', () => {
    const tree = buildSkillContentTree([
      makeFile('SKILL.md'),
      makeFile('scripts', SkillMetadataItemDtoNodeTypeEnum.Folder),
      makeFile('scripts/run.py'),
    ]);

    const scripts = folderNode(tree.find((node) => node.id === 'scripts')!);
    expect(scripts?.items).toEqual([
      {
        type: CatalogContentNodeType.File,
        id: 'scripts/run.py',
        name: 'run.py',
      },
    ]);
  });

  /* No 'agents' folder entry is ever listed — its own path is implied only by the nested file. */
  it('synthesizes an implicit intermediate folder a nested file implies but the listing never enumerated', () => {
    const tree = buildSkillContentTree([
      makeFile('SKILL.md'),
      makeFile('agents/analyzer.md'),
    ]);

    const agents = folderNode(tree.find((node) => node.id === 'agents')!);
    expect(agents?.name).toBe('agents');
    expect(agents?.items).toEqual([
      {
        type: CatalogContentNodeType.File,
        id: 'agents/analyzer.md',
        name: 'analyzer.md',
      },
    ]);
  });

  it('still shows an explicit empty folder entry, with no items', () => {
    const tree = buildSkillContentTree([
      makeFile('SKILL.md'),
      makeFile('assets', SkillMetadataItemDtoNodeTypeEnum.Folder),
    ]);

    const assets = folderNode(tree.find((node) => node.id === 'assets')!);
    expect(assets?.items).toEqual([]);
  });

  it('keeps two same-named files in different folders as distinct nodes', () => {
    const tree = buildSkillContentTree([
      makeFile('SKILL.md'),
      makeFile('a/run.py'),
      makeFile('b/run.py'),
    ]);

    const a = folderNode(tree.find((node) => node.id === 'a')!);
    const b = folderNode(tree.find((node) => node.id === 'b')!);
    expect(fileNode(a!.items[0])?.id).toBe('a/run.py');
    expect(fileNode(b!.items[0])?.id).toBe('b/run.py');
  });

  /* The manifest is the file the panel opens on, so it heads the root regardless of name. */
  it('sorts the manifest first at the root, then the rest alphabetically', () => {
    const tree = buildSkillContentTree([
      makeFile('scripts', SkillMetadataItemDtoNodeTypeEnum.Folder),
      makeFile('analyzer.md'),
      makeFile('SKILL.md'),
    ]);

    expect(tree.map((node) => node.id)).toEqual([
      'SKILL.md',
      'analyzer.md',
      'scripts',
    ]);
  });

  it('never mistakes a grouping folder for a file', () => {
    const tree = buildSkillContentTree([
      makeFile('SKILL.md'),
      makeFile('scripts', SkillMetadataItemDtoNodeTypeEnum.Folder),
    ]);

    const scripts = tree.find((node) => node.id === 'scripts');
    expect(scripts?.type).toBe(CatalogContentNodeType.Folder);
  });

  /* The id stays opaque until the app-edge download adapter receives it. */
  it('uses the listing entry path verbatim as the file id, through at least one nested level', () => {
    const tree = buildSkillContentTree([makeFile('scripts/run.py')]);

    const scripts = folderNode(tree[0]);
    expect(fileNode(scripts!.items[0])).toEqual({
      type: CatalogContentNodeType.File,
      id: 'scripts/run.py',
      name: 'run.py',
    });
  });
});

describe('resolveSkillFileDownloadPath', () => {
  it('keeps a file-relative nested path unchanged', () => {
    expect(
      resolveSkillFileDownloadPath(
        'scripts/run.py',
        'address-current-branch-review',
      ),
    ).toBe('scripts/run.py');
  });

  it('removes the skill files-root prefix returned by Core', () => {
    expect(
      resolveSkillFileDownloadPath(
        'address-current-branch-review/files/openai.yaml',
        'address-current-branch-review',
      ),
    ).toBe('openai.yaml');
  });

  it('removes a files-root prefix without a skill-path prefix', () => {
    expect(
      resolveSkillFileDownloadPath(
        'files/docs/notes.md',
        'address-current-branch-review',
      ),
    ).toBe('docs/notes.md');
  });

  it('rejects folder-root ids because they are not downloadable files', () => {
    expect(
      resolveSkillFileDownloadPath(
        'address-current-branch-review/files',
        'address-current-branch-review',
      ),
    ).toBeNull();
    expect(
      resolveSkillFileDownloadPath('', 'address-current-branch-review'),
    ).toBeNull();
  });
});

describe('resolveSkillManifestFileId', () => {
  it('keeps a file-relative manifest id unchanged', () => {
    expect(
      resolveSkillManifestFileId([makeFile('SKILL.md')], 'revenue-skill'),
    ).toBe('SKILL.md');
  });

  it('returns the verbatim manifest id when Core prefixes the skill files root', () => {
    const manifestPath = 'team-a/docs-helper/files/SKILL.md';

    expect(
      resolveSkillManifestFileId(
        [makeFile(manifestPath)],
        'team-a/docs-helper',
      ),
    ).toBe(manifestPath);
  });

  it('does not mistake a nested supporting manifest for the base file', () => {
    expect(
      resolveSkillManifestFileId(
        [makeFile('docs/SKILL.md'), makeFile('SKILL.md')],
        'revenue-skill',
      ),
    ).toBe('SKILL.md');
  });
});

describe('readSkillFileBytes', () => {
  it('returns the response body as bytes when within the size cap', async () => {
    const body = 'hello world';
    const response = new Response(body, {
      headers: { 'content-length': String(body.length) },
    });

    const bytes = await readSkillFileBytes(response);

    expect(bytes).not.toBeNull();
    expect(new TextDecoder().decode(bytes!)).toBe(body);
  });

  it('short-circuits before reading when the declared content-length exceeds the cap', async () => {
    const response = new Response('irrelevant', {
      headers: {
        'content-length': String(SKILL_MANIFEST_MAX_BYTES + 1),
      },
    });
    const arrayBufferSpy = vi.spyOn(response, 'arrayBuffer');

    const bytes = await readSkillFileBytes(response);

    expect(bytes).toBeNull();
    expect(arrayBufferSpy).not.toHaveBeenCalled();
  });

  it('rejects an oversized body when no declared length is present', async () => {
    const oversized = 'a'.repeat(SKILL_MANIFEST_MAX_BYTES + 1);
    const response = new Response(oversized);

    const bytes = await readSkillFileBytes(response);

    expect(bytes).toBeNull();
  });
});

describe('readSkillManifest', () => {
  it('decodes the response body as text', async () => {
    const response = new Response('# Instructions', {
      headers: { 'content-length': '14' },
    });

    expect(await readSkillManifest(response)).toBe('# Instructions');
  });

  it('returns null for an oversized manifest, applying the same guard as readSkillFileBytes', async () => {
    const response = new Response('irrelevant', {
      headers: {
        'content-length': String(SKILL_MANIFEST_MAX_BYTES + 1),
      },
    });

    expect(await readSkillManifest(response)).toBeNull();
  });
});
