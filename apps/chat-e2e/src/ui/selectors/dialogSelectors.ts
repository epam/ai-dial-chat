import { ErrorLabelSelectors } from '@/src/ui/selectors/chatSelectors';
import { InputSelectors } from '@/src/ui/selectors/commonSelectors';

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
  promptUnshareButton: '[data-qa="unshare-prompt"]',
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

export const ReviewEntityDialog = {
  reviewDialog: '[data-qa="review-entity-dialog"]',
  name: '[data-qa="entity-name"]',
  version: '[data-qa="entity-version"]',
  description: '[data-qa="entity-description"]',
  topics: '[data-qa="entity-topic"]',
  featuresData: '[data-qa="app-feature"]',
  attachmentTypes: '[data-qa="app-attach-type"]',
  maxAttachmentsNumber: '[data-qa="app-max-attach"]',
  completionUrlLabel: '[data-qa="app-completion-url-label"]',
  completionUrl: '[data-qa="app-completion-url"]',
  externalUrlLabel: '[data-qa="app-external-url-label"]',
  externalUrl: '[data-qa="app-external-url"]',
  endpoint: '[data-qa="toolset-endpoint"]',
  transport: '[data-qa="toolset-transport"]',
  authType: '[data-qa="toolset-authentication-type"]',
  allowedTools: '[data-qa="toolset-allowed-tools"]',
};

export const ModelTooltip = {
  modelTooltip: '[data-qa="chat-model-tooltip"]',
  modelInfo: '[data-qa="entity-info"]',
  versionInfo: '[data-qa="version-info"]',
  title: '[data-qa="tooltip-title"]',
};

export const SettingsTooltip = {
  settingsTooltip: '[data-qa="chat-settings-tooltip"]',
  applicationInfo: '[data-qa="application-info"]',
  assistantInfo: '[data-qa="assistant-info"]',
  promptInfo: '[data-qa="prompt-info"]',
  tempInfo: '[data-qa="temp-info"]',
};

export const TooltipSelector = {
  tooltip: '[data-qa="tooltip"]',
};

export const ShareModalSelectors = {
  modalContainer: '[data-qa="share-modal"]',
  shareLink: '[data-qa="share-link"]',
  copyLink: '[data-qa="copy-link"]',
  entityName: '[data-qa="modal-entity-name"]',
  leftEntityName: '.text-start',
  shareText: '[data-qa="share-message"]',
  removeAccessBtn: '[data-qa="remove-access-button"]',
  notSharedEntityLabel: '[data-qa="not-shared-entity-label"]',
  shareOption: '[data-qa="share-option"]',
  qrCode: '[data-qa="share-qr-code"]',
  entityVersion: '[data-qa="entity-version"]',
};

export const UploadFromDeviceModalSelectors = {
  modalContainer: '[data-qa="pre-upload-modal"]',
  uploadButton: '[data-qa="upload"]',
  uploadedFile: '[data-qa="uploaded-file"]',
  addMoreFiles: '[data-qa="add-more-files"]',
  fileExtension: '.dial-small-text',
  uploadedFiles: '[data-qa="uploaded-files"]',
};

export const FileManagerModalSelectors = {
  modalContainer: '[data-qa="file-manager-modal"]',
  title: '[data-qa="modal-title"]',
  supportedAttributesLabel: '[data-qa="supported-attributes"]',
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

export const SelectFolderModalSelectors = {
  modalContainer: '[data-qa="select-folder-modal"]',
  newFolderButton: '[data-qa="new-folder"]',
  selectFolderButton: '[data-qa="select-folder"]',
  selectFolders: '[data-qa="select-folders"]',
  allFolders: '[data-qa="all-folders"]',
  rootFolder: '[data-qa="section-root"]',
  searchInput: '[data-qa="search-folder"]',
};

export const PublishingDialogSelectors = {
  dialogContainer: '[data-qa="publish-dialog"]',
  requestName: '[data-qa="publishRequestName"]',
  authorLabel: '[data-qa="publication-display-author-label"]',
  author: '#publicationAuthor',
  publishPathLabel: '[data-qa="publish-label"]',
  publishPath: '[data-qa="publish-path"]',
  changePublishToPath: '[data-qa="change-button"]',
  sendButton: '[data-qa="submit"]',
  noPublishingFilesMessage: '[data-qa="no-publishing-files"]',
  fieldErrorMessage: `[data-qa="error-message"]`,
  requestNameErrorMessage: () =>
    `${PublishingDialogSelectors.requestName} + ${PublishingDialogSelectors.fieldErrorMessage}`,
};

export const ChangePathElement = {
  changePathContainer: '[data-qa="change-path-container"]',
  path: '[data-qa="path"]',
};

export const PublishingApprovalModalSelectors = {
  modalContainer: '[data-qa="publish-approval-modal"]',
  publishName: '[data-qa="publish-name"]',
  publishPath: '[data-qa="publish-path"]',
  publishPathLabel: '[data-qa="publish-label"]',
  creationDate: '[data-qa="creation-date"]',
  authorLabel: '[data-qa="publication-author-label"]',
  author: '[data-qa="publication-author"]',
  publicAuthor: '[data-qa="publication-display-author"]',
  publicAuthorLabel: '[data-qa="publication-display-author-label"]',
  publicAuthorContainerEditMode: '[data-qa="publicationAuthor"]',
  publicAuthorLabelEditMode: '[data-qa="publicationAuthor-label"]',
  requestCreatedLabel: '[data-qa="creation-date-label"]',
  goToReviewButton: '[data-qa="go-to-review"]',
  rejectButton: '[data-qa="reject"]',
  approveButton: '[data-qa="submit"]',
  duplicatedPublishing: '[data-qa="duplicate-unpublishing"]',
  editButton: '[data-qa="edit"]',
  updateRequestButton: '[data-qa="update"]',
  version: '[data-qa="version"]',
  entityRow: '[data-qa="entity-publication-row"]',
  fieldValue: (name: string) => InputSelectors.value(name),
};

export const PublishingTreeSelectors = {
  conversationsTree: '[data-qa="conversations-tree-container"]',
  filesTree: '[data-qa="files-tree-container"]',
  promptsTree: '[data-qa="prompts-tree-container"]',
  appsTree: '[data-qa="applications-tree-container"]',
  toolsetsTree: '[data-qa="toolsets-tree-container"]',
  credentials: '[data-qa="credentials"]',
};

export const ChatSettingsModalSelectors = {
  conversationSettingsModal: '[data-qa="chat-settings-modal"]',
  applyChanges: '[data-qa="apply-changes"]',
  entitySettings: '[data-qa="entity-settings"]',
  systemPromptContainer: '[data-qa="system-prompt-container"]',
  systemPrompt: '[data-qa="system-prompt"]',
  temperatureSlider: '[data-qa="temp-slider"]',
  slider: '.temperature-slider',
};

export const TalkToAgentDialogSelectors = {
  talkToAgentModal: '[data-qa="talk-to-agent"]',
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

export const EntityEditorHeaderSelectors = {
  header: '[data-qa="entity-editor-header"]',
  saveAndExitButton: 'Save and exit',
  exitButton: 'Exit',
  actionAndEntityTypeTitle: '[data-qa="action-entity-type-title"]',
  stepsContainer: '[data-qa="steps-container"]',
  singleStepLink: '[data-qa="single-step-link"]',
  singleStepTitle: '[data-qa="single-step-title"]',
  selectedStepIcon: '[data-qa="selected-step-icon"]',
  notSelectedStepIcon: '[data-qa="not-selected-step-icon"]',
};

export const EntityEditorPreviewToggleSelectors = {
  toggleContainer: '[data-qa="preview-toggle-container"]',
  detailedSwitch: '[data-qa="toggle-switch"]',
};

export const EntityEditorGeneralInfoPreviewSelectors = {
  fullContainer: '[data-qa="entity-preview-general-info-full-container"]',
  entityPreviewGeneralInfoContainer: '[data-qa="entity-preview-general-info"]',
  previewIconContainer: '[data-qa="icon-container"]',
  previewEntityName: '#entity-name',
  previewTopicsContainer: '[data-qa="entity-topics"]',
  previewInformationSection: '[data-qa="entity-information"]',
  previewAuthorContainer: '[data-qa="author-container"]',
  previewAuthorValue: '[data-qa="author"]',
  description: '[data-qa="entity-description"]',
  version: '[data-qa="version"]',
  releaseDate: '[data-qa="created-at"]',
  credsLabel: '[data-qa="creds-label"]',
};

export const EntityEditorEntitySettingsPreviewSelectors = {
  container: '[data-qa="entity-preview-settings"]',
  header: '[data-qa="preview-header"]',
  body: '[data-qa="preview-body"]',
  entitySettingsChatModeContainer: '[data-qa="entity-settings-chat-mode"]',
  previewIcon: '[data-qa="entity-icon"]',
  entityInfoContainer: '[data-qa="entity-info-container"]',
  entityInfo: '[data-qa="entity-info"]',
  entityName: '[data-qa="entity-name"]',
};

export const AddEntityGeneralInfoFormSelector = {
  entityGeneralFormContainer: '[data-qa="entity-general-form"]',
  name: '#name',
  version: '#version',
  icon: '[data-qa="icon"]',
  addIcon: '[data-qa="add-icon"]',
  changeIcon: '[data-qa="change-icon"]',
  descriptionInput: '#description',
  descriptionLabel: '[for="description"]',
  topicsDropdownContainer: '#topics-dropdown',
  nextButton: '[data-qa="save-entity-general-info"]',
  topicsDropdownToggle: '[class*="-indicatorContainer"]', // Selector for the dropdown arrow within the container
  selectedTopicPills: '[class*="-multiValue"]', // Selector for the selected topic pills within the container
  selectedTopicPillRemoveIcon: (topicName: string) =>
    `[role="button"][aria-label="Remove ${topicName}"]`, // Selector for the 'x' icon within the pill
  clearAllTopicsButton: '[data-qa="clear-dropdown-selection"]', // Selector for the main clear button within the container
};

export const AddEntitySettingsFormSelector = {
  featuresLabel: '[for="features"]',
  attachmentsTypesLabel: '[for="attachmentTypes"]',
  chatCompletionUrl: '#completionUrl',
  entityViewFormContainer: '[data-qa="entity-view-form"]',
  maxAttachmentNumberField: '[data-qa="max-attachment-number-field"]',
};

export const ComboboxSelectors = {
  comboboxContainer: '[data-qa="combobox"]',
  selectedPills: '[data-qa="combobox-pill"]',
  unselectPillButton: (value: string) =>
    `button[data-qa="unselect-item-${value}"]`,
};

export const AddExternalAppSettingsFormSelector = {
  externalUrl: '#externalUrl',
};

export const AddQuickApp2SettingsFormSelector = {
  orchestratorSection: '[data-qa="orchestrator-section"]',
  contextToolsSection: '[data-qa="context-tools-section"]',
  attachmentsSection: '[data-qa="attachments-section"]',
  conversationStartersSection: '[data-qa="conversation-starters-section"]',

  // Context & Tools subsections
  agentsAndToolsetsField: '[data-qa="agents-and-toolsets-field"]',
  documentUrlsField: '[data-qa="document-urls-field"]',
  codeInterpreterField: '[data-qa="code-interpreter-field"]',

  // Agents & Toolsets — view modes
  agentsAndToolsetsMarketplaceView:
    '[data-qa="agents-and-toolsets-marketplace-view"]',
  agentsAndToolsetsJsonView: '[data-qa="agents-and-toolsets-json-view"]',

  // Agents & Toolsets — controls inside marketplace view
  noAgentsAndToolsetsPlaceholder: '[data-qa="no-agents-and-toolsets"]',
  agentsAndToolsetsList: '[data-qa="agents-and-toolsets-list"]',
  addAgentsButtonContainer: '[data-qa="add-agents-button"]',
  addAgentsButtonLabel: 'Add', // aria-label of the "+ Add" button
  agentsAndToolsetsJsonToggle: '[data-qa="agents-and-toolsets-json-toggle"]',

  // Chips inside agents-and-toolsets-list
  agentChip: '[data-qa="agent-chip"]',
  chipName: '[data-qa="chip-name"]',
  chipVersion: '[data-qa="chip-version"]',
  chipRemoveButtonLabel: 'Remove item', // aria-label of the chip remove button

  // Code Interpreter toggle
  codeInterpreterToggle: '[data-qa="toggle-switch"]',
};

// Shared by both agents browser modals (Talk to / Select agents and toolsets).
export const AgentsBrowserModalSelectors = {
  searchInput: '[data-qa="search-agents"]',
  myWorkspaceTab: '[data-qa="workspace"]',
  marketplaceTab: '[data-qa="marketplace"]',
};

export const AgentAndToolsetModalSelector = {
  container:
    '[role="dialog"][aria-modal="true"]:has([data-qa="search-agents"])',
};

export const AddToolsetSettingsFormSelector = {
  definitionLabel: '[data-qa="definition-label"]',
  endpointLabel: '[for="endpoint"]',
  endpoint: '#endpoint',
  protocolLabel: '[for="protocol"]',
  transportProtocol: '#protocol',
  authenticationLabel: '[data-qa="authentication-label"]',
  authenticationLabelSubtitle: '[data-qa="authentication-subtitle"]',
  authContainer: '[data-qa="auth-container"]',
  oauthContainer: '[data-qa="oauth"]',
  oauthLabel: '[data-qa="oauth-label"]',
  authDetailsContainer: '[data-qa="auth-details-container"]',
  authLoginOption: '#auth-login-option',
  authLoginForm: '[data-qa="login-form"]',
  clientIdFieldContainer: '[data-qa="clientId"]',
  clientSecretFieldContainer: '[data-qa="clientSecret"]',
  apiKeyParameterNameFieldContainer: '[data-qa="keyHeader"]',
  apiKeyParameterNameFieldErrorMessage: () =>
    `${AddToolsetSettingsFormSelector.apiKeyParameterNameFieldContainer} + ${ErrorLabelSelectors.fieldError}`,
  apiKeyParameterValueFieldContainer: '[data-qa="apiKey"]',
  apiKeyContainer: '[data-qa="api_key"]',
  apiKeyLabel: '[data-qa="api_key-label"]',
  withoutAuthContainer: '[data-qa="none"]',
  withoutAuthLabel: '[data-qa="none-label"]',
  allowedToolsLabel: '[data-qa="allowed-tools-label"]',
  allowedToolsLabelSubtitle: '[data-qa="allowed-tools-subtitle"]',
  copyUrlButton: 'Copy URL',
  connectToolsetLabel: '[data-qa="connect-toolset-label"]',
  connectToolsetHint: '[data-qa="copy-section"] > label',
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

export const ReplaceConfirmationModalSelectors = {
  modalContainer: '[data-qa="replace-confirmation-modal"]',
  mainFolderTree: '[data-qa="main-folder-tree"]',
  allItemsSelector: '[data-qa="all-items-selector"]',
  cancelButton: '[data-qa="cancel-import"], [data-qa="cancel-upload"]',
  continueButton: '[data-qa="continue-import"], [data-qa="continue-upload"]',
  title: 'h2',
  description: 'p.text-secondary',
  dropdownTrigger: '[data-qa="dropdown-trigger"]',
  dropdownMenu: '[data-qa="dropdown-menu"]',
  menuItem: '[data-qa="menu-item"]',
  iconContainer: '[data-qa="icon-container"]',
};

export const UploadProgressDialogSelectors = {
  title: 'div:has-text("Uploading items")',
  itemName: '#name',
  uploadingIndicator: '[data-qa="uploading-indicator"]',
  uploadingItemsCount: '[data-qa="uploading-items-count"]',
};
