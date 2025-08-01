export const marketplaceContainer = '[data-qa="marketplace"]';

export const MarketplaceSelectors = {
  header: '[data-qa="marketplace-header"]',
  addApp: '[data-qa="add-app"]',
  noWorkspaceResultsFound: '[data-qa="no-workspace-results-found"]',
  noResultsFoundDescription: '[data-qa="no-data-description"]',
  marketplaceSuggestions: '[data-qa="marketplace-suggestions-label"]',
  marketplaceAgentSection: '[data-qa="agents-section"]',
  marketplaceAgentsRow: '[data-qa="agents-row"]',
};

export const MarketplaceAgentSelectors = {
  agent: '[data-qa="agent"]',
  agentName: '[data-qa="agent-name"]',
  version: '[data-qa="version"]',
  agentVersionMenuTrigger: '[data-qa="agent-version-select-trigger"]',
  header: '[data-qa="marketplace-header"]',
  description: '.text-sm',
  addBookmarkIcon: '[data-qa="add-bookmark"]',
  removeBookmarkIcon: '[data-qa="remove-bookmark"]',
  topicsContainer: '[data-qa="app-topics"]',
  topic: '[data-qa="app-topic"]',
  hiddenTopics: '[data-qa="hidden-topics"]',
  copyLink: '[data-qa="copy-link"]',
  copyLinkText: '[data-qa="copy-link-text"]',
  copyIcon: '[data-qa="copy-icon"]',
  copiedLink: '[data-qa="copied-link"]',
  copiedIcon: '[data-qa="copied-icon"]',
  pencilIcon: '[data-qa="pencil-icon"]',
};

export const MarketplaceDetailsModal = {
  modalContainer: '[data-qa="marketplace-agent-details"]',
  applicationContentContainer: '[data-qa="application-content"]',
  applicationDescription: '[data-qa="application-description"]',
  applicationInformation: '[data-qa="application-information"]',
  agentName: '[data-qa="agent-name"]',
  agentVersion: '[data-qa="version"]',
  agentAuthor: '[data-qa="author"]',
  agentReleaseDate: '[data-qa="created-at"]',
  versionMenuTrigger: '[data-qa="agent-version-select-trigger"]',
  useButton: '[data-qa="use-button"]',
  icon: '[data-qa="entity-icon"]',
  // editButton: '[data-qa="application-edit"]',
  // deleteButton: '[data-qa="application-delete"]',
  editButton: '[data-qa="edit"]',
  deleteButton: '[data-qa="delete"]',
  publishButton: '[data-qa="publish"]',
};

export const MarketplaceSideBarSelectors = {
  sidebar: '[data-qa="marketplace-sidebar"]',
  searchInput: '[name="titleInput"]',
  marketplaceFilter: '[data-qa="marketplace-filter"]',
  filterProperty: '[data-qa="filter-property"]',
  filterPropertyOptions: '[data-qa="filter-property-options"]',
  filterPropertyOption: '[data-qa="filter-option"]',
  optionLabel: '[data-qa="option-label"]',
};
