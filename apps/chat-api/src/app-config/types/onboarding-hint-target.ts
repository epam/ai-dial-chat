/**
 * The UI elements an operator-authored onboarding hint can point at.
 *
 * A closed list on purpose: operator config names a target, and the chat app
 * resolves it to an element it knows how to find. Config can never carry a raw
 * CSS selector, so a typo or a hostile value cannot reach `querySelector`.
 */
export enum OnboardingHintTarget {
  /** The "New chat" control — a sidebar link on desktop, a header button on mobile. */
  NewChat = 'new-chat',
  /** The navigation sidebar as a whole. */
  Navigation = 'navigation',
  /** The "Projects" link in the navigation sidebar. */
  Projects = 'projects',
  /** The "Scheduled tasks" link in the navigation sidebar. */
  ScheduledTasks = 'scheduled-tasks',
  /** The "Catalog" link in the navigation sidebar. */
  Catalog = 'catalog',
  /** The "File manager" link in the navigation sidebar. */
  FileManager = 'file-manager',
  /** The message composer on the conversation and new-chat screens. */
  ConversationInput = 'conversation-input',
  /** The composer's "+" button that attaches files and opens tools. */
  AddAttachment = 'add-attachment',
  /** The composer's send button. */
  SendMessage = 'send-message',
  /** The composer's model selector. */
  ModelSelector = 'model-selector',
  /** The composer's dictation button, when voice input is available. */
  VoiceInput = 'voice-input',
  /** The starter prompts on the new-chat screen, when the model has any. */
  ConversationStarters = 'conversation-starters',
  /** The message log of an open conversation. */
  ConversationMessages = 'conversation-messages',
  /** The button that opens an open conversation's sources panel. */
  SourcesPanelToggle = 'sources-panel-toggle',
  /** The sidebar collapse button on desktop, the menu button on mobile. */
  SidebarToggle = 'sidebar-toggle',
  /** The sidebar's chats section. */
  Chats = 'chats',
  /** The chats section's search. */
  ChatsSearch = 'chats-search',
  /** The chats section's filter button. */
  ChatsFilter = 'chats-filter',
  /** The user menu at the bottom of the sidebar. */
  UserMenu = 'user-menu',
  /** The Usage link at the bottom of the sidebar. */
  Usage = 'usage',
  /** The Projects page's "New project" button. */
  ProjectsCreate = 'projects-create',
  /** The Projects page's search field. */
  ProjectsSearch = 'projects-search',
  /** A project's chats section, with its composer. */
  ProjectChats = 'project-chats',
  /** A project's details panel. */
  ProjectDetails = 'project-details',
  /** The Scheduled tasks page's "New task" button. */
  ScheduledTasksCreate = 'scheduled-tasks-create',
  /** The Scheduled tasks page's search field. */
  ScheduledTasksSearch = 'scheduled-tasks-search',
  /** The settings page's section tabs. */
  SettingsSections = 'settings-sections',
  /** The catalog's "Create" button. */
  CatalogCreate = 'catalog-create',
  /** The catalog's search field. */
  CatalogSearch = 'catalog-search',
  /** The catalog's entity-type tabs (Models, Agents, Toolsets…). */
  CatalogTabs = 'catalog-tabs',
  /** The catalog's grid/list view switch. */
  CatalogViewMode = 'catalog-view-mode',
}
