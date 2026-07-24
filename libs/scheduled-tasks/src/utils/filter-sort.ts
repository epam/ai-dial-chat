import type { ScheduledTaskItem } from '../models/scheduled-task-item';

/** Sort keys supported by the Scheduled Tasks toolbar. */
export type ScheduledTasksSortKey =
  | 'firstToRun'
  | 'lastToRun'
  | 'newest'
  | 'nameAZ';

/** Case-insensitive substring match against `displayName` and `descriptionPreview`. */
export const filterScheduledTaskItems = (
  items: ScheduledTaskItem[],
  searchQuery: string,
): ScheduledTaskItem[] => {
  const query = searchQuery.trim().toLowerCase();
  if (!query) {
    return items;
  }
  return items.filter(
    (item) =>
      item.displayName.toLowerCase().includes(query) ||
      item.descriptionPreview?.toLowerCase().includes(query),
  );
};

/* Items missing the field a comparator sorts by are pushed to the end,
 * regardless of sort direction, rather than being treated as smallest. */
const compareByOptionalDate = (
  a: string | undefined,
  b: string | undefined,
  direction: 1 | -1,
): number => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return direction * (new Date(a).getTime() - new Date(b).getTime());
};

/** Sorts a (typically already-filtered) list of items by the given toolbar sort key. */
export const sortScheduledTaskItems = (
  items: ScheduledTaskItem[],
  sortKey: string,
): ScheduledTaskItem[] => {
  const sorted = [...items];
  switch (sortKey as ScheduledTasksSortKey) {
    case 'firstToRun':
      return sorted.sort((a, b) =>
        compareByOptionalDate(
          a.sortValues.nextRunAt,
          b.sortValues.nextRunAt,
          1,
        ),
      );
    case 'lastToRun':
      return sorted.sort((a, b) =>
        compareByOptionalDate(
          a.sortValues.nextRunAt,
          b.sortValues.nextRunAt,
          -1,
        ),
      );
    case 'newest':
      return sorted.sort((a, b) =>
        compareByOptionalDate(
          a.sortValues.createdAt,
          b.sortValues.createdAt,
          -1,
        ),
      );
    case 'nameAZ':
      return sorted.sort((a, b) => a.displayName.localeCompare(b.displayName));
    default:
      return sorted;
  }
};
