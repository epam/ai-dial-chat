import { translate } from '@/src/utils/app/translation';

import { ApiKeys } from '@/src/types/common';

export enum ToolsetEditorQuery {
  Id = 'id',
  PublicationUrl = 'publicationUrl',
  Step = 'step',
  ReturnUrl = 'returnUrl',
  IsCreating = '1',
}

export const DRAFT_TOOLSET_ID = `${ApiKeys.Toolsets}/draft`;

export enum ToolsetAuthAction {
  LoginWithMyCreds = 'Login with my creds',
  LogIn = 'Log in',
  LogOut = 'Log out',
}

export const PUBLIC_TOOLSET_TOOLTIP = translate(
  'This toolset is public and cannot be edited',
);
