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
export const TEMPERATURE_TOOLTIP = 'Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.';

export enum ModelId  {
  GPT_4 = "gpt-4",
  GPT_35 = "gpt-35-turbo",
}

export const MODEL_ICON_SIZE = {
  large: {
    [ModelId.GPT_4]: 24,
    [ModelId.GPT_35]: 33.7,
  },
  small: {
    [ModelId.GPT_4]: 18,
    [ModelId.GPT_35]: 25.28,
  }
};

export const MODEL_ICON_SIZE_DEFAULT = {
  large: 25.2,
  small: 18.9
};

export const CONVERSATION_SETTINGS_TITLE = "Conversation settings";
export const CONVERSATION_SETTINGS_SUB_TITLE =
    "Choose and configure model / application you want to interact with";
