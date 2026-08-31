import type { DialFile } from '@epam/ai-dial-react-file-manager';

/** Result returned by the file-manager attach modal when the user confirms a selection. */
export interface AttachResult {
  /** Selected files (individual items, not folders). */
  files: DialFile[];
  /** Virtual paths of selected folders. */
  folderPaths: string[];
}
