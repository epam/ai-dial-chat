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
