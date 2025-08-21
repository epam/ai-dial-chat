import { getEntitySearchOptions } from '@/src/utils/app/search';

import { DialAIEntityModel } from '@/src/types/models';
import { ToolsetModel } from '@/src/types/toolsets';

export const MODELS_SEARCH_OPTIONS =
  getEntitySearchOptions<DialAIEntityModel>();

export const TOOLSETS_SEARCH_OPTIONS = getEntitySearchOptions<ToolsetModel>();
