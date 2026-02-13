export const FileManagerSelectors = {
  container: '[data-qa="file-manager"]',
  /** Content area in simplified SelectFolder popup (no data-qa="file-manager") */
  popupDescription: '[aria-label="popup-description"]',
  toolbarContainer: '[role="toolbar"]',
};

export const FileManagerSidebarSelectors = {
  container: '[aria-label="collapsible-sidebar"]',
};

export const FileManagerNavigationPanelSelectors = {
  navigationPanelContainer: '[aria-label="navigation-panel"]',
  searchField: '[role="search"]',
};
