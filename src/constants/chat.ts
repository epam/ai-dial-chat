import { MouseEvent } from 'react';

export const modelCursorSign = '▍';
export const modelCursorSignWithBackquote = '`▍`';

export const stopBubbling = <T>(e: MouseEvent<T>) => {
  e.stopPropagation();
};
