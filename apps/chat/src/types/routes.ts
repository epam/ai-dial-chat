export enum ROUTES {
  Root = '/',
  Login = '/login',
  Catalog = '/catalog',
  SharedInvitation = '/catalog/shared/:invitationId',
  ConversationSharedInvitation = '/conversations/shared/:invitationId',
  Conversations = '/conversations',
  AppsEditor = '/apps-editor',
  ToolsetEditor = '/toolset-editor',
  CustomAppEditor = '/custom-app-editor',
  PromptEditor = '/prompt-editor',
  SkillEditor = '/skill-editor',
  /**
   * The sole registered OAuth redirect_uri for every toolset's IdP client.
   * Landed on by both the admin ToolsetEditor's redirect flow AND the
   * popup-based flow started from the QuickApps iframe embedded in
   * AppsEditor — see pages/ToolsetAuthCallback/ToolsetAuthCallback.tsx.
   * The enum member name is kept for backward compatibility with the
   * already-registered URL value; do not rename without checking every
   * toolset's registered redirect_uri first.
   */
  ToolsetEditorCallback = '/toolset-editor/callback',
  ToolsetSignIn = '/auth/toolset-signin',
  FileManager = '/files',
  Settings = '/settings',
  /**
   * Route pattern for one Settings tab, the segment being a `SettingsTabs`
   * value. A pattern, not a navigable URL — build one with
   * `getSettingsTabRoute`.
   */
  SettingsTab = '/settings/:tab',
  /** Standalone Usage page; the former Settings Usage tab (`/settings/usage`) redirects here. */
  Usage = '/usage',
  Projects = '/projects',
  ProjectCreate = '/projects/new',
  /**
   * Route pattern for one project's view page; the splat is the project's
   * path inside `:bucket`. Build a URL with `getProjectViewRoute`.
   */
  ProjectView = '/projects/view/:bucket/*',
  /** Route pattern for one project's edit page; build with `getProjectEditRoute`. */
  ProjectEdit = '/projects/edit/:bucket/*',
  /** Landing route of a project share link; must match the BFF's `getInvitationRoutePath`. */
  ProjectSharedInvitation = '/projects/shared/:invitationId',
  ScheduledTasks = '/scheduled-tasks',
  ScheduledTaskCreate = '/scheduled-tasks/new',
  ScheduledTaskDetail = '/scheduled-tasks/:scheduleId',
  ScheduledTaskEdit = '/scheduled-tasks/:scheduleId/edit',
}
