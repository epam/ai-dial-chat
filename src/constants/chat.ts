import { MouseEvent } from 'react';

import { ShareInterface } from '../types/share';

export const modelCursorSign = '▍';
export const modelCursorSignWithBackquote = '`▍`';

export const stopBubbling = <T>(e: MouseEvent<T>) => {
  e.stopPropagation();
};

export const resetShareEntity: ShareInterface = {
  isPublished: false,
  isShared: false,
  publishedWithMe: false,
  sharedWithMe: false,
  shareUniqueId: undefined,
};
