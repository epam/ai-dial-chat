import type { ScheduledTaskTimezoneOption } from '../models/scheduled-task-timezone-props';

/** Lower-cases and trims what the user typed into the zone search. */
export const normalizeTimezoneQuery = (query: string): string =>
  query.trim().toLowerCase();

/**
 * Keeps the options whose search terms contain the query, in their given order.
 * An empty query keeps every option.
 */
export const filterTimezoneOptions = (
  options: readonly ScheduledTaskTimezoneOption[],
  query: string,
): ScheduledTaskTimezoneOption[] => {
  const normalized = normalizeTimezoneQuery(query);
  if (!normalized) return [...options];
  return options.filter((option) =>
    option.searchTerms.some((term) => term.includes(normalized)),
  );
};
