/** A host-agnostic view model for a single deployment shown in UI components. */
export interface DeploymentItem {
  /** Unique stable identifier from DIAL Core. */
  id: string;
  /** Human-readable display name. Falls back to `id` when absent. */
  displayName?: string;
  /** URL-safe icon reference. Resolved to a usable `<img src>` by the host app before passing. */
  iconUrl?: string;
  /** Deployment kind — used to choose a fallback icon. Typically `'model'` or `'application'`. */
  type?: string;
  /** MIME types accepted as input attachments (e.g. `['audio/*', 'image/*']`). Undefined when not specified by DIAL Core. */
  inputAttachmentTypes?: string[];
  /** Human-readable description of the deployment. */
  description?: string;
  /** ISO timestamp of last update time from DIAL Core (e.g. "2024-05-01T12:34:56Z"). */
  updatedAt?: string;
  /** Display version string. */
  displayVersion?: string;
  /** Whether this deployment is featured (configured via env). */
  isFeatured?: boolean;
  /** Whether this deployment is hidden (configured via env). */
  isHidden?: boolean;
}
