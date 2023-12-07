import { Attributes, Tags } from '@/e2e/src/ui/domData';

export const SideBarSelectors = {
  chatBar: '[data-qa="sidebar"].fixed.left-0',
  promptBar: '[data-qa="sidebar"].fixed.right-0',
  folder: '[data-qa="folder"]',
  folderName: '[data-qa="folder-name"]',
  dotsMenu: '[aria-haspopup="menu"]',
  renameInput: (value: string) =>
    `${Tags.input}[${Attributes.value}="${value}"]`,
  dropdownMenu: '[data-qa="dropdown-menu"]',
  import: '[data-qa="import"]',
  draggableArea: '[data-qa="draggable-area"]',
  chronology: '[data-qa="chronology"]',
};

export const ChatBarSelectors = {
  newConversationButton: '[data-qa="new-chat"]',
  newFolder: '[data-qa="create-folder"]',
  deleteConversations: '[data-qa="delete-conversations"]',
  compare: '[data-qa="compare"]',
  conversations: '[data-qa="conversations"]',
  conversation: '[data-qa="conversation"]',
  conversationName: '[data-qa="chat-name"]',
  chatFolders: '[data-qa="chat-folders"]',
  actionButton: '[data-qa="action-button"]',
  exportConversations: '[data-qa="export-conversations"]',
  exportPrompts: '[data-qa="export-prompts"]',
};

export const PromptBarSelectors = {
  newFolder: '[data-qa="create-prompt-folder"]',
  promptFolders: '[data-qa="prompt-folders"]',
  newPromptButton: '[data-qa="new-prompt"]',
  prompts: '[data-qa="prompts"]',
  prompt: '[data-qa="prompt"]',
  deletePrompts: '[data-qa="delete-prompts"]',
};
