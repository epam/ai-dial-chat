import { DialAIEntityModel } from '@/src/types/models';
import { ToolsetModel } from '@/src/types/toolsets';

import { IFuseOptions } from 'fuse.js';

export const MODELS_SEARCH_OPTIONS: IFuseOptions<DialAIEntityModel> = {
  keys: ['name', 'version'],
  threshold: 0.2,
  distance: 100,
  minMatchCharLength: 1,
  ignoreLocation: true,
  useExtendedSearch: false,
  findAllMatches: false,
  isCaseSensitive: false,
  includeScore: false,
};

export const TOOLSETS_SEARCH_OPTIONS: IFuseOptions<ToolsetModel> = {
  keys: ['name', 'version'],
  threshold: 0.2,
  distance: 100,
  minMatchCharLength: 1,
  ignoreLocation: true,
  useExtendedSearch: false,
  findAllMatches: false,
  isCaseSensitive: false,
  includeScore: false,
};
