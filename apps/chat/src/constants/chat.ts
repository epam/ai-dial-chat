import { MouseEvent } from 'react';

import { ShareInterface } from '../types/share';

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

export const chartType = 'application/vnd.plotly.v1+json';

export const ISOLATED_MODEL_QUERY_PARAM = 'isolated-model-id';

export const TALK_TO_TOOLTIP =
  'Choice of available models and applications you can use. Below is the list of latest models you have interacted with. You may click on “See full list…” for a complete list of available models and applications';
export const SYSTEM_PROMPT_TOOLTIP =
  'Prompt that will always be executed in addition to your written prompts. Used to give more instructions or personality for this conversation, for instance “Act as a senior project manager and answer in a concise way';
