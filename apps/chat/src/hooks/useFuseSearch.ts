import { useMemo } from 'react';

import Fuse, { IFuseOptions } from 'fuse.js';

export const useFuseSearch = <T>(
  items: T[],
  query?: string,
  fuseOptions?: IFuseOptions<T>,
) => {
  const extendedQuery = useMemo(() => {
    const tokens = query
      ? query
          .trim()
          .split(' ')
          .map((t) => t.trim())
          .filter((t) => !!t)
      : [];

    if (tokens.length < 2 || !fuseOptions?.keys) {
      const trimmed = query?.trim();
      return trimmed && trimmed.length > 0 ? trimmed : undefined;
    }

    return {
      $or: fuseOptions.keys.map((key) => ({
        $and: tokens.map((token) => ({
          [key as string]: token,
        })),
      })),
    };
  }, [query, fuseOptions?.keys]);

  const searchableCollection = useMemo(() => {
    return new Fuse(items, fuseOptions);
  }, [fuseOptions, items]);

  const result = useMemo(() => {
    return extendedQuery
      ? searchableCollection.search(extendedQuery).map(({ item }) => item)
      : items;
  }, [extendedQuery, searchableCollection, items]);

  return result;
};
