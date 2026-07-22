import { Rate } from '@/src/testData';
import { Attributes } from '@/src/ui/domData';

export const layoutContainer = '#theme-main';
export const overlayFrame = '[name="overlay"]';

export const SendMessageSelectors = {
  sendMessageContainer: '[data-qa="send-message-container"]',
  stopGenerating: '[data-qa="stop-generating"]',
  proceedGenerating: '[data-qa="proceed-reply"]',
  sendMessage: '[data-qa="send"]',
  scrollDownButton: '[data-qa="scroll-down-button"]',
};

export const ChatSettingsSelectors = {
  entitySelector: '[data-qa="entity-selector"]',
  searchOnMyApplications: '[data-qa="search-on-my-app"]',
  recentEntities: '[data-qa="recent"]',
  talkToEntity: '[data-qa="talk-to-entity"]',
  talkToEntityName: '[data-qa="talk-to-entity-name"]',
  talkToEntityVersion: '[data-qa="version"]',
  talkToEntityDescr: '[data-qa="talk-to-entity-descr"]',
  expandTalkToEntity: '[data-qa="expand-talk-to-entity"]',
  selectedTalkToEntity: '.border-accent-primary',
  agentInfoContainer: '[data-qa="entity-info-container"]',
  agentInfo: '[data-qa="agent-info"]',
  agentName: '[data-qa="entity-name"]',
  agentDescription: '[data-qa="agent-descr"]',
  agentVersion: '[data-qa="version"]',
  agentVersionMenuTrigger: '[data-qa="agent-version-select-trigger"]',
  playbackButton: '[data-qa="Playback"]',
  replayAsIsButton: '[data-qa="Replay as is"]',
  configureSettingsButton: '[data-qa="configure-settings"]',
  changeAgentButton: '[data-qa="change-agent"]',
};

export const MessageInputSelectors = {
  textarea: '[data-qa="chat-textarea"]',
  saveAndSubmit: '[data-qa="save-and-submit"]',
  cancelEdit: '[data-qa="cancel"]',
  inputAttachmentsContainer: '[data-qa="attachment-container"]',
  inputAttachment: '[data-qa="chat-attachment"]',
  inputAttachmentName: '[data-qa="attachment-name"]',
  inputAttachedFolderName: '[data-qa="attached-folder-name"]',
};

export const DislikeCommentModalSelectors = {
  modal: '[data-qa="dislike-comment-modal"]',
  title: '[data-qa="modal-entity-name"]',
  commentInput: '[data-qa="dislike-comment-input"]',
  sendButton: '[data-qa="dislike-send-button"]',
  closeButtonAriaLabel: 'Close dialog',
};

export const PlaybackSelectors = {
  playbackContainer: '[data-qa="playback"]',
  playbackAppTitle: '[data-qa="entity-name"]',
  playbackChatTitle: '[data-qa="conversation-name"]',
  playbackControl: '[data-qa="playback-control"]',
  playbackMessage: '[data-qa="playback-message"]',
  playbackMessageContent: '[data-qa="playback-message-content"]',
  playbackNext: '[data-qa="playback-next"]',
  playbackNextDisabled: () =>
    `${PlaybackSelectors.playbackNext}[${Attributes.disabled}]`,
  playbackPrevious: '[data-qa="playback-prev"]',
  playbackPreviousDisabled: () =>
    `${PlaybackSelectors.playbackPrevious}[${Attributes.disabled}]`,
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
  chatAgent: '[data-qa="chat-model"]',
  conversationSettingsIcon: '[data-qa="conversation-setting"]',
  clearConversationIcon: '[data-qa="clear-conversation"]',
  leavePlayback: '[data-qa="cancel-playback-mode"]',
  deleteFromCompareIcon: '[data-qa="delete-from-compare"]',
  version: '[data-qa="version"]',
  dotsMenu: '[data-qa="dots-menu"]',
};

export const CompareSelectors = {
  showAllCheckbox: '[name="showAllCheckbox"]',
  conversationToCompare: '[data-qa="conversation-to-compare"]',
  compareMode: '[data-qa="compare-mode"]',
  conversationRow: '[data-qa="conversation-row"]',
  noConversationsAvailable: '[data-qa="no-conversations-available"]',
  searchCompareConversation: '[data-qa="search-compare-conversation"]',
  loader: '[compare-loader]',
};

export const ToastSelectors = {
  chatLoader: '[data-qa="chat-loader"]',
  toast: '.chat-toast',
  conversationNotFound: '[data-qa="not-found"]',
};

export const ErrorLabelSelectors = {
  noResultFound: '[data-qa="no-data"]',
  notAllowedModel: '[data-qa="not-allowed-model-error"]',
  changeAgentBtn: '[data-qa="change-agent-btn"]',
  fieldError: '.text-error',
  errorText: '[data-qa="error-text"]',
  errorContainer: '[data-qa="error-message-container"]',
};

export const ImportExportSelectors = {
  importExportLoader: '[data-qa="import-export-loader"]',
  stopLoading: '[data-qa="stop-loading"]',
};

export const ChatSelectors = {
  fileDropArea: '#file-drop-area',
  chat: '[data-qa="chat"]',
  spinner: '[data-qa="spinner"]',
  chatMessages: '[data-qa="chat-messages"]',
  chatMessage: '[data-qa="chat-message"]',
  compareChatMessageRow: '[data-qa="compare-message-row"]',
  lastCompareChatMessageRow: () =>
    `${ChatSelectors.compareChatMessageRow}[itemprop='last-row']`,
  messageIcon: '[data-qa="message-icon"]',
  messageContent: '[data-qa="message-content"]',
  messageStage: '[data-qa="message-stage"]',
  referenceButton: 'reference',
  openedStage: '[data-qa="stage-opened"]',
  closedStage: '[data-qa="stage-closed"]',
  stageContent: '[data-qa="stage-content"]',
  stageContentCopyButton: 'copy',
  stageContentDownloadButton: 'download',
  stageLoader: '.animate-spin',
  loadingCursor: '[data-qa="loading-cursor"]',
  regenerate: '[data-qa="regenerate"]',
  iconAnimation: '.animate-bounce',
  footer: '[data-qa="footer-message"]',
  rate: (rate: Rate) => `[data-qa="${rate}"]`,
  codeBlock: '.codeblock',
  codeBlockTitleContainer: '[data-qa="code-title-container"]',
  duplicate: '[data-qa="duplicate"]',
  chatScrollableArea: '[data-qa="scrollable-area"]',
  attachmentExpanded: '[data-qa="attachment-expanded"]',
  attachmentCollapsed: '[data-qa="attachment-collapsed"]',
  attachmentsGroup: '[data-qa="grouped-attachments"]',
  attachmentTitle: '[data-qa="attachment-title"]',
  attachmentContent: '[data-qa="attachment-content"]',
  entitySpinner: '[data-qa="entity-spinner"]',
  plotlyContainer: '.plot-container',
  maxWidth: '.max-w-none',
  showMore: '[data-qa="show-more"]',
  showLess: '[data-qa="show-less"]',
  iconSelector: '[data-qa="entity-icon"]',
  addModelToWorkspace: '[data-qa="add-model-to-workspace"]',
  messageImageAttachment: 'Attachment image',
  copyCodeButton: 'Copy-code',
  downloadButton: 'Download',
  copyTextButton: 'Copy text',
  copyMarkdownButton: 'Copy markdown',
};

export const DragFileSelectors = {
  dragFileContainer: '[data-qa="drag-file-container"]',
  dragFileIcon: '#drag-file-icon',
  dragFileTitle: '[data-qa="drag-file-title"]',
  dragFileDescription: '[data-qa="drag-file-description"]',
  dragFileNotAllowedIcon: '#drag-file-not-allowed-icon',
};

export const TableSelectors = {
  tableContainer: '[data-qa="table"]',
  tableControls: '[data-qa="table-controls"]',
  copyAsCsvIcon: '[data-qa="copy-csv-icon"]',
  copyAsTxtIcon: '[data-qa="copy-txt-icon"]',
  copyAsMdIcon: '[data-qa="copy-md-icon"]',
};

export const PublicationReviewControls = {
  reviewContainer: '[data-qa="chat-review-container"]',
  previousButton: '[data-qa="prev-chat-review-button"]',
  nextButton: '[data-qa="next-chat-review-button"]',
  backToPublication: '[data-qa="back-to-publication"]',
  editButton: '[data-qa="edit-chat"]',
};

export const RenameConversationModalSelectors = {
  modal: '[data-qa="rename-conversation-modal"]',
  saveButton: '[data-qa="save"]',
  cancelButton: '[data-qa="cancel"]',
  title: '[data-qa="title"]',
};

export const PublishingRulesSelectors = {
  rulesContainer: '[data-qa="rules-container"]',
  allowAccessLabel: '[data-qa="allow-access-label"]',
  noChangesLabel: '[data-qa="no-changes-label"]',
  availabilityLabel: '[data-qa="availability-label"]',
  seeChangesButton: '[data-qa="see-changes"]',
  path: '[data-qa="published-path"]',
  rulesList: '[data-qa="rules-list"]',
  rule: '[data-qa="rule"]',
  ruleTarget: '[data-qa="rule-target"]',
  ruleFunction: '[data-qa="rule-function"]',
  ruleValue: '[data-qa="rule-value"]',
  ruleInnerOperator: '[data-qa="inner-operator"]',
  ruleOperator: '[data-qa="rule-operator"]',
  addRuleButton: '[data-qa="add-rule"]',
};

export const PublishingFilterSelectors = {
  filterContainer: '[data-qa="publish-audience-filter-selectors"]',
  filterTarget: '[data-qa="filter-selector-targets"]',
  filterFunction: '[data-qa="filter-selector-filterFns"]',
  filterValuesContainer: '[data-qa="filter-values-container"]',
  filterValueInput: '[data-qa="filter-value-input"]',
  filterValueSuggestion: '[data-qa="value-suggestion"]',
  filterPill: '[data-qa="combobox-pill"]',
  saveFilterButton: '[data-qa="save-filter"]',
};
