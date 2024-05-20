export const Dialog = {
  confirmationDialog: '[data-qa="confirmation-dialog"]',
  cancelDialog: '[data-qa="cancel-dialog"]',
  confirm: '[data-qa="confirm"]',
  confirmationMessage: '[data-qa="confirm-message"]',
};

export const Popup = {
  errorPopup: '[style*="animation"]',
};

export const PromptModal = {
  promptModalDialog: '[data-qa="prompt-modal"]',
  promptName: '[data-qa="prompt-name"]',
  promptDescription: '[data-qa="prompt-descr"]',
  promptValue: '[data-qa="prompt-value"]',
  savePrompt: '[data-qa="save-prompt"]',
  fieldLabel: (label: string) => `label[for="${label}"]`,
};

export const VariableModal = {
  variableModalDialog: '[data-qa="variable-modal"]',
  variablePromptName: '[data-qa="variable-prompt-name"]',
  variablePromptDescription: '[data-qa="variable-prompt-descr"]',
  submitVariable: '[data-qa="submit-variable"]',
};

export const ModelDialog = {
  modelDialog: '[data-qa="models-dialog"]',
  talkToGroup: (groupName?: string) => {
    const base = '[data-qa="talk-to-group"]';
    return groupName ? `${base}:has-text('${groupName}')` : base;
  },
  closeDialog: '[data-qa="close-models-dialog"]',
  searchInput: '[name="titleInput"]',
  modelsTab: '[data-qa="models-tab"]',
  assistantsTab: '[data-qa="assistants-tab"]',
  applicationsTab: '[data-qa="applications-tab"]',
};

export const AddonDialog = {
  addonsDialog: '[data-qa="addons-dialog"]',
  addonSearchResults: '[data-qa="addon-search-results"]',
  addonName: '[data-qa="addon-name"]',
  closeDialog: '[data-qa="close-addons-dialog"]',
  applyAddons: '[data-qa="apply-addons"]',
};

export const InfoTooltip = {
  infoTooltip: '[data-qa="chat-info-tooltip"]',
  modelInfo: '[data-qa="model-info"]',
  applicationInfo: '[data-qa="application-info"]',
  assistantInfo: '[data-qa="assistant-info"]',
  assistantModelInfo: '[data-qa="assistant model-info"]',
  promptInfo: '[data-qa="prompt-info"]',
  tempInfo: '[data-qa="temp-info"]',
  addonsInfo: '[data-qa="addons-info"]',
  tooltip: '[data-qa="tooltip"]',
};
