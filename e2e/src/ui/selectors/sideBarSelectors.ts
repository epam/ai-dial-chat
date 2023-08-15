import { Attributes, Tags } from '@/e2e/src/ui/domData';

export const SideBarSelectors = {
  chatBar: '[data-qa="sidebar"].fixed.left-0',
  promptBar: '[data-qa="sidebar"].fixed.right-0',
};

export const ChatBarSelectors = {
  newChatButton: '[data-qa="new-chat"]',
  newFolder: '[data-qa="create-folder"]',
  conversations: '[data-qa="conversations"]',
  conversation: '[data-qa="conversation"]',
  chatFolders: '[data-qa="chat-folders"]',
  chatFolder: '[data-qa="chat-folder"]',
  dotsMenu: '[aria-haspopup="menu"]',
  actionButton: '[data-qa="action-button"]',
  contextMenu: '[data-qa="context-menu"]',
  dropdownMenu: '[data-qa="dropdown-menu"]',
  renameInput: (value: string) =>
    `${Tags.input}[${Attributes.value}="${value}"]`,
  chronology: '[data-qa="chronology"]',
};
