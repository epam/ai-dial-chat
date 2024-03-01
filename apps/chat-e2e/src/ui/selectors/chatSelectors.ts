import { Rate } from '@/src/testData';
import { Attributes } from '@/src/ui/domData';

export const appContainer = '#theme-main';
export const ChatSelectors = {
  chat: '[data-qa="chat"]',
  spinner: '[data-qa="spinner"]',
  conversationSettingsSelector: '[data-qa="conversation-settings"]',
  entitySelector: '[data-qa="entity-selector"]',
  entitySettings: '[data-qa="entity-settings"]',
  seeFullList: '[data-qa="see-full-list"]',
  recentEntities: '[data-qa="recent"]',
  groupEntity: '[data-qa="group-entity"]',
  groupEntityName: '[data-qa="group-entity-name"]',
  groupEntityDescr: '[data-qa="group-entity-descr"]',
  expandGroupEntity: '[data-qa="expand-group-entity"]',
  systemPrompt: '[data-qa="system-prompt"]',
  message: '[data-qa="message"]',
  messageSpinner: '[data-qa="message-input-spinner"]',
  chatMessages: '[data-qa="chat-messages"]',
  chatMessage: '[data-qa="chat-message"]',
  compareChatMessage: '[data-qa="compare-message-row"]',
  messageIcon: '[data-qa="message-icon"]',
  messageContent: '[data-qa="message-content"]',
  messageStage: '[data-qa="message-stage"]',
  stageLoader: '.animate-spin',
  loadingCursor: '[data-qa="loading-cursor"]',
  temperatureSlider: '[data-qa="temp-slider"]',
  slider: '.temperature-slider',
  addons: '[data-qa="addons"]',
  selectedAddons: '[data-qa="selected-addons"]',
  recentAddons: '[data-qa="recent-addons"]',
  seeAllSelectors: '[data-qa="see-all-addons"]',
  regenerate: '[data-qa="regenerate"]',
  saveAndSubmit: '[data-qa="save-and-submit"]',
  cancelEdit: '[data-qa="cancel"]',
  modelSelector: '[data-qa="model-selector"]',
  listbox: '[role="listbox"]',
  listOptions: '[role="option"]',
  combobox: '[role="combobox"]',
  showAllCheckbox: '[name="showAllCheckbox"]',
  promptList: '[data-qa="prompt-list"]',
  promptOption: '[data-qa="prompt-option"]',
  moreInfo: '[data-qa="more-info"]',
  infoApplication: '[data-qa="info-app"]',
  description: '[data-qa="app-descr"]',
  startReplay: '[data-qa="start-replay"]',
  applyChanges: '[data-qa="apply-changes"]',
  stopGenerating: '[data-qa="stop-generating"]',
  proceedGenerating: '[data-qa="proceed-reply"]',
  chatHeader: '[data-qa="chat-header"]',
  chatTitle: '[data-qa="chat-title"]',
  worldAdditionalIcon: '[data-qa="world-icon"]',
  chatModel: '[data-qa="chat-model"]',
  chatAddons: '[data-qa="chat-addons"]',
  conversationToCompare: '[data-qa="conversation-to-compare"]',
  compareMode: '[data-qa="compare-mode"]',
  playbackContainer: '[data-qa="playback"]',
  playbackAppTitle: '[data-qa="app-name"]',
  playbackChatTitle: '[data-qa="conversation-name"]',
  playbackControl: '[data-qa="playback-control"]',
  leavePlayback: '[data-qa="cancel-playback-mode"]',
  playbackMessage: '[data-qa="playback-message"]',
  playbackNext: '[data-qa="playback-next"]',
  playbackNextDisabled: () =>
    `${ChatSelectors.playbackNext}[${Attributes.disabled}]`,
  playbackPrevious: '[data-qa="playback-prev"]',
  playbackPreviousDisabled: () =>
    `${ChatSelectors.playbackPrevious}[${Attributes.disabled}]`,
  removeFromCompareIcon: '[data-qa="remove-from-compare"]',
  conversationSettingsIcon: '[data-qa="conversation-setting"]',
  clearConversationIcon: '[data-qa="clear-conversation"]',
  replayAsIs: '[data-qa="replay-as-is"]',
  replayAsIsLabel: '[data-qa="info-as-is"]',
  iconAnimation: '.animate-bounce',
  noResultFound: '[data-qa="no-data"]',
  footer: '[data-qa="footer-message"]',
  notAllowedModel: '[data-qa="not-allowed-model-error"]',
  replayOldVersion: '[data-qa="replay-old-version"]',
  sendMessage: '[data-qa="send"]',
  rate: (rate: Rate) => `[data-qa="${rate}"]`,
  chatLoader: '[data-qa="chat-loader"]',
  importExportLoader: '[data-qa="import-export-loader"]',
  stopLoading: '[data-qa="stop-loading"]',
};
