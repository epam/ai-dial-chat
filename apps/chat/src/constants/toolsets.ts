import { ApiKeys } from '@/src/types/common';

export enum ToolsetEditorQuery {
  Id = 'id',
  PublicationUrl = 'publicationUrl',
  Step = 'step',
  ReturnUrl = 'returnUrl',
}

export const DRAFT_TOOLSET_ID = `${ApiKeys.Toolsets}/draft`;

export enum ToolsetAuthAction {
  LoginWithMyCreds = 'Login with my creds',
  LogIn = 'Log in',
  LogOut = 'Log out',
}
