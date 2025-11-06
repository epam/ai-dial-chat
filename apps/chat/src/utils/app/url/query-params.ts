import Router from 'next/router';

/**
 * Updates a query parameter in the URL, avoiding unnecessary re-renders.
 *
 * @param key - the name of the parameter
 * @param value - the new value; if null, the parameter is deleted
 * @param options.shallow - use shallow routing (default: true)
 */
export const updateQueryParamWithReplace = (
  key: string,
  value: string | null,
  options: Partial<{ shallow: boolean }> = { shallow: true },
) => {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);

  if (value === null) {
    params.delete(key);
  } else {
    params.set(key, value);
  }

  const newQuery = params.toString();
  const currentQuery = window.location.search.slice(1);

  if (newQuery !== currentQuery) {
    Router.replace(`?${newQuery}`, undefined, {
      shallow: options?.shallow ?? true,
    });
  }
};
