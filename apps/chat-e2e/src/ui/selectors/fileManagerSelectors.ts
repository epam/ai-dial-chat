import { Attributes, Tags } from '@/src/ui/domData';

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
  confirm: 'Confirm',
  singleFileRadio: (value: string) =>
    `${Tags.input}[type="radio"][${Attributes.name}="${FileConflictResolutionSelectors.singleFileRadioName}"][${Attributes.value}="${value}"]`,
  multipleFilesRadio: (value: string) =>
    `${Tags.input}[type="radio"][${Attributes.name}="${FileConflictResolutionSelectors.multipleFilesRadioName}"][${Attributes.value}="${value}"]`,
  radioLabel: (value: string) => `${Tags.label}[for$="${value}"]`,
};

export const FileManagerSidebarSelectors = {
  container: '[aria-label="collapsible-sidebar"]',
};

export const FileManagerNavigationPanelSelectors = {
  navigationPanelContainer: '[aria-label="navigation-panel"]',
};

export const SelectFolderManagerModalSelectors = {
  selectFolderButtonLabel: 'Select folder',
  addFolderButtonLabel: 'Add folder',
};
