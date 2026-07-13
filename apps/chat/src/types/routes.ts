export enum ROUTES {
  Root = '/',
  Login = '/login',
  Catalog = '/catalog',
  SharedInvitation = '/catalog/shared/:invitationId',
  ConversationSharedInvitation = '/conversations/shared/:invitationId',
  Conversations = '/conversations',
  AppsEditor = '/apps-editor',
  ToolsetEditor = '/toolset-editor',
  ToolsetEditorCallback = '/toolset-editor/callback',
  FileManager = '/files',
}
