import { Conversation } from '../models/chat';

/** A minimal conversation-folder record carried in an export file. */
export interface ExportFolderV5 {
  /** Unique folder identifier. */
  id: string;
  /** Display name of the folder. */
  name: string;
  /** Identifier of the parent folder, if nested. */
  folderId?: string;
}

/**
 * Conversation as serialized in export format v5.
 * Fork into a standalone frozen interface and bump to `ExportFormatV6` when
 * the domain `Conversation` model diverges from what a v5 file must hold.
 */
export type ExportConversationV5 = Conversation;

/** Versioned JSON envelope produced by conversation export (current version). */
export interface ExportFormatV5 {
  /** Format version discriminator. */
  version: 5;
  /** Exported conversations. */
  history: ExportConversationV5[];
  /** Folders the exported conversations belong to. */
  folders: ExportFolderV5[];
}

/** Alias for the export format this app currently produces. */
export type LatestExportFormat = ExportFormatV5;

/**
 * Every export format this app can produce or (in the future) import.
 * Grows to `ExportFormatV4 | ExportFormatV5` when import is added;
 * versions below 4 are not supported.
 */
export type SupportedExportFormats = ExportFormatV5;
