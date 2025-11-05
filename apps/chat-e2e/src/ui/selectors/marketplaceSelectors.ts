export const marketplaceContainer = '[data-qa="marketplace"]';

export const MarketplaceSelectors = {
  header: '[data-qa="marketplace-header"]',
  addApp: '[data-qa="add-app"]',
  addToolset: '[data-qa="add-toolset"]',
  noWorkspaceResultsFound: '[data-qa="no-workspace-results-found"]',
  noResultsFoundDescription: '[data-qa="no-data-description"]',
  marketplaceSuggestions: '[data-qa="marketplace-suggestions-label"]',
  marketplaceAgentSection: '[data-qa="agents-section"]',
  marketplaceAgentsRow: '[data-qa="agents-row"]',
};

export const MarketplaceAgentSelectors = {
  agent: '[data-qa="agent"]',
  agentName: '[data-qa="entity-name"]',
  version: '[data-qa="version"]',
  agentVersionMenuTrigger: '[data-qa="agent-version-select-trigger"]',
  header: '[data-qa="marketplace-header"]',
  description: '.text-sm',
  addBookmarkIcon: '[data-qa="add-bookmark"]',
  removeBookmarkIcon: '[data-qa="remove-bookmark"]',
  topicsContainer: '[data-qa="entity-topics"]',
  topic: '[data-qa="app-topic"]',
  hiddenTopics: '[data-qa="hidden-topics"]',
  copyLink: '[data-qa="copy-link"]',
  copyLinkText: '[data-qa="copy-link-text"]',
  iconContainer: '[data-qa="icon-container"]',
  copyIcon: '[data-qa="copy-icon"]',
  copiedLink: '[data-qa="copied-link"]',
  copiedIcon: '[data-qa="copied-icon"]',
  pencilIcon: '[data-qa="pencil-icon"]',
  arrowIcon: '[data-qa="arrow-icon"]',
  openInNewTab: '[data-qa="external-link"]',
};

export const MarketplaceDetailsModal = {
  modalContainer: '[data-qa="marketplace-entity-details"]',
  entityContentContainer: '[data-qa="entity-content"]',
  entityDescription: '[data-qa="entity-description"]',
  entityInformation: '[data-qa="entity-information"]',
  entityName: '[data-qa="entity-name"]',
  entityVersion: '[data-qa="version"]',
  entityAuthor: '[data-qa="author"]',
  entityReleaseDate: '[data-qa="created-at"]',
  versionMenuTrigger: '[data-qa="agent-version-select-trigger"]',
  useButton: '[data-qa="use-button"]',
  icon: '[data-qa="entity-icon"]',
  // editButton: '[data-qa="application-edit"]',
  // deleteButton: '[data-qa="application-delete"]',
  editButton: '[data-qa="edit"]',
  deleteButton: '[data-qa="delete"]',
  publishButton: '[data-qa="publish"]',
  unpublishButton: '[data-qa="unpublish"]',
  shareButton: '[data-qa="share"]',
  unshareButton: '[data-qa="unshare"]',
};

export const MarketplaceSideBarSelectors = {
  sidebar: '[data-qa="marketplace-sidebar"]',
  searchInput: '[name="titleInput"]',
  agentsTab: '[data-qa="agents-tab"]',
  toolsetsTab: '[data-qa="toolsets-tab"]',
  marketplaceFilter: '[data-qa="marketplace-filter"]',
  filterProperty: '[data-qa="filter-property"]',
  filterPropertyOptions: '[data-qa="filter-property-options"]',
  filterPropertyOption: '[data-qa="filter-option"]',
  optionLabel: '[data-qa="option-label"]',
};
