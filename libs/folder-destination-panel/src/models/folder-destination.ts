import type { FolderNode } from './folder-tree';

/** A destination folder inside one of the roots of a multi-root folder tree. */
export interface FolderDestination {
  /** Key of the root the folder belongs to, as given in {@link FolderDestinationRoot.key}. */
  rootKey: string;
  /** Folder path segments inside that root; `[]` is the root itself. */
  path: string[];
}

/** One top-level root of a multi-root folder tree, e.g. Personal or Organization. */
export interface FolderDestinationRoot {
  /** Stable identifier of the root, reported back in {@link FolderDestination.rootKey}. Must not contain `/`. */
  key: string;
  /** Visible name of the root node. */
  label: string;
  /** Folder nodes loaded so far under this root, with paths relative to the root. */
  items: FolderNode[];
  /** Whether folders can be created under this root. Defaults to `true`. */
  canCreateFolders?: boolean;
  /** Expanded folder path keys inside this root, when the host controls them. */
  expandedPaths?: Set<string>;
  /** Called with this root's expanded folder path keys whenever they change. */
  onExpandedPathsChange?: (paths: Set<string>) => void;
  /** Folder path keys inside this root that the host is currently fetching. */
  loadingPaths?: Set<string>;
  /** Host flag carried on the root and never read by this library; `@epam/ai-dial-publish-panel` uses it to show access rules for folders under the root. */
  hasAccessRules?: boolean;
}
