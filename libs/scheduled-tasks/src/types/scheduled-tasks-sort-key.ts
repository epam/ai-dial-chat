/** Sort keys supported by the Scheduled Tasks toolbar. */
export enum ScheduledTasksSortKey {
  /** Sort by `sortValues.nextRunAt` ascending — earliest next run first. Items with no `nextRunAt` sort last. */
  FirstToRun = 'firstToRun',
  /** Sort by `sortValues.nextRunAt` descending — latest next run first. Items with no `nextRunAt` sort last. */
  LastToRun = 'lastToRun',
  /** Sort by `sortValues.createdAt` descending — most recently created first. Items with no `createdAt` sort last. */
  Newest = 'newest',
  /** Sort by `item.displayName` ascending, case-insensitive. */
  NameAZ = 'nameAZ',
}
