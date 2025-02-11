export const marketplaceContainer = '[data-qa="marketplace"]';

export const MarketplaceSelectors = {
  header: '[data-qa="marketplace-header"]',
  addApp: '[data-qa="add-app"]',
  noWorkspaceResultsFound: '[data-qa="no-workspace-results-found"]',
  noResultsFoundDescription: '[data-qa="no-data-description"]',
  marketplaceSuggestions: '[data-qa="marketplace-suggestions-label"]',
};

export const MarketplaceAgentSelectors = {
  filteredAgents: '[data-qa="filtered-agents"]',
  suggestedAgents: '[data-qa="suggested-agents"]',
  agent: '[data-qa="agent"]',
  agentName: '[data-qa="agent-name"]',
  version: '[data-qa="version"]',
  agentVersionMenuTrigger: '[data-qa="agent-version-select-trigger"]',
  header: '[data-qa="marketplace-header"]',
  description: '.text-sm',
};

export const MarketplaceDetailsModal = {
  modalContainer: '[data-qa="marketplace-agent-details"]',
  agentName: '[data-qa="agent-name"]',
  agentVersion: '[data-qa="version"]',
  versionMenuTrigger: '[data-qa="agent-version-select-trigger"]',
  useButton: '[data-qa="use-button"]',
};

export const MarketplaceSideBarSelectors = {
  sidebar: '[data-qa="marketplace-sidebar"]',
  marketplaceHomePageButton: '[data-qa="home-page"]',
  myApplicationsButton: '[data-qa="my-applications"]',
  searchInput: '[name="titleInput"]',
  marketplaceFilter: '[data-qa="marketplace-filter"]',
  filterProperty: '[data-qa="filter-property"]',
  filterPropertyOptions: '[data-qa="filter-property-options"]',
  filterPropertyOption: '[data-qa="filter-option"]',
};
