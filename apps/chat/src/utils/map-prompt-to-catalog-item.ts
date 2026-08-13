import {
  type CatalogItemOverview,
  type CatalogItem,
  type OverviewSpec,
} from '@epam/ai-dial-catalog';
import type { PromptResponseDto } from '@epam/ai-dial-chat-api-client';
import { CatalogEntityType, formatLastUsed } from '@epam/ai-dial-chat-shared';
import type { TFunction } from 'i18next';
import { CatalogI18nKeys } from '../constants/translation-keys';
import { buildPromptResourceUrl, PromptSource } from '../types/prompt';
import { safeDecodeURIComponent } from './string-utils';

const SOURCE_FOLDER_KEY: Record<PromptSource, CatalogI18nKeys> = {
  [PromptSource.Personal]: CatalogI18nKeys.FolderPersonal,
  [PromptSource.SharedWithMe]: CatalogI18nKeys.FolderShared,
  [PromptSource.Public]: CatalogI18nKeys.FolderPublic,
};

const resolvePromptFolder = (
  folderId: string,
  source: PromptSource,
  t: TFunction,
): string[] => [
  t(SOURCE_FOLDER_KEY[source]),
  ...folderId.split('/').filter(Boolean).map(safeDecodeURIComponent),
];

/**
 * Builds the Overview tab data for a prompt: who authored it and when it last
 * changed. The description is not repeated here — the Details tab already
 * shows it above the body.
 */
export const buildPromptOverview = (
  prompt: PromptResponseDto,
  t: TFunction,
): CatalogItemOverview => {
  const specs: OverviewSpec[] = [];

  /* DIAL Core omits the author on resources written before it tracked one. */
  if (prompt.author) {
    specs.push({
      label: t(CatalogI18nKeys.DetailsPromptAuthor),
      value: prompt.author,
    });
  }
  specs.push({
    label: t(CatalogI18nKeys.DetailsPromptUpdated),
    value: formatLastUsed(prompt.updatedAt),
  });

  return {
    sections: [{ title: t(CatalogI18nKeys.DetailsPromptSection), specs }],
  };
};

/**
 * Whether a prompt item came from the organisation namespace, which the public
 * prompt endpoints serve. Personal and shared-with-me prompts both resolve
 * through the caller's own bucket instead.
 */
export const isOrganisationPromptItem = (item: CatalogItem): boolean =>
  !item.isMyApp && !item.sharedWithMe;

export interface MapPromptToCatalogItemOptions {
  /** Resolves the Personal/Shared/Public folder label; i18n stays at the app edge. */
  t: TFunction;
  /** Namespace the prompt came from; drives ownership flags and the folder prefix. */
  source: PromptSource;
  /** Favorited resource ids from the user config, keyed by prompt path. */
  favoriteIds: ReadonlySet<string>;
}

/**
 * Maps a prompt DTO into a catalog item.
 *
 * A personal or organisation prompt uses its DIAL path verbatim as
 * `CatalogItem.id` — its bucket is implied by the endpoint that serves it. A
 * shared-with-me prompt cannot: its path is relative to the *owner's* bucket,
 * so a bare path both collides with a same-named personal prompt and resolves
 * against the caller's own bucket when read back. Those items carry the
 * qualified `prompts/{ownerBucket}/{path}` url instead.
 */
export const mapPromptToCatalogItem = (
  prompt: PromptResponseDto,
  { t, source, favoriteIds }: MapPromptToCatalogItemOptions,
): CatalogItem => {
  const isPersonal = source === PromptSource.Personal;
  const id =
    source === PromptSource.SharedWithMe
      ? buildPromptResourceUrl({ bucket: prompt.bucket, path: prompt.id })
      : prompt.id;
  const isFavorite = favoriteIds.has(id);

  return {
    id,
    type: CatalogEntityType.Prompt,
    name: prompt.name,
    description: prompt.description ?? '',
    /* Prompts are unversioned — the backend exposes no version field. */
    version: '',
    lastUsed: formatLastUsed(prompt.updatedAt),
    createdAt: prompt.createdAt,
    updatedAt: prompt.updatedAt,
    isFeatured: false,
    isHidden: false,
    /* The prompts API exposes no topics, so there is nothing to filter on. */
    topics: [],
    /* Favorites live in the user config's `prompts.installed`, keyed by path. */
    isUserFavorite: isFavorite,
    isStarred: isFavorite,
    isMyApp: isPersonal,
    sharedWithMe: source === PromptSource.SharedWithMe,
    isEditable: isPersonal,
    folder: resolvePromptFolder(prompt.folderId, source, t),
    /*
     * `listPrompts` already returns the body, so the details panel can render
     * both tabs before `onFetchDetails` settles; the fetch then refreshes them.
     */
    details: {
      ...(prompt.content
        ? { promptContent: { content: prompt.content } }
        : undefined),
      overview: buildPromptOverview(prompt, t),
    },
  };
};
