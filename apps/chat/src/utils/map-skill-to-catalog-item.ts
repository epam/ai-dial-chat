import {
  type CatalogItem,
  type CatalogItemOverview,
  type OverviewSpec,
} from '@epam/ai-dial-catalog';
import {
  SkillMetadataItemDtoNodeTypeEnum,
  type SkillMetadataItemDto,
} from '@epam/ai-dial-chat-api-client';
import { CatalogEntityType, formatLastUsed } from '@epam/ai-dial-chat-shared';
import type { TFunction } from 'i18next';
import { CatalogI18nKeys } from '../constants/translation-keys';
import { SKILL_MANIFEST_MAX_BYTES, SkillSource } from '../types/skill';
import { safeDecodeURIComponent } from './string-utils';

const SOURCE_FOLDER_KEY: Record<SkillSource, CatalogI18nKeys> = {
  [SkillSource.Personal]: CatalogI18nKeys.FolderPersonal,
  [SkillSource.SharedWithMe]: CatalogI18nKeys.FolderShared,
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
  /** Resolves the Personal/Shared/Public folder label; i18n stays at the app edge. */
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
  const isPublic = source === SkillSource.Public;
  const isPersonal = source === SkillSource.Personal;

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
    /* Only the personal namespace can confer ownership; public/shared metadata is untrusted. */
    isMyApp: isPersonal && (skill.isMy ?? true),
    sharedWithMe: skill.sharedWithMe ?? source === SkillSource.SharedWithMe,
    isEditable: !isPublic && (skill.canEdit ?? isPersonal),
    folder: resolveSkillFolder(skill.parentPath, source, t),
  };
};

/**
 * Builds the Overview tab data for a skill: who authored it, when it last
 * changed, and its file inventory. Grouping folders in the file listing are
 * excluded from both the count and the rows. Sizes are not shown — the skill
 * metadata carries no content-length field.
 */
export const buildSkillOverview = (
  skill: SkillMetadataItemDto | undefined,
  files: SkillMetadataItemDto[],
  t: TFunction,
): CatalogItemOverview => {
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

  const fileItems = files.filter(
    (file) => file.nodeType === SkillMetadataItemDtoNodeTypeEnum.Item,
  );
  specs.push({
    label: t(CatalogI18nKeys.DetailsSkillFileCount),
    value: String(fileItems.length),
  });
  specs.push(
    ...fileItems.map((file) => ({
      label: file.path,
      value: formatLastUsed(file.updatedAt),
    })),
  );

  return {
    sections: [{ title: t(CatalogI18nKeys.DetailsSkillSection), specs }],
  };
};

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
