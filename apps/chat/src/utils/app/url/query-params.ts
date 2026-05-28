import { ReadonlyURLSearchParams } from 'next/navigation';
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

export function getNumberFromSearchParams(
  searchParams: URLSearchParams,
  key: string,
  fallback = 0,
): number {
  const value = searchParams.get(key);
  return value ? parseInt(value, 10) : fallback;
}

export function getStringFromSearchParams<T extends string>(
  searchParams: URLSearchParams,
  key: string,
  fallback: T = '' as T,
): T {
  return (searchParams.get(key) ?? fallback) as T;
}

export function stripQueryParamsFromUrl(
  url: string,
  keysToStrip: string[],
): string {
  const [path, queryString] = url.split('?');
  if (!queryString) return url;

  const params = new URLSearchParams(queryString);
  keysToStrip.forEach((key) => {
    params.delete(key);
  });
  const newQuery = params.toString();

  return newQuery ? `${path}?${newQuery}` : path;
}

export const getQueryParameterCaseInsensitive = (
  searchParams: ReadonlyURLSearchParams,
  name: string,
  defaultValue?: string,
) => {
  const lowerName = name.toLowerCase();
  const paramKey = searchParams
    ?.keys()
    .find((key) => key.toLowerCase() === lowerName);
  return paramKey ? searchParams.get(paramKey) : defaultValue;
};
