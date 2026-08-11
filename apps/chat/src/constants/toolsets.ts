import {
  IconBrandOauth,
  IconKey,
  IconLockOff,
  IconProps,
} from '@tabler/icons-react';
import { ForwardRefExoticComponent, RefAttributes } from 'react';

import { translate } from '@/src/utils/app/translation';

import { ApiKeys } from '@/src/types/common';
import { ToolsetAuthResultMessageType } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { CommonI18nKeys } from '@/src/constants/i18n';

import { ToolsetAuthTypes } from '@epam/ai-dial-shared';

export enum ToolsetEditorQuery {
  Id = 'id',
  PublicationUrl = 'publicationUrl',
  Step = 'step',
  ReturnUrl = 'returnUrl',
  IsCreating = 'isCreating',
}

export enum ToolsetLoginQuery {
  LoginComplete = 'login-complete',
  /** Where the sign in attempt broke down, a `ToolsetAuthErrorReason` value */
  Reason = 'reason',
  /** Trace id of the failed sign in request, for correlating with DIAL Core logs */
  TraceId = 'trace-id',
  // Error params an OAuth provider may redirect back with, see RFC 6749 §4.1.2.1
  Error = 'error',
  ErrorDescription = 'error_description',
  ErrorUri = 'error_uri',
}

export const DRAFT_TOOLSET_ID = `${ApiKeys.Toolsets}/draft`;

export enum ToolsetAuthAction {
  LoginWithMyCreds = 'Login with my creds',
  LogIn = 'Log in',
  LogOut = 'Log out',
}

export const PUBLIC_TOOLSET_TOOLTIP = translate(
  CommonI18nKeys.ToolsetIsPublicCannotBeEdited,
  {
    ns: Translation.Common,
  },
);

export const TOOLSET_AUTH_POPUP_NAME = 'toolset-auth';

export const TOOLSET_AUTH_RESULT_MESSAGE_TYPE: ToolsetAuthResultMessageType =
  'toolset-auth-result';

export const AUTH_TYPE_OPTIONS: Record<
  string,
  {
    name: string;
    Icon: ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>;
  }
> = {
  [ToolsetAuthTypes.OAUTH]: {
    name: 'OAuth',
    Icon: IconBrandOauth,
  },
  [ToolsetAuthTypes.API_KEY]: {
    name: 'API Key',
    Icon: IconKey,
  },
  [ToolsetAuthTypes.NONE]: {
    name: 'Without authentication',
    Icon: IconLockOff,
  },
};
