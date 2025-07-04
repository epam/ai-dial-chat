import { Tags } from '@/src/ui/domData';

export const ConfirmationDialogSelectors = {
  container: '[data-qa="confirmation-dialog"]',
  cancelDialog: '[data-qa="cancel-dialog"]',
  confirm: '[data-qa="confirm"]',
  confirmationMessage: '[data-qa="confirm-message"]',
};

export const Popup = {
  errorPopup: '[style*="animation"]',
};

export const PromptModal = {
  title: '[data-qa="modal-entity-name"]',
  promptModalDialog: '[data-qa="prompt-modal"]',
  promptName: '[data-qa="prompt-name"]',
  promptDescription: '[data-qa="prompt-descr"]',
  promptValue: '[data-qa="prompt-value"]',
  savePrompt: '[data-qa="save-prompt"]',
  fieldLabel: (label: string) => `label[for="${label}"]`,
};

export const PromptPreviewModal = {
  promptPreviewModal: '[data-qa="preview-prompt-modal"]',
  promptPreviewModalTitle: '[data-qa="modal-entity-name"]',
  promptPreviewName: '[data-qa="prompt-name-label"] ~ [data-qa="prompt-name"]',
  promptPreviewDescription:
    '[data-qa="prompt-description-label"] ~ [data-qa="prompt-description"]',
  promptPreviewContent:
    '[data-qa="prompt-content-label"] ~ [data-qa="prompt-content"]',
  promptExportButton: '[data-qa="export-prompt"]',
  promptDeleteButton: '[data-qa="delete-prompt"]',
  promptDuplicateButton: '[data-qa="duplicate-prompt"]',
  editPromptButton: '[data-qa="edit-prompt"]',
  movePromptButton: '[data-qa="move-prompt"]',
  sharePromptButton: '[data-qa="share-prompt"]',
  publishPromptButton: '[data-qa="publish-prompt"]',
  unpublishPromptButton: '[data-qa="unpublish-prompt"]',
  deletePromptButton: '[data-qa="delete-prompt"]',
  promptInfoButton: '[data-qa="info-prompt"]',
  usePromptButton: '[data-qa="use-prompt"]',
  promptPreviewVersion: '[data-qa="version"]',
  promptNotFound: '[data-qa="not-found"]',
};

export const VariableModal = {
  variableModalDialog: '[data-qa="variable-modal"]',
  variablePromptName: '[data-qa="variable-prompt-name"]',
  variablePromptDescription: '[data-qa="variable-prompt-descr"]',
  submitVariable: '[data-qa="submit-variable"]',
  variable: '[data-qa="variable"]',
  variableAsterisk: '[data-qa="variable-asterisk"]',
  variableLabel: '[data-qa="variable-label"]',
};

export const ModelDialog = {
  modelDialog: '[data-qa="models-dialog"]',
  talkToGroup: '[data-qa="talk-to-group"]',
  closeDialog: '[data-qa="close-models-dialog"]',
  searchInput: '[name="titleInput"]',
  modelsTab: '[data-qa="models-tab"]',
  assistantsTab: '[data-qa="assistants-tab"]',
  applicationsTab: '[data-qa="applications-tab"]',
};

export const ReviewApplicationDialog = {
  reviewDialog: '[data-qa="review-application-dialog"]',
  entityIcon: '[data-qa="entity-icon"]',
};

export const AddonDialog = {
  addonsDialog: '[data-qa="addons-dialog"]',
  addonSearchResults: '[data-qa="addon-search-results"]',
  addonName: '[data-qa="addon-name"]',
  closeDialog: '[data-qa="close-addons-dialog"]',
  applyAddons: '[data-qa="apply-addons"]',
};

export const ModelTooltip = {
  modelTooltip: '[data-qa="chat-model-tooltip"]',
  modelInfo: '[data-qa="agent-info"]',
  versionInfo: '[data-qa="version-info"]',
  title: '[data-qa="tooltip-title"]',
};

export const SettingsTooltip = {
  settingsTooltip: '[data-qa="chat-settings-tooltip"]',
  applicationInfo: '[data-qa="application-info"]',
  assistantInfo: '[data-qa="assistant-info"]',
  assistantModelInfo: '[data-qa="assistant agent-info"]',
  promptInfo: '[data-qa="prompt-info"]',
  tempInfo: '[data-qa="temp-info"]',
  addonsInfo: '[data-qa="addons-info"]',
};

export const TooltipSelector = {
  tooltip: '[data-qa="tooltip"]',
};

export const ShareModalSelectors = {
  modalContainer: '[data-qa="share-modal"]',
  shareLink: '[data-qa="share-link"]',
  copyLink: '[data-qa="copy-link"]',
  entityName: '[data-qa="modal-entity-name"]',
  shareText: '[data-qa="share-message"]',
  removeAccessBtn: '[data-qa="remove-access-button"]',
  notSharedEntityLabel: '[data-qa="not-shared-entity-label"]',
};

export const UploadFromDeviceModalSelectors = {
  modalContainer: '[data-qa="pre-upload-modal"]',
  uploadButton: '[data-qa="upload"]',
  uploadedFile: '[data-qa="uploaded-file"]',
  addMoreFiles: '[data-qa="add-more-files"]',
  deleteUploadedFileIcon: `[data-qa="delete-file"] > ${Tags.svg}`,
  fileExtension: '[data-qa="file-extension"]',
  uploadedFiles: '[data-qa="uploaded-files"]',
};

export const AttachFilesModalSelectors = {
  modalContainer: '[data-qa="file-manager-modal"]',
  organizationFilesContainer: '[data-qa="organization-files-container"]',
  sharedWithMeFilesContainer: '[data-qa="shared-with-me-files-container"]',
  allFilesContainer: '[data-qa="all-files-container"]',
  attachedFileIcon: '[data-qa="attached-file-icon"]',
  attachFilesButton: '[data-qa="attach-files"]',
  uploadFromDeviceButton: '[data-qa="upload-from-device"]',
  deleteFilesButton: '[data-qa="delete-files"]',
  downloadFilesButton: '[data-qa="download-files"]',
  newFolderButton: '[data-qa="new-folder"]',
  arrowAdditionalIcon: '[data-qa="arrow-icon"]',
  rootFolder: '[data-qa="section-root"]',
  fileSection: '[data-qa="file-section-content"]',
};

export const FilesModalSelectors = {
  supportedAttributesLabel: '[data-qa="supported-attributes"]',
};

export const SelectFolderModalSelectors = {
  modalContainer: '[data-qa="select-folder-modal"]',
  newFolderButton: '[data-qa="new-folder"]',
  selectFolderButton: '[data-qa="select-folder"]',
  selectFolders: '[data-qa="select-folders"]',
  allFolders: '[data-qa="all-folders"]',
  rootFolder: '[data-qa="section-root"]',
  searchInput: '[data-qa="search-folder"]',
};

export const AccountSettingsModalSelector = {
  settingsModal: '[data-qa="settings-modal"]',
  theme: '[data-qa="theme"]',
  customLogo: '[data-qa="custom-logo"]',
  fullWidthChatToggle: '[data-qa="toggle-switch"]',
  save: '[data-qa="save"]',
};

export const PublishingModalSelectors = {
  modalContainer: '[data-qa="publish-modal"]',
  requestName: '[data-qa="publishRequestName"]',
  author: '#publicationAuthor',
  publishTo: '[data-qa="change-path-container"]',
  unpublishFromLabel: '[data-qa="unpublish-from-label"]',
  unpublishFromPath: '[data-qa="unpublish-from-path"]',
  changePublishToPath: '[data-qa="change-button"]',
  conversationsToPublishContainer:
    '[data-qa="conversations-to-send-request-container"]',
  filesToPublishContainer: '[data-qa="files-to-send-request-container"]',
  promptsToPublishContainer: '[data-qa="prompts-to-send-request-container"]',
  appsToPublishContainer: '[data-qa="applications-to-send-request-container"]',
  sendButton: '[data-qa="publish"]',
  noPublishingFilesMessage: '[data-qa="no-publishing-files"]',
  fieldErrorMessage: `[data-qa="error-message"]`,
  requestNameErrorMessage: () =>
    `${PublishingModalSelectors.requestName} + ${PublishingModalSelectors.fieldErrorMessage}`,
};

export const ChangePathElement = {
  changePathContainer: '[data-qa="change-path-container"]',
  path: '[data-qa="path"]',
  changeButton: '[data-qa="change-button"]',
};

export const PublishingApprovalModalSelectors = {
  modalContainer: '[data-qa="publish-approval-modal"]',
  publishName: '[data-qa="publish-name"]',
  publishToPath: '[data-qa="publish-to-path"]',
  publishToPathLabel: '[data-qa="publish-to-label"]',
  creationDate: '[data-qa="creation-date"]',
  requestCreatedLabel: '[data-qa="creation-date-label"]',
  conversationsToApproveContainer:
    '[data-qa="conversations-to-approve-container"]',
  filesToApproveContainer: '[data-qa="files-to-approve-container"]',
  promptsToApproveContainer: '[data-qa="prompts-to-approve-container"]',
  applicationsToApproveContainer:
    '[data-qa="applications-to-approve-container"]',
  allowAccessLabel: '[data-qa="allow-access-label"]',
  noChangesLabel: '[data-qa="no-changes-label"]',
  availabilityLabel: '[data-qa="availability-label"]',
  goToReviewButton: '[data-qa="go-to-review"]',
  rejectButton: '[data-qa="reject"]',
  approveButton: '[data-qa="approve"]',
  duplicatedPublishing: '[data-qa="duplicate-unpublishing"]',
};

export const ChatSettingsModalSelectors = {
  conversationSettingsModal: '[data-qa="chat-settings-modal"]',
  applyChanges: '[data-qa="apply-changes"]',
  entitySettings: '[data-qa="entity-settings"]',
  systemPromptContainer: '[data-qa="system-prompt-container"]',
  systemPrompt: '[data-qa="system-prompt"]',
  temperatureSlider: '[data-qa="temp-slider"]',
  slider: '.temperature-slider',
  addons: '[data-qa="addons"]',
  selectedAddons: '[data-qa="selected-addons"]',
  recentAddons: '[data-qa="recent-addons"]',
  seeAllSelectors: '[data-qa="see-all-addons"]',
};

export const TalkToAgentDialogSelectors = {
  talkToAgentModal: '[data-qa="talk-to-agent"]',
  searchAgent: '[data-qa="search-agents"]',
  goToMyWorkspaceButton: '[data-qa="go-to-my-workspace"]',
  goToDialMarketplaceButton: '[data-qa="go-to-marketplace"]',
  myAgentsTab: '[data-qa="workspace"]',
  allAgentsTab: '[data-qa="marketplace"]',
  nextArrowButton: '[data-qa="slider-dot-arrow-next"]',
  previousArrowButton: '[data-qa="slider-dot-arrow-prev"]',
};

export const MessageTemplateModalSelectors = {
  messageTemplateModal: '[data-qa="message-templates-dialog"]',
  modalTitle: '[data-qa="modal-entity-name"]',
  description: '[data-qa="description"]',
  originalMessageLabel: '[data-qa="original-message-label"]',
  setTemplateTab: '[data-qa="set-template-tab"]',
  previewTab: '[data-qa="preview-tab"]',
  originalMessageContent: '[data-qa="original-message-content"]',
  templateRow: '[data-qa="template-row"]',
  templateRowContent: '[data-qa="template-content"]',
  templateRowValue: '[data-qa="template-value"]',
  deleteRow: '[name="delete-row"]',
  saveButton: '[data-qa="save-button"]',
  templatePreview: '[data-qa="result-message-template"]',
  showMoreButton: '[data-qa="show-more"]',
  showLessButton: '[data-qa="show-less"]',
};

export const RequestApiKeyModalSelectors = {
  requestApiKeyContainer: '[data-qa="request-api-key-dialog"]',
};

export const ReportAnIssueModalSelectors = {
  reportAnIssueContainer: '[data-qa="report-issue-dialog"]',
};

export const ApplicationEditorHeader = {
  header: '[data-qa="app-editor-header"]',
  saveAndExitButton: '[data-qa="save-and-exit"]',
  exitLink: '[data-qa="exit-link"]',
  actionAndApplicationTypeTitle: '[data-qa="action-application-type-title"]',
  stepsContainer: '[data-qa="steps-container"]',
  singleStepLink: '[data-qa="single-step-link"]',
  singleStepTitle: '[data-qa="single-step-title"]',
  selectedStepIcon: '[data-qa="selected-step-icon"]',
  notSelectedStepIcon: '[data-qa="not-selected-step-icon"]',
};

export const AppEditorGeneralInfoPreviewSelectors = {
  fullContainer: '[data-qa="app-preview-general-info-full-container"]',
  detailedSwitch: '[data-qa="toggle-switch"]',
  appPreviewGeneralInfoContainer: '[data-qa="app-preview-general-info"]',
  previewIconContainer: '[data-qa="entity-icon"]',
  previewAgentName: '[data-qa="agent-name"]',
  previewTopicsContainer: '[data-qa="app-topics"]',
  previewInformationSection: '[data-qa="application-information"]',
  previewAuthorContainer: '[data-qa="author-container"]',
  previewAuthorValue: '[data-qa="author"]',
  description: '[data-qa="application-description"]',
  version: '[data-qa="version"]',
  releaseDate: '[data-qa="created-at"]',
};

export const AppEditorAppSettingsPreviewSelectors = {
  container: '[data-qa="app-preview-settings"]',
  appSettingsChatModeContainer: '[data-qa="app-settings-chat-mode"]',
  previewIcon: '[data-qa="entity-icon"]',
  agentInfoContainer: '[data-qa="agent-info-container"]',
  agentInfo: '[data-qa="agent-info"]',
  agentName: '[data-qa="agent-name"]',
};

export const AddApplicationGeneralInfoFormSelector = {
  appGeneralFormContainer: '[data-qa="app-general-form"]',
  name: '#name',
  version: '#version',
  addIcon: '[data-qa="add-icon"]',
  changeIcon: '[data-qa="change-icon"]',
  descriptionInput: '#description',
  descriptionLabel: '[for="description"]',
  topicsDropdownContainer: '#topics-dropdown',
  nextButton: '[data-qa="save-application-general-info"]',
  topicsDropdownToggle: '[class*="-indicatorContainer"]', // Selector for the dropdown arrow within the container
  selectedTopicPills: '[class*="-multiValue"]', // Selector for the selected topic pills within the container
  selectedTopicPillRemoveIcon: (topicName: string) =>
    `[role="button"][aria-label="Remove ${topicName}"]`, // Selector for the 'x' icon within the pill
  clearAllTopicsButton: '[data-qa="clear-dropdown-selection"]', // Selector for the main clear button within the container
};

export const AddApplicationAppSettingsFormSelector = {
  featuresLabel: '[for="features"]',
  attachmentsTypesLabel: '[for="attachmentTypes"]',
  attachmentTypesContainer: '[data-qa="attachment-types-field"]',
  chatCompletionUrl: '#completionUrl',
  addButton: '[data-qa="add-application"]',
  appViewFormContainer: '[data-qa="app-view-form"]',
  maxAttachmentNumberField: '[data-qa="max-attachment-number-field"]',
  selectedAttachmentTypePills: '[data-qa="attachment-type-pill"]',
  unselectAttachmentTypePillButton: (type: string) =>
    `button[data-qa="unselect-item-${type}"]`,
};

export const InformationModalSelectors = {
  container: '[data-qa="info-modal"]',
  title: '[data-qa="modal-entity-name"]',
  lastUpdatedContainer: '[data-qa="updated-at"]',
  createdDateContainer: '[data-qa="created-at"]',
  authorContainer: '[data-qa="author"]',
  lastUpdatedLabel: '[data-qa="updated-at-label"]',
  lastUpdatedValue: '[data-qa="updated-at-value"]',
  createdDateLabel: '[data-qa="created-at-label"]',
  createdDateValue: '[data-qa="created-at-value"]',
  authorLabel: '[data-qa="author-label"]',
  authorValue: '[data-qa="author-value"]',
};
