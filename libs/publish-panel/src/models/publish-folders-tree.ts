import type { CSSProperties } from 'react';
import type { PublishFolderNode } from './publish';

/** Color overrides for the publish destination folder tree. */
export interface PublishFoldersTreeColors {
  /** Divider color above the folder-creation controls. Defaults to `--stroke-tertiary`. */
  divider?: string;
}

/** Style overrides for the publish destination folder tree. */
export interface PublishFoldersTreeStyles {
  /** Color overrides. */
  colors?: PublishFoldersTreeColors;
  /** Additional class name applied to the component root. */
  className?: string;
  /** Additional CSS custom properties applied to the component root. */
  cssVars?: CSSProperties;
}

/** Props for the publish destination folder tree. */
export interface PublishFoldersTreeProps {
  /** Root-level folder nodes. */
  items: PublishFolderNode[];
  /** Currently selected destination path; `undefined` means no selection and `[]` means the bucket root. */
  selectedPath?: string[];
  /** Called when the selected destination changes. */
  onSelectedPathChange: (path: string[] | undefined) => void;
  /** Called when a new folder name is confirmed. */
  onCreateFolder: (parentPath: string[], name: string) => Promise<void>;
  /** Host-owned search query used to filter the tree. */
  searchQuery: string;
  /** Disables every control. Defaults to `false`. */
  disabled?: boolean;
  /** Label for the folder-creation trigger. Defaults to `'Create new folder'`. */
  createFolderLabel?: string;
  /** Label for the action that cancels folder creation. Defaults to `'Cancel'`. */
  cancelCreatingFolderLabel?: string;
  /** Label for the context-menu action that creates a sibling folder. Defaults to `'Add sibling'`. */
  addSiblingFolderLabel?: string;
  /** Label for the context-menu action that creates a child folder. Defaults to `'Add child'`. */
  addChildFolderLabel?: string;
  /** Initial folder name unless a valid unmatched search query is available. Defaults to `'New folder'`. */
  newFolderDefaultName?: string;
  /** Empty-state message with a `{query}` placeholder. Defaults to `'No folders match "{query}".'`. */
  noResultsLabel?: string;
  /** Validation message for an empty folder name. Defaults to `'Folder name cannot be empty.'`. */
  emptyFolderNameError?: string;
  /** Validation message for a forbidden folder name. Defaults to `'Folder name contains invalid characters.'`. */
  invalidFolderNameError?: string;
  /** Validation message for a duplicate folder name. Defaults to `'A folder with this name already exists.'`. */
  duplicateFolderNameError?: string;
  /** Label for the selectable bucket root. Defaults to `'Organization'`. */
  rootLabel?: string;
  /** Externally controlled expanded folder path keys. */
  expandedPaths?: Set<string>;
  /** Called when expanded folder path keys change. */
  onExpandedPathsChange?: (paths: Set<string>) => void;
  /** Folder path keys currently being fetched by the host. */
  loadingPaths?: Set<string>;
  /** Style overrides. */
  styles?: PublishFoldersTreeStyles;
}
