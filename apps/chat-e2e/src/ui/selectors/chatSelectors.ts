import { Rate } from '@/src/testData';
import { Attributes } from '@/src/ui/domData';

export const appContainer = '#theme-main';
export const overlayFrame = '[name="overlay"]';

export const SendMessageSelectors = {
  message: '[data-qa="message"]',
  stopGenerating: '[data-qa="stop-generating"]',
  sendMessage: '[data-qa="send"]',
  scrollDownButton: '[data-qa="scroll-down-button"]',
};

export const ChatSettingsSelectors = {
  conversationSettingsSelector: '[data-qa="conversation-settings"]',
  entitySelector: '[data-qa="entity-selector"]',
  entitySettings: '[data-qa="entity-settings"]',
  seeFullList: '[data-qa="see-full-list"]',
  recentEntities: '[data-qa="recent"]',
  groupEntity: '[data-qa="group-entity"]',
  groupEntityName: '[data-qa="group-entity-name"]',
  groupEntityVersion: '[data-qa="model-version-select-trigger"]',
  groupEntityDescr: '[data-qa="group-entity-descr"]',
  expandGroupEntity: '[data-qa="expand-group-entity"]',
  selectedGroupEntity: '.border-accent-primary',
  systemPrompt: '[data-qa="system-prompt"]',
  temperatureSlider: '[data-qa="temp-slider"]',
  slider: '.temperature-slider',
  addons: '[data-qa="addons"]',
  selectedAddons: '[data-qa="selected-addons"]',
  recentAddons: '[data-qa="recent-addons"]',
  seeAllSelectors: '[data-qa="see-all-addons"]',
  moreInfo: '[data-qa="more-info"]',
  entityInfo: '[data-qa="entity-info"]',
  entityDescription: '[data-qa="entity-descr"]',
  applyChanges: '[data-qa="apply-changes"]',
  playbackButton: '[data-qa="Playback"]',
  replayAsIsButton: '[data-qa="Replay as is"]',
};

export const MessageInputSelectors = {
  textarea: '[data-qa="chat-textarea"]',
  saveAndSubmit: '[data-qa="save-and-submit"]',
  cancelEdit: '[data-qa="cancel"]',
  inputAttachmentsContainer: '[data-qa="attachment-container"]',
  inputAttachment: '[data-qa="chat-attachment"]',
  inputAttachmentName: '[data-qa="attachment-name"]',
};

export const PlaybackSelectors = {
  playbackContainer: '[data-qa="playback"]',
  playbackAppTitle: '[data-qa="app-name"]',
  playbackChatTitle: '[data-qa="conversation-name"]',
  playbackControl: '[data-qa="playback-control"]',
  playbackMessage: '[data-qa="playback-message"]',
  playbackNext: '[data-qa="playback-next"]',
  playbackNextDisabled: () =>
    `${PlaybackSelectors.playbackNext}[${Attributes.disabled}]`,
  playbackPrevious: '[data-qa="playback-prev"]',
  playbackPreviousDisabled: () =>
    `${PlaybackSelectors.playbackPrevious}[${Attributes.disabled}]`,
};

export const ModelControlSelectors = {
  modelSelector: '[data-qa="model-selector"]',
  listbox: '[role="listbox"]',
  listOptions: '[role="option"]',
  combobox: '[role="combobox"]',
};

export const PromptListSelectors = {
  promptList: '[data-qa="prompt-list"]',
  promptOption: '[data-qa="prompt-option"]',
};

export const ReplaySelectors = {
  replayDescription: '[data-qa="replay-descr"]',
  startReplay: '[data-qa="start-replay"]',
  replayAsIs: '[data-qa="replay-as-is"]',
  replayAsIsLabel: '[data-qa="info-as-is"]',
  replayOldVersion: '[data-qa="replay-old-version"]',
};

export const ChatHeaderSelectors = {
  chatHeader: '[data-qa="chat-header"]',
  chatTitle: '[data-qa="chat-title"]',
  chatModel: '[data-qa="chat-model"]',
  chatAddons: '[data-qa="chat-addons"]',
  conversationSettingsIcon: '[data-qa="conversation-setting"]',
  clearConversationIcon: '[data-qa="clear-conversation"]',
  leavePlayback: '[data-qa="cancel-playback-mode"]',
  deleteFromCompareIcon: '[data-qa="delete-from-compare"]',
};

export const CompareSelectors = {
  showAllCheckbox: '[name="showAllCheckbox"]',
  conversationToCompare: '[data-qa="conversation-to-compare"]',
  compareMode: '[data-qa="compare-mode"]',
};

export const ToastSelectors = {
  chatLoader: '[data-qa="chat-loader"]',
  errorToast: '.chat-toast',
  conversationNotFound: '[data-qa="not-found"]',
};

export const ErrorLabelSelectors = {
  noResultFound: '[data-qa="no-data"]',
  notAllowedModel: '[data-qa="not-allowed-model-error"]',
  fieldError: '.text-error',
  errorText: '[data-qa="error-text"]',
};

export const ImportExportSelectors = {
  importExportLoader: '[data-qa="import-export-loader"]',
  stopLoading: '[data-qa="stop-loading"]',
};

export const ChatSelectors = {
  chat: '[data-qa="chat"]',
  spinner: '[data-qa="spinner"]',
  chatMessages: '[data-qa="chat-messages"]',
  chatMessage: '[data-qa="chat-message"]',
  compareChatMessage: '[data-qa="compare-message-row"]',
  messageIcon: '[data-qa="message-icon"]',
  messageContent: '[data-qa="message-content"]',
  messageStage: '[data-qa="message-stage"]',
  openedStage: '[data-qa="stage-opened"]',
  closedStage: '[data-qa="stage-closed"]',
  stageLoader: '.animate-spin',
  loadingCursor: '[data-qa="loading-cursor"]',
  regenerate: '[data-qa="regenerate"]',
  proceedGenerating: '[data-qa="proceed-reply"]',
  iconAnimation: '.animate-bounce',
  footer: '[data-qa="footer-message"]',
  rate: (rate: Rate) => `[data-qa="${rate}"]`,
  codeBlock: '.codeblock',
  duplicate: '[data-qa="duplicate"]',
  chatScrollableArea: '[data-qa="scrollable-area"]',
  attachmentExpanded: '[data-qa="attachment-expanded"]',
  attachmentCollapsed: '[data-qa="attachment-collapsed"]',
  attachmentsGroup: '[data-qa="grouped-attachments"]',
  messageSpinner: '[data-qa="message-input-spinner"]',
  plotlyContainer: '.plot-container',
  maxWidth: '.max-w-none',
  showMore: '[data-qa="show-more"]',
  showLess: '[data-qa="show-less"]',
};

export const TableSelectors = {
  tableContainer: '[data-qa="table"]',
  tableControls: '[data-qa="table-controls"]',
  copyAsCsvIcon: '[data-qa="csv-icon"]',
  copyAsTxtIcon: '[data-qa="txt-icon"]',
  copyAsMdIcon: '[data-qa="md-icon"]',
};
