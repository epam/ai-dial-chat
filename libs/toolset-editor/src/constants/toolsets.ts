import {
  DEFAULT_DEPLOYMENT_VERSION,
  type DeploymentCreationFormLabels,
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

/** Default display version seeded into a new toolset form; the shared deployment default. */
export const DEFAULT_TOOLSET_VERSION = DEFAULT_DEPLOYMENT_VERSION;

/** Toolset-flavoured English metadata field labels used when the host omits `labels.general.form`. */
export const DEFAULT_TOOLSET_METADATA_LABELS: DeploymentCreationFormLabels = {
  name: { label: 'Name', placeholder: 'Enter name' },
  description: {
    label: 'Description',
    placeholder: 'Describe what this toolset does',
  },
  iconUrl: {
    label: 'Avatar',
    addAvatarLabel: 'Add avatar',
    captionText: 'PNG, JPG or SVG (max 1 MB)',
  },
  version: { label: 'Version', placeholder: 'e.g. 1.0.0' },
  topics: { label: 'Tags', placeholder: 'Add tags, comma separated' },
  otherLocales: {
    summaryLabel: 'Locales',
    addLabel: 'Add locales',
    editLabel: 'Edit locales',
    popupTitle: 'Add locale',
    addLocaleLabel: 'Add locale',
    localeRowLabel: 'Locale',
    languageLabel: 'Language',
    nameLabel: 'Name',
    namePlaceholder: 'Enter name',
    descriptionLabel: 'About',
    descriptionPlaceholder: 'Enter brief description',
    deleteAriaLabel: 'Delete locale',
    cancelLabel: 'Cancel',
    saveLabel: 'Save',
  },
  ariaLabel: 'General',
};

/** Icon shown for each toolset authentication-type segment; labels arrive via the auth labels. */
export const AUTH_TYPE_ICONS: Record<ToolsetAuthTypes, TablerIcon> = {
  [ToolsetAuthTypes.OAuth]: IconBrandOauth,
  [ToolsetAuthTypes.ApiKey]: IconKey,
  [ToolsetAuthTypes.None]: IconLockOff,
};
