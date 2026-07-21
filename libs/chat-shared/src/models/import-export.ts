import { Conversation } from './chat';

/** A minimal conversation-folder record carried in an export file. */
export interface ExportFolder {
  /** Unique folder identifier. */
  id: string;
  /** Display name of the folder. */
  name: string;
  /** Identifier of the parent folder, if nested. */
  folderId?: string;
}

/**
 * Versioned JSON envelope produced by conversation export, and read back on
 * import.
 */
export interface ExportFormat {
  /** Format version discriminator. Only `5` is currently produced or accepted. */
  version: 5;
  /** Exported conversations. */
  history: Conversation[];
  /** Folders the exported conversations belong to. */
  folders: ExportFolder[];
}
