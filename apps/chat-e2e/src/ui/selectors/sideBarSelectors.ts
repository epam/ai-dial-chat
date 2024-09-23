export const SideBarSelectors = {
  chatBar: '[data-qa="chatbar"]',
  promptBar: '[data-qa="promptbar"]',
  newEntity: '[data-qa="new-entity"]',
  import: '[data-qa="import"]',
  export: '[data-qa="export"]',
  deleteEntities: '[data-qa="delete-entities"]',
  selectAll: '[data-qa="select-all"]',
  unselectAll: '[data-qa="unselect-all"]',
  draggableArea: '[data-qa="draggable-area"]',
  chronology: '[data-qa="chronology-container"]',
  newFolder: '[data-qa="create-folder"]',
  resizeIcon: '[data-qa="resize-icon"]',
  bottomPanel: '[data-qa="bottom-panel"]',
  arrowAdditionalIcon: '[data-qa="arrow-icon"]',
  search: '[data-qa="search"]',
  folderSeparator: '.h-1',
  pinnedEntities: '[data-qa^="pinned"]',
  sharedWithMeContainer: '[data-qa="shared-with-me-container"]',
  approveRequiredContainer: '[data-qa="approve-required-container"]',
  organizationContainer: '[data-qa="published-with-me-container"]',
};

export const ChatBarSelectors = {
  deleteConversations: '[data-qa="delete-conversations"]',
  compare: '[data-qa="compare"]',
  attachments: '[data-qa="attachments"]',
  conversations: '[data-qa="conversations"]',
  selectedEntity: '[data-qa="selected"]',
  chatFolders: '[data-qa="chat-folders"]',
  exportConversations: '[data-qa="export-conversations"]',
  exportPrompts: '[data-qa="export-prompts"]',
  pinnedChats: () =>
    `${ChatBarSelectors.chatFolders} > [data-qa="pinned-chats-container"]`,
  sharedWithMeChats: () =>
    `${ChatBarSelectors.chatFolders} > ${SideBarSelectors.sharedWithMeContainer}`,
  approveRequiredConversations: () =>
    `${ChatBarSelectors.chatFolders} > ${SideBarSelectors.approveRequiredContainer}`,
  organizationConversations: () =>
    `${ChatBarSelectors.chatFolders} > ${SideBarSelectors.organizationContainer}`,
};

export const PromptBarSelectors = {
  newFolder: '[data-qa="create-prompt-folder"]',
  promptFolders: '[data-qa="prompt-folders"]',
  newPromptButton: '[data-qa="new-prompt"]',
  prompts: '[data-qa="prompts-section-container"] >> [data-qa="prompts"]',
  prompt: '[data-qa="prompt"]',
  deletePrompts: '[data-qa="delete-prompts"]',
  pinnedChats: () =>
    `${PromptBarSelectors.promptFolders} > [data-qa="pinned-prompts-container"]`,
  sharedWithMePrompts: () =>
    `${PromptBarSelectors.promptFolders} > ${SideBarSelectors.sharedWithMeContainer}`,
  approveRequiredPrompts: () =>
    `${PromptBarSelectors.promptFolders} > ${SideBarSelectors.approveRequiredContainer}`,
  leftResizeIcon: '[data-qa="left-resize-icon"]',
};

export const EntitySelectors = {
  entityName: '[data-qa="entity-name"]',
  conversation: '[data-qa="conversation"]',
  prompt: '[data-qa="prompt"]',
  file: '[data-qa="file"]',
  application: '[data-qa="application"]',
  version: '[data-qa="version"]',
};

export const PublishEntitySelectors = {
  version: '[data-qa="version"]',
};
