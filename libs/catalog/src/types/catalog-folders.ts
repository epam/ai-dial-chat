/** Top-level folder groups listed under "All entities" in the catalog folder tree. */
export enum CatalogFolderRootKind {
  /** The current user's own entities. */
  Personal = 'personal',
  /** Entities shared with the current user. */
  Shared = 'shared',
  /** Entities published to the organization. */
  Organization = 'organization',
}

/** A top-level node under "All entities"; `label` is the host's translated text. */
export interface CatalogFolderRoot {
  /** Which root this is. */
  kind: CatalogFolderRootKind;
  /** Display name of the root, e.g. 'Organization'. */
  label: string;
}

/** A folder picked in the catalog; no `root` means All entities. */
export interface CatalogFolderSelection {
  /** Selected root, or `undefined` for All entities. */
  root?: CatalogFolderRootKind;
  /** Subfolders below the root, outermost first; empty for the root itself. */
  path: string[];
}
