import { MouseEvent } from 'react';

import { ShareInterface } from '@epam/ai-dial-shared';

export const modelCursorSign = '▍';
export const modelCursorSignWithBackquote = '`▍`';
export const RECENT_MODELS_COUNT = 5;

export const stopBubbling = <T>(e: MouseEvent<T>) => {
  e.stopPropagation();
};

export const resetShareEntity: ShareInterface = {
  isPublished: false,
  isShared: false,
  publishedWithMe: false,
  sharedWithMe: false,
};

export const PLOTLY_CONTENT_TYPE = 'application/vnd.plotly.v1+json';

export const ISOLATED_MODEL_QUERY_PARAM = 'isolated-model-id';

export const DEFAULT_CUSTOM_ATTACHMENT_WIDTH = 150;
export const DEFAULT_CUSTOM_ATTACHMENT_HEIGHT = 150;

export const MIN_TWO_CAL_CHAT_SETTINGS_WIDTH = 510;
export const CENTRAL_CHAT_MIN_WIDTH = 800;

export const REPLAY_AS_IS_MODEL = 'REPLAY_AS_IS_MODEL';
