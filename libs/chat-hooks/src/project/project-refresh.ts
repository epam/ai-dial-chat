/** How a silent refresh of one loaded project ended. */
export enum ProjectRefreshOutcome {
  /** The details were replaced with the fresh read. */
  Updated = 'updated',
  /** The project no longer exists; the page should leave it. */
  NotFound = 'not-found',
  /** The read failed; the loaded details are kept. */
  Failed = 'failed',
  /** No project was loaded, or a newer refresh or an id change superseded this one. */
  Skipped = 'skipped',
}
