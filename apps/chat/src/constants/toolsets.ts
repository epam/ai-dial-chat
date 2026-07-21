import { IconBrandOauth, IconKey, IconLockOff } from '@tabler/icons-react';
import type { TablerIcon } from '@tabler/icons-react';
import { ToolsetAuthTypes } from '../types/toolsets';
import { ToolsetEditorI18nKeys } from './translation-keys';

export enum ToolsetEditorQuery {
  Id = 'id',
  Step = 'step',
  ReturnUrl = 'returnUrl',
}

export const DEFAULT_TOOLSET_NAME = 'New toolset';
export const DEFAULT_TOOLSET_VERSION = '0.0.1';

/** `sessionStorage` key `initiateOAuthLogin` writes the admin flow's `ToolsetRedirectState` under, in the popup it opens. */
export const TOOLSET_REDIRECT_STATE_KEY = 'toolset-redirect-state';

export interface AuthTypeOption {
  labelKey: ToolsetEditorI18nKeys;
  Icon: TablerIcon;
}

export const AUTH_TYPE_OPTIONS: Record<ToolsetAuthTypes, AuthTypeOption> = {
  [ToolsetAuthTypes.OAuth]: {
    labelKey: ToolsetEditorI18nKeys.AuthTypeOAuth,
    Icon: IconBrandOauth,
  },
  [ToolsetAuthTypes.ApiKey]: {
    labelKey: ToolsetEditorI18nKeys.AuthTypeApiKey,
    Icon: IconKey,
  },
  [ToolsetAuthTypes.None]: {
    labelKey: ToolsetEditorI18nKeys.AuthTypeNone,
    Icon: IconLockOff,
  },
};
