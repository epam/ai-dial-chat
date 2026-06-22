import { extensions } from 'mime-types';

export const MIME_FORMAT_REGEX =
  /^([a-zA-Z0-9!*\-.+]+|\*)\/([a-zA-Z0-9!*\-.+]+|\*)$/;

export const BYTES_IN_MB = 1_048_576;
export const BYTES_IN_KB = 1_024;

export const MAX_FILE_SIZE_IN_BYTES = BYTES_IN_MB * 512;

export const MAX_VISIBLE_NOTIFICATION_ITEMS = 5;

export const FALLBACK_CONTENT_TYPE = 'application/octet-stream';

export const TEMP_FILE_NAME_IN_FILE_MANAGER = '.dial_folder';

export enum FileItemEventIds {
  Cancel = 'cancel',
  Retry = 'retry',
  Toggle = 'toggle',
  ToggleFolder = 'toggleFolder',
  Delete = 'delete',
  Unshare = 'unshare',
}

// Extend the list of allowed file extensions for specific MIME types from 'mime-types' package
export const ADDITIONAL_FILE_EXTENSIONS: Record<string, string[]> = {
  'text/javascript': ['js'],
};

// Combine the extensions from 'mime-types' with the additional allowed file extensions
export const ALL_FILE_EXTENSIONS = {
  ...extensions,
  ...ADDITIONAL_FILE_EXTENSIONS,
};
