import { ToolsetAuthTypes } from '@epam/ai-dial-chat-hooks';
import { IconBrandOauth, IconKey, IconLockCancel } from '@tabler/icons-react';
import type { TablerIcon } from '@tabler/icons-react';
import { ToolsetEditorI18nKeys } from './translation-keys';

export enum ToolsetTransportType {
  Http = 'HTTP',
  Sse = 'SSE',
}

export enum ToolsetEditorSteps {
  General = 'general',
  Settings = 'settings',
}

/** `Id`/`ReturnUrl` intentionally match `EditorQuery`'s values; kept as their own enum for the toolset-editor-only `Step` member. */
export enum ToolsetEditorQuery {
  Id = 'id',
  Step = 'step',
  ReturnUrl = 'returnUrl',
}

export const DEFAULT_TOOLSET_NAME = 'New toolset';
export const DEFAULT_TOOLSET_VERSION = '0.0.1';

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
    Icon: IconLockCancel,
  },
};
