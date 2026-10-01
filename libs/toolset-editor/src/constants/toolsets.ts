import {
  SEMVER_VERSION_PATTERN,
  type DeploymentCreationFormValidationOptions,
} from '@epam/ai-dial-builder-form';
import { ToolsetAuthTypes } from '@epam/ai-dial-chat-hooks';
import { IconBrandOauth, IconKey, IconLockOff } from '@tabler/icons-react';
import type { TablerIcon } from '@tabler/icons-react';

export enum ToolsetTransportType {
  /** Streamable HTTP MCP transport. */
  Http = 'HTTP',
  /** Server-sent events MCP transport. */
  Sse = 'SSE',
}

/** Default display name seeded into a new toolset form. */
export const DEFAULT_TOOLSET_NAME = 'New toolset';

/** Default display version seeded into a new toolset form. */
export const DEFAULT_TOOLSET_VERSION = '1.0.0';

/** Metadata checks for a toolset: the version must be SemVer 2.0.0, as DIAL Admin requires. */
export const TOOLSET_METADATA_VALIDATION_OPTIONS: DeploymentCreationFormValidationOptions =
  { validateVersionPattern: SEMVER_VERSION_PATTERN };

/** Icon shown for each toolset authentication-type segment; labels arrive via the auth labels. */
export const AUTH_TYPE_ICONS: Record<ToolsetAuthTypes, TablerIcon> = {
  [ToolsetAuthTypes.OAuth]: IconBrandOauth,
  [ToolsetAuthTypes.ApiKey]: IconKey,
  [ToolsetAuthTypes.None]: IconLockOff,
};
