/** A single folder in the "publish to folder" destination tree. */
export interface PublishFolderNode {
  /** Full path segments to this folder, outermost first. Also serves as the unique key. */
  path: string[];
  /** Display name of this folder (its last path segment). */
  name: string;
  /** Child folders, if any. */
  children?: PublishFolderNode[];
}

/** A previously published version of a catalog entity. */
export interface PublishHistoryEntry {
  /** Semantic version string, e.g. "4.0.0". */
  version: string;
  /** Unix timestamp (ms) when this version was published. */
  publishedAt: number;
  /** Display name of the user who published this version. */
  publishedBy: string;
  /** Folder path segments this version was published to, outermost first. */
  folderPath: string[];
}

/** Which callout (if any) the publish panel should show below the folder picker. */
export enum PublishCalloutKind {
  /** No callout — no folder selected, or a request is in flight. */
  None = 'none',
  /** Informational callout describing who gets access once published. */
  Info = 'info',
  /** Warning callout — publishing will replace an existing version in this folder. */
  ReplaceWarning = 'replaceWarning',
  /** Error callout — the user lacks write access to the selected folder. */
  NoAccess = 'noAccess',
  /** Error callout — the most recent submit attempt failed. */
  SubmitError = 'submitError',
}

/** Inputs used to derive the publish panel's callout and submit-button state. */
export interface PublishDerivationInput {
  /** Whether a destination folder is currently selected. */
  hasSelectedFolder: boolean;
  /** Whether the selected folder already has this exact version published. */
  hasExistingVersionInFolder: boolean;
  /** Whether the current user can publish to the selected folder. */
  hasWriteAccess: boolean;
  /** Whether a publish request is currently in flight. */
  isSubmitting: boolean;
  /** Whether the most recent submit attempt failed. */
  hasSubmitError: boolean;
}

/** Derived, render-ready state for the publish panel. */
export interface PublishDerivedState {
  /** Which callout (if any) to show below the folder picker. */
  calloutKind: PublishCalloutKind;
  /** Whether the submit button is disabled. */
  isSubmitDisabled: boolean;
  /** Whether the submit button should show its loading/spinner state. */
  isSubmitLoading: boolean;
}
