import { Conversation, ConversationInfo } from '@/src/types/chat';
import { ShareEntity } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { DialAIEntity } from '@/src/types/models';
import { Prompt } from '@/src/types/prompt';
import { EntityFilter, EntityFilters, SearchFilters } from '@/src/types/search';
import { ShareInterface } from '@/src/types/share';

import { getOpenAIEntityFullName } from './conversation';
import { getConversationRootId, getPromptRootId } from './id';

export const doesEntityContainSearchTerm = (
  entity: ShareEntity,
  searchTerm: string,
) => {
  return entity.name.toLowerCase().includes(searchTerm.toLowerCase());
};

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

export const MyItemFilter: EntityFilter<ShareEntity> = (item) =>
  item.folderId === getConversationRootId() ||
  item.folderId === getPromptRootId(); // only my root items

export const SharedWithMeFilters: EntityFilters = {
  searchFilter: TrueFilter,
  sectionFilter: SharedWithMeFilter,
};

export const SharedByMeFilter: EntityFilter<ShareInterface> = (item) =>
  !!item.isShared;

export const PublishedWithMeFilter: EntityFilters = {
  searchFilter: TrueFilter,
  sectionFilter: (item) => !!item.publishedWithMe,
};

export const PublishedByMeFilter: EntityFilter<ShareInterface> = (item) =>
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

export const getMyItemsFilter = (
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
