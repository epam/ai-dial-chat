import type { FolderDestinationRoot as FileManagerDestinationRoot } from '@epam/ai-dial-react-file-manager';

/** One top-level root of the save-to-folder destination tree, e.g. Personal or Organization. */
export interface FolderDestinationRoot extends FileManagerDestinationRoot {
  /** Whether a folder under this root takes access rules, edited below the tree once selected. Defaults to `false`. */
  hasAccessRules?: boolean;
}
