import { Conversation } from './chat';

/** A minimal conversation-folder record carried in an export file. */
export interface ExportFolderV5 {
  /** Unique folder identifier. */
  id: string;
  /** Display name of the folder. */
  name: string;
  /** Identifier of the parent folder, if nested. */
  folderId?: string;
}

/** Versioned JSON envelope produced by conversation export (current version). */
export interface ExportFormatV5 {
  /** Format version discriminator. */
  version: 5;
  /** Exported conversations. */
  history: Conversation[];
  /** Folders the exported conversations belong to. */
  folders: ExportFolderV5[];
}

/**
 * Every export format this app can produce or (in the future) import.
 * Grows to `ExportFormatV4 | ExportFormatV5` when import is added;
 * versions below 4 are not supported.
 */
export type SupportedExportFormats = ExportFormatV5;
