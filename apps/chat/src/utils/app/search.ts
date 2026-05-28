import { Conversation } from '@/src/types/chat';
import { DialFile } from '@/src/types/files';
import { DialAIEntity } from '@/src/types/models';
import { Prompt } from '@/src/types/prompt';
import { EntityFilter, EntityFilters, SearchFilters } from '@/src/types/search';

import { getOpenAIEntityFullName } from './conversation';
import { getConversationRootId, getFileRootId, getPromptRootId } from './id';

import {
  ConversationInfo,
  ShareEntity,
  ShareInterface,
} from '@epam/ai-dial-shared';
import { IFuseOptions } from 'fuse.js';

export const doesEntityContainSearchTerm = (
  entity: { name: string },
  searchTerm: string,
) => {
  return entity.name
    .toLowerCase()
    .trim()
    .includes(searchTerm.toLowerCase().trim());
};

export const isHiddenEntity = (entity: { name?: string; path?: string }) => {
  if (entity.path) {
    return entity.path.split('/').some((part) => part.startsWith('.'));
  }
  return !!entity?.name?.startsWith('.');
};

export const isHiddenPath = (path: string) =>
  path.split('/').some((segment) => segment.startsWith('.'));

export const isSearchTermMatched = (entity: ShareEntity, searchTerm?: string) =>
  !searchTerm || doesEntityContainSearchTerm(entity, searchTerm);

export const doesOpenAIEntityContainSearchTerm = (
  model: DialAIEntity,
  searchTerm: string,
) => getOpenAIEntityFullName(model).toLowerCase().trim().includes(searchTerm);

export const doesEntityContainSearchItem = <
  T extends Conversation | Prompt | DialFile,
>(
  item: T,
  searchTerm: string,
) => {
  if (!searchTerm) {
    return true;
  }

  if ((item as DialFile).contentType || (item as ShareEntity).name) {
    return doesEntityContainSearchTerm(item, searchTerm);
  }

  return false;
};

export const TrueFilter: EntityFilter<ShareInterface> = () => true;

export const SharedWithMeFilter: EntityFilter<ShareInterface> = (item) =>
  !!item.sharedWithMe;

const MyItemFilter: EntityFilter<ShareEntity> = (item) =>
  item.folderId === getConversationRootId() ||
  item.folderId === getPromptRootId() ||
  item.folderId === getFileRootId();

export const SharedWithMeFilters: EntityFilters = {
  searchFilter: TrueFilter,
  sectionFilter: SharedWithMeFilter,
};

const SharedByMeFilter: EntityFilter<ShareInterface> = (item) =>
  !!item.isShared;

export const PublishedWithMeFilter: EntityFilters = {
  searchFilter: TrueFilter,
  sectionFilter: (item) => !!item.publishedWithMe,
  versionFilter: (item, version) => item.publicationInfo?.version === version,
};

const PublishedByMeFilter: EntityFilter<ShareInterface> = (item) =>
  !!item.isPublished;

export const NotReplayFilter: EntityFilter<ConversationInfo> = (conv) =>
  !conv.isReplay;

export const getNewSearchFiltersValue = (
  filter: SearchFilters,
  value: SearchFilters,
  selected: boolean,
) => (!selected ? filter & ~value : filter | value);

export const isSearchFilterSelected = (
  filter: SearchFilters,
  value: SearchFilters,
) => (filter & value) === value;

const getMyItemsFilter = (
  searchFilters: SearchFilters,
): EntityFilter<ShareEntity> => {
  const itemFilters: EntityFilter<ShareEntity>[] = [];
  if (isSearchFilterSelected(searchFilters, SearchFilters.SharedByMe)) {
    itemFilters.push(SharedByMeFilter);
  }
  if (isSearchFilterSelected(searchFilters, SearchFilters.PublishedByMe)) {
    itemFilters.push(PublishedByMeFilter);
  }
  if (!itemFilters.length) return TrueFilter;

  return (item: ShareEntity) => itemFilters.some((filter) => filter(item));
};

export const getMyItemsFilters = (
  searchFilters: SearchFilters = SearchFilters.None,
): EntityFilters => ({
  searchFilter: getMyItemsFilter(searchFilters),
  sectionFilter: MyItemFilter,
});

export const defaultMyItemsFilters = getMyItemsFilters();

export const getEntitySearchOptions = <T>(): IFuseOptions<T> => ({
  keys: ['name', 'version'],
  threshold: 0.2,
  distance: 100,
  minMatchCharLength: 1,
  ignoreLocation: true,
  useExtendedSearch: false,
  findAllMatches: false,
  isCaseSensitive: false,
  includeScore: false,
});
