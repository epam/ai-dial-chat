import { DialAIEntityModel } from '@/src/types/models';

import { IFuseOptions } from 'fuse.js';

export const MODELS_SEARCH_OPTIONS: IFuseOptions<DialAIEntityModel> = {
  keys: ['name', 'version'],
  includeScore: false,
  threshold: 0.4,
  distance: 100,
  minMatchCharLength: 1,
  useExtendedSearch: false,
  findAllMatches: true,
};
