/** A single folder in a destination folder tree. */
export interface FolderNode {
  /** Full path segments to this folder, outermost first. Also serves as the unique key. */
  path: string[];
  /** Display name of this folder (its last path segment). */
  name: string;
  /** Child folders, if any. */
  children?: FolderNode[];
}
