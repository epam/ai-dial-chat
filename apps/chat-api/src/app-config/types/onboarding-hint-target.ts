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
  /** The catalog's source filter ("From" / "My"). */
  CatalogFilter = 'catalog-filter',
  /** The catalog's sort menu, or the browse-settings button on a phone. */
  CatalogSort = 'catalog-sort',
  /** The first catalog card on screen. */
  CatalogCard = 'catalog-card',
  /** The favorite star of the first catalog card on screen. */
  CatalogFavorite = 'catalog-favorite',
  /** The action bar (Copy, Regenerate…) of the last message in the open conversation. */
  MessageActions = 'message-actions',
  /** The catalog item details drawer as a whole. */
  CatalogDetails = 'catalog-details',
  /** The details drawer's "Use in chat" button. */
  CatalogDetailsUseInChat = 'catalog-details-use-in-chat',
  /** The details drawer's "Manage" menu button. */
  CatalogDetailsManage = 'catalog-details-manage',
  /** The details drawer's toolset sign-in / credentials button. */
  CatalogDetailsCredentials = 'catalog-details-credentials',
  /** The details drawer's "Share" button. */
  CatalogDetailsShare = 'catalog-details-share',
  /** The details drawer's "Publish" / "Unpublish" button. */
  CatalogDetailsPublish = 'catalog-details-publish',
  /** The details drawer's tabs. */
  CatalogDetailsTabs = 'catalog-details-tabs',
  /** The project create/edit form's "Create" / "Save" button. */
  ProjectFormSubmit = 'project-form-submit',
  /** The project create/edit form's "Context" section. */
  ProjectFormContext = 'project-form-context',
  /** The project view's "Edit" button. */
  ProjectViewEdit = 'project-view-edit',
  /** The project view's "More actions" menu button. */
  ProjectViewMoreActions = 'project-view-more-actions',
  /** The project view's "Pin" / "Unpin" button. */
  ProjectViewPin = 'project-view-pin',
  /** The project view's "Publish" / "Unpublish" button. */
  ProjectViewPublish = 'project-view-publish',
  /** The project details panel's context-file search. */
  ProjectContextSearch = 'project-context-search',
  /** The Projects page's sort control. */
  ProjectsSort = 'projects-sort',
  /** The scheduled task form's "Create" / "Save" button. */
  ScheduledTaskFormSubmit = 'scheduled-task-form-submit',
  /** The scheduled task form's "Configuration" section. */
  ScheduledTaskConfiguration = 'scheduled-task-configuration',
  /** The scheduled task form's "Repeat" picker. */
  ScheduledTaskRepeat = 'scheduled-task-repeat',
  /** The scheduled task form's model or agent picker. */
  ScheduledTaskModel = 'scheduled-task-model',
  /** A scheduled task's "Start now" button. */
  ScheduledTaskStartNow = 'scheduled-task-start-now',
  /** A scheduled task's "Edit" button. */
  ScheduledTaskEdit = 'scheduled-task-edit',
  /** A scheduled task's run history. */
  ScheduledTaskHistory = 'scheduled-task-history',
  /** A scheduled task's "Active" switch. */
  ScheduledTaskActive = 'scheduled-task-active',
  /** The Scheduled tasks page's sort menu. */
  ScheduledTasksSort = 'scheduled-tasks-sort',
  /** The settings page's extensions table. */
  SettingsExtensions = 'settings-extensions',
  /** The extensions table's "Log in" button. */
  SettingsExtensionsLogIn = 'settings-extensions-log-in',
  /** The settings page's theme picker. */
  SettingsTheme = 'settings-theme',
  /** The settings page's language picker. */
  SettingsLanguage = 'settings-language',
  /** The "Duplicate the conversation to be able to edit it" button of a read-only chat. */
  DuplicateSharedChat = 'duplicate-shared-chat',
  /** The conversation sources panel. */
  SourcesPanel = 'sources-panel',
  /** The sources panel's "Download all" button. */
  SourcesDownloadAll = 'sources-download-all',
  /** A project chat's "Back to <project>" button. */
  ProjectChatBack = 'project-chat-back',
  /** The composer's tools chip. */
  ToolsSelector = 'tools-selector',
  /** An app, toolset or custom-app editor's "Setup" section. */
  EditorSetup = 'editor-setup',
  /** The open conversation's row in the sidebar's chat list. */
  ActiveChat = 'active-chat',
  /** The "More actions" menu button of the open conversation's row (pin, duplicate, export, share…). */
  ActiveChatActions = 'active-chat-actions',
}
