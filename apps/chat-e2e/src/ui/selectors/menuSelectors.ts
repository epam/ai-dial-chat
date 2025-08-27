export const MenuSelectors = {
  menuTrigger: '[data-qa="menu-trigger"]',
  dotsMenu: '[aria-haspopup="menu"]',
  dropdownMenu: '[data-qa="dropdown-menu"]',
  listboxMenu: '[id*="listbox"]',
  menuOption: '[role="option"]', // Selector for individual options within the menu
};

export const AccountSettingsModalSelector = {
  settingsModal: '[data-qa="settings-modal"]',
  theme: '[data-qa="theme"]',
  customLogo: '[data-qa="custom-logo"]',
  fullWidthChatToggle: '[data-qa="toggle-switch"]',
  save: '[data-qa="save"]',
  startChatWith: '[data-qa="model-selector"]',
  startChatWithSelectedOption: '[data-qa="selected-agent"]',
  startChatWithToggle: 'button[aria-label="toggle menu"]',
  startChatWithSearchInput: '[data-qa="search-input"]',
  startChatWithListbox: '[role="listbox"]',
  startChatWithListboxOption: '[role="option"]',
  startChatWithListboxOptionAttributes: '[data-qa="agent-attributes"]',
  startChatWithListboxOptionVersion: '[data-qa="agent-version"]',
  noAvailableItems: '[data-qa="no-available-items"]',
};
