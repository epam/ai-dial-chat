const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Formats a publish timestamp for display: a relative phrase ("Today",
 * "Yesterday", "N days ago") within the last week, and an exact date
 * (e.g. "Nov 20, 2024") once it's a week old or more.
 */
export const formatPublishedDate = (
  publishedAt: number,
  now: number = Date.now(),
): string => {
  const daysElapsed = Math.floor((now - publishedAt) / DAY_MS);

  if (daysElapsed <= 0) {
    return 'Today';
  }
  if (daysElapsed === 1) {
    return 'Yesterday';
  }
  if (daysElapsed < 7) {
    return `${daysElapsed} days ago`;
  }

  return new Date(publishedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};
