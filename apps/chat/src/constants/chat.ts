import { MouseEvent } from 'react';

import { translate } from '@/src/utils/app/translation';

import { EntityType } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';

import { ImageMIMEType } from '@epam/ai-dial-shared';

export const modelCursorSign = '▍';
export const modelCursorSignWithBackquote = '`▍`';
export const RECENT_MODELS_COUNT = 100;

export const stopBubbling = <T>(e: MouseEvent<T>) => {
  e.stopPropagation();
};

export const PLOTLY_CONTENT_TYPE = 'application/vnd.plotly.v1+json';

export const ISOLATED_MODEL_QUERY_PARAM = 'isolated-model-id';
export const CONVERSATION_QUERY_PARAM = 'conversation-id';
export const ACTION_QUERY_PARAM = 'action';

export const DEFAULT_CUSTOM_ATTACHMENT_WIDTH = 150;
export const DEFAULT_CUSTOM_ATTACHMENT_HEIGHT = 150;

export const MIN_TWO_CAL_CHAT_SETTINGS_WIDTH = 510;
export const CENTRAL_CHAT_MIN_WIDTH = 800;

export const REPLAY_AS_IS_MODEL = 'REPLAY_AS_IS_MODEL';

export const DESCRIPTION_DELIMITER_REGEX = /\n\s*\n/;

export const IMAGE_TYPES: ImageMIMEType[] = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/apng',
  'image/webp',
  'image/avif',
  'image/svg+xml',
  'image/bmp',
  'image/vnd.microsoft.icon',
  'image/x-icon',
];

export const IMAGE_TYPES_SET: Set<ImageMIMEType> = new Set<ImageMIMEType>(
  IMAGE_TYPES,
);

export const LOCAL_BUCKET = 'local';

export const DEFAULT_AGENT = 'default-agent';
export const LAST_USED_AGENT = 'last-used-agent';

export const DEFAULT_MODEL_OPTION: DialAIEntityModel = {
  id: DEFAULT_AGENT,
  reference: DEFAULT_AGENT,
  name: translate('Default agent'),
  type: EntityType.Model,
  isDefault: true,
};

export const LAST_USED_MODEL_OPTION: DialAIEntityModel = {
  id: LAST_USED_AGENT,
  reference: LAST_USED_AGENT,
  name: translate('Last used agent'),
  type: EntityType.Model,
  isDefault: false,
};

export const SPECIAL_DEFAULT_MODEL_DIC: Record<string, DialAIEntityModel> = {
  [DEFAULT_AGENT]: DEFAULT_MODEL_OPTION,
  [LAST_USED_AGENT]: LAST_USED_MODEL_OPTION,
};
