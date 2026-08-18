import {
  CatalogContentNodeType,
  type CatalogContentFolderNode,
  type CatalogContentTreeNode,
  type CatalogItem,
  type CatalogItemOverview,
  type OverviewSection,
  type OverviewSpec,
} from '@epam/ai-dial-catalog';
import {
  SkillMetadataItemDtoNodeTypeEnum,
  type SkillMetadataItemDto,
} from '@epam/ai-dial-chat-api-client';
import { CatalogEntityType, formatLastUsed } from '@epam/ai-dial-chat-shared';
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
 * Resolves the manifest file's opaque listing id across DIAL Core versions.
 * Some return file-relative paths (`SKILL.md`), while others prefix the
 * skill's path and its internal `files` directory. The returned id is kept
 * verbatim so it matches the corresponding tree node exactly.
 */
export const resolveSkillManifestFileId = (
  files: SkillMetadataItemDto[],
  skillPath: string,
): string => {
  const normalizedSkillPath = skillPath.replace(/^\/+|\/+$/g, '');
  const filesRoot = normalizedSkillPath
    ? `${normalizedSkillPath}/files`
    : 'files';
  const manifest = selectFileItems(files).find((file) => {
    const path = file.path.replace(/^\/+|\/+$/g, '');
    return (
      path === SKILL_MANIFEST_FILE ||
      path === `files/${SKILL_MANIFEST_FILE}` ||
      path === `${filesRoot}/${SKILL_MANIFEST_FILE}`
    );
  });

  return manifest?.path ?? SKILL_MANIFEST_FILE;
};

/**
 * Converts an opaque file-listing id into the path expected by the single-file
 * download endpoint. Core may prefix listing paths with the skill path and its
 * internal `files` directory, while the endpoint accepts a path relative to
 * that directory. File-relative ids are returned unchanged.
 */
export const resolveSkillFileDownloadPath = (
  fileId: string,
  skillPath: string,
): string | null => {
  const normalizedFileId = fileId.replace(/^\/+|\/+$/g, '');
  const normalizedSkillPath = skillPath.replace(/^\/+|\/+$/g, '');
  const filesRoot = normalizedSkillPath
    ? `${normalizedSkillPath}/files`
    : 'files';

  if (
    normalizedFileId === '' ||
    normalizedFileId === 'files' ||
    normalizedFileId === filesRoot
  ) {
    return null;
  }

  if (normalizedFileId.startsWith(`${filesRoot}/`)) {
    return normalizedFileId.slice(filesRoot.length + 1);
  }

  if (normalizedFileId.startsWith('files/')) {
    return normalizedFileId.slice('files/'.length);
  }

  return normalizedFileId;
};

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
 * Returns the child-node array a node at `folderPath` should be attached to,
 * creating that folder node — and any missing ancestor between it and the
 * root — the first time a path reaches it. Returns `roots` itself for the
 * empty path (the tree's own root).
 */
const getOrCreateFolderChain = (
  folderPath: string,
  folderNodesByPath: Map<string, CatalogContentFolderNode>,
  roots: CatalogContentTreeNode[],
): CatalogContentTreeNode[] => {
  if (folderPath === '') return roots;

  const existing = folderNodesByPath.get(folderPath);
  if (existing != null) return existing.items;

  const segments = folderPath.split('/');
  const parentPath = segments.slice(0, -1).join('/');
  const parentItems = getOrCreateFolderChain(
    parentPath,
    folderNodesByPath,
    roots,
  );

  const node: CatalogContentFolderNode = {
    type: CatalogContentNodeType.Folder,
    id: folderPath,
    name: segments[segments.length - 1],
    items: [],
  };
  folderNodesByPath.set(folderPath, node);
  parentItems.push(node);
  return node.items;
};

/**
 * Orders a folder's children case-insensitively by name, folders and files
 * interleaved, recursing into every folder. At the root only, the manifest
 * sorts first regardless of name — it is the file the panel opens on.
 */
const sortContentTree = (
  nodes: CatalogContentTreeNode[],
  isRoot: boolean,
): void => {
  nodes.sort((a, b) => {
    if (isRoot) {
      if (a.id === SKILL_MANIFEST_FILE) return -1;
      if (b.id === SKILL_MANIFEST_FILE) return 1;
    }
    return a.name.localeCompare(b.name);
  });
  for (const node of nodes) {
    if (node.type === CatalogContentNodeType.Folder) {
      sortContentTree(node.items, false);
    }
  }
};

/**
 * Builds the Content tab's hierarchical file tree for a skill from
 * `listSkillFiles({ recursive: true })`'s flat listing. Every folder entry is
 * attached under its own path so an empty grouping folder still appears;
 * every file entry attaches under the folder chain its own path implies,
 * synthesizing any intermediate folder the listing never enumerated on its
 * own. A file node's `id` is the listing entry's own path, so it round-trips
 * back to `downloadSkillFile` without being re-derived; a folder node's `id`
 * only keys client-side expand/collapse state.
 */
export const buildSkillContentTree = (
  files: SkillMetadataItemDto[],
): CatalogContentTreeNode[] => {
  const folderNodesByPath = new Map<string, CatalogContentFolderNode>();
  const roots: CatalogContentTreeNode[] = [];

  for (const entry of files) {
    if (entry.nodeType === SkillMetadataItemDtoNodeTypeEnum.Folder) {
      getOrCreateFolderChain(entry.path, folderNodesByPath, roots);
      continue;
    }

    const lastSlash = entry.path.lastIndexOf('/');
    const parentPath = lastSlash === -1 ? '' : entry.path.slice(0, lastSlash);
    const parentItems = getOrCreateFolderChain(
      parentPath,
      folderNodesByPath,
      roots,
    );
    parentItems.push({
      type: CatalogContentNodeType.File,
      id: entry.path,
      name: entry.name,
    });
  }

  sortContentTree(roots, true);
  return roots;
};

/**
 * Reads a skill file response as raw bytes, or `null` when the body is
 * larger than `SKILL_MANIFEST_MAX_BYTES`. The declared `content-length` is
 * checked first so an oversized body is never read into memory at all; the
 * actual byte length is checked again after reading, for a response with no
 * (or an inaccurate) declared length. Applies identically to every skill
 * file, text or binary — not only `SKILL.md`.
 */
export const readSkillFileBytes = async (
  response: Response,
): Promise<Uint8Array | null> => {
  const declaredLength = Number(response.headers.get('content-length'));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > SKILL_MANIFEST_MAX_BYTES
  ) {
    return null;
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > SKILL_MANIFEST_MAX_BYTES) return null;

  return new Uint8Array(buffer);
};

/**
 * Reads a skill manifest response as text, or `null` when the body is larger
 * than `SKILL_MANIFEST_MAX_BYTES`. The size is checked before decoding, so an
 * oversized manifest is never turned into a string.
 */
export const readSkillManifest = async (
  response: Response,
): Promise<string | null> => {
  const bytes = await readSkillFileBytes(response);
  if (bytes == null) return null;

  return new TextDecoder().decode(bytes);
};
