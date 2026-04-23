export const FileManagerSelectors = {
  container: '[data-qa="file-manager"]',
  toolbarContainer: '[role="toolbar"]',
  selectedItemsButton: `button[aria-label$=" item selected"]:visible,button[aria-label$=" items selected"]:visible`,
};

export const FileConflictResolutionSelectors = {
  singleFileRadioName: 'single-file-conflict',
  multipleFilesRadioName: 'multiple-files-conflict',
  replace: 'replace',
  duplicate: 'duplicate',
  replaceAll: 'replaceAll',
  duplicateAll: 'duplicateAll',
  decideForEach: 'decideForEach',
} as const;

export const FileManagerSidebarSelectors = {
  container: '[aria-label="collapsible-sidebar"]',
};

export const FileManagerNavigationPanelSelectors = {
  navigationPanelContainer: '[aria-label="navigation-panel"]',
};
