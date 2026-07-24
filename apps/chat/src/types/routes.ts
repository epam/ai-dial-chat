export enum ROUTES {
  Root = '/',
  Login = '/login',
  Catalog = '/catalog',
  SharedInvitation = '/catalog/shared/:invitationId',
  ConversationSharedInvitation = '/conversations/shared/:invitationId',
  Conversations = '/conversations',
  AppsEditor = '/apps-editor',
  ToolsetEditor = '/toolset-editor',
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
  ScheduledTasks = '/scheduled-tasks',
  ScheduledTaskCreate = '/scheduled-tasks/new',
}
