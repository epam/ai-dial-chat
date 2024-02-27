import { Conversation, ConversationInfo } from '@/src/types/chat';
import { ShareEntity } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { OpenAIEntity } from '@/src/types/openai';
import { Prompt, PromptInfo } from '@/src/types/prompt';
import { EntityFilter, EntityFilters, SearchFilters } from '@/src/types/search';
import { ShareInterface } from '@/src/types/share';

import { getOpenAIEntityFullName } from './conversation';
import { getConversationRootId, getPromptRootId, isRootId } from './id';

export const doesPromptOrConversationContainSearchTerm = (
  conversation: ConversationInfo | PromptInfo,
  searchTerm: string,
) => {
  return conversation.name.toLowerCase().includes(searchTerm.toLowerCase());
};

export const doesFileContainSearchTerm = (
  file: DialFile,
  searchTerm: string,
) => {
  return file.name.toLowerCase().includes(searchTerm.toLowerCase());
};

export const doesOpenAIEntityContainSearchTerm = (
  model: OpenAIEntity,
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

  if ('contentType' in item) {
    // DialFile
    return doesFileContainSearchTerm(item, searchTerm);
  } else if ('name' in item) {
    // Conversation or Prompt
    return doesPromptOrConversationContainSearchTerm(item, searchTerm);
  }

  return false;
};

export const TrueFilter: EntityFilter<ShareInterface> = () => true;

export const SharedWithMeFilter: EntityFilter<ShareInterface> = (item) =>
  !!item.sharedWithMe;

export const MyItemFilter: EntityFilter<ShareEntity> = (item) =>
  isRootId(item.folderId) &&
  (item.folderId.startsWith(getConversationRootId()) ||
    item.folderId.startsWith(getPromptRootId()));

export const SharedWithMeFilters: EntityFilters = {
  searchFilter: TrueFilter,
  sectionFilter: SharedWithMeFilter,
};
export const SharedWithMeRootFilters: EntityFilters = {
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
