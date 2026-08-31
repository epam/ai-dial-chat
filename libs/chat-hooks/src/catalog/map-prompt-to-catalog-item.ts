import {
  type CatalogItemOverview,
  type CatalogItem,
  type OverviewSpec,
} from '@epam/ai-dial-catalog';
import type { PromptResponseDto } from '@epam/ai-dial-chat-api-client';
import { CatalogEntityType, formatLastUsed } from '@epam/ai-dial-chat-shared';
import { PromptSource } from '../prompt/prompt-resource';
import { formatCalendarDate } from '../shared/formatting';
import { safeDecodeURIComponent } from '../shared/string-utils';
import type { DeploymentFolderLabels } from './map-deployment-to-catalog-item';

const SOURCE_FOLDER_LABEL: Record<PromptSource, keyof DeploymentFolderLabels> =
  {
    [PromptSource.Personal]: 'personal',
    [PromptSource.SharedWithMe]: 'shared',
    [PromptSource.Public]: 'public',
  };

const resolvePromptFolder = (
  folderId: string,
  source: PromptSource,
  folderLabels: DeploymentFolderLabels,
): string[] => [
  folderLabels[SOURCE_FOLDER_LABEL[source]],
  ...folderId.split('/').filter(Boolean).map(safeDecodeURIComponent),
];

/** Translated labels for the Overview tab's author/updated rows and section title. */
export interface PromptOverviewLabels {
  authorLabel: string;
  updatedLabel: string;
  sectionTitle: string;
}

/**
 * Builds the Overview tab data for a prompt: who authored it and when it last
 * changed. The description is not repeated here — the Details tab already
 * shows it above the body.
 */
export const buildPromptOverview = (
  prompt: PromptResponseDto,
  labels: PromptOverviewLabels,
): CatalogItemOverview => {
  const specs: OverviewSpec[] = [];

  /* DIAL Core omits the author on resources written before it tracked one. */
  if (prompt.author) {
    specs.push({ label: labels.authorLabel, value: prompt.author });
  }
  specs.push({
    label: labels.updatedLabel,
    value: formatCalendarDate(prompt.updatedAt),
  });

  return { sections: [{ title: labels.sectionTitle, specs }] };
};

/**
 * Whether a prompt item came from the organisation namespace, which the public
 * prompt endpoints serve. Personal prompts resolve through the caller's own
 * bucket, while shared prompts carry their owner's bucket in the resource URL.
 */
export const isOrganisationPromptItem = (item: CatalogItem): boolean =>
  !item.isMyApp && !item.sharedWithMe;

/** Parameters for {@link mapPromptToCatalogItem}. */
export interface MapPromptToCatalogItemOptions {
  /** Personal/Shared/Public folder labels; i18n stays at the app edge. */
  folderLabels: DeploymentFolderLabels;
  /** Author/updated/section-title labels for the Overview tab; i18n stays at the app edge. */
  overviewLabels: PromptOverviewLabels;
  /** Namespace the prompt came from; drives ownership flags and the folder prefix. */
  source: PromptSource;
  /** Favorited resource ids from the user config, keyed by prompt path. */
  favoriteIds: ReadonlySet<string>;
}

/**
 * Maps a prompt DTO into a catalog item.
 *
 * `prompt.id` is already the full `prompts/{bucket}/{path}` resource path —
 * the owner bucket for a shared-with-me prompt, the caller's own bucket
 * otherwise — the same shape every other resource type's `CatalogItem.id`
 * carries, so no per-source qualification is needed here.
 */
export const mapPromptToCatalogItem = (
  prompt: PromptResponseDto,
  {
    folderLabels,
    overviewLabels,
    source,
    favoriteIds,
  }: MapPromptToCatalogItemOptions,
): CatalogItem => {
  const isPersonal = source === PromptSource.Personal;
  const id = prompt.id;
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
    isMyApp: prompt.isMy ?? isPersonal,
    sharedWithMe: prompt.sharedWithMe ?? source === PromptSource.SharedWithMe,
    isEditable:
      source !== PromptSource.Public && (prompt.canEdit ?? isPersonal),
    folder: resolvePromptFolder(prompt.folderId, source, folderLabels),
    /*
     * `listPrompts` already returns the body, so the details panel can render
     * both tabs before `onFetchDetails` settles; the fetch then refreshes them.
     */
    details: {
      ...(prompt.content
        ? { promptContent: { content: prompt.content } }
        : undefined),
      overview: buildPromptOverview(prompt, overviewLabels),
    },
  };
};
