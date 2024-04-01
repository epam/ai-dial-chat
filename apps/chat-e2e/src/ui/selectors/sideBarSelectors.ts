import { Attributes, Tags } from '@/src/ui/domData';

export const SideBarSelectors = {
  chatBar: '[data-qa="chatbar"]',
  promptBar: '[data-qa="promptbar"]',
  newEntity: '[data-qa="new-entity"]',
  folder: '[data-qa="folder"]',
  folderGroup: '#folder',
  folderName: '[data-qa="folder-name"]',
  dotsMenu: '[aria-haspopup="menu"]',
  renameInput: (value: string) =>
    `${Tags.input}[${Attributes.value}="${value}"]`,
  renameDefaultNameInput: (value: string) =>
    `${Tags.input}[${Attributes.value}^="${value}"]`,
  dropdownMenu: '[data-qa="dropdown-menu"]',
  import: '[data-qa="import"]',
  export: '[data-qa="export"]',
  deleteEntities: '[data-qa="delete-entities"]',
  draggableArea: '[data-qa="draggable-area"]',
  chronology: '[data-qa="chronology"]',
  newFolder: '[data-qa="create-folder"]',
  resizeIcon: '[data-qa="resize-icon"]',
  bottomPanel: '[data-qa="bottom-panel"]',
  arrowAdditionalIcon: '[data-qa="arrow-icon"]',
  search: '[data-qa="search"]',
  filterMenuTrigger: '[data-qa="menu-trigger"]',
  folderSeparator: '.h-1',
};

export const ChatBarSelectors = {
  deleteConversations: '[data-qa="delete-conversations"]',
  compare: '[data-qa="compare"]',
  attachments: '[data-qa="attachments"]',
  conversations: '[data-qa="conversations"]',
  conversation: '[data-qa="conversation"]',
  conversationName: '[data-qa="conversation-name"]',
  chatFolders: '[data-qa="chat-folders"]',
  actionButton: '[data-qa="action-button"]',
  exportConversations: '[data-qa="export-conversations"]',
  exportPrompts: '[data-qa="export-prompts"]',
  pinnedChats: () =>
    `${ChatBarSelectors.chatFolders} > [data-qa="pinned-chats-container"]`,
  sharedWithMeChats: () =>
    `${ChatBarSelectors.chatFolders} > [data-qa="shared-with-me-container"]`,
};

export const PromptBarSelectors = {
  newFolder: '[data-qa="create-prompt-folder"]',
  promptFolders: '[data-qa="prompt-folders"]',
  newPromptButton: '[data-qa="new-prompt"]',
  prompts: '[data-qa="prompts"]',
  prompt: '[data-qa="prompt"]',
  deletePrompts: '[data-qa="delete-prompts"]',
  leftResizeIcon: '[data-qa="left-resize-icon"]',
};
