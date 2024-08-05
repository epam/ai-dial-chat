import { MouseEvent } from 'react';

import { translate } from '../utils/app/translation';

import { ShareInterface } from '../types/share';
import { Translation } from '@/src/types/translation';

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

export const TALK_TO_TOOLTIP = 'common.tooltip.talk_to';

export const SYSTEM_PROMPT_TOOLTIP = 'common.tooltip.system_prompt';

export enum ModelId {
  GPT_4 = 'gpt-4',
  GPT_4_turbo = 'gpt-4-turbo-2024-04-09',
  GPT_4_32K = 'gpt-4-32k',
  GPT_35 = 'gpt-35-turbo',
  GPT_4_vision = 'gpt-4-vision',
  GPT_4o = 'gpt-4o',
  DALL = 'dall-e-3',
  HR_BUDDY = 'hr-buddy',
  RAG = 'rag',
}

export const MODEL_ICON_SIZE = {
  large: {
    [ModelId.GPT_4]: 24,
    [ModelId.GPT_4_turbo]: 24,
    [ModelId.GPT_4_32K]: 24,
    [ModelId.GPT_4o]: 24,
    [ModelId.GPT_35]: 33.7,
    [ModelId.GPT_4_vision]: 33.5,
    [ModelId.DALL]: 27,
    [ModelId.HR_BUDDY]: 30,
    [ModelId.RAG]: 30,
  },
  small: {
    [ModelId.GPT_4]: 18,
    [ModelId.GPT_4_turbo]: 18,
    [ModelId.GPT_4_32K]: 18,
    [ModelId.GPT_4o]: 18,
    [ModelId.GPT_35]: 25.28,
    [ModelId.GPT_4_vision]: 25.13,
    [ModelId.DALL]: 20.25,
    [ModelId.HR_BUDDY]: 25,
    [ModelId.RAG]: 22.5,
  },
};

export const MODEL_ICON_SIZE_DEFAULT = {
  large: 30,
  small: 22.5,
};

export const HEADER_TITLE_TEXT = 'PR GPT';

export const CHINA_TIME_ZONE_OFFSET = 8;
export const NUMBER_OF_POPULAR_PROMPTS_TO_DISPLAY = 4;

export const APPLICATIONS_DISPLAYING_ORDER: Record<string, string> = {
  [ModelId.HR_BUDDY]: '0',
  [ModelId.RAG]: '1',
};

export enum HR_BUDDY_PERSONAS {
  Employee = 'Employee',
  Manager = 'Manager',
  HR = 'HR',
}

export const HR_BUDDY_PERSONAS_DISPLAYING_ORDER: Record<string, number> = {
  [HR_BUDDY_PERSONAS.Employee]: 0,
  [HR_BUDDY_PERSONAS.Manager]: 1,
  [HR_BUDDY_PERSONAS.HR]: 2,
};
