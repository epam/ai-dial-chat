import type { CSSProperties } from 'react';

/** Publication state of one saved version, as the host resolved it. */
export enum VersionHistoryStatus {
  /** No live or pending publication of the version. */
  NotPublished = 'not-published',
  /** A publication request of the version is waiting for an administrator. */
  InReview = 'in-review',
  /** An approved publication of the version is live. */
  Published = 'published',
  /** The state cannot be read, for a version the user does not own. */
  Unknown = 'unknown',
}

/** One saved version in the Versions history section. */
export interface VersionHistoryRow {
  /** Stable identifier of the version, used as the list key. */
  id: string;
  /** Version text as the user knows it. */
  version: string;
  /** Whether this is the version being edited or published. */
  isCurrent: boolean;
  /** Publication state; omit while it is still loading. */
  status?: VersionHistoryStatus;
  /** Folders a published version is published to. */
  publishedFolders?: string[];
  /** Folder the version is saved in, already formatted by the host. */
  folder?: string;
  /** Last modified date, already formatted by the host. */
  modifiedAt?: string;
  /** Author line, already formatted and translated by the host. */
  author?: string;
}

/** Text overrides for the Versions history section. */
export interface VersionHistoryLabels {
  /** Section heading. Defaults to `'Versions history'`. */
  heading?: string;
  /** Marker of the version being edited or published. Defaults to `'Current'`. */
  currentLabel?: string;
  /** Status of a version with no publication. Defaults to `'Not published'`. */
  notPublishedLabel?: string;
  /** Status of a version with a request waiting for approval. Defaults to `'In review'`. */
  inReviewLabel?: string;
  /** Status badge of a published version. Defaults to `'Published'`. */
  publishedLabel?: string;
  /** Line under a published version; `{folders}` is replaced by the comma-joined folders. Defaults to `'Published in {folders}'`. */
  publishedInLabel?: string;
  /** Status of a version whose publication state cannot be read. Defaults to `'Status unavailable'`. */
  unknownLabel?: string;
  /** Message announced to screen readers while statuses load; a placeholder is drawn in each status slot. Defaults to `'Loading publication statuses…'`. */
  loadingLabel?: string;
  /** Message shown when the group lists no version. Defaults to `'No saved versions yet.'`. */
  emptyLabel?: string;
  /** Message shown and announced when the statuses request fails. Defaults to `'Could not load publication statuses.'`. */
  errorLabel?: string;
  /** Label of the action that reloads the statuses. Defaults to `'Retry'`. */
  retryLabel?: string;
}

/** Color overrides for the Versions history section. */
export interface VersionHistoryColors {
  /** Heading text color. Defaults to `--text-primary`. */
  headingText?: string;
  /** Version text color. Defaults to `--text-primary`. */
  versionText?: string;
  /** Last modified date text color. Defaults to `--text-primary`. */
  dateText?: string;
  /** Folder, author and published-folders text color. Defaults to `--text-secondary`. */
  metaText?: string;
  /** Fill of the status placeholder shown while statuses load. Defaults to `--bg-control-disable-primary`. */
  skeleton?: string;
  /** Border color between rows. Defaults to `--stroke-tertiary`. */
  rowBorder?: string;
}

/** Style overrides for the Versions history section. */
export interface VersionHistoryStyles {
  /** Color overrides. */
  colors?: VersionHistoryColors;
  /** Additional CSS custom properties applied to the section root. */
  cssVars?: CSSProperties;
}

/** Props for `VersionHistorySection`; the Save and Publish panels take the same object as `versionHistory`. */
export interface VersionHistorySectionProps {
  /** Saved versions in display order; the host sorts them. */
  rows: VersionHistoryRow[];
  /** Whether the statuses are still loading. Defaults to `false`. */
  isLoading?: boolean;
  /** Whether the statuses request failed; the rows stay visible. Defaults to `false`. */
  hasError?: boolean;
  /** Called when the user retries a failed statuses request. */
  onRetry?: () => void;
  /** Text overrides. */
  labels?: VersionHistoryLabels;
  /** Typography class of the heading. Defaults to `'dial-body-semi-text'`. */
  headingClassName?: string;
  /** Typography class of each version. Defaults to `'dial-small-semi-text'`. */
  versionClassName?: string;
  /** Typography class of the last modified date. Defaults to `'dial-small-text'`. */
  dateClassName?: string;
  /** Typography class of the folder, author and published-folders lines. Defaults to `'dial-tiny-text'`. */
  metaClassName?: string;
  /** Style overrides. */
  styles?: VersionHistoryStyles;
}
