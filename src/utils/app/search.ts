import { Conversation } from '@/src/types/chat';
import { EntityFilter } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { OpenAIEntityAddon, OpenAIEntityModel } from '@/src/types/openai';
import { Prompt } from '@/src/types/prompt';

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

//TODO: for development purpose - emulate immediate sharing with yourself
export const PinnedItemsFilter: EntityFilter<Conversation | Prompt> = (_item) =>
  true; // !item.sharedWithMe;

export const SharedWithMeFilter: EntityFilter<Conversation | Prompt> = (item) =>
  !!item.sharedWithMe;

export const SharedByMeFilter: EntityFilter<Conversation | Prompt> = (item) =>
  !!item.isShared;
