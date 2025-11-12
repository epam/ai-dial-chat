import Router from 'next/router';

/**
 * Updates query parameters in the URL, avoiding unnecessary re-renders.
 *
 * @param updates - the object with the key-value pairs of the parameters to update
 * @param options.shallow - use shallow routing (default: true)
 */
export const updateQueryParams = (
  updates: Record<string, string | null>,
  options: Partial<{ shallow: boolean }> = { shallow: true },
) => {
  if (typeof window === 'undefined') return;

  const currentQuery = { ...Router.query };

  Object.entries(updates).forEach(([key, value]) => {
    if (value === null) {
      delete currentQuery[key];
    } else {
      currentQuery[key] = value;
    }
  });

  Router.replace(
    {
      pathname: Router.pathname,
      query: currentQuery,
    },
    undefined,
    {
      shallow: options?.shallow ?? true,
    },
  );
};
