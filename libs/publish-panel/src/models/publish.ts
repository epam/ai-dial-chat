/** A single folder in the "publish to folder" destination tree. */
export interface PublishFolderNode {
  /** Full path segments to this folder, outermost first. Also serves as the unique key. */
  path: string[];
  /** Display name of this folder (its last path segment). */
  name: string;
  /** Child folders, if any. */
  children?: PublishFolderNode[];
}

/**
 * A previously published version of a catalog entity, or a previous
 * publication of an unversioned resource (e.g. a conversation).
 */
export interface PublishHistoryEntry {
  /**
   * Semantic version string, e.g. "4.0.0". `undefined` for unversioned
   * resources (e.g. a conversation), where a folder having any entry at all
   * already means "already published here" — see `usePublishFlow`.
   */
  version?: string;
  /** Unix timestamp (ms) when this version was published. */
  publishedAt: number;
  /** Display name of the user who published this version. */
  publishedBy: string;
  /** Folder path segments this version was published to, outermost first. */
  folderPath: string[];
}

/**
 * Minimal display data for the Publish flow's entity-summary row and for
 * version-derived behavior (the replace-warning callout, the publish-history
 * section's visibility), covering both versioned entities and unversioned
 * resources (e.g. a conversation). `PublishPanel` renders a title-only row
 * from this by default; a host needing a richer summary (icon, type badge)
 * passes `renderSummary` alongside this instead.
 */
export interface PublishResourceSummary {
  /** Display title/name shown in the summary row. */
  title: string;
  /** Icon URL, if any. */
  iconUrl?: string;
  /** Version, when the resource is versioned. `undefined` for conversations. */
  version?: string;
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
  /**
   * Whether the selected folder already has this publication — this exact
   * version, for a versioned catalog entity, or any prior publication at
   * all, for an unversioned resource (e.g. a conversation).
   */
  hasExistingPublicationInFolder: boolean;
  /** Whether the current user can publish to the selected folder. */
  hasWriteAccess: boolean;
  /** Whether a publish request is currently in flight. */
  isSubmitting: boolean;
  /** Whether the most recent submit attempt failed. */
  hasSubmitError: boolean;
  /**
   * Whether resubmitting when `hasExistingPublicationInFolder` is true is
   * allowed (catalog: republishing replaces the existing version) or
   * blocked entirely (conversations have no update/replace semantics —
   * publishing again to the same folder is not supported). Default `true`.
   */
  allowReplace?: boolean;
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
