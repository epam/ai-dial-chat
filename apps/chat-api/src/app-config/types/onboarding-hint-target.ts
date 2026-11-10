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
  /** The catalog's "Create" button. */
  CatalogCreate = 'catalog-create',
  /** The catalog's search field. */
  CatalogSearch = 'catalog-search',
  /** The catalog's entity-type tabs (Models, Agents, Toolsets…). */
  CatalogTabs = 'catalog-tabs',
  /** The catalog's grid/list view switch. */
  CatalogViewMode = 'catalog-view-mode',
}
