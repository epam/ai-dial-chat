/**
 * Sort keys supported by the Scheduled Tasks toolbar. The lib does not sort —
 * it reports the active key through `onSortChange` and renders `items` in the
 * order the host supplies them.
 */
export enum ScheduledTasksSortKey {
  /** Earliest next run first. */
  FirstToRun = 'firstToRun',
  /** Latest next run first. */
  LastToRun = 'lastToRun',
  /** Most recently created first. */
  Newest = 'newest',
  /** Task name ascending, case-insensitive. */
  NameAZ = 'nameAZ',
}
