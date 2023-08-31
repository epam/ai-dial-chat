import { Attributes, Tags } from '@/e2e/src/ui/domData';

export const SideBarSelectors = {
  chatBar: '[data-qa="sidebar"].fixed.left-0',
  promptBar: '[data-qa="sidebar"].fixed.right-0',
  folder: '[data-qa="folder"]',
  dotsMenu: '[aria-haspopup="menu"]',
  renameInput: (value: string) =>
    `${Tags.input}[${Attributes.value}="${value}"]`,
  dropdownMenu: '[data-qa="dropdown-menu"]',
};

export const ChatBarSelectors = {
  newConversationButton: '[data-qa="new-chat"]',
  newFolder: '[data-qa="create-folder"]',
  deleteConversations: '[data-qa="delete-conversations"]',
  conversations: '[data-qa="conversations"]',
  conversation: '[data-qa="conversation"]',
  chatFolders: '[data-qa="chat-folders"]',
  actionButton: '[data-qa="action-button"]',
};

export const PromptBarSelectors = {
  newFolder: '[data-qa="create-prompt-folder"]',
  promptFolders: '[data-qa="prompt-folders"]',
  newPromptButton: '[data-qa="new-prompt"]',
  prompts: '[data-qa="prompts"]',
  prompt: '[data-qa="prompt"]',
  deletePrompts: '[data-qa="delete-prompts"]',
};
