import { AttributeValues, Attributes, Tags } from '@/src/ui/domData';

export const marketplaceContainer = '[data-qa="marketplace"]';

export const MarketplaceSelectors = {
  header: '[data-qa="marketplace-header"]',
  addApp: '[data-qa="add-app"]',
  addToolset: '[data-qa="add-toolset"]',
  cardViewToggle: '[data-qa="card-view"]',
  tableViewToggle: '[data-qa="table-view"]',
  noWorkspaceResultsFound: '[data-qa="no-workspace-results-found"]',
  noDataHeader: '[data-qa="no-data-header"]',
  noResultsFoundDescription: '[data-qa="no-data-description"]',
  marketplaceSuggestions: '[data-qa="marketplace-suggestions-label"]',
  marketplaceEntitiesSection: '[data-qa="entities-section"]',
  marketplaceEntitiesRow: '[data-qa="entities-row"]',
  marketplaceNoDataContainer: '[data-qa="no-data-container"]',
};

export const MarketplaceEntitySelectors = {
  entity: '[data-qa="entity"]',
  entityName: '#entity-name',
  version: '[data-qa="version"]',
  agentVersionMenuTrigger: '[data-qa="agent-version-select-trigger"]',
  header: '[data-qa="marketplace-header"]',
  description: '.text-sm',
  addBookmarkIcon: '[data-qa="add-bookmark"]',
  removeBookmarkIcon: '[data-qa="remove-bookmark"]',
  topicsContainer: '[data-qa="entity-topics"]',
  topic: '[data-qa="entity-topic"]',
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
  credsLabel: '[data-qa="creds-label"]',
};

export const MarketplaceDetailsModal = {
  modalContainer: '[data-qa="marketplace-entity-details"]',
  entityContentContainer: '[data-qa="entity-content"]',
  entityDescription: '[data-qa="entity-description"]',
  entityInformation: '[data-qa="entity-information"]',
  entityName: '#entity-name',
  entityVersion: '[data-qa="version"]',
  entityAuthor: '[data-qa="author"]',
  entityReleaseDate: '[data-qa="created-at"]',
  versionMenuTrigger: '[data-qa="agent-version-select-trigger"]',
  useButton: '[data-qa="use-button"]',
  icon: '[data-qa="entity-icon"]',
  credsLabel: '[data-qa="creds-label"]',
  editButton: '[data-qa="edit"]',
  deleteButton: '[data-qa="delete"]',
  publishButton: '[data-qa="publish"]',
  unpublishButton: '[data-qa="unpublish"]',
  shareButton: '[data-qa="share"]',
  unshareButton: '[data-qa="unshare"]',
  loginButton: 'Log in',
  logoutButton: 'Log out',
  manageCredsButton: 'Manage creds',
  viewButton: 'View',
  connectButton: 'Connect',
  loginWithMyCredsButton: 'Login with my creds',
};

export const MarketplaceSideBarSelectors = {
  sidebar: '[data-qa="marketplace-sidebar"]',
  agentsTab: '[data-qa="agents-tab"]',
  toolsetsTab: '[data-qa="toolsets-tab"]',
  marketplaceFilter: '[data-qa="marketplace-filter"]',
  filterProperty: '[data-qa="filter-property"]',
  filterPropertyOptions: '[data-qa="filter-property-options"]',
  filterPropertyOption: '[data-qa="filter-option"]',
  optionLabel: '#option-label',
};

export const ToolsetLoginModalSelectors = {
  modalContainer: '[data-qa="marketplace-toolset-signin"]',
  header: '[data-qa="login-header"]',
  manageCredsHeader: '[data-qa="manage-creds-header"]',
  toolsetName: '[data-qa="toolset-name"]',
  toolsetVersion: '[data-qa="toolset-version"]',
  apiKeyFieldContainer: '[data-qa="apiKey"]',
  apiKeyMaskedFieldInput: `${Tags.input}[${Attributes.type} = "${AttributeValues.password}"]`,
  apiKeyUnmaskedFieldInput: `${Tags.input}[${Attributes.type} = "${AttributeValues.text}"]`,
  loginButton: 'Log in',
  orgCredsAccordion: '[data-qa="org-creds-accordion"]',
  orgCredsContent: '[data-qa="org-creds-content"]',
  myCredsAccordion: '[data-qa="my-creds-accordion"]',
  myCredsContent: '[data-qa="my-creds-content"]',
};

export const ConnectToolsetModalSelectors = {
  copyUrlButton: 'Copy URL',
};
