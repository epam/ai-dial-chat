import { useMemo } from 'react';

import Fuse, { IFuseOptions } from 'fuse.js';

export const useFuseSearch = <T>(
  items: T[],
  query?: string,
  fuseOptions?: IFuseOptions<T>,
) => {
  const searchableCollection = useMemo(() => {
    return new Fuse(items, fuseOptions);
  }, [fuseOptions, items]);

  const result = useMemo(() => {
    return query
      ? searchableCollection.search(query).map(({ item }) => item)
      : items;
  }, [query, searchableCollection, items]);

  return result;
};
