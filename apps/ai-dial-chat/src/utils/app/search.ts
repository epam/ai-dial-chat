import { Conversation } from '@/src/types/chat';
import { DialFile } from '@/src/types/files';
import { FolderInterface } from '@/src/types/folder';
import { OpenAIEntityAddon, OpenAIEntityModel } from '@/src/types/openai';
import { Prompt } from '@/src/types/prompt';
import { EntityFilter, EntityFilters, SearchFilters } from '@/src/types/search';
import { ShareInterface } from '@/src/types/share';

import { getChildAndCurrentFoldersIdsById } from './folders';

export const doesConversationContainSearchTerm = (
  conversation: Conversation,
  searchTerm: string,
) => {
  return [
    conversation.name,
    ...conversation.messages.map((message) => message.content),
  ]
    .join(' ')
    .toLowerCase()
    .includes(searchTerm.toLowerCase());
};

export const doesPromptContainSearchTerm = (
  prompt: Prompt,
  searchTerm: string,
) => {
  return [prompt.name, prompt.description, prompt.content]
    .join(' ')
    .toLowerCase()
    .includes(searchTerm.toLowerCase());
};

export const doesFileContainSearchTerm = (
  file: DialFile,
  searchTerm: string,
) => {
  return file.name.toLowerCase().includes(searchTerm.toLowerCase());
};

export const doesAddonContainSearchTerm = (
  addon: OpenAIEntityAddon,
  searchTerm: string,
) => {
  return (addon.name || addon.id).toLowerCase().trim().includes(searchTerm);
};

export const doesModelContainSearchTerm = (
  model: OpenAIEntityModel,
  searchTerm: string,
) => model.name.toLowerCase().trim().includes(searchTerm);

export const doesEntityContainSearchItem = <
  T extends Conversation | Prompt | DialFile,
>(
  item: T,
  searchTerm: string,
) => {
  if ('messages' in item) {
    // Conversation
    return doesConversationContainSearchTerm(item, searchTerm);
  } else if ('description' in item) {
    // Prompt
    return doesPromptContainSearchTerm(item, searchTerm);
  } else if ('contentType' in item) {
    // DialFile
    return doesFileContainSearchTerm(item, searchTerm);
  }
  throw new Error('unexpected entity');
};

export const TrueFilter: EntityFilter<ShareInterface> = () => true;

export const MyItemFilter: EntityFilter<ShareInterface> = (item) =>
  !item.sharedWithMe && !item.publishedWithMe;

export const SharedWithMeFilter: EntityFilters = {
  searchFilter: TrueFilter,
  sectionFilter: (item) => !!item.sharedWithMe,
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
): EntityFilter<ShareInterface> => {
  const itemFilters: EntityFilter<ShareInterface>[] = [];
  if (isSearchFilterSelected(searchFilters, SearchFilters.SharedByMe)) {
    itemFilters.push(SharedByMeFilter);
  }
  if (isSearchFilterSelected(searchFilters, SearchFilters.PublishedByMe)) {
    itemFilters.push(PublishedByMeFilter);
  }
  if (!itemFilters.length) return TrueFilter;

  return (item: ShareInterface) => itemFilters.some((filter) => filter(item));
};

export const getMyItemsFilters = (
  searchFilters: SearchFilters = SearchFilters.None,
): EntityFilters => ({
  sectionFilter: MyItemFilter,
  searchFilter: getMyItemsFilter(searchFilters),
});

export const defaultMyItemsFilters = getMyItemsFilters();

export const searchSectionFolders = (
  folders: FolderInterface[],
  filters: EntityFilters,
) => {
  const folderIds = folders // direct parent folders
    .filter((folder) => filters.sectionFilter(folder))
    .map((folder) => folder.id);

  const filteredFolderIds = new Set(
    folderIds.flatMap((fid) => getChildAndCurrentFoldersIdsById(fid, folders)),
  );

  return folders.filter((folder) => filteredFolderIds.has(folder.id));
};
