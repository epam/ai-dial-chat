/**
 * Zero-byte marker object that makes an empty folder visible in DIAL Core listings.
 * Must stay in sync with `HIDDEN_FILE` in `libs/chat-shared/src/constants/dial.ts`.
 */
export const MARKER_NAME = '.dial_folder';
export const FOLDER_NODE_TYPE = 'folder';

/**
 * Root-level folders the BFF itself writes user config/legacy migration data into
 * (see UserConfigService). They must never be exposed through the files listing API.
 */
export const RESERVED_ROOT_FOLDER_NAMES = ['.client_data', 'clientdata'];
