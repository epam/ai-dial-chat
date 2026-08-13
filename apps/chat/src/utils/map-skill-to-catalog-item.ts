import {
  CatalogEntityType,
  type CatalogContentFile,
  type CatalogItem,
  type CatalogItemOverview,
  type OverviewSection,
  type OverviewSpec,
} from '@epam/ai-dial-catalog';
import {
  SkillMetadataItemDtoNodeTypeEnum,
  type SkillMetadataItemDto,
} from '@epam/ai-dial-chat-api-client';
import { formatLastUsed } from '@epam/ai-dial-chat-shared';
import type { TFunction } from 'i18next';
import { CatalogI18nKeys } from '../constants/translation-keys';
import {
  SKILL_MANIFEST_FILE,
  SKILL_MANIFEST_MAX_BYTES,
  SkillSource,
  type SkillAboutDetails,
} from '../types/skill';
import { safeDecodeURIComponent } from './string-utils';

const SOURCE_FOLDER_KEY: Record<SkillSource, CatalogI18nKeys> = {
  [SkillSource.Personal]: CatalogI18nKeys.FolderPersonal,
  [SkillSource.Public]: CatalogI18nKeys.FolderPublic,
};

const resolveSkillFolder = (
  parentPath: string | undefined,
  source: SkillSource,
  t: TFunction,
): string[] => [
  t(SOURCE_FOLDER_KEY[source]),
  ...(parentPath ?? '').split('/').filter(Boolean).map(safeDecodeURIComponent),
];

export interface MapSkillToCatalogItemOptions {
  /** Resolves the Personal/Public folder label; i18n stays at the app edge. */
  t: TFunction;
  /** Namespace the skill came from; drives ownership flags and the folder prefix. */
  source: SkillSource;
  /** Favorited resource ids from the user config, keyed by skill resource URL. */
  favoriteIds: ReadonlySet<string>;
}

/**
 * Maps a skill's DIAL Core metadata into a catalog item. The full
 * `skills/{bucket}/{path}` resource URL is used as `CatalogItem.id` rather
 * than the bucket-relative path: the catalog lists two buckets, and the same
 * relative path can exist in both.
 */
export const mapSkillToCatalogItem = (
  skill: SkillMetadataItemDto,
  { t, source, favoriteIds }: MapSkillToCatalogItemOptions,
): CatalogItem => {
  const isFavorite = favoriteIds.has(skill.url);

  return {
    id: skill.url,
    type: CatalogEntityType.Skill,
    name: skill.name,
    /* Skill metadata carries no description — the manifest does, and it is read lazily. */
    description: '',
    /* Skills are unversioned — the metadata exposes no version field. */
    version: '',
    lastUsed: formatLastUsed(skill.updatedAt),
    createdAt: skill.createdAt,
    updatedAt: skill.updatedAt,
    isFeatured: false,
    isHidden: false,
    /* The skills API exposes no topics, so there is nothing to filter on. */
    topics: [],
    isUserFavorite: isFavorite,
    isStarred: isFavorite,
    isMyApp: source === SkillSource.Personal,
    /* No shared-skill listing endpoint exists, so a skill is never shared-with-me. */
    sharedWithMe: false,
    /* Skills are read-only in the catalog; no mutating action is wired up. */
    isEditable: false,
    folder: resolveSkillFolder(skill.parentPath, source, t),
  };
};

/** Joins a frontmatter list into one spec value, matching the deployment mappers. */
const joinSpecList = (values: string[]): string => values.join(' · ');

const buildSpecificationSection = (
  about: SkillAboutDetails | undefined,
  t: TFunction,
): OverviewSection | null => {
  if (about == null) return null;

  const specs: OverviewSpec[] = [];

  if (about.whenToUse != null) {
    specs.push({
      label: t(CatalogI18nKeys.DetailsSkillWhenToUse),
      value: about.whenToUse,
    });
  }
  if (about.allowedTools?.length) {
    specs.push({
      label: t(CatalogI18nKeys.DetailsSkillAllowedTools),
      value: joinSpecList(about.allowedTools),
    });
  }
  if (about.bundledResources?.length) {
    specs.push({
      label: t(CatalogI18nKeys.DetailsSkillBundledResources),
      value: joinSpecList(about.bundledResources),
    });
  }

  /*
   * `about.skillPrompt` is deliberately not rendered: it repeats the manifest
   * body the Content tab already shows in full.
   */
  if (specs.length === 0) return null;

  return {
    title: t(CatalogI18nKeys.DetailsSkillSpecificationSection),
    specs,
  };
};

/** Keeps only real files — grouping folders are not part of a skill's inventory. */
const selectFileItems = (
  files: SkillMetadataItemDto[],
): SkillMetadataItemDto[] =>
  files.filter(
    (file) => file.nodeType === SkillMetadataItemDtoNodeTypeEnum.Item,
  );

/**
 * Builds the Overview tab data for a skill: a Specification section from its
 * parsed manifest frontmatter, followed by a Details section covering who
 * authored it, when it last changed, and its file inventory. Grouping folders
 * in the file listing are excluded from both the count and the rows. Sizes are
 * not shown — the skill metadata carries no content-length field.
 */
export const buildSkillOverview = (
  skill: SkillMetadataItemDto | undefined,
  files: SkillMetadataItemDto[],
  about: SkillAboutDetails | undefined,
  t: TFunction,
): CatalogItemOverview => {
  const sections: OverviewSection[] = [];

  const specification = buildSpecificationSection(about, t);
  if (specification != null) sections.push(specification);

  const specs: OverviewSpec[] = [];

  /* DIAL Core omits the author on resources written before it tracked one. */
  if (skill?.author) {
    specs.push({
      label: t(CatalogI18nKeys.DetailsSkillAuthor),
      value: skill.author,
    });
  }
  specs.push({
    label: t(CatalogI18nKeys.DetailsSkillUpdated),
    value: formatLastUsed(skill?.updatedAt),
  });

  specs.push({
    label: t(CatalogI18nKeys.DetailsSkillFileCount),
    value: String(selectFileItems(files).length),
  });

  sections.push({ title: t(CatalogI18nKeys.DetailsSkillSection), specs });

  return { sections };
};

/**
 * Builds the Content tab's file options for a skill. Each option's `id` is the
 * listing entry's own path, so it round-trips back to `downloadSkillFile`
 * without being re-derived, and the manifest is listed first — it is the file
 * the panel opens on.
 */
export const buildSkillContentFiles = (
  files: SkillMetadataItemDto[],
): CatalogContentFile[] =>
  selectFileItems(files)
    .map((file) => ({ id: file.path, name: file.path }))
    .sort((a, b) => {
      if (a.id === SKILL_MANIFEST_FILE) return -1;
      if (b.id === SKILL_MANIFEST_FILE) return 1;
      return a.name.localeCompare(b.name);
    });

/**
 * Reads a skill manifest response as text, or `null` when the body is larger
 * than `SKILL_MANIFEST_MAX_BYTES`. The size is checked before decoding, so an
 * oversized manifest is never turned into a string.
 */
export const readSkillManifest = async (
  response: Response,
): Promise<string | null> => {
  const declaredLength = Number(response.headers.get('content-length'));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > SKILL_MANIFEST_MAX_BYTES
  ) {
    return null;
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > SKILL_MANIFEST_MAX_BYTES) return null;

  return new TextDecoder().decode(buffer);
};
